/**
 * SaaS Routes - Organization, Team, Billing Management
 * Include this in server.js: app.use('/api', require('./saas-routes'))
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { body, param, validationResult } = require('express-validator');
const mongoose = require('mongoose');

const {
  Organization,
  TeamMember,
  User,
  SubscriptionPlan,
  Invoice,
  Reward,
  ViewerPoints
} = require('./models');

const {
  authenticateToken,
  loadOrganization,
  requireOrganizationAccess,
  requirePermissions,
  checkQuota,
  recordUsage,
  requireActiveSubscription
} = require('./middleware');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Helper validazione
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

// Helper per generare slug unico
const generateSlug = async (baseName) => {
  let slug = baseName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 50);
  let count = 0;
  let uniqueSlug = slug;

  while (await Organization.findOne({ slug: uniqueSlug })) {
    uniqueSlug = `${slug}-${++count}`;
  }

  return uniqueSlug;
};

// ==================== CREATE ORGANIZATION ====================
/**
 * POST /api/organizations
 * Crea una nuova organizzazione (auto-join owner)
 */
router.post('/organizations', authenticateToken, [
  body('name').trim().isLength({ min: 2, max: 100 }),
  body('description').optional().trim().isLength({ max: 500 })
], validate, async (req, res) => {
  try {
    const { name, description } = req.body;

    // Crea org
    const slug = await generateSlug(name);
    const org = new Organization({
      name,
      description,
      slug,
      owner: req.user.id,
      subscription: { plan: 'free' }
    });
    await org.save();

    // Auto-add owner come team member
    const teamMember = new TeamMember({
      organization: org._id,
      user: req.user.id,
      role: 'owner',
      permissions: {
        canManageRewards: true,
        canManageTeam: true,
        canViewAnalytics: true,
        canManageBilling: true
      },
      joinedAt: new Date()
    });
    await teamMember.save();

    // Update user's primary organization
    await User.findByIdAndUpdate(req.user.id, { primaryOrganization: org._id });

    // Inizializza default subscription plans se non esistono
    if ((await SubscriptionPlan.countDocuments()) === 0) {
      await SubscriptionPlan.insertMany([
        {
          name: 'Free',
          slug: 'free',
          displayName: 'Free Forever',
          description: 'Per streamer in partenza',
          priceMonthly: 0,
          quotas: {
            maxRewards: 5,
            maxTeamMembers: 1,
            maxApiCallsPerMonth: 1000,
            maxWebhooksPerMonth: 100,
            customBranding: false,
            advancedAnalytics: false,
            prioritySupport: false,
            whiteLabel: false,
            webhookIntegrations: false
          },
          order: 1
        },
        {
          name: 'Pro',
          slug: 'pro',
          displayName: 'Pro',
          description: 'Per streamer professionisti',
          priceMonthly: 9.99,
          priceYearly: 99,
          stripePriceIdMonthly: 'price_pro_monthly',
          stripePriceIdYearly: 'price_pro_yearly',
          quotas: {
            maxRewards: 25,
            maxTeamMembers: 5,
            maxApiCallsPerMonth: 50000,
            maxWebhooksPerMonth: 5000,
            customBranding: true,
            advancedAnalytics: true,
            prioritySupport: false,
            whiteLabel: false,
            webhookIntegrations: true
          },
          order: 2
        },
        {
          name: 'Business',
          slug: 'business',
          displayName: 'Business',
          description: 'Per team di streaming professionali',
          priceMonthly: 39.99,
          priceYearly: 399,
          stripePriceIdMonthly: 'price_business_monthly',
          stripePriceIdYearly: 'price_business_yearly',
          quotas: {
            maxRewards: 100,
            maxTeamMembers: 30,
            maxApiCallsPerMonth: 500000,
            maxWebhooksPerMonth: 50000,
            customBranding: true,
            advancedAnalytics: true,
            prioritySupport: true,
            whiteLabel: true,
            webhookIntegrations: true
          },
          order: 3
        },
        {
          name: 'Enterprise',
          slug: 'enterprise',
          displayName: 'Enterprise',
          description: 'Performance, integrazione e supporto custom',
          priceMonthly: 0, // Custom
          quotas: {
            maxRewards: 999999,
            maxTeamMembers: 999999,
            maxApiCallsPerMonth: 999999999,
            maxWebhooksPerMonth: 999999999,
            customBranding: true,
            advancedAnalytics: true,
            prioritySupport: true,
            whiteLabel: true,
            webhookIntegrations: true
          },
          order: 4
        }
      ]);
    }

    res.status(201).json({
      success: true,
      organization: {
        id: org._id,
        name: org.name,
        slug: org.slug,
        plan: org.subscription.plan
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== GET USER ORGANIZATIONS ====================
/**
 * GET /api/organizations
 * Lista tutte le organizzazioni dell'utente
 */
router.get('/organizations', authenticateToken, async (req, res) => {
  try {
    const memberships = await TeamMember.find({
      user: req.user.id,
      deletedAt: null
    }).populate('organization');

    const orgs = memberships
      .map(m => m.organization)
      .filter(o => o && !o.deletedAt);

    res.json({
      organizations: orgs.map(o => ({
        id: o._id,
        name: o.name,
        slug: o.slug,
        plan: o.subscription.plan
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== GET ORGANIZATION DETAIL ====================
/**
 * GET /api/organizations/:slug
 * Dettagli organizzazione + usage stats (richiede accesso)
 */
router.get('/organizations/:slug',
  authenticateToken,
  loadOrganization,
  requireOrganizationAccess(),
  async (req, res) => {
    try {
      const plan = await SubscriptionPlan.findOne({ slug: req.organization.subscription.plan });
      const members = await TeamMember.find({
        organization: req.organization._id,
        deletedAt: null
      });

      res.json({
        id: req.organization._id,
        name: req.organization.name,
        slug: req.organization.slug,
        description: req.organization.description,
        subscription: {
          plan: req.organization.subscription.plan,
          status: req.organization.subscription.status,
          renewalDate: req.organization.subscription.renewalDate
        },
        usage: req.organization.usage,
        quotas: plan?.quotas || {},
        teamMembers: members.length,
        createdAt: req.organization.createdAt
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

// ==================== UPDATE ORGANIZATION ====================
/**
 * PATCH /api/organizations/:slug
 * Modifica dati organizzazione (nome, logo, etc)
 */
router.patch('/organizations/:slug',
  authenticateToken,
  loadOrganization,
  requireOrganizationAccess(['owner', 'admin']),
  [
    body('name').optional().trim().isLength({ min: 2, max: 100 }),
    body('description').optional().trim().isLength({ max: 500 })
  ],
  validate,
  async (req, res) => {
    try {
      const updateData = {};
      if (req.body.name) updateData.name = req.body.name;
      if (req.body.description) updateData.description = req.body.description;
      if (req.body.logo) updateData.logo = req.body.logo;

      updateData.updatedAt = new Date();

      const updated = await Organization.findByIdAndUpdate(
        req.organization._id,
        updateData,
        { new: true }
      );

      res.json({ success: true, organization: updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

// ==================== TEAM MEMBERS ====================
/**
 * GET /api/organizations/:slug/team
 * Lista team members
 */
router.get('/organizations/:slug/team',
  authenticateToken,
  loadOrganization,
  requireOrganizationAccess(),
  async (req, res) => {
    try {
      const members = await TeamMember.find({
        organization: req.organization._id,
        deletedAt: null
      }).populate('user', 'kickUsername kickDisplayName kickAvatarUrl email');

      res.json({
        members: members.map(m => ({
          id: m._id,
          user: {
            id: m.user._id,
            username: m.user.kickUsername,
            displayName: m.user.kickDisplayName,
            avatar: m.user.kickAvatarUrl
          },
          role: m.role,
          permissions: m.permissions,
          joinedAt: m.joinedAt
        }))
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

/**
 * POST /api/organizations/:slug/team/invite
 * Invita un utente al team (via email o username)
 */
router.post('/organizations/:slug/team/invite',
  authenticateToken,
  loadOrganization,
  requireOrganizationAccess(['owner', 'admin']),
  [
    body('email').optional().isEmail(),
    body('kickUsername').optional().trim().isLength({ min: 1 }),
    body('role').isIn(['admin', 'editor', 'viewer']),
  ],
  validate,
  requireQuota = checkQuota('maxTeamMembers', 'team_member_added'),
  async (req, res) => {
    try {
      const { email, kickUsername, role } = req.body;

      // Find user by email o kickUsername
      let targetUser = null;
      if (email) {
        targetUser = await User.findOne({ email });
      } else if (kickUsername) {
        targetUser = await User.findOne({ kickUsername: { $regex: `^${kickUsername}$`, $options: 'i' } });
      }

      if (!targetUser) {
        return res.status(404).json({ error: 'Utente non trovato' });
      }

      // Check if already member
      const existing = await TeamMember.findOne({
        organization: req.organization._id,
        user: targetUser._id,
        deletedAt: null
      });

      if (existing) {
        return res.status(400).json({ error: 'Utente già membro del team' });
      }

      // Create team member
      const teamMember = new TeamMember({
        organization: req.organization._id,
        user: targetUser._id,
        role,
        permissions: {
          canManageRewards: ['admin', 'editor'].includes(role),
          canManageTeam: role === 'admin',
          canViewAnalytics: true,
          canManageBilling: role === 'admin'
        },
        joinedAt: new Date()
      });
      await teamMember.save();

      // TODO: Invia email di invito

      res.status(201).json({
        success: true,
        member: {
          id: teamMember._id,
          user: targetUser.kickUsername,
          role: teamMember.role,
          joinedAt: teamMember.joinedAt
        }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

/**
 * PATCH /api/organizations/:slug/team/:memberId
 * Modifica ruolo team member
 */
router.patch('/organizations/:slug/team/:memberId',
  authenticateToken,
  loadOrganization,
  requireOrganizationAccess(['owner', 'admin']),
  [body('role').isIn(['admin', 'editor', 'viewer']).optional()],
  validate,
  async (req, res) => {
    try {
      const { role } = req.body;

      const member = await TeamMember.findOne({
        _id: req.params.memberId,
        organization: req.organization._id,
        deletedAt: null
      });

      if (!member) {
        return res.status(404).json({ error: 'Team member non trovato' });
      }

      // Non puoi modificare l'owner
      if (member.role === 'owner') {
        return res.status(403).json({ error: 'Non puoi modificare il ruolo owner' });
      }

      if (role) {
        member.role = role;
        member.permissions = {
          canManageRewards: ['admin', 'editor'].includes(role),
          canManageTeam: role === 'admin',
          canViewAnalytics: true,
          canManageBilling: role === 'admin'
        };
      }

      await member.save();

      res.json({ success: true, member });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

/**
 * DELETE /api/organizations/:slug/team/:memberId
 * Rimuovi membro dal team (soft delete)
 */
router.delete('/organizations/:slug/team/:memberId',
  authenticateToken,
  loadOrganization,
  requireOrganizationAccess(['owner', 'admin']),
  async (req, res) => {
    try {
      const member = await TeamMember.findOne({
        _id: req.params.memberId,
        organization: req.organization._id,
        deletedAt: null
      });

      if (!member) {
        return res.status(404).json({ error: 'Team member non trovato' });
      }

      if (member.role === 'owner') {
        return res.status(403).json({ error: 'Non puoi rimuovere l\'owner' });
      }

      member.deletedAt = new Date();
      await member.save();

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

// ==================== BILLING - STRIPE INTEGRATION ====================
/**
 * GET /api/organizations/:slug/billing
 * Dettagli billing subscription
 */
router.get('/organizations/:slug/billing',
  authenticateToken,
  loadOrganization,
  requireOrganizationAccess(['owner', 'admin'], 'canManageBilling'),
  async (req, res) => {
    try {
      const plan = await SubscriptionPlan.findOne({ slug: req.organization.subscription.plan });

      res.json({
        currentPlan: {
          name: plan?.displayName,
          slug: req.organization.subscription.plan,
          price: plan?.priceMonthly,
          quotas: plan?.quotas
        },
        subscription: {
          status: req.organization.subscription.status,
          renewalDate: req.organization.subscription.renewalDate,
          stripeCustomerId: req.organization.subscription.stripeCustomerId
        },
        availablePlans: await SubscriptionPlan.find({ active: true }).sort({ order: 1 })
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

/**
 * POST /api/organizations/:slug/billing/upgrade
 * Crea Stripe checkout session per upgrade plan
 */
router.post('/organizations/:slug/billing/upgrade',
  authenticateToken,
  loadOrganization,
  requireOrganizationAccess(['owner', 'admin']),
  [body('planSlug').isIn(['free', 'pro', 'business', 'enterprise'])],
  validate,
  async (req, res) => {
    try {
      const { planSlug } = req.body;

      // Se upgrade a free, skip Stripe
      if (planSlug === 'free') {
        req.organization.subscription.plan = 'free';
        req.organization.subscription.status = 'active';
        req.organization.subscription.stripeSubscriptionId = null;
        // TODO: Cancel existing Stripe subscription
        await req.organization.save();

        return res.json({ success: true, message: 'Piano cambiato a Free' });
      }

      // Carica plan target
      const targetPlan = await SubscriptionPlan.findOne({ slug: planSlug });
      if (!targetPlan) {
        return res.status(404).json({ error: 'Piano non trovato' });
      }

      // Crea customer Stripe se non esiste
      let customerId = req.organization.subscription.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          metadata: {
            organizationId: req.organization._id.toString(),
            organizationSlug: req.organization.slug
          }
        });
        customerId = customer.id;
        req.organization.subscription.stripeCustomerId = customerId;
      }

      // Crea checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{
          price: targetPlan.stripePriceIdMonthly || 'price_' + targetPlan.slug,
          quantity: 1
        }],
        success_url: `${process.env.FRONTEND_URL}?billing=success&org=${req.organization.slug}`,
        cancel_url: `${process.env.FRONTEND_URL}?billing=cancelled&org=${req.organization.slug}`,
        metadata: {
          organizationId: req.organization._id.toString(),
          planSlug: planSlug
        }
      });

      res.json({
        sessionUrl: session.url,
        sessionId: session.id
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

/**
 * POST /api/organizations/:slug/billing/cancel
 * Cancella subscription (torna a free)
 */
router.post('/organizations/:slug/billing/cancel',
  authenticateToken,
  loadOrganization,
  requireOrganizationAccess(['owner']),
  async (req, res) => {
    try {
      const { subscriptionId } = req.organization.subscription;

      if (subscriptionId) {
        await stripe.subscriptions.cancel(subscriptionId);
      }

      req.organization.subscription.plan = 'free';
      req.organization.subscription.status = 'cancelled';
      req.organization.subscription.cancelledAt = new Date();
      req.organization.subscription.stripeSubscriptionId = null;
      await req.organization.save();

      res.json({ success: true, message: 'Subscription cancellata' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

// ==================== REWARDS (updated for multi-tenant) ====================
/**
 * GET /api/organizations/:slug/rewards
 * Lista rewards per organizzazione
 */
router.get('/organizations/:slug/rewards',
  authenticateToken,
  loadOrganization,
  requireOrganizationAccess(),
  async (req, res) => {
    try {
      const rewards = await Reward.find({
        organization: req.organization._id
      }).sort({ createdAt: -1 });

      res.json(rewards);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

/**
 * POST /api/organizations/:slug/rewards
 * Crea reward (con quota check)
 */
router.post('/organizations/:slug/rewards',
  authenticateToken,
  loadOrganization,
  requireOrganizationAccess(),
  requireActiveSubscription,
  checkQuota('maxRewards', 'reward_created'),
  [
    body('name').trim().isLength({ min: 1, max: 100 }),
    body('points').isInt({ min: 0, max: 1000000 }),
    body('description').optional().trim().isLength({ max: 500 })
  ],
  validate,
  recordUsage,
  async (req, res) => {
    try {
      const reward = new Reward({
        organization: req.organization._id,
        ...req.body,
        createdBy: req.user.id
      });
      await reward.save();

      res.status(201).json(reward);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

// ==================== EXPORTS ====================
module.exports = router;
