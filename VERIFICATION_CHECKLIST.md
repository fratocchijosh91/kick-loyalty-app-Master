# 📋 Project Verification Checklist

Usa questo file per verificare che tutto sia configurato correttamente prima del deploy.

## ✅ Prerequisites

- [ ] **Node.js 18+** installato (`node -v`)
- [ ] **npm** disponibile (`npm -v`)
- [ ] **Git** disponibile (`git --version`)
- [ ] **MongoDB** 5+ accessibile (local o Atlas)
- [ ] Accesso **Stripe account** (test keys)
- [ ] Accesso **Kick API** credentials
- [ ] Email provider account (Gmail/SendGrid/Mailgun)

## 🔧 Backend Setup

- [ ] File `backend/.env` creato e compilato
- [ ] `NODE_ENV=development` impostato
- [ ] `MONGODB_URI` valida e testata
- [ ] `JWT_SECRET` configurato (min 32 chars)
- [ ] `KICK_API_ID` e `KICK_API_SECRET` impostati
- [ ] `STRIPE_SECRET_KEY` (sk_test_*) impostato
- [ ] `EMAIL_PROVIDER` e credenziali configurati
- [ ] `FRONTEND_URL` impostato correttamente
- [ ] `npm install` completato in `backend/`
- [ ] `npm run dev` avvia il server senza errori

### Backend Health Checks

```bash
cd backend
npm run dev
```

In un'altra finestra:
```bash
# Test API health
curl http://localhost:5000/api/health

# Expected response:
# {"status":"ok","message":"Server is running!"}
```

- [ ] Health check ritorna 200 OK
- [ ] Server logs non mostrano errori critici
- [ ] MongoDB connesso (o mock data funziona)
- [ ] Email service inizializzato correttamente

## 🎨 Frontend Setup

- [ ] File `frontend/.env` creato
- [ ] `VITE_API_URL=http://localhost:5000/api` impostato
- [ ] `npm install` completato in `frontend/`
- [ ] `npm run dev` avvia il dev server
- [ ] No TypeScript/build errors in console

### Frontend Health Checks

```bash
cd frontend
npm run dev
```

- [ ] Vite dev server avvia su http://localhost:5173
- [ ] Pagina carica senza errori
- [ ] Browser console pulita (no 404s)
- [ ] API calls al backend non danno CORS errors

## 🧪 Testing

```bash
cd backend
npm test
npm run test:coverage
```

- [ ] Tutti i test passano (0 failures)
- [ ] Coverage > 70% per critical paths
- [ ] No warnings nei test logs

## 🌐 Database

### MongoDB Local

```bash
# Verifica che MongoDB stia running
mongosh

# Nel database, verifica le collezioni
show collections
```

- [ ] MongoDB accessibile
- [ ] Database `kick-loyalty` creato
- [ ] Collezioni inizializzate

### MongoDB Atlas (Cloud)

- [ ] Cluster creato e accessibile
- [ ] Connection string configurata
- [ ] IP whitelist configurato
- [ ] Database user creato

## 💳 Stripe

- [ ] Account Stripe creato
- [ ] Modalità test attiva
- [ ] Secret key (sk_test_*) copuato in `.env`
- [ ] Publishable key (pk_test_*) disponibile
- [ ] Test mode toggle visibile nel dashboard

### Stripe Test Mode

Test cards che puoi usare:
- **4242 4242 4242 4242** - Successful payment
- **4000 0000 0000 0002** - Card declined
- **4000 0025 0000 3155** - Requires authentication

## 📧 Email Service

### Se usi Gmail:

- [ ] Gmail 2FA abilitato
- [ ] App Password generato (non plain password)
- [ ] `EMAIL_PROVIDER=gmail` impostato
- [ ] `EMAIL_USER` e `EMAIL_PASSWORD` compilati
- [ ] Test email mandatibile manualmente

### Se usi SendGrid:

- [ ] SendGrid account creato
- [ ] API key generato
- [ ] `EMAIL_PROVIDER=sendgrid` impostato
- [ ] `SENDGRID_API_KEY` configurato
- [ ] From email verificata su SendGrid

### Se usi Mailgun:

- [ ] Mailgun account creato
- [ ] Domain configurato
- [ ] API key e domain in `.env`
- [ ] `EMAIL_PROVIDER=mailgun` impostato

### Test Email:

```javascript
// Nel terminal backend:
const emailService = require('./services/email');
await emailService.sendWelcomeEmail(
  { username: 'test', email: 'your-email@example.com' },
  { name: 'Test Org' }
);
```

- [ ] Email ricevuta in pochi secondi
- [ ] Layout HTML renderizzato correttamente
- [ ] Link backend URL validi

## 🔐 Security

- [ ] `JWT_SECRET` diverso da example (min 32 chars)
- [ ] `STRIPE_SECRET_KEY` è secret key, non public
- [ ] `.env` non è committato a Git (. in `.gitignore`)
- [ ] `NODE_ENV=development` in dev (production in prod)
- [ ] CORS origins configurato correttamente
- [ ] No API keys espuesti nel frontend code
- [ ] HTTPS abilitato in produzione

## 📡 API Testing

Testa gli endpoint principali:

```bash
# 1. Health check
curl http://localhost:5000/api/health

# 2. Login (se OAuth è compilato)
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"code":"test","state":"test"}'

# 3. OpenAPI spec
curl http://localhost:5000/openapi.yaml
```

- [ ] Health check ritorna 200
- [ ] Auth endpoint non da server errors (auth fail è ok)
- [ ] OpenAPI spec caricabile

## 📚 Documentation

- [ ] `README.md` leggibile e aggiornato
- [ ] Backend documentazione `.md` file completi
- [ ] API docs in OpenAPI format
- [ ] Setup instructions sono chiari
- [ ] .env.example files creati

## 🚀 Pre-Production Checklist

- [ ] GitHub repository creato e sincronizzato
- [ ] .gitignore include `.env` e `node_modules/`
- [ ] Branch `main` è protetto
- [ ] CI/CD pipeline configurato (se usi GitHub Actions)
- [ ] Database backup strategy definito
- [ ] Error tracking (Sentry) configurato (optional)
- [ ] Monitoring configurato (optional)

## 🌍 Deployment Preparation

### Frontend (Vercel)

- [ ] Project collegato a GitHub
- [ ] Environment variables configurate in Vercel
- [ ] Build command: `npm run build`
- [ ] Output directory: `dist/`
- [ ] Preview deployment successful
- [ ] Production domain configurato

### Backend (Railway/Render/Heroku)

- [ ] Project creato sulla piattaforma
- [ ] Linked a GitHub repo
- [ ] Environment variables tutte configurate
- [ ] Dockerfile configurato (se necessario)
- [ ] Build logs controllati (no errors)
- [ ] Test deployment funziona

### Database (MongoDB Atlas)

- [ ] Production cluster creato
- [ ] Backup abilitato
- [ ] IP whitelist per server backend
- [ ] Monitor/alerts configurati

## 📊 Performance Baselines

Questi valori aiutano a identificare regressioni:

### Backend Response Times
- [ ] Health check: < 10ms
- [ ] Organization list: < 100ms
- [ ] Rewards CRUD: < 200ms
- [ ] Login: < 500ms

### Frontend Metrics
- [ ] First Contentful Paint: < 2s
- [ ] Largest Contentful Paint: < 3s
- [ ] Cumulative Layout Shift: < 0.1
- [ ] Time to Interactive: < 2s

## ⚠️ Known Issues & Workarounds

### MongoDB non disponibile

**Problema**: Locale MongoDB non accessibile  
**Workaround**: Usa MongoDB Atlas (cloud)

```bash
# In .env:
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/kick-loyalty
```

### Email non inviata

**Problema**: Nodemailer non riesce a connettersi  
**Soluzione**:
1. Verifica credenziali email nel `.env`
2. Se Gmail: verifica che App Password sia abilitata
3. Se SendGrid: controlla API key e domain
4. Leggi [EMAIL_SETUP.md](backend/EMAIL_SETUP.md)

### CORS error nel frontend

**Problema**: Browser blocca richieste al backend  
**Soluzione**:
1. Verifica che backend sia running su porta 5000
2. Verifica `VITE_API_URL` nel frontend `.env`
3. Controlla CORS configuration nel server.js

### Test timeout

**Problema**: Jest tests timeout in ci/cd  
**Soluzione**:
```bash
npm test -- --testTimeout=30000
```

## 🎉 Final Sign-Off

Una volta che tutti i checkbox sono completati:

- [ ] **Developer**: Ho verificato che tutto funziona localmente
- [ ] **Testing**: Ho eseguito la suite di test completa
- [ ] **Security**: Ho configurato tutte le variabili segrete
- [ ] **Documentation**: Ho letto e compreso la documentazione
- [ ] **Deployment**: Sono pronto per il deploy in produzione

---

**Status**: _______________  
**Date**: _______________  
**Verified By**: _______________

---

Per domande, consulta [README.md](README.md) o la sezione di troubleshooting.
