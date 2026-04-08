# 📚 OpenAPI Documentation

## Overview

La Kick Loyalty SaaS API è completamente documentata in OpenAPI 3.0 format. Questo permette:

✅ Generazione automatica di client SDK
✅ Tool interattivi come Swagger UI e ReDoc
✅ Documentazione sempre sincronizzata col codice
✅ Test automatici degli endpoint
✅ Integrazione con API gateway

## File

```
backend/openapi.yaml  - Specifica OpenAPI completa
```

## Accedere alla Documentazione

### Opzione 1: Swagger UI (Consigliato)

Ospita la specifica su Swagger Editor:

```
https://editor.swagger.io/?url=https://api.kickloyalty.com/openapi.yaml
```

Oppure in locale durante lo sviluppo:

```bash
# Installa swagger-ui-express
npm install swagger-ui-express

# Nel server.js, aggiungi:
const swaggerUi = require('swagger-ui-express');
const yaml = require('yaml');
const fs = require('fs');

const openApiSpec = yaml.parse(fs.readFileSync('./openapi.yaml', 'utf8'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
```

Poi accedi a: `http://localhost:5000/api-docs`

### Opzione 2: ReDoc (Design-focused)

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Kick Loyalty API</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <style>
      body {
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body>
    <redoc spec-url='./openapi.yaml'></redoc>
    <script src="https://cdn.jsdelivr.net/npm/redoc@next/bundles/redoc.standalone.js"></script>
  </body>
</html>
```

### Opzione 3: Localhost con Swagger CLI

```bash
# Installa globally
npm install -g swagger-ui

# Serve la documentazione
swagger-ui ./openapi.yaml -p 8080
```

Poi accedi a: `http://localhost:8080`

## Struttura API

### Autenticazione

Tutti gli endpoint (eccetto login) richiedono:

```bash
Authorization: Bearer <JWT_TOKEN>
```

Ottieni il token da:
- `POST /api/auth/login` con Kick OAuth code

### Endpoint Principali

#### Organizations (Multi-tenant)
```
POST   /api/organizations              - Crea org
GET    /api/organizations              - Lista tutte le tue org
GET    /api/organizations/{slug}       - Dettagli org
PATCH  /api/organizations/{slug}       - Aggiorna org
```

#### Team Management
```
GET    /api/organizations/{slug}/team              - Lista team
POST   /api/organizations/{slug}/team/invite       - Invita membro
PATCH  /api/organizations/{slug}/team/{memberId}   - Aggiorna ruolo
DELETE /api/organizations/{slug}/team/{memberId}   - Rimuovi membro
```

#### Billing & Subscription
```
GET    /api/organizations/{slug}/billing           - Info billing
POST   /api/organizations/{slug}/billing/upgrade   - Upgrade plan
POST   /api/organizations/{slug}/billing/cancel    - Cancella sub.
```

#### Rewards Management
```
GET    /api/organizations/{slug}/rewards           - Lista rewards
POST   /api/organizations/{slug}/rewards           - Crea reward
PATCH  /api/organizations/{slug}/rewards/{id}      - Aggiorna reward
DELETE /api/organizations/{slug}/rewards/{id}      - Elimina reward
```

#### Viewer Points
```
GET    /api/viewer-points/{orgId}/{viewerId}       - Ottieni punti
PATCH  /api/viewer-points/{orgId}/{viewerId}       - Aggiorna punti
```

## Esempi di Utilizzo

### 1. Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "code": "AUTH_CODE_FROM_OAUTH",
    "state": "STATE_FROM_OAUTH"
  }'
```

Risposta:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "john_doe",
    "email": "john@example.com"
  }
}
```

### 2. Crea Organizzazione

```bash
curl -X POST http://localhost:5000/api/organizations \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Gaming Community",
    "slug": "my-gaming-community",
    "description": "A community for gamers"
  }'
```

### 3. Ottieni Info Billing

```bash
curl -X GET http://localhost:5000/api/organizations/my-gaming-community/billing \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Risposta:
```json
{
  "currentPlan": {
    "slug": "pro",
    "name": "Pro",
    "price": 29.00,
    "quotas": {
      "maxRewards": 50,
      "maxTeamMembers": 10,
      "maxApiCallsPerMonth": 10000
    }
  },
  "subscription": {
    "status": "active",
    "renewalDate": "2026-05-08T00:00:00Z"
  },
  "availablePlans": [...]
}
```

### 4. Invita Membro Team

```bash
curl -X POST http://localhost:5000/api/organizations/my-gaming-community/team/invite \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "team-member@example.com",
    "role": "editor"
  }'
```

### 5. Crea Reward

```bash
curl -X POST http://localhost:5000/api/organizations/my-gaming-community/rewards \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Custom Emote",
    "description": "A custom emote for the community",
    "points": 1000,
    "type": "emote",
    "image": "https://cdn.example.com/emote.png"
  }'
```

## Rate Limits

| Plan | Limit/Mese |
|------|-----------|
| Free | 1,000 |
| Pro | 10,000 |
| Business | 100,000 |
| Enterprise | Unlimited |

Ogni richiesta decrementa il contatore. Se superi il limite, ricevi `429 Too Many Requests`.

## Errori

Tutti gli errori seguono questo formato:

```json
{
  "error": "Descriptive error message",
  "details": {
    "field": "Additional error details"
  }
}
```

### Codici di Errore Comuni

| Code | Meaning |
|------|---------|
| 400 | Bad Request (dati non validi) |
| 401 | Unauthorized (token mancante o scaduto) |
| 403 | Forbidden (permessi insufficienti) |
| 404 | Not Found |
| 409 | Conflict (es: slug già esiste) |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

## Generazione Client SDK

Usando OpenAPI, puoi generare client automaticamente:

### OpenAPI Generator (npm)

```bash
npm install -g @openapitools/openapi-generator-cli

# Genera TypeScript client
openapi-generator-cli generate -i backend/openapi.yaml \
  -g typescript-axios \
  -o client-sdk-typescript
```

### Swagger Codegen

```bash
swagger-codegen generate -i backend/openapi.yaml \
  -l javascript \
  -o client-sdk-js
```

Poi usa il client generato nel tuo codice:

```typescript
import { OrganizationsApi } from './client-sdk-typescript';

const api = new OrganizationsApi();
const orgs = await api.listOrganizations();
```

## Webhooks

Quando accadono eventi importanti (nuovo reward, pagamento, etc.), inviamo un POST webhook se configurato.

```bash
POST {webhookUrl}
Content-Type: application/json
X-Webhook-Signature: sha256=...

{
  "event": "reward.created",
  "timestamp": "2026-04-08T10:30:00Z",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "organizationId": "507f1f77bcf86cd799439012",
    "name": "Custom Emote",
    "points": 1000
  }
}
```

Verifica la firma HMAC:

```javascript
const crypto = require('crypto');

const signature = req.headers['x-webhook-signature'];
const body = req.rawBody;
const secret = process.env.WEBHOOK_SECRET;

const hash = crypto
  .createHmac('sha256', secret)
  .update(body)
  .digest('hex');

if (hash !== signature.replace('sha256=', '')) {
  // Webhook non valido
  return res.status(403).json({ error: 'Invalid signature' });
}
```

## Changelog

### v1.0.0 (2026-04-08)

- ✅ Autenticazione OAuth Kick
- ✅ Multi-tenant organizations
- ✅ Team management con RBAC
- ✅ Billing con Stripe integration
- ✅ Rewards management
- ✅ Viewer points tracking

## Prossimi Aggiornamenti

- [ ] GraphQL endpoint
- [ ] WebSocket real-time updates
- [ ] Batch operations
- [ ] Advanced analytics API
- [ ] Analytics aggregation endpoint

## Support

Domande? Contatta: **api-support@kickloyalty.com**

O leggi il nostro blog: https://blog.kickloyalty.com/api
