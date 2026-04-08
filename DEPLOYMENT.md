# KickLoyalty - Deployment Guide

Guida completa per deploy staging e produzione di KickLoyalty.

## 🚀 Quick Deploy (Railway + Vercel)

### Backend (Railway)

1. **Crea account** su [Railway.app](https://railway.app)

2. **New Project** → Deploy from GitHub repo

3. **Variabili d'ambiente** (Settings → Variables):
```
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/kick-loyalty
JWT_SECRET=openssl_rand_base64_32
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxx
FRONTEND_URL=https://your-frontend.vercel.app
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@yourdomain.com
```

4. **Deploy** → Auto-deploy su ogni push a main

### Frontend (Vercel)

1. **Crea account** su [Vercel.com](https://vercel.com)

2. **Add New Project** → Import GitHub repo

3. **Configurazione**:
   - Framework: Vite
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`

4. **Environment Variables**:
```
VITE_API_URL=https://your-backend.railway.app/api
```

5. **Deploy**

---

## 📋 Pre-Deploy Checklist

### Backend
- [ ] MongoDB Atlas cluster creato
- [ ] JWT Secret generato (32+ chars)
- [ ] Stripe account configurato (test/live)
- [ ] Email provider configurato (SendGrid consigliato)
- [ ] CORS origins aggiornati
- [ ] Rate limiting testato

### Frontend
- [ ] API URL configurato
- [ ] PWA manifest valido
- [ ] Service worker testato
- [ ] Icons generate (72x72 a 512x512)

### Security
- [ ] HTTPS forzato in produzione
- [ ] Webhook URLs usano HTTPS
- [ ] Secrets non in codice
- [ ] CORS limitato ai domini corretti

---

## 🔧 Configurazione Dettagliata

### MongoDB Atlas

1. Crea cluster su [mongodb.com/atlas](https://mongodb.com/atlas)
2. Database Access → Create User
3. Network Access → Add IP Address (0.0.0.0/0 per Railway)
4. Clusters → Connect → Drivers → Node.js
5. Copia URI: `mongodb+srv://<user>:<password>@cluster...`

### Stripe

**Test Mode:**
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_... (da Stripe Dashboard → Webhooks)
```

**Live Mode:**
- Attiva account su Stripe Dashboard
- Configura webhook endpoint: `https://your-api.com/api/stripe/webhook`
- Seleziona eventi: `checkout.session.completed`, `customer.subscription.deleted`

### Email (SendGrid Consigliato)

1. Registrati su [sendgrid.com](https://sendgrid.com)
2. Settings → API Keys → Create API Key (Full Access)
3. Sender Authentication → Verify Single Sender
4. Configura env:
```
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxx
```

### VAPID Keys (Push Notifications)

```bash
npx web-push generate-vapid-keys
```

Copia public e private key in env:
```
VAPID_PUBLIC_KEY=BLCxxxxx
VAPID_PRIVATE_KEY=FPNxxxxx
VAPID_SUBJECT=mailto:admin@yourdomain.com
```

---

## 🐳 Deploy con Docker

### Dockerfile Backend

```dockerfile
FROM node:18-slim

# Install Chromium for Puppeteer
RUN apt-get update && apt-get install -y \
  chromium \
  fonts-liberation \
  libappindicator3-1 \
  --no-install-recommends

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

EXPOSE 5000
CMD ["npm", "start"]
```

### Build & Run

```bash
docker build -t kickloyalty-backend ./backend
docker run -p 5000:5000 --env-file .env kickloyalty-backend
```

---

## ☁️ Alternative Cloud Providers

### Render.com

```yaml
# render.yaml
services:
  - type: web
    name: kickloyalty-api
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: MONGODB_URI
        sync: false
```

### Heroku

```bash
# Procfile (già presente)
web: npm start

# Deploy
heroku create kickloyalty-api
heroku config:set NODE_ENV=production
heroku config:set MONGODB_URI=...
git push heroku main
```

---

## 🔒 Security Hardening

### Headers (già configurati in server.js)
- Helmet.js per security headers
- Rate limiting su auth endpoints
- CORS whitelist

### Database
- MongoDB Atlas: IP whitelist
- Enable encryption at rest
- Enable automated backups

### Secrets Management
**Railway:** Built-in secrets management
**Alternative:** AWS Secrets Manager, HashiCorp Vault

---

## 📊 Post-Deploy Verification

### Health Checks
```bash
# API Health
curl https://your-api.com/api/health

# Database
curl https://your-api.com/api/stats

# Auth
curl -X POST https://your-api.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test"}'
```

### Frontend Tests
- [ ] Login funziona
- [ ] Dashboard carica
- [ ] Rewards visibili
- [ ] PWA installabile (Chrome DevTools → Lighthouse)
- [ ] Offline mode funziona
- [ ] Push notifications (se configurate)

### Critical Flows
- [ ] User registration/login
- [ ] Stripe checkout (test mode)
- [ ] Reward redemption
- [ ] Webhook delivery
- [ ] Batch operations

---

## 🔄 CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd backend && npm ci
      - run: cd backend && npm test

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Railway
        uses: railway/cli@latest
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: vercel/action-deploy@v1
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
```

---

## 🐛 Troubleshooting

### Problemi Comuni

**1. CORS Errors**
```
Aggiorna ALLOWED_ORIGINS con frontend URL
```

**2. MongoDB Connection Failed**
```
- Verifica IP whitelist in Atlas
- Controlla URI formato
- Assicurati password encoded (@ → %40)
```

**3. Puppeteer/Chromium Errors**
```
# Railway/Render: già configurato in railway.json
# Docker: installa chromium nel container
```

**4. Stripe Webhook 400 Error**
```
- Verifica STRIPE_WEBHOOK_SECRET
- Controlla endpoint URL in Stripe Dashboard
```

**5. PWA Not Installable**
```
- Verifica manifest.json valido
- Controlla service worker registration
- HTTPS required per PWA
```

---

## 📈 Scaling

### Database
- MongoDB Atlas: Auto-scale M10+ cluster
- Enable connection pooling

### API
- Railway: Auto-scaling enabled
- Rate limiting per tier

### Static Assets
- Vercel: CDN automatico
- Cache headers configurati

---

## 💰 Costi Stimati (Mensili)

| Servizio | Tier | Costo |
|----------|------|-------|
| Railway | Starter | $5/mese |
| MongoDB Atlas | M0 (free) | $0 |
| Vercel | Hobby | $0 |
| SendGrid | Free (100/day) | $0 |
| **Totale** | | **~$5/mese** |

Per produzione reale:
- Railway Pro: $25/mese
- MongoDB M10: $60/mese
- Totale: ~$85/mese

---

## 🆘 Supporto

- Railway Docs: https://docs.railway.app
- Vercel Docs: https://vercel.com/docs
- MongoDB Atlas: https://docs.atlas.mongodb.com

**Emergency Contacts:**
- Railway Status: https://status.railway.app
- Vercel Status: https://www.vercel-status.com
