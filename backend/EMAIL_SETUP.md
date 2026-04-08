# 📧 Email Onboarding System

## Overview

Il sistema di email onboarding automatico invia notifiche in vari scenari:

- **Welcome Email**: Benvenuto per nuovi utenti
- **Team Invite**: Invito a unirsi a un team
- **Quota Alert**: Avviso quando quota raggiunge 80%
- **Invoice Email**: Ricevuta fattura dopo pagamento
- **Password Reset**: Link reset password

## Setup

### 1. Scegli Provider Email

#### Opzione A: Gmail (consigliato per test)

```bash
# Abilita 2FA su Gmail: https://myaccount.google.com/security
# Genera App Password: https://myaccount.google.com/apppasswords

# Nel .env:
EMAIL_PROVIDER=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your_app_password
```

#### Opzione B: SendGrid (production)

```bash
# Registrati: https://app.sendgrid.com
# Crea API Key: https://app.sendgrid.com/settings/api_keys

# Nel .env:
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your_sendgrid_api_key
```

#### Opzione C: Mailgun (production)

```bash
# Registrati: https://www.mailgun.com
# Ottieni API Key: https://app.mailgun.com

# Nel .env:
EMAIL_PROVIDER=mailgun
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_DOMAIN=your_domain.mailgun.org
```

### 2. Configura .env

```env
# Email Configuration
EMAIL_PROVIDER=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your_app_password

# Frontend URL (usato nei link nelle email)
FRONTEND_URL=https://app.kickloyalty.com
```

### 3. Installa Dipendenze

```bash
cd backend
npm install
```

## Utilizzo

### Invia Welcome Email

```javascript
const emailService = require('./services/email');

await emailService.sendWelcomeEmail(
  {
    username: 'john_doe',
    email: 'john@example.com'
  },
  {
    name: 'My Community'
  }
);
```

### Invia Team Invite

```javascript
await emailService.sendTeamInviteEmail(
  'invited@example.com',           // Email invitato
  'My Community',                   // Nome organizzazione
  'John Doe',                       // Chi ha invitato
  'https://app.kickloyalty.com/join/token123' // Link join
);
```

### Invia Quota Alert

```javascript
await emailService.sendQuotaAlertEmail(
  'admin@community.com',           // Email admin
  'My Community',                   // Nome org
  'API Calls',                      // Tipo quota
  8000,                             // Utilizzati
  10000                             // Limite
);
```

### Invia Invoice

```javascript
await emailService.sendInvoiceEmail(
  'admin@community.com',
  'My Community',
  {
    invoiceId: 'inv_1234567890',
    planName: 'Pro',
    amount: 29.00,
    tax: 5.80,
    taxRate: 20
  }
);
```

### Invia Password Reset

```javascript
await emailService.sendPasswordResetEmail(
  'user@example.com',
  'https://app.kickloyalty.com/reset-password?token=abc123'
);
```

## Integrazione negli API

### Esempio: Aggiungere email welcome al signup

Nel file `saas-routes.js`, modifica il POST `/api/auth/signup`:

```javascript
// Dopo creare l'utente...
const emailService = require('../services/email');

await emailService.sendWelcomeEmail(newUser, organization);
```

### Esempio: Quota Alert nei rewards

Nel middleware `checkQuota()`:

```javascript
if (usagePercentage >= 80) {
  const emailService = require('../services/email');
  
  await emailService.sendQuotaAlertEmail(
    org.contactEmail,
    org.name,
    quotaType,
    used,
    limit
  );
}
```

### Esempio: Invoice dopo Stripe payment

Nel webhook Stripe (webhook handler):

```javascript
if (event.type === 'invoice.payment_succeeded') {
  const emailService = require('../services/email');
  
  await emailService.sendInvoiceEmail(
    organization.contactEmail,
    organization.name,
    {
      invoiceId: data.object.number,
      planName: subscription.plan.name,
      amount: data.object.amount_paid / 100
    }
  );
}
```

## Template Email

Tutti i template usano:
- **Brand colors**: Verde #53FC18
- **Layout responsive**: Mobile-friendly
- **Call-to-action**: Button primari verso il dashboard
- **Branding**: Logo + footer Kick Loyalty

I template si trovano in `/backend/services/email.js`:
- `sendWelcomeEmail()` - Benvenuto utente
- `sendTeamInviteEmail()` - Invito team
- `sendQuotaAlertEmail()` - Avviso quota
- `sendInvoiceEmail()` - Ricevuta fattura
- `sendPasswordResetEmail()` - Reset password

## Troubleshooting

### Email non inviate?

1. **Controlla .env**: Assicurati che `EMAIL_PROVIDER` e credenziali siano corrette
2. **Controlla logs**: Guarda i log del server per errori di connessione
3. **Verifica provider**: Testa le credenziali sul sito del provider
4. **Sandbox mode**: Sendgrid e Mailgun richiedono conferma email destinatari in sandbox

### Gmail App Password

Se usi Gmail:
1. Abilita 2FA: https://myaccount.google.com/security
2. Genera App Password: https://myaccount.google.com/apppasswords
3. Copia la password (no spazi)
4. Incolla in `EMAIL_PASSWORD`

### SendGrid API Key scaduta?

Genera una nuova API key:
1. Vai su https://app.sendgrid.com/settings/api_keys
2. Copia la nuova key
3. Aggiorna in `.env`

## Monitoraggio

Per monitorare gli invii email in produzione:
- **Gmail**: Gmail activity log
- **SendGrid**: https://app.sendgrid.com/email_activity
- **Mailgun**: https://app.mailgun.com/app/logs

## Rate Limiting

Il servizio email non ha rate limit built-in. Consigliamo di:
- Limitare quota alert a 1 al giorno per org
- Rate limit per email address
- Implementare queue cron per invii batch

## Prossimi Step

- [ ] Implementare email queue (Bull/RabbitMQ) per affidabilità
- [ ] Dashboard di monitoraggio invii email
- [ ] Unsubscribe links nella email
- [ ] Tracking opens e clicks
- [ ] AB testing template email
