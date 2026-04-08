# 🚀 Deployment Guide

Guida completa per deployare Kick Loyalty in produzione.

---

## 📋 Pre-Deployment Checklist

Prima di deployare:

- [ ] Tutti i test passano (`npm test`)
- [ ] Zero console errors/warnings
- [ ] `.env` completamente configurato
- [ ] Database backup effettuato
- [ ] GitHub repository sincronizzato
- [ ] Branch `main` è stabile
- [ ] Domain registrato e configurato
- [ ] SSL certificate pronto

---

## 🎨 Frontend Deployment (Vercel)

Vercel è la scelta migliore per React + Vite (FREE tier perfetto).

### Step 1: Prepara il Repository

```bash
# Assicurati che frontend/ sia sincronizzato con GitHub
git add .
git commit -m "Ready for production deployment"
git push origin main
```

### Step 2: Connetti a Vercel

1. Vai su https://vercel.com
2. Clicca "New Project"
3. Importa il repo GitHub
4. Vercel auto-detects Vite

### Step 3: Configura Environment Variables

Nel dashboard Vercel:

1. Vai in **Settings → Environment Variables**
2. Aggiungi per tutti gli environment (Preview, Production, Development):

```
VITE_API_URL=https://api.kickloyalty.com/api
VITE_APP_NAME=Kick Loyalty
VITE_APP_VERSION=2.0.0
```

(Sostituisci `api.kickloyalty.com` con il tuo dominio backend)

### Step 4: Deploy

Vercel auto-deploys quando pushes a `main`:

- ✅ Automatic previews per ogni PR
- ✅ Automatic production deploy su `main`
- ✅ Rollback disponibile in dashboard
- ✅ Analytics built-in
- ✅ CDN globale

### Step 5: Custom Domain

1. In **Settings → Domains**
2. Aggiungi il tuo dominio (es. `app.kickloyalty.com`)
3. Vercel genera il certificato SSL automaticamente

### Verifica Deployment

```bash
# Check production URL
curl https://app.kickloyalty.com

# Should return HTML (not JSON)
# Check browser console for API errors
```

---

## 🔧 Backend Deployment (Railway)

Railway è semplice, veloce, e gratis per il primo mese.

### Step 1: Crea Account Railway

1. Vai su https://railway.app
2. Signup con GitHub (recomandato)

### Step 2: Crea Nuovo Project

1. Dashboard → "New Project"
2. Seleziona "Deploy from GitHub repo"
3. Autorizza Railway a GitHub
4. Seleziona il repo `kick-loyalty-app`
5. Seleziona la branch `main`

### Step 3: Aggiungi MongoDB

Railway gestisce questo automaticamente:

1. Project → "+ Add Service"
2. Seleziona "MongoDB"
3. Railway crea il database automaticamente

Oppure usa MongoDB Atlas (esterno):

1. Salta "Add MongoDB"
2. Configura connection string in environment variables

### Step 4: Aggiungi Environment Variables

Nel dashboard Railway:

1. Clicca sul servizio "backend"
2. **Variables** tab
3. Aggiungi tutte le variabili da `.env`:

```
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/kick-loyalty
JWT_SECRET=your-production-secret-key-very-long
KICK_API_ID=your_kick_api_id
KICK_API_SECRET=your_kick_api_secret
STRIPE_SECRET_KEY=sk_live_your_stripe_key  # LIVE KEY!
STRIPE_PUBLISHABLE_KEY=pk_live_your_key
EMAIL_PROVIDER=sendgrid  # Use SendGrid for production
SENDGRID_API_KEY=SG.your_sendgrid_api_key
FRONTEND_URL=https://app.kickloyalty.com
GROQ_API_KEY=your_groq_api_key
```

### Step 5: Custom Domain

1. **Settings → Environment → Custom Domain**
2. Aggiungi `api.kickloyalty.com`
3. Segui le istruzioni DNS
4. Railway generi SSL certificate automaticamente

### Step 6: Deploy

```bash
# Push to main branch
git push origin main

# Railway auto-deploys
# Check logs in dashboard
```

### Verifica Deployment

```bash
# Check API health
curl https://api.kickloyalty.com/api/health

# Expected response:
# {"status":"ok","message":"Server is running!"}
```

---

## 💾 Database Setup (MongoDB Atlas)

Per il backend hai bisogno di MongoDB in produzione.

### Step 1: Crea MongoDB Atlas Account

1. Vai su https://www.mongodb.com/cloud/atlas
2. Signup (gratis, 512MB included)
3. Verifica email

### Step 2: Crea Cluster

1. Create → Shared cluster (FREE)
2. Provider: AWS (EU region raccomandato)
3. Cluster Name: `kick-loyalty-prod`
4. Create cluster (impiega ~5 minuti)

### Step 3: Configurazione Sicurezza

1. **Database Access** → Add Database User
   - Username: `kick_user`
   - Password: (genera password forte)
   - Salva le credenziali!

2. **Network Access** → IP Whitelist
   - Add IP address
   - Per Railway: lascia vuoto o usa 0.0.0.0/0 (meno sicuro)
   - Per migliore sicurezza: aggiungi solo IP del server

### Step 4: Connection String

1. **Clusters** → Connect
2. Seleziona "Connect your applicaton"
3. Copia connection string:

```
mongodb+srv://kick_user:PASSWORD@cluster.mongodb.net/kick-loyalty?retryWrites=true&w=majority
```

4. Sostituisci `PASSWORD` con la password dell'utente
5. Configura nel backend:

```
MONGODB_URI=mongodb+srv://kick_user:PASSWORD@cluster.mongodb.net/kick-loyalty?retryWrites=true&w=majority
```

### Step 5: Backup

1. **Backup & Restore** → Backup
2. Enable automatic daily backups (gratis)
3. Retention: 7 days (gratis)

---

## 💳 Stripe Configuration (Production)

Finora hai usato test keys. Ora configura le LIVE keys.

### Step 1: Attiva Live Mode

1. Dashboard Stripe → Accounts (top-right)
2. **Activate your account**
3. Compila business info

### Step 2: Ottieni Live Keys

1. Dashboard → **Developers** → **API Keys**
2. Toggle "View test data" OFF
3. Copia **Secret key** (sk_live_*)
4. Copia **Publishable key** (pk_live_*)

### Step 3: Configura Backend

Nel backend environment variables (Railway):

```
STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_KEY
STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_LIVE_KEY
```

### Step 4: Webhook

Per productione, configura Stripe webhooks:

1. Dashboard → **Webhooks** → Add endpoint
2. Endpoint URL: `https://api.kickloyalty.com/api/webhooks/stripe`
3. Events: 
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
   - `charge.failed`
4. Copia signing secret
5. Aggiungi in backend variables:

```
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

---

## 📧 Email Service (Production)

Gmail è OK per test, ma SendGrid/Mailgun per produzione.

### Opzione A: SendGrid (Raccomandato)

1. Vai su https://sendgrid.com
2. Signup (Free tier: 100 emails/day)
3. **Settings** → **API Keys**
4. Create API Key (Full Access)
5. Copia key
6. Nel backend variables:

```
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.YOUR_API_KEY
```

7. **Sender Authentication**:
   - Aggiungi il tuo dominio
   - Completa DNS verification (CNAME records)
   - Questo serve per whitelist (alta deliverability)

### Opzione B: Mailgun

1. Vai su https://www.mailgun.com
2. Signup
3. **Domain Management** → Add domain
4. Completa DNS verification
5. **API** → API Keys
6. Copia private API key
7. Nel backend:

```
EMAIL_PROVIDER=mailgun
MAILGUN_API_KEY=key-YOUR_API_KEY
MAILGUN_DOMAIN=mail.kickloyalty.com
```

---

## 🔐 Security Checklist

Prima di andare live:

### Environment Variables
- [ ] JWT_SECRET è diverso da example (min 32 chars)
- [ ] Tutti i Stripe keys sono LIVE (sk_live_*, pk_live_*)
- [ ] Email API keys sono configurate
- [ ] No hardcoded secrets nel codice
- [ ] `.env` non è committato

### HTTPS & TLS
- [ ] Frontend ha SSL certificate (Vercel lo fa automaticamente)
- [ ] Backend ha SSL certificate (Railway lo fa automaticamente)
- [ ] Tutte le API call usano HTTPS
- [ ] HSTS headers configurato (optional, production-ready)

### Database
- [ ] MongoDB user password è forte
- [ ] IP whitelist configurato
- [ ] Backup automatici abilitati
- [ ] Encryption at rest abilitato (Atlas M0 free - no)
- [ ] Encryption in transit abilitato (default - yes)

### CORS
- [ ] Verificare che CORS sia configurato per il tuo dominio frontend
- [ ] Non usare `*` in produzione (specifico `https://app.kickloyalty.com`)

### Rate Limiting
- [ ] Verificare che rate limiting sia abilitato
- [ ] Limiti per endpoint sensibili (login, password reset)

---

## 📊 Monitoring & Logging

### Error Tracking (Sentry - Optional)

1. Vai su https://sentry.io
2. Create organization + project (Node.js backend)
3. Copia DSN
4. Nel backend:.

```
SENTRY_DSN=https://YOUR_DSN@sentry.io/PROJECT_ID
```

5. Server cattura tutti gli errors automaticamente
6. Dashboard mostra error trends e stack traces

### Application Monitoring (Optional)

- **Vercel Analytics**: Built-in, mostra performance metrics
- **MongoDB Atlas Monitoring**: Builtin, mostra query latency
- **Railway Logging**: Built-in, mostra container logs

### Custom Logs

Per produzione, aggiungi structured logging:

```javascript
// backend/server.js
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Log everything:
logger.info('User logged in', { userId: user.id });
logger.error('Database error', { code: err.code });
```

---

## 🧪 Production Testing

Prima di dichiarare "live":

### Test Payment Flow
```
Test card: 4242 4242 4242 4242
Expiry: 12/25
CVC: 123
```

1. Signup as new organization
2. Upgrade to Pro plan
3. Complete Stripe checkout
4. Verify subscription is active
5. Check invoice email ricevuta

### Test Email
1. Signup new user
2. Invite team member
3. Check email ricevuta (spam folder?)
4. Verify links in email funzionano

### Test API
```bash
# Testa gli endpoint principali
curl -H "Authorization: Bearer TOKEN" \
  https://api.kickloyalty.com/api/organizations

# Dovrebbe ritornare lista org
```

---

## 🚨 Rollback Plan

Se qualcosa va male:

### Frontend (Vercel)
1. Dashboard → Deployments
2. Seleziona deployment precedente
3. Clicca "Rollback"
4. Istantaneo (< 1 secondo)

### Backend (Railway)
1. Railway Dashboard → Deployments
2. Redeploy da commit precedente
3. Oppure manual rollback (5-10 secondi)

### Database
1. MongoDB Atlas → Backup & Restore
2. Restore da backup precedente
3. Impiega alcuni minuti

---

## 📈 Post-Deployment

Dopo il deploy:

### Track Metrics
- [ ] User signups
- [ ] Plan upgrades
- [ ] API usage
- [ ] Error rates (from Sentry)
- [ ] Page load times (from Vercel)
- [ ] Database query latency (from MongoDB)

### Communicate Launch
- [ ] Notify customers / announce
- [ ] Monitor error logs 24/48h
- [ ] Be ready per quick hotfixes

### Scale Preparation
- [ ] Database indexed per common queries
- [ ] API caching configurato
- [ ] Static content su CDN
- [ ] Redis cache (optional, if needed)

---

## 🆘 Troubleshooting

### Frontend not loading
```
1. Check Vercel build logs
2. Check browser console (F12)
3. Verify VITE_API_URL in Vercel env vars
```

### API returning 500 errors
```
1. Check Railway logs
2. Verify MongoDB is running
3. Check environment variables in Railway
4. Manually SSH e inspect
```

### Email not sending
```
1. Check SendGrid dashboard (Email Activity)
2. Verify API key in backend
3. Check server logs message
4. Verify domain whitelisting
```

### Database connection timeout
```
1. Verify MongoDB Atlas IP whitelist
2. Check connection string format
3. Verify username/password
4. Test locally first
```

---

## 📞 Support

Se qualcosa non funziona:

1. **Check logs**: Vercel/Railway/MongoDB dashboard
2. **Read docs**: EMAIL_SETUP.md, API_DOCUMENTATION.md
3. **GitHub issues**: Crea issue nel repository
4. **Email support**: support@kickloyalty.com

---

**🎉 Congratulations! Your app is now LIVE!**

Monitor error rates and user feedback in the first 24-48 hours.
Be prepared for hotfixes if needed.

Good luck! 🚀
