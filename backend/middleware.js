/**
 * MIDDLEWARE - Multi-tenant SaaS
 * Authentication, organization context, role-based access, quota enforcement
 */

const jwt = require('jsonwebtoken');
const { User, Organization, TeamMember, SubscriptionPlan, UsageRecord } = require('./models');

// ==================== AUTHENTICATION ====================
/**
 * Enhanced JWT middleware with organization context
 * Sets req.user and req.organization
 */
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token mancante', code: 'MISSING_TOKEN' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_change_me');
    req.user = decoded;

    // Carica user dal DB se disponibile
    if (req.user.id && process.env.MONGODB_URI) {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(401).json({ error: 'Utente non trovato', code: 'USER_NOT_FOUND' });
      }
      req.userObject = user;
    }

    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token non valido o scaduto', code: 'INVALID_TOKEN' });
  }
};

// ==================== ORGANIZATION CONTEXT ====================
/**
 * Carica l'organizzazione dal query param o header
 * Obbligatorio per endpoint SaaS
 * ?organization=slug oppure X-Organization: slug
 */
const loadOrganization = async (req, res, next) => {
  const orgSlug = req.query.organization || req.headers['x-organization'] || req.body.organization;

  if (!orgSlug) {
    return res.status(400).json({ error: 'Organization mancante', code: 'MISSING_ORGANIZATION' });
  }

  try {
    const org = await Organization.findOne({ slug: orgSlug, deletedAt: null });

    if (!org) {
      return res.status(404).json({ error: 'Organizzazione non trovata', code: 'ORG_NOT_FOUND' });
    }

    req.organization = org;
    next();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ==================== ACCESS CONTROL ====================
/**
 * Verifica che l'utente abbia accesso all'organizzazione
 * Opzionalmente verifica ruoli specifici
 */
const requireOrganizationAccess = (allowedRoles = []) => {
  return async (req, res, next) => {
    if (!req.user || !req.organization) {
      return res.status(401).json({ error: 'Non autenticato', code: 'UNAUTHENTICATED' });
    }

    try {
      const member = await TeamMember.findOne({
        organization: req.organization._id,
        user: req.user.id,
        deletedAt: null
      });

      if (!member) {
        return res.status(403).json({ error: 'Accesso negato a questa organizzazione', code: 'NO_ACCESS' });
      }

      // Valida ruoli se specificati
      if (allowedRoles.length > 0 && !allowedRoles.includes(member.role)) {
        return res.status(403).json({ 
          error: `Ruolo richiesto: ${allowedRoles.join(', ')}`, 
          code: 'INSUFFICIENT_ROLE' 
        });
      }

      req.teamMember = member;
      next();
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  };
};

// ==================== PERMISSION CHECK ====================
/**
 * Verifica permessi specifici
 * requirePermissions(['canManageRewards', 'canViewAnalytics'])
 */
const requirePermissions = (requiredPermissions = []) => {
  return async (req, res, next) => {
    if (!req.teamMember) {
      return res.status(401).json({ error: 'No team member context', code: 'NO_MEMBER_CONTEXT' });
    }

    const { role, permissions } = req.teamMember;

    // Owner e admin hanno tutti i permessi
    if (['owner', 'admin'].includes(role)) {
      return next();
    }

    // Check permessi specifici
    const hasAllPermissions = requiredPermissions.every(perm => permissions[perm] === true);

    if (!hasAllPermissions) {
      return res.status(403).json({ 
        error: 'Permessi insufficienti',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: requiredPermissions,
        actual: requiredPermissions.filter(p => permissions[p])
      });
    }

    next();
  };
};

// ==================== QUOTA ENFORCEMENT ====================
/**
 * Verifica limiti quota dell'organizzazione
 * Usage check prima di operazioni
 * requireQuota('maxRewards', 'rewards')
 */
const checkQuota = (quotaKey, usageType) => {
  return async (req, res, next) => {
    if (!req.organization) {
      return res.status(400).json({ error: 'Organization context required' });
    }

    try {
      // Carica il plan dell'organizzazione
      const plan = await SubscriptionPlan.findOne({ slug: req.organization.subscription.plan });
      if (!plan) {
        return res.status(500).json({ error: 'Piano non trovato', code: 'PLAN_NOT_FOUND' });
      }

      const limit = plan.quotas[quotaKey];
      let currentUsage = req.organization.usage[quotaKey.replace('max', '').toLowerCase()] || 0;

      // Se è un limite mensile (api calls, webhooks), conta usage nel mese
      if (['maxApiCallsPerMonth', 'maxWebhooksPerMonth'].includes(quotaKey)) {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Conta dal DB
        const monthlyUsage = await UsageRecord.countDocuments({
          organization: req.organization._id,
          type: usageType,
          createdAt: { $gte: monthStart }
        });

        currentUsage = monthlyUsage;
      }

      if (currentUsage >= limit) {
        return res.status(429).json({ 
          error: `Quota raggiunta per ${quotaKey}`,
          code: 'QUOTA_EXCEEDED',
          limit,
          current: currentUsage,
          plan: req.organization.subscription.plan
        });
      }

      // Passa quota info a next middleware
      req.quota = { quotaKey, usageType, limit, current: currentUsage };
      next();
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  };
};

/**
 * Track usage dopo operazione riuscita
 * Deve essere dopo checkQuota per popolare req.quota
 */
const recordUsage = async (req, res, next) => {
  if (!req.quota || !req.organization) {
    return next();
  }

  try {
    // Track monthly limits
    if (['maxApiCallsPerMonth', 'maxWebhooksPerMonth'].includes(req.quota.quotaKey)) {
      await UsageRecord.create({
        organization: req.organization._id,
        type: req.quota.usageType,
        metadata: { path: req.path, method: req.method }
      });
    }

    // Update org usage counters
    const updateKey = `usage.${req.quota.usageType}`;
    await Organization.findByIdAndUpdate(req.organization._id, {
      $inc: { [updateKey]: 1 },
      updatedAt: new Date()
    });

    next();
  } catch (err) {
    // Non blockante - log ma continua
    console.error('Usage recording error:', err.message);
    next();
  }
};

// ==================== SUBSCRIPTION STATUS CHECK ====================
/**
 * Verifica che la subscription sia attiva
 * Precede operation-specific middleware
 */
const requireActiveSubscription = async (req, res, next) => {
  if (!req.organization) {
    return res.status(400).json({ error: 'Organization context required' });
  }

  const { subscription } = req.organization;

  // Free plan è sempre "active"
  if (subscription.plan === 'free') {
    return next();
  }

  // Paid plans richiedono status active
  if (subscription.status !== 'active') {
    return res.status(402).json({ 
      error: 'Subscription scaduta o in arrears',
      code: 'SUBSCRIPTION_INACTIVE',
      status: subscription.status,
      renewalDate: subscription.renewalDate
    });
  }

  next();
};

// ==================== STRIPE WEBHOOK VERIFICATION ====================
/**
 * Verifica firma Stripe webhook
 */
const verifyStripeWebhook = (req, res, next) => {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers['stripe-signature'];

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    req.stripeEvent = event;
    next();
  } catch (err) {
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }
};

// ==================== RATE LIMITING PER ORGANIZATION ====================
/**
 * Rate limiting basato su plan
 * Free: 100 req/min, Pro: 1000 req/min, Business/Enterprise: unlimited
 */
const getOrgRateLimit = (organization) => {
  switch (organization?.subscription?.plan) {
    case 'pro': return { windowMs: 60 * 1000, max: 1000 };
    case 'business':
    case 'enterprise': return { windowMs: 60 * 1000, max: 10000 };
    default: return { windowMs: 60 * 1000, max: 100 };
  }
};

// ==================== EXPORTS ====================
module.exports = {
  authenticateToken,
  loadOrganization,
  requireOrganizationAccess,
  requirePermissions,
  checkQuota,
  recordUsage,
  requireActiveSubscription,
  verifyStripeWebhook,
  getOrgRateLimit
};
