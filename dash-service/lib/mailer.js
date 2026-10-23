// Vlastný mailer pre dash appku — na jednotlivé/hromadné odosielanie
// emailov kontaktom z webinárového zoznamu (rovnaké SMTP_* ako hlavná
// appka, keďže posiela do rovnakého zoznamu). Rovnaký princíp ako
// mailer.js v hlavnej appke / partner appke.
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
    return { sent: false };
  }
  await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, html });
  return { sent: true };
}

module.exports = { sendMail };
