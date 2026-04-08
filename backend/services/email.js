/**
 * Email Service
 * Gestisce l'invio di email per onboarding, alerts, e notifiche
 * 
 * Setup richiesto:
 * - Gmail: Abilitare "App Password" (https://myaccount.google.com/apppasswords)
 * - Sendgrid: Generare API key (https://app.sendgrid.com/settings/api_keys)
 * - Mailgun: Generare API key (https://app.mailgun.com)
 */

const nodemailer = require('nodemailer');

// Configurazione transporter (Gmail, Sendgrid, o Mailgun)
let transporter;

/**
 * Inizializza il servizio email
 * Supporta Gmail, Sendgrid, o Mailgun via variabili di ambiente
 */
const initializeEmailService = () => {
  const emailProvider = process.env.EMAIL_PROVIDER || 'gmail';

  if (emailProvider === 'gmail') {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD // App Password per Gmail
      }
    });
  } else if (emailProvider === 'sendgrid') {
    const sgTransport = require('nodemailer-sendgrid-transport');
    transporter = nodemailer.createTransport(
      sgTransport({
        auth: {
          api_key: process.env.SENDGRID_API_KEY
        }
      })
    );
  } else if (emailProvider === 'mailgun') {
    const mailgunTransport = require('nodemailer-mailgun-transport');
    transporter = nodemailer.createTransport(
      mailgunTransport({
        auth: {
          api_key: process.env.MAILGUN_API_KEY,
          domain: process.env.MAILGUN_DOMAIN
        }
      })
    );
  }

  console.log(`📧 Email service initialized with ${emailProvider}`);
};

/**
 * Invia email di benvenuto a nuovi utenti
 */
const sendWelcomeEmail = async (user, organization) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 8px; }
        .header { text-align: center; border-bottom: 3px solid #53FC18; padding-bottom: 20px; }
        .logo { font-size: 28px; font-weight: bold; color: #53FC18; }
        .content { margin: 30px 0; line-height: 1.6; color: #333; }
        .button { display: inline-block; background: #53FC18; color: #000; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 20px 0; }
        .footer { color: #999; font-size: 12px; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🎮 KICK LOYALTY</div>
        </div>
        
        <div class="content">
          <h2>Benvenuto, ${user.username}! 🎉</h2>
          
          <p>Sei stato aggiunto a <strong>${organization.name}</strong> come membro del team.</p>
          
          <p>Il tuo ruolo: <strong>${user.role}</strong></p>
          
          <p>Con Kick Loyalty puoi:</p>
          <ul>
            <li>✨ Creare e gestire card rewards</li>
            <li>👥 Invitare team members</li>
            <li>📊 Tracciare punti loyalty</li>
            <li>💰 Gestire subscription e billing</li>
          </ul>
          
          <p>
            <a href="${process.env.FRONTEND_URL || 'https://app.kickloyalty.com'}/dashboard" class="button">
              Accedi al Dashboard
            </a>
          </p>
          
          <p>Se hai domande, contattaci: <strong>support@kickloyalty.com</strong></p>
        </div>
        
        <div class="footer">
          <p>© 2026 Kick Loyalty. Tutti i diritti riservati.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `Kick Loyalty <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: `Benvenuto in ${organization.name}! 🎉`,
      html
    });
    console.log(`✅ Welcome email sent to ${user.email}`);
  } catch (err) {
    console.error(`❌ Error sending welcome email:`, err);
  }
};

/**
 * Invia email di invito team
 */
const sendTeamInviteEmail = async (invitedEmail, organization, invitedByUser, joinLink) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 8px; }
        .header { text-align: center; border-bottom: 3px solid #53FC18; padding-bottom: 20px; }
        .logo { font-size: 28px; font-weight: bold; color: #53FC18; }
        .content { margin: 30px 0; line-height: 1.6; color: #333; }
        .button { display: inline-block; background: #53FC18; color: #000; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 20px 0; }
        .footer { color: #999; font-size: 12px; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🎮 KICK LOYALTY</div>
        </div>
        
        <div class="content">
          <h2>Sei invitato a unirti a un team! 👋</h2>
          
          <p><strong>${invitedByUser}</strong> ti ha invitato a unirti al team su <strong>${organization}</strong>.</p>
          
          <p>Con Kick Loyalty potrai collaborare per gestire rewards e loyalty points.</p>
          
          <p>
            <a href="${joinLink}" class="button">
              Accetta Invito
            </a>
          </p>
          
          <p>Il link rimane valido per 7 giorni.</p>
        </div>
        
        <div class="footer">
          <p>© 2026 Kick Loyalty. Tutti i diritti riservati.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `Kick Loyalty <${process.env.EMAIL_USER}>`,
      to: invitedEmail,
      subject: `${invitedByUser} ti ha invitato su Kick Loyalty 🎮`,
      html
    });
    console.log(`✅ Invite email sent to ${invitedEmail}`);
  } catch (err) {
    console.error(`❌ Error sending invite email:`, err);
  }
};

/**
 * Invia alert quota (80% utilizzato)
 */
const sendQuotaAlertEmail = async (organizationEmail, organizationName, quotaType, used, limit) => {
  const percentage = Math.round((used / limit) * 100);
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 8px; }
        .alert { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .content { margin: 30px 0; line-height: 1.6; color: #333; }
        .button { display: inline-block; background: #53FC18; color: #000; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; }
        .footer { color: #999; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="alert">
          <strong>⚠️ Quota Alert</strong>: Hai raggiunto il ${percentage}% della tua quota ${quotaType}
        </div>
        
        <div class="content">
          <h2>Avviso Quota</h2>
          
          <p><strong>${organizationName}</strong> ha raggiunto il <strong>${percentage}%</strong> della quota ${quotaType}:</p>
          
          <p style="font-size: 16px; color: #53FC18;">
            <strong>${used.toLocaleString()} / ${limit.toLocaleString()}</strong>
          </p>
          
          <p>Per evitare interruzioni del servizio, considera un upgrade del piano.</p>
          
          <p>
            <a href="${process.env.FRONTEND_URL || 'https://app.kickloyalty.com'}/org/${organizationName}/billing" class="button">
              Visualizza Opzioni Upgrade
            </a>
          </p>
        </div>
        
        <div class="footer">
          <p>© 2026 Kick Loyalty. Tutti i diritti riservati.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `Kick Loyalty <${process.env.EMAIL_USER}>`,
      to: organizationEmail,
      subject: `⚠️ Avviso Quota al ${percentage}% - ${organizationName}`,
      html
    });
    console.log(`✅ Quota alert email sent to ${organizationEmail}`);
  } catch (err) {
    console.error(`❌ Error sending quota alert email:`, err);
  }
};

/**
 * Invia ricevuta fattura
 */
const sendInvoiceEmail = async (organizationEmail, organizationName, invoiceDetails) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 8px; }
        .header { text-align: center; border-bottom: 3px solid #53FC18; padding-bottom: 20px; }
        .logo { font-size: 28px; font-weight: bold; color: #53FC18; }
        .invoice-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .invoice-table th { background: #f4f4f4; padding: 10px; text-align: left; border-bottom: 2px solid #ddd; }
        .invoice-table td { padding: 10px; border-bottom: 1px solid #eee; }
        .total { font-size: 18px; font-weight: bold; color: #53FC18; }
        .button { display: inline-block; background: #53FC18; color: #000; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🎮 KICK LOYALTY</div>
        </div>
        
        <div style="margin: 30px 0;">
          <h2>Ricevuta Fattura</h2>
          
          <p><strong>Organizzazione:</strong> ${organizationName}</p>
          <p><strong>Data:</strong> ${new Date().toLocaleDateString('it-IT')}</p>
          <p><strong>Fattura N.:</strong> ${invoiceDetails.invoiceId}</p>
          
          <table class="invoice-table">
            <thead>
              <tr>
                <th>Descrizione</th>
                <th style="text-align: right;">Importo</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Piano ${invoiceDetails.planName} - 1 mese</td>
                <td style="text-align: right;">€${invoiceDetails.amount.toFixed(2)}</td>
              </tr>
              ${invoiceDetails.tax ? `
              <tr>
                <td>IVA (${invoiceDetails.taxRate}%)</td>
                <td style="text-align: right;">€${invoiceDetails.tax.toFixed(2)}</td>
              </tr>
              ` : ''}
            </tbody>
          </table>
          
          <div style="border-top: 2px solid #ddd; padding-top: 20px;">
            <p>
              <strong>Totale:</strong> <span class="total">€${(invoiceDetails.amount + (invoiceDetails.tax || 0)).toFixed(2)}</span>
            </p>
          </div>
          
          <p style="margin-top: 30px; color: #666;">
            La fattura è stata registrata nel nostro sistema. Puoi visualizzare le tue fatture nel dashboard.
          </p>
          
          <p>
            <a href="${process.env.FRONTEND_URL || 'https://app.kickloyalty.com'}/org/${organizationName}/billing" class="button">
              Visualizza nel Dashboard
            </a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `Kick Loyalty <${process.env.EMAIL_USER}>`,
      to: organizationEmail,
      subject: `Ricevuta Fattura - ${organizationName} - ${invoiceDetails.invoiceId}`,
      html
    });
    console.log(`✅ Invoice email sent to ${organizationEmail}`);
  } catch (err) {
    console.error(`❌ Error sending invoice email:`, err);
  }
};

/**
 * Invia notifica password reset
 */
const sendPasswordResetEmail = async (userEmail, resetLink) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 8px; }
        .content { margin: 30px 0; line-height: 1.6; color: #333; }
        .alert { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
        .button { display: inline-block; background: #53FC18; color: #000; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="alert">
          <strong>Richiesta Reset Password</strong>
        </div>
        
        <div class="content">
          <p>Hai richiesto il reset della tua password su Kick Loyalty.</p>
          
          <p>
            <a href="${resetLink}" class="button">
              Reimposta Password
            </a>
          </p>
          
          <p style="color: #999; font-size: 12px;">
            Il link rimane valido per 1 ora. Se non hai richiesto questo reset, ignora questa email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `Kick Loyalty <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: 'Reset Password - Kick Loyalty',
      html
    });
    console.log(`✅ Password reset email sent to ${userEmail}`);
  } catch (err) {
    console.error(`❌ Error sending password reset email:`, err);
  }
};

module.exports = {
  initializeEmailService,
  sendWelcomeEmail,
  sendTeamInviteEmail,
  sendQuotaAlertEmail,
  sendInvoiceEmail,
  sendPasswordResetEmail
};
