# Phase 4 - Batch Operations & Webhooks

Sistema completo per operazioni bulk e notifiche webhook.

## Features

- **Batch Operations** - Creazione/aggiornamento/eliminazione massiva
- **Job Queue** - Tracciamento asincrono con progress monitoring
- **Webhooks** - Notifiche eventi a endpoint esterni
- **Retry Logic** - Riconsegna automatica con exponential backoff
- **HMAC Security** - Firma delle richieste per verifica autenticità

## Batch Operations API

### POST /api/batch/rewards/create
Crea fino a 100 rewards in batch.

**Request:**
```json
{
  "organizationId": "...",
  "rewards": [
    {
      "name": "Reward 1",
      "description": "Description",
      "points": 100,
      "type": "digital"
    },
    {
      "name": "Reward 2",
      "points": 200
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Batch job started",
  "jobId": "...",
  "status": "processing"
}
```

### POST /api/batch/rewards/update
Aggiorna fino a 100 rewards in batch.

**Request:**
```json
{
  "updates": [
    { "id": "reward_id_1", "points": 150, "active": false },
    { "id": "reward_id_2", "name": "New Name" }
  ]
}
```

### POST /api/batch/rewards/delete
Elimina fino a 100 rewards in batch.

**Request:**
```json
{
  "ids": ["reward_id_1", "reward_id_2", "reward_id_3"]
}
```

### POST /api/batch/users/import
Importa fino a 500 utenti.

**Request:**
```json
{
  "organizationId": "...",
  "defaultPoints": 100,
  "users": [
    {
      "kickUsername": "user1",
      "email": "user1@example.com"
    },
    {
      "kickUsername": "user2"
    }
  ]
}
```

**Response Results:**
- `created` - Nuovo utente creato
- `duplicate` - Utente già esistente (salta)
- `error` - Errore nella creazione

### POST /api/batch/points/assign
Assegna punti a fino 200 viewer.

**Request:**
```json
{
  "reason": "Event participation bonus",
  "assignments": [
    { "viewerUsername": "viewer1", "points": 50 },
    { "viewerUsername": "viewer2", "points": 100 },
    { "viewerUsername": "viewer3", "points": -20 }
  ]
}
```

### POST /api/batch/redemptions/process
Processa massivamente redemptions (approve/reject/fulfill).

**Request:**
```json
{
  "ids": ["redemption_id_1", "redemption_id_2"],
  "action": "approve",
  "notes": "Approved by batch process"
}
```

## Job Monitoring

### GET /api/batch/jobs
Lista job con filtri opzionali.

**Query:** `?organizationId=...&status=processing&type=rewards_create`

**Response:**
```json
{
  "success": true,
  "jobs": [
    {
      "_id": "...",
      "type": "rewards_create",
      "status": "completed",
      "totalCount": 50,
      "processedCount": 50,
      "successCount": 48,
      "errorCount": 2,
      "progress": 100,
      "createdAt": "2024-01-15T10:00:00Z",
      "completedAt": "2024-01-15T10:00:15Z"
    }
  ]
}
```

### GET /api/batch/jobs/:id
Dettaglio job completo con risultati.

### POST /api/batch/jobs/:id/cancel
Cancella un job in esecuzione.

## Webhooks API

### GET /api/webhooks
Lista webhook configurati.

### POST /api/webhooks
Crea nuovo webhook.

**Request:**
```json
{
  "name": "My Integration",
  "description": "Send events to my app",
  "url": "https://myapp.com/webhooks/kickloyalty",
  "method": "POST",
  "events": [
    "redemption.requested",
    "redemption.approved",
    "redemption.fulfilled"
  ],
  "auth": {
    "type": "hmac",
    "secret": "my_webhook_secret"
  },
  "headers": [
    { "key": "X-Custom-Header", "value": "custom-value" }
  ],
  "retryPolicy": {
    "maxRetries": 5,
    "initialDelay": 1000,
    "maxDelay": 60000,
    "backoffMultiplier": 2
  }
}
```

**Auth Types:**
- `none` - No authentication
- `bearer` - Bearer token in Authorization header
- `basic` - HTTP Basic auth (username/password)
- `hmac` - HMAC-SHA256 signature in X-Signature header

### PATCH /api/webhooks/:id
Aggiorna webhook.

### DELETE /api/webhooks/:id
Elimina webhook.

### POST /api/webhooks/:id/test
Invia evento test.

### GET /api/webhooks/:id/deliveries
Storico delivery (paginato).

### POST /api/webhooks/:webhookId/deliveries/:deliveryId/retry
Riprova delivery fallita.

### GET /api/webhooks/events
Lista eventi disponibili.

## Webhook Events

| Event | Description |
|-------|-------------|
| `user.created` | Nuovo utente creato |
| `user.updated` | Dati utente aggiornati |
| `user.deleted` | Utente eliminato |
| `reward.created` | Nuovo reward creato |
| `reward.updated` | Reward aggiornato |
| `reward.deleted` | Reward eliminato |
| `redemption.requested` | Richiesta riscatto |
| `redemption.approved` | Riscatto approvato |
| `redemption.rejected` | Riscatto rifiutato |
| `redemption.fulfilled` | Riscatto completato |
| `points.assigned` | Punti assegnati |
| `points.redeemed` | Punti riscattati |
| `achievement.unlocked` | Achievement sbloccato |
| `member.invited` | Membro invitato |
| `member.joined` | Membro unito |
| `member.left` | Membro uscito |
| `subscription.created` | Sottoscrizione creata |
| `subscription.cancelled` | Sottoscrizione cancellata |
| `subscription.updated` | Sottoscrizione aggiornata |
| `batch.job.completed` | Job batch completato |
| `batch.job.failed` | Job batch fallito |

## Webhook Payload

**Headers inviati:**
```
Content-Type: application/json
User-Agent: KickLoyalty-Webhook/1.0
X-Webhook-ID: webhook_id
X-Event-ID: delivery_id
X-Event-Type: redemption.approved
X-Timestamp: 2024-01-15T10:30:00.000Z
X-Signature: sha256=abc123... (se HMAC)
X-Retry-Attempt: 2 (se retry)
```

**Body:**
```json
{
  "event": "redemption.approved",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "redemptionId": "...",
    "userId": "...",
    "rewardId": "...",
    "points": 100,
    "approvedBy": "admin_id",
    "approvedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

## HMAC Verification

Per verificare la firma HMAC:

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// Usage
const signature = req.headers['x-signature'];
const payload = req.body;
if (!verifyWebhook(payload.data, signature, WEBHOOK_SECRET)) {
  return res.status(401).send('Invalid signature');
}
```

## Retry Policy

Default configuration:
- **Max Retries:** 3
- **Initial Delay:** 1000ms
- **Max Delay:** 60000ms
- **Backoff Multiplier:** 2

Delays: 1s → 2s → 4s → 8s (capped at 60s)

## Security

- **HTTPS Required** in production
- **Max 10 webhooks** per organization
- **Signature verification** for HMAC auth
- **Sensitive data hidden** in API responses
- **TTL on delivery logs** (7 days auto-cleanup)

## Database Schema

### BatchJob
- Job type, status, progress tracking
- Results with detailed error info
- Auto-expire after 30 days

### Webhook
- Endpoint configuration
- Event subscriptions
- Auth settings (encrypted secrets)
- Delivery statistics

### WebhookDelivery
- Request/Response logging
- Retry scheduling
- 7-day TTL auto-cleanup

## Rate Limiting

- Batch operations: 5/minute
- Webhook management: 30/minute

## Permissions

| Endpoint | Permission Required |
|----------|---------------------|
| Batch rewards | `manage_rewards` |
| Batch users import | `admin` |
| Batch points | `manage_points` |
| Batch redemptions | `manage_redemptions` |
| Webhooks | `manage_webhooks` |

## Best Practices

1. **Batch Size** - Usa batch di 50-100 per bilanciare velocità e affidabilità
2. **Idempotency** - Le operazioni batch sono idempotenti dove possibile
3. **Webhook Ordering** - Non garantito ordine delivery, usa timestamp
4. **At-least-once** - Webhooks possono essere duplicati, gestisci idempotenza
5. **Async Confirmation** - I batch rispondono immediatamente, controlla status

## Examples

### cURL - Create Batch Rewards
```bash
curl -X POST http://localhost:5000/api/batch/rewards/create \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rewards": [
      {"name": "Bronze Badge", "points": 100},
      {"name": "Silver Badge", "points": 500},
      {"name": "Gold Badge", "points": 1000}
    ]
  }'
```

### cURL - Create Webhook
```bash
curl -X POST http://localhost:5000/api/webhooks \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Discord Notifications",
    "url": "https://discord.com/api/webhooks/...",
    "events": ["redemption.requested", "redemption.approved"],
    "auth": {"type": "none"}
  }'
```
