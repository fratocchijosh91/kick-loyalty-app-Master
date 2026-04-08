# 🎮 Kick Loyalty - Production-Ready SaaS Platform

**Status**: ✅ Phase 1 Complete  
**Version**: 2.0.0 (SaaS Multi-Tenant)  
**Date**: April 8, 2026

---

## 📋 Overview

Kick Loyalty è una **piattaforma SaaS multi-tenant** completa per gestire **loyalty programs** e **rewards** per creator/streamer su Kick.

### 🎯 Chi può usarlo?

- 🎮 **Streamer**: Crea card rewards per i viewer
- 💰 **Communities**: Gestisci punti loyalty e redemptions
- 🎁 **Brands**: Sistema white-label per loyalty programs

### ✨ Features

- **Multi-tenant**: Isolamento completo tra organizzazioni
- **RBAC**: 4 ruoli con permessi granulari
- **Billing**: Stripe integration con 4 piani pricing
- **Quota Enforcement**: Limiti per API calls, rewards, team members
- **Real-time**: Socket.io notifications
- **API-First**: OpenAPI documentation + SDK generation ready
- **Analytics**: Dashboard completo con KPI, trends, cohort analysis (Phase 2)
- **Gamification**: Leaderboards + Achievements to drive engagement (Phase 2)
- **2FA Security**: TOTP-based authentication with backup codes & trusted devices (Phase 2)
- **Audit Logs**: Immutable audit trail for compliance & security monitoring (Phase 2)
- **Redemptions**: Full workflow for request → approve → fulfill with admin management (Phase 2)
- **Scalable**: Architettura pronta per ±1M users
- **Email**: Onboarding + notifications automatiche
- **Testing**: Jest + Supertest con 35+ test cases

---

## 📂 Project Structure

```
kick-loyalty-app/
├── 🔧 backend/
│   ├── server.js                    - Express server (v8)
│   ├── models.js                    - 20 MongoDB schemas (+ Achievement, UserAchievement, Leaderboard, TwoFactor, AuditLog, Redemption, SmsNotification, SmsTemplate, SmsSettings)
│   ├── middleware.js                - Auth, RBAC, quota
│   ├── saas-routes.js               - 20+ API endpoints
│   ├── analytics-routes.js          - Analytics endpoints (Phase 2)
│   ├── leaderboard-routes.js        - Leaderboards & achievements (Phase 2)
│   ├── 2fa-routes.js                - Two-Factor Authentication (Phase 2)
│   ├── audit-routes.js              - Audit logging & compliance (Phase 2)
│   ├── redemption-routes.js         - Reward redemptions & fulfillment (Phase 2)
│   ├── sms-routes.js                - SMS notifications (Phase 2.6)
│   ├── services/
│   │   └── email.js                 - Email service (Nodemailer)
│   ├── __tests__/
│   │   └── api.test.js              - Jest + Supertest suite
│   ├── openapi.yaml                 - API documentation
│   ├── jest.config.js               - Jest configuration
│   ├── jest.setup.js                - Test setup (mocks, env)
│   ├── EMAIL_SETUP.md               - Email onboarding guide
│   ├── API_DOCUMENTATION.md         - API usage + examples
│   ├── ANALYTICS.md                 - Analytics features + API (Phase 2)
│   ├── LEADERBOARDS.md              - Leaderboards & achievements API (Phase 2)
│   ├── 2FA.md                       - Two-Factor Authentication guide (Phase 2)
│   ├── AUDIT.md                     - Audit logs & compliance (Phase 2)
│   ├── REDEMPTION.md                - Reward redemptions & fulfillment (Phase 2)
│   ├── TESTING_GUIDE.md             - Full test suite documentation
│   ├── SAAS_IMPLEMENTATION.md       - Architecture deep-dive
│   └── package.json                 - Dependencies + scripts
│
└── 🎨 frontend/
    │   ├── pages/                   - 9 dashboard pages
    │   │   ├── Login.jsx            - OAuth + username login
    │   │   ├── Dashboard.jsx        - Home con stats
    │   │   ├── RewardsPage.jsx      - CRUD rewards UI
    │   │   ├── TeamPage.jsx         - Invite + roles
    │   │   ├── BillingPage.jsx      - Plans + upgrade/cancel
    │   │   ├── AnalyticsPage.jsx    - Advanced analytics dashboard (Phase 2)
    │   │   ├── LeaderboardsPage.jsx - Leaderboards + achievements (Phase 2)
    │   │   ├── AuditPage.jsx        - Audit logs + compliance (Phase 2)
    │   │   ├── RedemptionsPage.jsx  - Reward redemptions & fulfillment (Phase 2)
    │   │   ├── SMSPage.jsx          - SMS notifications management (Phase 2.6)
    │   │   └── SettingsPage.jsx     - Org config + API keys + 2FA setup
    │   ├── components/Layout/        - Sidebar, Navbar, Layout
    │   ├── components/sms/          - SMS notifications components (Phase 2.6)
    │   │   ├── SMSSettingsPanel.jsx - User phone verification + preferences
    │   │   ├── SMSTemplateEditor.jsx - Admin SMS template management
    │   │   ├── SMSNotificationList.jsx - SMS history viewer
    │   │   ├── SMSStatsPanel.jsx    - Admin SMS statistics dashboard
    │   │   └── sms.css              - SMS styling
│   ├── components/TwoFactorSetup.jsx - 2FA setup modal with QR code (Phase 2)
│   ├── components/TwoFactorVerify.jsx - 2FA verification during login (Phase 2)
│   ├── components/TrustedDevices.jsx - Trusted device management (Phase 2)
    │   ├── contexts/                 - Auth + Organization contexts
    │   ├── index.css                 - Tailwind globals
    │   ├── App.jsx                   - Routes + providers
    │   └── main.jsx                  - Vite entry point
    ├── tailwind.config.js            - Tailwind brand colors
    ├── postcss.config.js             - PostCSS pipeline
    └── package.json                  - React + dependencies
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **MongoDB** 5+ ([Download](https://www.mongodb.com/try/download/community) or [Docker](https://hub.docker.com/_/mongo))
- **Stripe Account** ([Sign up](https://stripe.com))
- **Kick API Credentials** ([Portal](https://dev.kick.com/))

### 1. Setup Backend

```bash
# Clone e naviga al backend
cd backend

# Installa dipendenze
npm install

# Crea .env
cat > .env << EOF
# Server
NODE_ENV=development
PORT=5000

# Database
MONGODB_URI=mongodb://localhost:27017/kick-loyalty

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
KICK_API_ID=your_kick_api_id
KICK_API_SECRET=your_kick_api_secret

# Payment
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key

# Email (Gmail example)
EMAIL_PROVIDER=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your_app_specific_password

# Frontend
FRONTEND_URL=http://localhost:5173

# SMS (Phase 2.6)
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
SMS_VERIFICATION_CODE_EXPIRY=600000
SMS_DEFAULT_DAILY_LIMIT=10
SMS_DEFAULT_WEEKLY_LIMIT=50

# AI
GROQ_API_KEY=your_groq_api_key
EOF

# Avvia server
npm start
# O in develop mode con auto-reload:
npm run dev
```

Server pronto su `http://localhost:5000` ✅

### 2. Setup Frontend

```bash
# Naviga al frontend
cd frontend

# Installa dipendenze
npm install

# Crea .env
cat > .env << EOF
VITE_API_URL=http://localhost:5000/api
EOF

# Avvia dev server
npm run dev
```

Frontend pronto su `http://localhost:5173` ✅

### 3. Test API

```bash
# Salute check
curl http://localhost:5000/api/health

# Login (ottieni token)
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "code": "AUTH_CODE_FROM_OAUTH",
    "state": "STATE_FROM_OAUTH"
  }'
```

---

## 📚 Documentation

Consulta questi file dopo il setup:

### Backend Documentation
| File | Focus |
|------|-------|
| [backend/SAAS_IMPLEMENTATION.md](backend/SAAS_IMPLEMENTATION.md) | Multi-tenant architecture, schemas, middleware |
| [backend/API_DOCUMENTATION.md](backend/API_DOCUMENTATION.md) | All endpoints + curl examples + SDK gen |
| [backend/ANALYTICS.md](backend/ANALYTICS.md) | Advanced analytics API + dashboard (Phase 2) |
| [backend/LEADERBOARDS.md](backend/LEADERBOARDS.md) | Leaderboards & achievements API (Phase 2) |
| [backend/2FA.md](backend/2FA.md) | Two-Factor Authentication system (Phase 2) |
| [backend/AUDIT.md](backend/AUDIT.md) | Audit logging for compliance & security (Phase 2) |
| [backend/REDEMPTION.md](backend/REDEMPTION.md) | Reward redemptions & fulfillment (Phase 2) |
| [backend/SMS.md](backend/SMS.md) | SMS notifications system (Phase 2.6) |
| [backend/EMAIL_SETUP.md](backend/EMAIL_SETUP.md) | Email service (Gmail/SendGrid/Mailgun) |
| [backend/TESTING_GUIDE.md](backend/TESTING_GUIDE.md) | Jest test suite + best practices |
| [backend/openapi.yaml](backend/openapi.yaml) | OpenAPI 3.0 spec (Swagger/ReDoc) |

### Frontend
- [frontend/src/App.jsx](frontend/src/App.jsx) - Routes + providers
- [frontend/src/contexts/](frontend/src/contexts/) - Auth + Organization state
- [frontend/src/pages/](frontend/src/pages/) - 9 dashboard pages
- [frontend/tailwind.config.js](frontend/tailwind.config.js) - Brand theming

---

## 🧪 Testing

```bash
cd backend

# Esegui tutti i test
npm test

# Watch mode (riesegui al cambio file)
npm run test:watch

# Coverage report (apri coverage/lcov-report/index.html)
npm run test:coverage
```

**Test Coverage:**
- ✅ 35+ test cases
- ✅ Authentication (login, tokens)
- ✅ Organizations/Team (CRUD + RBAC)
- ✅ Billing/Checkout (Stripe flow)
- ✅ Rewards management (quota enforcement)
- ✅ Points tracking
- ✅ Security (auth, permissions)
- ✅ Input validation

---

## 🌍 API Endpoints

### Base URL
- **Prod**: `https://api.kickloyalty.com/api`
- **Dev**: `http://localhost:5000/api`

### Authentication
```
POST   /auth/login                          - Kick OAuth + JWT
```

### Organizations (Multi-tenant)
```
POST   /organizations                       - Crea org
GET    /organizations                       - Elenca tutte le tue org
GET    /organizations/{slug}                - Dettagli org
PATCH  /organizations/{slug}                - Aggiorna org
```

### Team Management
```
GET    /organizations/{slug}/team           - Elenca team
POST   /organizations/{slug}/team/invite    - Invita membro
PATCH  /organizations/{slug}/team/{id}      - Aggiorna ruolo
DELETE /organizations/{slug}/team/{id}      - Rimuovi membro
```

### Billing & Subscription
```
GET    /organizations/{slug}/billing        - Info billing + plans
POST   /organizations/{slug}/billing/upgrade - Upgrade piano
POST   /organizations/{slug}/billing/cancel  - Cancella subscription
```

### Rewards Management
```
GET    /organizations/{slug}/rewards        - Elenca rewards
POST   /organizations/{slug}/rewards        - Crea reward
PATCH  /organizations/{slug}/rewards/{id}   - Aggiorna reward
DELETE /organizations/{slug}/rewards/{id}   - Elimina reward
```

### Viewer Points
```
GET    /viewer-points/{orgId}/{viewerId}    - Ottieni punti
PATCH  /viewer-points/{orgId}/{viewerId}    - Aggiorna punti
```

### Reward Redemptions (Phase 2.5)
```
POST   /redemptions                         - Viewer requests reward redemption
GET    /redemptions                         - List redemptions (viewer sees own)
GET    /redemptions/{id}                    - Get redemption details
PATCH  /redemptions/{id}/approve            - Admin approves (requires permission)
PATCH  /redemptions/{id}/reject             - Admin rejects (requires permission)
PATCH  /redemptions/{id}/fulfill            - Mark as fulfilled (requires permission)
GET    /redemptions/pending                 - Admin pending queue (requires permission)
GET    /rewards/{rewardId}/redemptions      - All redemptions for reward
GET    /redemptions/stats                   - Redemption statistics (requires permission)
```

### SMS Notifications (Phase 2.6)
```
POST   /sms/settings/verify-phone          - Send phone verification code
POST   /sms/settings/confirm-phone         - Confirm phone verification
GET    /sms/settings                       - Get user SMS settings
POST   /sms/settings                       - Update SMS preferences & rate limits
POST   /sms/send-manual                    - Admin send custom SMS
GET    /sms/notifications                  - List SMS notifications (with filtering)
GET    /sms/templates                      - Admin list SMS templates
POST   /sms/templates                      - Admin create SMS template
PATCH  /sms/templates/{id}                 - Admin update SMS template
DELETE /sms/templates/{id}                 - Admin delete SMS template
GET    /sms/stats                          - Admin SMS statistics & cost tracking
```

📖 **Interactive API Docs**: 
- Swagger UI: http://localhost:5000/api-docs (dopo `npm install swagger-ui-express`)
- OpenAPI Spec: http://localhost:5000/openapi.yaml
- ReDoc: https://redocly.github.io/redoc/?url=http://localhost:5000/openapi.yaml

---

## 💾 Database Schema

9 Mongoose models con isolamento per organizzazione:

```
Organization          - Tenant di business
├─ name, slug, owner
├─ subscription (Stripe customer)
├─ usageQuota
└─ webhookUrl

User                  - Utenti del sistema
├─ username, email
├─ passwordHash (bcrypt)
└─ tokens

TeamMember            - RBAC mapping
├─ userId, organizationId
├─ role (owner/admin/editor/viewer)
└─ joinedAt

SubscriptionPlan      - 4 piani (Free/Pro/Business/Enterprise)
├─ slug, name, price (EUR)
└─ quotas (maxRewards, maxTeamMembers, maxApiCalls, etc.)

Subscription          - Record attivo per org
├─ organizationId, planSlug
├─ stripeCustomerId, stripeSubscriptionId
├─ status (active/canceled)
└─ renewalDate

UsageRecord           - Quota tracking (TTL 30 giorni)
├─ organizationId, month
├─ quotaType (apiCalls, teamMembers, rewards)
└─ count

Reward                - Card rewards (config)
├─ organizationId, name
├─ points, type (emoji/shoutout/badge/custom)
├─ image, description
└─ active (boolean)

ViewerPoints          - Loyalty points per viewer
├─ organizationId, viewerId
├─ points, level
├─ redeemedRewards (array)
└─ lastRedeemDate

Invoice               - Fatture Stripe
├─ organizationId, stripeInvoiceId
├─ amount, currency (EUR)
├─ status, paidAt
└─ dueDate

SmsNotification       - SMS message tracking (Phase 2.6)
├─ organizationId, userId, phoneNumber
├─ type (enum: 9 message types)
├─ status (pending/sent/delivered/failed/bounced)
├─ cost (EUR), segmentCount
└─ provider (twilio/aws-sns/nexmo)

SmsTemplate           - Reusable SMS templates (Phase 2.6)
├─ organizationId, name, type
├─ messageTemplate (with {{variable}} support)
├─ active (boolean)
├─ autoSend, sendDelay
└─ usageCount, lastUsedAt

SmsSettings           - User SMS preferences (Phase 2.6)
├─ organizationId, userId
├─ phoneNumber (E.164 format)
├─ isPhoneVerified, phoneVerifiedAt
├─ smsEnabled, notificationPreferences
├─ dailyLimit (1-100), weeklyLimit (1-500)
└─ smsProvider, rate limiting counters
```

---

## 🔐 Security Features

✅ **Authentication**
- JWT tokens con 7-day expiry
- OAuth 2.0 PKCE per Kick
- Password hashing con bcrypt

✅ **Authorization**
- RBAC con 4 ruoli (owner/admin/editor/viewer)
- Granular permissions per endpoint
- Multi-tenant data isolation (DB level)

✅ **API Security**
- Rate limiting per piano pricing
- HMAC signing per webhooks
- CORS configuration
- Input validation + sanitization
- Helmet.js security headers

✅ **Data Protection**
- Database encryption (optional)
- HTTPS only in production
- No sensitive data in logs
- Automatic token expiry

---

## 📧 Email System

Invia notifiche automatiche per:
- ✅ **Welcome**: Nuovo utente
- ✅ **Team Invite**: Nuovo membro invitato
- ✅ **Quota Alert**: Utilizzo 80% raggiunto
- ✅ **Invoice**: Pagamento ricevuto (Stripe)
- ✅ **Password Reset**: Link reset password

**Provider supportati:**
- Gmail (test/development)
- SendGrid (production recommended)
- Mailgun (alternative)

Setup: Leggi [backend/EMAIL_SETUP.md](backend/EMAIL_SETUP.md)

---

## 💰 Pricing Tiers

| Plan | Prezzo | Rewards | Team | API/mese | Webhooks | Analytics | Support |
|------|--------|---------|------|----------|----------|-----------|---------|
| **Free** | €0 | 5 | 3 | 1K | ✗ | Base | Community |
| **Pro** | €29 | 50 | 10 | 10K | ✓ | Avanzate | Email |
| **Business** | €79 | 500 | 50 | 100K | ✓ | Avanzate | Priority |
| **Enterprise** | Custom | ∞ | ∞ | ∞ | ✓ | Avanzate | 24/7 |

Upgrade via Stripe checkout session.

---

## 🚢 Deployment

### Frontend (Vercel - Recommended)

```bash
# Auto-deploy da GitHub
git push origin main
# https://your-app.vercel.app
```

Oppure build manuale:

```bash
cd frontend
npm run build  # Output in `dist/`
# Deploy su CDN (Cloudflare, AWS CloudFront, Netlify)
```

### Backend (Railway/Render/Heroku)

```bash
# Railway (recommended)
railway init
railway add
railway up

# Oppure Render/Heroku/DigitalOcean
```

**Environment variables required:**
- `MONGODB_URI` (MongoDB Atlas)
- `JWT_SECRET` (strong random key)
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`
- `KICK_API_ID`, `KICK_API_SECRET`
- `EMAIL_PROVIDER`, `EMAIL_USER`, `EMAIL_PASSWORD` (or `SENDGRID_API_KEY`)
- `FRONTEND_URL` (production domain)

### Database

MongoDB Atlas (Cloud - FREE tier available):
```
mongodb+srv://user:pass@cluster.mongodb.net/kick-loyalty
```

---

## 📊 Monitoring & Observability

### Health Check
```bash
curl http://localhost:5000/api/health
# {"status":"ok","message":"Server is running!"}
```

### Error Tracking (Optional)
Integra con **Sentry**:
```javascript
const Sentry = require("@sentry/node");
Sentry.init({ dsn: process.env.SENTRY_DSN });
```

### Metrics (Optional)
Prometheus + Grafana con `prom-client`

### Logs
- Console logs in development
- Winston/Morgan per structured logging in production

---

## 🎁 Features Roadmap

### ✅ Phase 1 (Complete)
- [x] Multi-tenant backend architecture
- [x] SaaS billing system (Stripe)
- [x] Full-featured dashboard (React)
- [x] Email onboarding
- [x] OpenAPI documentation
- [x] Jest test suite

### ⏳ Phase 2 (Next)
- [ ] Advanced analytics dashboard
- [ ] Leaderboards + achievements
- [ ] Redemption workflows
- [ ] SMS/Telegram notifications
- [ ] Custom webhooks dashboard
- [ ] Two-factor authentication
- [ ] Audit log

### 🚀 Phase 3 (Future)
- [ ] GraphQL API
- [ ] WebSocket real-time updates
- [ ] ML recommendations
- [ ] A/B testing
- [ ] International currencies
- [ ] Mobile app (React Native)

---

## 🐛 Troubleshooting

### MongoDB connection error
```bash
# Verifica che MongoDB sia running
mongosh

# Oppure avvia container Docker
docker run -d -p 27017:27017 mongo:latest
```

### JWT token scaduto
Ottieni nuovo token da `POST /api/auth/login`

### Stripe test key non funziona
- Usa chiavi di test (`sk_test_*`, `pk_test_*`)
- Non usare chiavi live in development
- Verifica che `STRIPE_SECRET_KEY` sia nel `.env`

### Email non inviate
1. Controlla `.env` `EMAIL_PROVIDER` e credenziali
2. Gmail: abilita App Password (non plain password)
3. Verifica logs in `/backend/services/email.js`
4. SendGrid/Mailgun: verifica email in sandbox o verified

### CORS error nel frontend
Assicurati che `FRONTEND_URL` sia nel `.env` del backend (usato nei link email/webhook).

### "Port 5000 already in use"
```bash
# Cambia porta in .env
PORT=5001

# E aggiorna frontend:
VITE_API_URL=http://localhost:5001/api
```

---

## 🤝 Support & Community

- 📧 **Support**: support@kickloyalty.com
- 🐛 **Issues**: [GitHub](https://github.com/kickloyalty)
- 💬 **Discord**: [Community](https://discord.gg/kick-loyalty)
- 📖 **Docs**: [kick-loyalty.com/docs](https://kick-loyalty.com/docs)
- 🎪 **Blog**: [blog.kick-loyalty.com](https://blog.kick-loyalty.com)

---

## 📄 License

**Proprietary** - Kick Loyalty SaaS  
All rights reserved © 2026

For licensing questions: legal@kickloyalty.com

---

## 🙋 FAQ

**Q: Posso usare questo per il mio streamer?**  
A: Sì! Crea un'organizzazione e invita il tuo team.

**Q: Quanto costa hosted?**  
A: Vedi [Pricing](#-pricing-tiers). Setup auto-billing con Stripe.

**Q: Devo runnare il mio server?**  
A: No, usa https://app.kickloyalty.com. Oppure self-host con istruzioni di deployment.

**Q: Supportate monetizzazione in other currencies?**  
A: Attualmente EUR. Valute custom in Phase 2.

**Q: Qual è l'SLA?**  
A: Business/Enterprise: 99.9% uptime SLA. Vedi contratto.

**Q: API rate limit?**  
A: Varia per piano. Free: 1K/mese, Pro: 10K/mese, Business: 100K/mese, Enterprise: unlimited.

**Q: Posso generare SDK dalle OpenAPI?**  
A: Sì! Usa `openapi-generator` o Swagger Codegen per JS/TS/Python/Go.

**Q: Come testo gli API?**  
A: Usa Postman, curl, o la Swagger UI interactive su `/api-docs`.

---

## ✅ Pre-Launch Checklist

- [ ] MongoDB configurato e tested
- [ ] Kick OAuth credentials settati
- [ ] Stripe account con secret key
- [ ] Email service configurato (Gmail/SendGrid)
- [ ] Environment variables completed
- [ ] Tutti i test passano (`npm test`)
- [ ] Frontend builds senza errors (`npm run build`)
- [ ] Backend runs in production mode
- [ ] HTTPS certificati configurati
- [ ] Database backup strategy
- [ ] Monitoring + error tracking (Sentry)
- [ ] Domain configured e DNS ready
- [ ] Security audit completed

---

## 🎉 Ready to Launch?

```bash
# Start developing
cd backend && npm run dev    # Terminal 1
cd frontend && npm run dev   # Terminal 2

# Vai a http://localhost:5173 🚀
```

**Deploy quando pronto:**
- Frontend → Vercel
- Backend → Railway
- Database → MongoDB Atlas

---

**Built with ❤️ for Kick Streamers**

Questions? Email: hello@kickloyalty.com
