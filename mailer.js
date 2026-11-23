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

// Zobrazované meno odosielateľa — bez neho klienti (Gmail a pod.) ukazujú
// namiesto mena len holú emailovú adresu. SMTP_FROM_NAME v .env prebije
// tento default; ak SMTP_FROM už obsahuje vlastné meno (formát "Meno <email>"),
// použije sa presne tak, ako je.
const FROM_NAME = process.env.SMTP_FROM_NAME || 'Juraj z SP Tréner';
function buildFromHeader() {
  const raw = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!raw) return raw;
  if (raw.includes('<')) return raw;
  return `"${FROM_NAME}" <${raw}>`;
}

async function sendMail({ to, subject, html }) {
  if (!transporter) {
    console.warn('⚠️  SMTP nie je nastavené — email sa neposlal.', { to, subject });
    return;
  }
  try {
    await transporter.sendMail({ from: buildFromHeader(), to, subject, html });
  } catch (e) {
    console.error('sendMail zlyhal:', e.message);
  }
}

module.exports = { sendMail };
