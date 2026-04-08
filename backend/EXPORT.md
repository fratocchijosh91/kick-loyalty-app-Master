# Phase 3 - Advanced Reporting & Export

Sistema completo di esportazione dati in CSV e PDF con report programmati.

## Features

- **CSV Export** - Dati tabulari per Excel/analisi
- **PDF Reports** - Report professionali con grafici
- **Scheduled Exports** - Report automatici giornalieri/settimanali/mensili
- **Export History** - Tracciamento export effettuati

## API Endpoints

### CSV Exports

#### GET /api/exports/csv/analytics
Esporta analytics in CSV.

**Query Parameters:**
- `startDate` (ISO8601) - Data inizio
- `endDate` (ISO8601) - Data fine
- `organizationId` (MongoID) - Filtra per organizzazione

**Response:** File CSV download

#### GET /api/exports/csv/users
Esporta lista utenti (admin only).

**Query Parameters:**
- `organizationId` - Filtra per organizzazione
- `active` (boolean) - Solo utenti attivi
- `sortBy` (`points`, `createdAt`, `lastLogin`) - Ordinamento

#### GET /api/exports/csv/rewards
Esporta catalogo premi (admin only).

**Query Parameters:**
- `organizationId` - Filtra per organizzazione
- `active` (boolean) - Solo premi attivi

#### GET /api/exports/csv/redemptions
Esporta storico riscatti (admin only).

**Query Parameters:**
- `organizationId` - Filtra per organizzazione
- `status` (`pending`, `approved`, `completed`, `cancelled`) - Filtra stato
- `startDate`, `endDate` - Range date

#### GET /api/exports/csv/audit
Esporta audit logs (admin only).

**Query Parameters:**
- `organizationId` - Filtra per organizzazione
- `action` - Filtra per tipo azione
- `startDate`, `endDate` - Range date

### PDF Reports

#### GET /api/exports/pdf/analytics
Genera report PDF analytics.

**Query Parameters:**
- `organizationId` - Filtra per organizzazione
- `period` (`7d`, `30d`, `90d`, `1y`) - Periodo report

**Response:** File PDF download con:
- Summary metrics (users, rewards, redemptions, points)
- Tabella recent redemptions
- Formattazione professionale

#### GET /api/exports/pdf/leaderboard
Genera report PDF classifica.

**Query Parameters:**
- `organizationId` - Filtra per organizzazione
- `streamerUsername` - Filtra per streamer
- `limit` (1-100, default 50) - Numero posizioni

### Export Management

#### GET /api/exports/formats
Restituisce formati disponibili.

**Response:**
```json
{
  "success": true,
  "formats": {
    "csv": {
      "name": "CSV",
      "description": "Comma-separated values",
      "mimeType": "text/csv",
      "extensions": ["csv"],
      "availableFor": ["analytics", "users", "rewards", "redemptions", "audit", "leaderboard"]
    },
    "pdf": {
      "name": "PDF",
      "description": "Professional formatted report",
      "mimeType": "application/pdf",
      "extensions": ["pdf"],
      "availableFor": ["analytics", "leaderboard"]
    }
  },
  "types": [
    { "id": "analytics", "name": "Analytics Overview", "description": "..." }
  ]
}
```

#### GET /api/exports/history
Storico export utente corrente.

**Response:**
```json
{
  "success": true,
  "exports": [
    {
      "id": "...",
      "type": "analytics",
      "format": "csv",
      "createdAt": "2024-01-15T10:30:00Z",
      "isScheduled": false
    }
  ]
}
```

#### POST /api/exports/scheduled
Crea export programmato (admin only).

**Request Body:**
```json
{
  "name": "Weekly Analytics Report",
  "type": "analytics",
  "format": "csv",
  "frequency": "weekly",
  "recipients": ["admin@example.com", "manager@example.com"],
  "filters": {
    "organizationId": "..."
  }
}
```

**Frequenze disponibili:**
- `daily` - Ogni giorno alle 9:00
- `weekly` - Ogni 7 giorni
- `monthly` - Il 1° di ogni mese

## Frontend Components

### ExportManager
Componente principale per gestione export.

```jsx
import ExportManager from './components/export/ExportManager';

<ExportManager 
  organizationId="org_id"
  userRole="admin"
/>
```

**Features:**
- Filtri date/stato
- Griglia export types
- Storico export
- Creazione export programmati (admin)

### ExportButton
Bottone rapido per export singolo.

```jsx
import { ExportButton } from './components/export/ExportManager';

<ExportButton 
  type="analytics"
  format="csv"
  label="Export CSV"
  filters={{ startDate: '2024-01-01' }}
/>
```

## Configurazione Puppeteer

Per generazione PDF, Puppeteer richiede Chrome/Chromium.

### Local Development
```bash
# macOS
brew install chromium

# Ubuntu/Debian
sudo apt-get install chromium-browser

# Set env variable
export PUPPETEER_EXECUTABLE_PATH=$(which chromium)
```

### Production (Docker)
```dockerfile
FROM node:18-slim

# Install Chrome dependencies
RUN apt-get update && apt-get install -y \
  chromium \
  fonts-liberation \
  --no-install-recommends

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

### Railway/Heroku
```bash
# Add buildpack
heroku buildpacks:add jontewks/puppeteer

# Or use apt buildpack
heroku buildpacks:add --index 1 heroku-community/apt
```

Create `Aptfile`:
```
gconf-service
libasound2
libatk1.0-0
libatk-bridge2.0-0
cups-bsd
libxcomposite1
libxdamage1
```

## Rate Limiting

Gli endpoint export hanno limiti per prevenire abuso:
- **10 export per 15 minuti** per utente
- Admin esclusi da alcuni limiti

## Sicurezza

- JWT authentication richiesta per tutti gli endpoint
- Admin role richiesto per export users/rewards/redemptions/audit
- Organization filtering per multi-tenancy
- Input validation su tutti i parametri

## Dipendenze

```json
{
  "json2csv": "^6.0.0",
  "puppeteer": "^21.6.1"
}
```

Installazione:
```bash
cd backend
npm install json2csv puppeteer
```

## CSV Format

Tutti i CSV usano:
- Delimiter: comma (`,`)  
- Quote char: double quote (`"`)
- Header row con nomi colonne
- Encoding: UTF-8
- Date format: ISO8601

## PDF Template

I report PDF includono:
- Header con logo organizzazione
- Summary cards (metriche chiave)
- Tabella dati formattata
- Footer con data generazione
- Branding KickLoyalty

## Esempi

### cURL - Export CSV Analytics
```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:5000/api/exports/csv/analytics?startDate=2024-01-01&endDate=2024-01-31" \
  --output analytics-jan.csv
```

### cURL - Export PDF Leaderboard
```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:5000/api/exports/pdf/leaderboard?streamerUsername=mystreamer&limit=100" \
  --output leaderboard.pdf
```

### JavaScript - Scheduled Export
```javascript
const createScheduledExport = async () => {
  const res = await fetch('/api/exports/scheduled', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Monthly Report',
      type: 'analytics',
      format: 'pdf',
      frequency: 'monthly',
      recipients: ['admin@example.com']
    })
  });
  return res.json();
};
```

## Note

- I PDF usano Puppeteer headless (Chrome in background)
- I CSV sono generati in-memory e streamati al client
- Non c'è persistenza file su server (privacy/security)
- Scheduled exports richiedono implementazione cron job separata per invio email
