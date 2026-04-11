# 🚀 Deploy su Render (Alternativa a Railway)

Render è più semplice e affidabile di Railway. Nessun problema di cache!

## 📋 Prerequisiti

- Account GitHub con il repository pushato
- MongoDB Atlas (già creato)

---

## PARTE 1: Crea Account Render (2 min)

1. Vai su **render.com**
2. Clicca **"Get Started for Free"**
3. Clicca **"Continue with GitHub"**
4. Autorizza Render ad accedere ai tuoi repository

---

## PARTE 2: Deploy Backend (5 min)

### Step 2.1: Nuovo Web Service
1. Dashboard Render → clicca **"+ New"** → **"Web Service"**
2. Seleziona il tuo repository: `kick-loyalty-app-Master`
3. Clicca **"Connect"**

### Step 2.2: Configura
- **Name**: `kick-loyalty-backend`
- **Region**: **Frankfurt (EU Central)**
- **Branch**: `main`
- **Runtime**: `Node`
- **Build Command**: `cd backend && npm install`
- **Start Command**: `cd backend && npm start`
- **Plan**: `Free`

### Step 2.3: Environment Variables
Clicca **"Advanced"** e aggiungi:

| Variable | Valore |
|----------|--------|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | `mongodb+srv://Admin:Tz6VhujH9HOHr8jb@cluster0.yxta68l.mongodb.net/kick-loyalty?appName=Cluster0` |
| `JWT_SECRET` | `E9oswezoiwCQ7qymon7PeTZQfVX2dFgaaMpvERjQsAo=` (o genera nuovo) |
| `FRONTEND_URL` | `https://placeholder.vercel.app` (aggiorneremo dopo) |
| `EMAIL_PROVIDER` | `gmail` |
| `EMAIL_USER` | tua email Gmail |
| `EMAIL_PASSWORD` | App Password Gmail |

**Nota per EMAIL_PASSWORD:**
- Gmail normale non funziona
- Vai su myaccount.google.com → Security → 2-Step Verification → Attiva
- Poi: Security → App passwords → Select app: Mail → Device: Other → Genera password

### Step 2.4: Deploy
1. Clicca **"Create Web Service"**
2. Aspetta il build (vedi log in tempo reale)
3. Quando vedi **"Your service is live"** → ✅ Backend online!

### Step 2.5: Ottieni URL Backend
- Clicca sul nome del servizio
- Copia l'URL (es: `https://kick-loyalty-backend.onrender.com`)
- **SALVA QUESTO URL**

---

## PARTE 3: Deploy Frontend su Vercel (5 min)

### Step 3.1: Crea Account
1. Vai su **vercel.com**
2. Clicca **"Sign Up"** → **"Continue with GitHub"**

### Step 3.2: Importa Progetto
1. Dashboard Vercel → clicca **"Add New Project"**
2. Seleziona `kick-loyalty-app-Master`
3. Clicca **"Import"**

### Step 3.3: Configura
- **Framework Preset**: `Vite`
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

### Step 3.4: Environment Variables
Aggiungi:
```
VITE_API_URL=https://kick-loyalty-backend.onrender.com/api
```
(usa l'URL di Render copiato prima + `/api`)

### Step 3.5: Deploy
1. Clicca **"Deploy"**
2. Aspetta il build
3. Clicca **"Visit"** per vedere il sito!

---

## PARTE 4: Collega Tutto (2 min)

### Aggiorna Render con URL Frontend
1. Torna su Render Dashboard
2. Clicca sul tuo servizio `kick-loyalty-backend`
3. Tab **"Environment"**
4. Trova `FRONTEND_URL`
5. Clicca **"Edit"** e cambia in: `https://tuo-frontend.vercel.app`
6. Salva → Render redeploya automaticamente

---

## ✅ Verifica

### Test Backend
Apri in browser:
```
https://kick-loyalty-backend.onrender.com/api/health
```
Dovresti vedere: `{"status":"ok"}`

### Test Frontend
- Apri il tuo URL Vercel
- Login dovrebbe funzionare
- Dashboard carica correttamente

---

## 🆘 Troubleshooting

### "Build failed" su Render
- Controlla i log in Render → "Logs" tab
- Verifica che tutte le env vars siano inserite
- Assicurati che `MONGODB_URI` sia corretta

### CORS Error
- Verifica che `FRONTEND_URL` in Render sia ESATTAMENTE l'URL Vercel

### "Cannot connect to database"
- MongoDB Atlas → Network Access → controlla che ci sia `0.0.0.0/0`

---

## 💰 Costi

| Servizio | Costo |
|----------|-------|
| Render (Free tier) | Gratis |
| MongoDB Atlas (M0) | Gratis |
| Vercel (Hobby) | Gratis |
| **Totale** | **Gratis** |

Render Free:
- ✅ Web service sempre online (a differenza di Heroku che "dorme")
- ✅ 512 MB RAM
- ✅ 100 GB bandwidth/mese
- ⚠️ Dopo 15 min inattività, primo accesso è lento (2-3 sec)

---

**Inizia con PARTE 1: Crea account Render!** 🚀
