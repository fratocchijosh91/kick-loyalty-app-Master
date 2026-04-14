# Operazioni produzione (KickLoyalty)

Checklist in ordine cronologico dopo ogni modifica rilevante.

## 1. Variabili ambiente

### Render (backend)

- `MONGODB_URI` — database produzione
- `JWT_SECRET` — obbligatorio in produzione
- `FRONTEND_URL` — URL Vercel dell’app
- **Stripe (pagamenti)**  
  - `STRIPE_SECRET_KEY` — secret key (`sk_live_…` o `sk_test_…`) solo su Render  
  - `STRIPE_WEBHOOK_SECRET` — signing secret dell’endpoint webhook (`whsec_…`)  
  - `STRIPE_PRICE_ID` — ID prezzo Stripe usato da `POST /api/stripe/create-checkout` (crealo in Products → Prices)  
  - `STRIPE_PUBLISHABLE_KEY` — opzionale sul backend; sul frontend imposta `VITE_STRIPE_PUBLISHABLE_KEY` (`pk_live_…` / `pk_test_…`) se usi Elements/Stripe.js  
- `KICK_CLIENT_ID`, `KICK_CLIENT_SECRET`, `KICK_REDIRECT_URI` — OAuth Kick (redirect deve coincidere con la app registrata su Kick)
- `ENCRYPTION_KEY` — obbligatoria in produzione se abiliti **2FA** (stringa lunga casuale)
- `ALLOW_USERNAME_LOGIN=true` — **solo staging**: riattiva `POST /api/auth/login` con solo username; in produzione pubblica lascia **non** impostato
- **Telemetry (consigliato)**  
  - `TELEMETRY_ADMIN_SECRET` — stringa lunga casuale; usata da GitHub Actions per `release:check`  
  - `TELEMETRY_ADMIN_USERNAMES` — lista Kick username (minuscolo, separati da virgola) che possono vedere `/api/telemetry/summary` con JWT dalla dashboard  
  - oppure `platformAdmin: true` sul documento utente in Mongo per account interni  
  - `TELEMETRY_SUMMARY_OPEN=true` — **solo sviluppo**: summary pubblica (non usare in produzione)

### Vercel (frontend)

- `VITE_API_URL` — es. `https://<service>.onrender.com/api` (obbligatorio: tutte le chiamate API usano questo base URL)
- `VITE_STRIPE_PUBLISHABLE_KEY` — opzionale, chiave pubblica Stripe se il checkout/UI la richiede
- `VITE_ALLOW_USERNAME_LOGIN=true` — solo se in staging vuoi mostrare il campo login username nel bundle monolitico (`App.jsx`); non usare in produzione pubblica

## 2. GitHub Actions

Repository secrets:

| Secret | Uso |
|--------|-----|
| `SMOKE_API_URL` | Base URL API (es. `https://....onrender.com/api`) |
| `TELEMETRY_ADMIN_SECRET` | Bearer per validare `GET /api/telemetry/summary` nel job `release:check` |
| `SMOKE_ALERT_WEBHOOK_URL` | Opzionale: Slack/Discord webhook su fallimento workflow |

Se `TELEMETRY_ADMIN_SECRET` non è impostato, `npm run release:check` fallisce sullo step summary (comportamento voluto).

## 3. Comandi locali

```bash
npm run smoke
npm run release:check
```

Per `release:check` in locale:

```bash
export SMOKE_API_URL="https://<tuo-backend>/api"
export TELEMETRY_ADMIN_SECRET="<stesso valore di Render/GitHub>"
npm run release:check
```

## 4. Backup MongoDB

- Abilita backup automatici sul provider MongoDB (Atlas: backup continui / snapshot).
- Almeno una volta all’anno esegui **restore di prova** su ambiente isolato e documenta la procedura.

## 5. Post-deploy

1. Controlla run verde su GitHub Actions (`Smoke Test Production API`).
2. Apri `/api/health` e `/api/health/ready` sul backend.
3. Smoke manuale: login app, crea un reward di test.
