// Voliteľné emailové upozornenie admina pri automatickom zamietnutí obsahu.
// Ak SMTP nie je nastavený, len sa to zaloguje do konzoly (pm2 logs) —
// appka nezlyhá, ale odporúča sa SMTP doplniť kvôli reálnemu dohľadu.

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

async function notifyAdminRejection({ advertiserEmail, itemType, linkUrl, category, reason }) {
  if (!transporter || !process.env.ADMIN_EMAIL) {
    console.warn('⚠️  AI moderácia zamietla obsah, ale SMTP/ADMIN_EMAIL nie je nastavený — email sa neposlal.', { advertiserEmail, itemType, linkUrl, category, reason });
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.ADMIN_EMAIL,
      subject: `[SP Tréner Ads] AI zamietla ${itemType === 'video' ? 'video reklamu' : 'banner'} — ${category}`,
      text: `Inzerent: ${advertiserEmail}\nCieľová URL: ${linkUrl}\nKategória: ${category}\nDôvod: ${reason}\n\nAk ide o falošný poplach, skontroluj a rieš priamo s inzerentom (napr. ho nechaj nahrať znova) — rozhodnutie je zaznamenané v tabuľke moderation_log.`
    });
  } catch (e) {
    console.error('notify email failed:', e.message);
  }
}

module.exports = { notifyAdminRejection };
