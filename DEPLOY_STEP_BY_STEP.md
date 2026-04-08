# 🚀 Deploy Step-by-Step - Guida Dettagliata

## PREPARAZIONE (Faccio io ora)

### ✅ Step 1: Verifica Progetto
Devi avere:
- Account GitHub con repository pushato
- Node.js installato (per test locale)
- Progetto KickLoyalty funzionante localmente

---

## PARTE 1: MONGODB ATLAS (Tu fai - 5 min)

### Step 1.1: Crea Cluster
1. Apri browser → vai a **mongodb.com/atlas**
2. Clicca **"Try Free"** o **"Sign In"**
3. Accedi con Google/GitHub (più veloce)
4. Seleziona **"Shared Cluster"** (gratis) → **M0 tier**
5. Provider: **AWS** → Region: **eu-west-1** (Irlanda, più vicina)
6. Nome cluster: lascia quello di default (Cluster0)
7. Clicca **"Create Deployment"**

### Step 1.2: Crea Utente Database
1. Nella pagina "Security Quickstart"
2. Username: scegli tuo nome (es: `admin`)
3. Password: clicca **"Autogenerate Secure Password"**
4. **COPIA LA PASSWORD** in un posto sicuro (bloc notes)
5. Clicca **"Create User"**

### Step 1.3: Configura Network Access
1. Seleziona **"My Local Environment"**
2. Aggiungi IP: clicca **"Add My Current IP Address"**
3. Poi aggiungi anche: clicca **"Add IP Address"** → IP: `0.0.0.0/0` → Comment: "Allow from anywhere"
4. Clicca **"Finish and Close"**

### Step 1.4: Ottieni Connection String
1. Nel dashboard, clicca **"Connect"** (bottone grigio vicino al cluster)
2. Seleziona **"Drivers"**
3. Driver: **"Node.js"**
4. Versione: lascia default
5. Copia la stringa che appare:
   ```
   mongodb+srv://admin:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. **Sostituisci `<password>`** con la password che hai copiato prima
7. Aggiungi `kick-loyalty` prima di `?`:
   ```
   mongodb+srv://admin:password@cluster0.xxxxx.mongodb.net/kick-loyalty?retryWrites=true&w=majority
   ```
8. **COPIA QUESTA STRINGA FINALE** → la userai in Railway

---

## PARTE 2: RAILWAY (Backend Hosting - 5 min)

### Step 2.1: Crea Account
1. Vai a **railway.app**
2. Clicca **"Start for Free"**
3. Clicca **"Login with GitHub"** (più veloce)
4. Autorizza Railway → ti porta al dashboard

### Step 2.2: Nuovo Progetto
1. Dashboard Railway → clicca **"New Project"**
2. Seleziona **"Deploy from GitHub repo"**
3. Se ti chiede autorizzazione GitHub → clicca **"Authorize Railway"**
4. Seleziona il tuo repository: `kick-loyalty-app-master`
5. Clicca **"Add Variables"** (bottone viola)

### Step 2.3: Aggiungi Environment Variables
Per ogni variabile:
- Clicca **"+ New Variable"**
- Inserisci nome e valore
- Clicca **"Add"**

**Variabili da aggiungere:**

| Nome | Valore |
|------|--------|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | (incolla la stringa MongoDB che hai copiato) |
| `JWT_SECRET` | (genera con: apri terminale → `openssl rand -base64 32` → copia output) |
| `FRONTEND_URL` | `https://placeholder.vercel.app` (aggiorneremo dopo) |
| `EMAIL_PROVIDER` | `gmail` |
| `EMAIL_USER` | (tua email Gmail) |
| `EMAIL_PASSWORD` | (App Password di Gmail - vedi nota sotto) |

**Nota Gmail App Password:**
- Gmail normale non funziona, serve App Password
- Vai su myaccount.google.com → Security → 2-Step Verification → Attiva
- Poi: Security → App passwords → Select app: Mail → Select device: Other → Genera → Copia password

### Step 2.4: Deploy
1. Dopo aver aggiunto tutte le variabili
2. Clicca **"Deploy"** in alto a destra (se non parte automatico)
3. Aspetta che finisca (vedi log in tempo reale)
4. Quando vedi **"Healthy"** in verde → deploy OK!

### Step 2.5: Ottieni URL Backend
1. Clicca sulla card del tuo progetto
2. Vedi l'URL generato (es: `https://kickloyalty-production.up.railway.app`)
3. **COPIA QUESTO URL** → lo userai in Vercel
4. Aggiungi `/api` alla fine per le chiamate API (es: `https://...railway.app/api`)

---

## PARTE 3: VERCEL (Frontend Hosting - 5 min)

### Step 3.1: Crea Account
1. Vai a **vercel.com**
2. Clicca **"Sign Up"** → **"Continue with GitHub"**
3. Autorizza Vercel

### Step 3.2: Importa Progetto
1. Dashboard Vercel → clicca **"Add New Project"**
2. Seleziona **"Import Git Repository"**
3. Trova `kick-loyalty-app-master` → clicca **"Import"**

### Step 3.3: Configura Build Settings
1. **Framework Preset**: seleziona **"Vite"** dal dropdown
2. Se non c'è Vite, lascia "Other"
3. **Root Directory**: cambia da `./` a `frontend`
   - Clicca sul campo → scrivi `frontend` → premi Enter
4. **Build Command**: `npm run build` (dovrebbe essere già corretto)
5. **Output Directory**: `dist` (dovrebbe essere già corretto)

### Step 3.4: Environment Variables
1. Espandi la sezione **"Environment Variables"** (bottone "+" o "Edit")
2. Aggiungi questa variabile:
   - Name: `VITE_API_URL`
   - Value: `https://TUO-URL-RAILWAY.up.railway.app/api` (usa l'URL copiato prima + `/api`)
3. Clicca **"Add"**

### Step 3.5: Deploy
1. Clicca grande bottone **"Deploy"**
2. Aspetta il build (vedi progresso)
3. Quando vedi **"Congratulations!"** → clicca **"Go to Dashboard"**
4. Nella dashboard, vedi il tuo dominio (es: `https://kickloyalty.vercel.app`)
5. **COPIA QUESTO URL**

---

## PARTE 4: COLLEGA TUTTO (2 min)

### Step 4.1: Aggiorna Railway con URL Frontend
1. Torna su Railway dashboard
2. Clicca sul tuo progetto
3. Tab **"Variables"** (in alto)
4. Trova `FRONTEND_URL` → clicca sull'icona matita (edit)
5. Cambia da `https://placeholder.vercel.app` a `https://TUO-URL-VERCEL.vercel.app`
6. Clicca **"Save"** → Railway redeploya automaticamente (attendi 30 sec)

---

## PARTE 5: TEST (5 min)

### Step 5.1: Verifica Frontend
1. Apri il tuo URL Vercel in browser
2. Dovresti vedere la pagina di login
3. Se vedi errore CORS → controlla che FRONTEND_URL in Railway sia corretto

### Step 5.2: Test Login
1. Clicca **"Login with Kick"** o usa form
2. Se funziona → sei connesso al backend!

### Step 5.3: Verifica API
1. Apri: `https://TUO-RAILWAY.up.railway.app/api/health`
2. Dovresti vedere: `{"status":"ok"}`
3. Se vedi questo → backend funziona!

### Step 5.4: Verifica PWA
1. Frontend aperto → premi F12 (DevTools)
2. Tab **"Lighthouse"** (se non c'è: ⋮ → More tools → Lighthouse)
3. Seleziona **"PWA"** → clicca **"Analyze page load"**
4. Dovresti vedere score verde per PWA

---

## 🎉 SEI ONLINE!

### URL da salvare:
- **Frontend**: `https://kickloyalty.vercel.app`
- **Backend**: `https://kickloyalty.up.railway.app`
- **API Health**: `https://.../api/health`

### Prossimi passi opzionali:
1. **Dominio custom** (es: kickloyalty.it) → su Vercel: Settings → Domains
2. **Stripe Live Mode** → quando pronto per vendite reali
3. **SendGrid** → per email più affidabili
4. **VAPID Keys** → per push notifications su mobile

---

## 🆘 TROUBLESHOOTING

### ❌ "Failed to load" / Pagina bianca
**Causa**: Frontend non trova backend
**Fix**: Controlla `VITE_API_URL` in Vercel → deve essere URL Railway + `/api`

### ❌ "CORS error" in console
**Causa**: Backend rifiuta richieste dal frontend
**Fix**: Railway → Variables → `FRONTEND_URL` deve essere ESATTAMENTE URL Vercel (con https://)

### ❌ "Cannot connect to database"
**Causa**: MongoDB URI sbagliata o IP non whitelistato
**Fix**: 
1. Verifica URI in Railway (deve avere password reale, non `<password>`)
2. MongoDB Atlas → Network Access → controlla che ci sia `0.0.0.0/0`

### ❌ "Login non funziona"
**Causa**: JWT_SECRET mancante o Kick API keys
**Fix**: Aggiungi `JWT_SECRET` in Railway (generato con openssl)

### ❌ "Build failed" su Vercel
**Causa**: Root directory sbagliata
**Fix**: Vercel → Project Settings → Root Directory → deve essere `frontend`

---

## 📞 Supporto

Se blocchi su qualcosa:
1. Controlla i **logs** in Railway (tab "Deployments" → clicca sul deploy → "View Logs")
2. Controlla **Console** del browser (F12 → Console)
3. Verifica **Network** tab (F12 → Network) per vedere quali chiamate falliscono

---

**INIZIA DA PARTE 1 (MongoDB Atlas)**

Quando hai finito una parte, dimmi "FATTO" e passiamo alla prossima! 🚀
