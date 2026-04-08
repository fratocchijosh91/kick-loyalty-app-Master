# Multi-Tenant SaaS Architecture - Kick Loyalty System

## 📋 Overview

Implementazione completa di un sistema SaaS multi-tenant production-ready per la gestione di loyalty e rewards su Kick.

### Struttura Progetto

```
backend/
├── server.js              # Main app (v8 - integrato con multi-tenant)
├── models.js              # Schemas Mongoose (NEW - multi-tenant)
├── middleware.js          # Auth & authorization (NEW)
├── saas-routes.js         # SaaS API routes (NEW)
├── package.json
└── ...
```

---

## 🗂️ Database Schema

### Organization
Container per ogni team/account. Isolamento dati basato su organization ID.
```
{
  _id: ObjectId
  name: String              # Nome della società
  slug: String              # URL-safe, unique
  subscription: {
    plan: 'free|pro|business|enterprise'
    status: 'active|cancelled|past_due'
    stripeCustomerId: String
    stripeSubscriptionId: String
    renewalDate: Date
  }
  usage: {                  # Tracked per enforcement quota
    rewards: Number
    teamMembers: Number
    apiCalls: Number
    webhookEvents: Number
  }
  owner: ObjectId           # Reference a User
  createdAt: Date
}
```

### TeamMember
Controllo accesso per utente per organizzazione.
```
{
  organization: ObjectId
  user: ObjectId
  role: 'owner|admin|editor|viewer'
  permissions: {
    canManageRewards: Boolean
    canManageTeam: Boolean
    canViewAnalytics: Boolean
    canManageBilling: Boolean
  }
  joinedAt: Date
}
```

### SubscriptionPlan
Template di piani con quotas predefiniti.
```
{
  slug: 'free|pro|business|enterprise'
  displayName: String
  priceMonthly: Number
  priceYearly: Number
  stripePriceIdMonthly: String
  stripePriceIdYearly: String
  quotas: {
    maxRewards: Number
    maxTeamMembers: Number
    maxApiCallsPerMonth: Number
    maxWebhooksPerMonth: Number
    customBranding: Boolean
    advancedAnalytics: Boolean
    prioritySupport: Boolean
    whiteLabel: Boolean
    webhookIntegrations: Boolean
  }
}
```

### UsageRecord
Tracking granulare per quota enforcement mensile.
```
{
  organization: ObjectId
  type: 'api_call|webhook_event|reward_created|team_member_added'
  metadata: {}
  createdAt: Date           # TTL: 30 giorni
}
```

---

## 🔐 Autenticazione & Autorizzazione

### Middleware Chain
```
authenticateToken 
→ loadOrganization (opzionale, per routes SaaS)
→ requireOrganizationAccess (verifica accesso org)
→ requirePermissions (verifica permessi specifici)
```

### Esempio: Creare Reward
```javascript
router.post('/organizations/:slug/rewards',
  authenticateToken,        // JWT token
  loadOrganization,         // Carica org da slug
  requireOrganizationAccess(),  // User è membro?
  requireActiveSubscription, // Plan attivo?
  checkQuota('maxRewards'),  // Quota disponibile?
  [...body validations...],
  validate,
  recordUsage,              // Track usage
  async (req, res) => { ... }
);
```

---

## 📡 API Endpoints

### Authentication
```
GET  /api/auth/kick/url           - Genera OAuth Kick URL
POST /api/auth/kick/callback      - OAuth callback
POST /api/auth/login              - Login fallback
```

### Organizations
```
POST   /api/organizations         - Crea nuova org
GET    /api/organizations         - List user's orgs
GET    /api/organizations/:slug   - Dettagli org
PATCH  /api/organizations/:slug   - Modifica org
```

### Team Management
```
GET    /api/organizations/:slug/team           - List members
POST   /api/organizations/:slug/team/invite    - Invita membro
PATCH  /api/organizations/:slug/team/:memberId - Modifica ruolo
DELETE /api/organizations/:slug/team/:memberId - Rimuovi membro
```

### Billing
```
GET    /api/organizations/:slug/billing              - Dettagli billing
POST   /api/organizations/:slug/billing/upgrade      - Crea checkout session
POST   /api/organizations/:slug/billing/cancel       - Cancella subscription
POST   /api/stripe/webhook                          - Stripe webhook (existenti)
```

### Rewards (Updated)
```
GET    /api/organizations/:slug/rewards      - List rewards
POST   /api/organizations/:slug/rewards      - Crea reward (con quota check)
PUT    /api/rewards/:id                      - Update reward (legacy)
DELETE /api/rewards/:id                      - Delete reward (legacy)
POST   /api/rewards/:id/redeem               - Redeem reward (legacy)
```

---

## 💰 Pricing Tiers

| Plan | Price | Rewards | Team Members | Monthly API Calls | Features |
|------|-------|---------|--------------|------------------|----------|
| Free | $0 | 5 | 1 | 1,000 | Basic rewards |
| Pro | $9.99/mo | 25 | 5 | 50,000 | Custom branding, Advanced analytics |
| Business | $39.99/mo | 100 | 30 | 500,000 | White-label, Priority support, Webhooks |
| Enterprise | Custom | ∞ | ∞ | ∞ | Everything + custom integrations |

---

## 🚀 Setup & Deployment

### 1. Environment Variables
```bash
# .env
MONGODB_URI=mongodb+srv://user:pwd@...
JWT_SECRET=secure_random_string
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
KICK_CLIENT_ID=your_client_id
KICK_CLIENT_SECRET=your_secret
FRONTEND_URL=https://yourdomain.com
```

### 2. Initialize Database
```javascript
// Al primo avvio, gli schema vengono creati automaticamente
// I SubscriptionPlans vengono seeded la prima volta
// che qualcuno crea un'organizzazione
```

### 3. Test Multi-Tenant Flow
```bash
# 1. Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "test_streamer"}'

# Response: { token: "...", user: {...} }

# 2. Crea organizzazione
curl -X POST http://localhost:5000/api/organizations \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Team", "description": "..."}'

# Response: { organization: { id: "...", slug: "my-team" } }

# 3. Query con organization context
curl -X GET "http://localhost:5000/api/organizations/my-team/rewards?organization=my-team" \
  -H "Authorization: Bearer TOKEN"
```

---

## 🔒 Security Features

✅ JWT-based authentication  
✅ Organization-level data isolation  
✅ Role-based access control (RBAC)  
✅ Permission verification  
✅ Rate limiting per plan  
✅ Quota enforcement   
✅ Stripe webhook signature verification  
✅ Soft-delete (no data loss)  
✅ Request validation (express-validator)  
✅ CORS configured  

---

## 📊 Quota Enforcement

### Monthly Limits
- Tracked via `UsageRecord` con TTL 30 giorni
- Resetato automaticamente a inizio mese
- Contati via aggregation pipeline

### Hard Limits
- Created rewards: controlla vs `maxRewards`
- Team members: controlla vs `maxTeamMembers`
- API calls/month: contati via UsageRecord

### Enforcement
```javascript
// Prima dell'operazione
if (currentUsage >= limit) {
  return 429 QUOTA_EXCEEDED
}

// Dopo successo
await UsageRecord.create({ ... })
await Organization.findByIdAndUpdate({ $inc: { usage.X: 1 } })
```

---

## 🔄 Stripe Integration

### Workflow
1. User clicks "Upgrade to Pro"
2. API crea Stripe checkout session
3. Customer completes payment → Stripe webhook
4. Webhook aggiorna `organization.subscription`
5. Accesso a features Pro abilitato

### Webhook Events
```javascript
customer.subscription.created      // New subscription
customer.subscription.updated      // Plan changed
customer.subscription.deleted      // Cancelled
invoice.paid                       // Payment successful
invoice.payment_failed             // Payment failed
```

---

## 📈 Monitoring & Analytics

### Usage Tracking
- Ogni operazione quota-sensitive registra `UsageRecord`
- Dashboard può aggregare per periodo
- Base per upsell predictor (80% quota usage?)

### Metrics
```javascript
// Per organizzazione
db.usageRecords.aggregate([
  { $match: { organization: orgId, createdAt: { $gte: monthStart } } },
  { $group: { _id: '$type', count: { $sum: 1 } } }
])

// Per correlare con churn/expansion
```

---

## 🐛 Troubleshooting

### "Organization not found"
- Verifica slug nella URL/query param
- Assicurati non sia soft-deleted

### "Quota exceeded"
- Check Organization.usage counters
- Verify SubscriptionPlan quotas
- Check UsageRecord data

### "No access to organization"
- User è membro di org? (TeamMember record)
- membership è soft-deleted? (deletedAt = null)

### Stripe webhook failures
- Verify webhook secret corretta
- Check Stripe dashboard per retry status
- Log in `/api/stripe/webhook` handler

---

## 🎯 Next Steps (Post-MVP)

1. **Email Notifications**
   - Welcome after signup
   - Quota warnings (80%)
   - Invoice delivery

2. **Advanced Analytics**
   - Dashboard per org
   - Usage trends
   - Revenue forecasting

3. **API Keys**
   - Customer-facing API keys
   - Rate limiting per API key
   - Scope-based access

4. **Webhooks**
   - Organization can register webhooks
   - Event delivery with retry
   - Webhook signing

5. **Integrations Marketplace**
   - Third-party apps
   - Commission model (30%)
   - OAuth for apps

6. **Custom Domains**
   - White-label support
   - Dedicated branded dashboard
   - Custom email domain

---

## 📚 Code Examples

### Creare Organizzazione Programmatically
```javascript
const { Organization, TeamMember, User } = require('./models');

async function createOrganizationForUser(userId, name) {
  // Create org
  const org = new Organization({
    name,
    slug: generateSlug(name),
    owner: userId,
    subscription: { plan: 'free' }
  });
  await org.save();

  // Add owner as team member
  const member = new TeamMember({
    organization: org._id,
    user: userId,
    role: 'owner',
    permissions: { canManageRewards: true, canManageTeam: true, ... },
    joinedAt: new Date()
  });
  await member.save();

  return org;
}
```

### Verificare Quota
```javascript
async function canCreateReward(organizationId) {
  const org = await Organization.findById(organizationId);
  const plan = await SubscriptionPlan.findOne({ slug: org.subscription.plan });
  
  const rewardsCount = await Reward.countDocuments({ organization: organizationId });
  
  return rewardsCount < plan.quotas.maxRewards;
}
```

---

## 📞 Support

Per domande su this implementation:
- Check `/backend/models.js` per schema details
- Check `/backend/middleware.js` per auth logic
- Check `/backend/saas-routes.js` per API implementation

Safe di estendere e modificare! ✨
