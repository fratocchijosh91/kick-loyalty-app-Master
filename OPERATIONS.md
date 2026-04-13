# Operazioni produzione (KickLoyalty)

Checklist in ordine cronologico dopo ogni modifica rilevante.

## 1. Variabili ambiente

### Render (backend)

- `MONGODB_URI` — database produzione
- `JWT_SECRET` — obbligatorio in produzione
- `FRONTEND_URL` — URL Vercel dell’app
- `STRIPE_*` — chiavi e webhook secret Stripe
- **Telemetry (consigliato)**  
  - `TELEMETRY_ADMIN_SECRET` — stringa lunga casuale; usata da GitHub Actions per `release:check`  
  - `TELEMETRY_ADMIN_USERNAMES` — lista Kick username (minuscolo, separati da virgola) che possono vedere `/api/telemetry/summary` con JWT dalla dashboard  
  - oppure `platformAdmin: true` sul documento utente in Mongo per account interni  
  - `TELEMETRY_SUMMARY_OPEN=true` — **solo sviluppo**: summary pubblica (non usare in produzione)

### Vercel (frontend)

- `VITE_API_URL` — es. `https://<service>.onrender.com/api`

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
