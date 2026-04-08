# Phase 5 - Mobile API & PWA

API ottimizzate per mobile e supporto Progressive Web App (PWA).

## Features

- **Mobile Dashboard** - Dati condensati per mobile
- **Offline Sync** - Delta sync con queue azioni offline
- **Push Notifications** - Web Push API per notifiche
- **PWA** - Installabile come app nativa
- **Check-in** - QR/location-based points
- **Quick Actions** - One-tap redemption

## Mobile API Endpoints

### GET /api/mobile/dashboard
Dashboard condensata per mobile.

**Response:**
```json
{
  "success": true,
  "data": {
    "points": {
      "total": 1250,
      "earned": 3000,
      "breakdown": [
        { "streamer": "streamer1", "points": 800 },
        { "streamer": "streamer2", "points": 450 }
      ]
    },
    "rewards": {
      "available": [...],
      "count": 12
    },
    "redemptions": {
      "recent": [...],
      "pending": 2
    },
    "actions": [
      { "id": "scan", "label": "Scan QR", "icon": "qr-code" },
      { "id": "redeem", "label": "Redeem", "icon": "gift" }
    ]
  },
  "syncToken": "..."
}
```

### GET /api/mobile/sync
Delta sync per offline support.

**Query:** `?lastSync=1234567890&organizationId=...`

**Response:**
```json
{
  "success": true,
  "syncData": {
    "rewards": { "updated": [...], "fullRefresh": false },
    "points": [...],
    "redemptions": [...]
  },
  "syncToken": "...",
  "serverTime": "2024-01-15T10:00:00Z"
}
```

### POST /api/mobile/sync/offline-actions
Elabora azioni accumulate offline.

**Request:**
```json
{
  "actions": [
    { "type": "redeem", "clientId": "...", "data": {...}, "timestamp": "..." },
    { "type": "check_in", "clientId": "...", "data": {...}, "timestamp": "..." }
  ]
}
```

## Push Notifications

### POST /api/mobile/push/register
Registra subscription push.

**Request:**
```json
{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  },
  "platform": "web|ios|android",
  "deviceInfo": {
    "deviceId": "...",
    "model": "iPhone14,2",
    "os": "iOS",
    "osVersion": "17.0"
  }
}
```

### POST /api/mobile/push/preferences
Aggiorna preferenze notifiche.

**Request:**
```json
{
  "deviceId": "...",
  "preferences": {
    "redemptions": true,
    "points": true,
    "rewards": true,
    "achievements": true,
    "announcements": true,
    "marketing": false
  }
}
```

## Mobile Actions

### POST /api/mobile/check-in
Check-in per punti bonus.

**Request:**
```json
{
  "checkInCode": "EVENT2024",
  "location": { "lat": 45.0, "lng": 9.0 },
  "eventId": "event_123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Check-in completato! +50 punti",
  "data": {
    "pointsEarned": 50,
    "totalPoints": 1300,
    "checkInType": "event",
    "streak": 5
  }
}
```

### POST /api/mobile/quick-redeem
Redemption one-tap.

**Request:**
```json
{
  "rewardId": "...",
  "qrCode": "optional_qr_code"
}
```

### GET /api/mobile/rewards/nearby
Rewards basati su location.

## PWA Configuration

### Manifest
File: `frontend/public/manifest.json`

```json
{
  "name": "KickLoyalty - Rewards Platform",
  "short_name": "KickLoyalty",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#53FC18",
  "icons": [...]
}
```

### Service Worker
File: `frontend/public/sw.js`

**Features:**
- Static asset caching
- API response caching
- Background sync
- Push notification handling

### Installazione
```javascript
// Registra Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(reg => console.log('SW registered'))
    .catch(err => console.log('SW error:', err));
}

// Installa PWA
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // Mostra pulsante install
});

async function installPWA() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      console.log('PWA installed');
    }
  }
}
```

## Push Notification Setup

### 1. Generare VAPID Keys
```bash
npx web-push generate-vapid-keys
```

### 2. Configurare .env
```
VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
VAPID_SUBJECT=mailto:admin@kickloyalty.com
```

### 3. Frontend Subscription
```javascript
async function subscribePush() {
  const registration = await navigator.serviceWorker.ready;
  
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  });
  
  // Invia subscription al server
  await fetch('/api/mobile/push/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription,
      platform: 'web',
      deviceInfo: { deviceId: '...' }
    })
  });
}
```

### 4. Backend - Invio Push
```javascript
const webpush = require('web-push');

webpush.setVapidDetails(
  'mailto:admin@kickloyalty.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function sendPush(subscription, payload) {
  await webpush.sendNotification(
    subscription,
    JSON.stringify(payload)
  );
}
```

## Offline Support

### IndexedDB Schema
```javascript
const DB_NAME = 'kickloyalty-offline';
const DB_VERSION = 1;

const db = await openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    // Store azioni offline
    db.createObjectStore('actions', { keyPath: 'clientId' });
    
    // Store dati cache
    db.createObjectStore('cache', { keyPath: 'key' });
    
    // Store auth token
    db.createObjectStore('tokens', { keyPath: 'key' });
  }
});
```

### Queue Azioni Offline
```javascript
async function queueOfflineAction(type, data) {
  const action = {
    clientId: generateUUID(),
    type,
    data,
    timestamp: new Date().toISOString(),
    retryCount: 0
  };
  
  await db.put('actions', action);
  
  // Registra background sync
  if ('sync' in registration) {
    await registration.sync.register('sync-offline-actions');
  }
}
```

### Background Sync
```javascript
// sw.js
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-actions') {
    event.waitUntil(syncOfflineActions());
  }
});
```

## Database Schema

### PushSubscription
- `userId` - Utente proprietario
- `subscription` - Web Push subscription object
- `platform` - ios/android/web
- `deviceInfo` - Dettagli device
- `active` - Stato subscription
- `expiresAt` - TTL 90 giorni

### Device
- `userId` - Utente proprietario
- `deviceId` - Identificatore unico
- `platform` - ios/android/web
- `pushSubscriptionId` - Riferimento subscription
- `notificationPreferences` - Preferenze notifiche
- `isActive` - Stato device

## Rate Limiting

- Mobile API: 120 richieste/minuto (più permissivo per UX)
- Push registration: 10/minuto
- Offline sync: 50 azioni per batch

## Check-in QR Codes

Generare QR per event check-in:

```javascript
const QRCode = require('qrcode');

const checkInData = {
  type: 'kickloyalty-checkin',
  code: 'EVENT2024',
  eventId: 'event_123',
  expires: '2024-01-20T00:00:00Z'
};

const qrDataUrl = await QRCode.toDataURL(JSON.stringify(checkInData));
```

## Best Practices

1. **Lazy Loading** - Carica dati solo quando necessario
2. **Optimistic UI** - Mostra azioni immediatamente, sync in background
3. **Error Handling** - Gestisci offline gracefully
4. **Battery** - Minimizza wake-ups per push
5. **Storage** - Limita cache a 50MB
6. **Privacy** - Chiedi permesso push all'apertura app, non al login

## Testing

```bash
# Test PWA
npm run build
npm run preview

# Test Service Worker
# Chrome DevTools > Application > Service Workers

# Test Push
# Chrome DevTools > Application > Push
```
