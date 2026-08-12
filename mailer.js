// Jednoduchý mailer pre hlavnú appku. Ak SMTP nie je nastavené v .env,
// email sa len zaloguje namiesto pádu — rovnaký princíp ako v ostatných
// SP Tréner appkách (ad-subdomain-service/notify.js, partner/mailer.js).
const nodemailer = require('nodemailer');

let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

async function sendMail({ to, subject, html }) {
  if (!transporter) {
    console.warn('⚠️  SMTP nie je nastavené — email sa neposlal.', { to, subject });
    return;
  }
  try {
    await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, html });
  } catch (e) {
    console.error('sendMail zlyhal:', e.message);
  }
}

module.exports = { sendMail };
