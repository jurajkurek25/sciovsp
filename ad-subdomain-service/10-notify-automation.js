// Pridáva 4 nové emailové notifikácie do notify.js pre automatizáciu.js:
//   - notifyAdvertiserCampaignExpiringSoon — banner/video sa čoskoro skončí
//   - notifyAdvertiserCampaignLive — banner/video práve začal bežať
//   - notifyAdvertiserPrArticleApprovalReminder — PR článok čaká na
//     schválenie inzerentom už príliš dlho
//   - notifyAdminFraudFlag — admin dostane email pri automaticky odhalenom
//     rizikovom signáli (opakované zamietnutia obsahu)
//
// Presný textový match proti overenému živému súboru notify.js (po
// aplikovaní 02-notify-pr-article.js a 08-notify-pr-article-approval.js).
//
// Spusti z /home/sptrener-ad/htdocs/ad.sptrener.online:
//   node /root/ad-subdomain-service/10-notify-automation.js

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'notify.js');
const src = fs.readFileSync(FILE_PATH, 'utf8');

if (src.includes('notifyAdvertiserCampaignExpiringSoon')) {
  console.error('❌ Vyzerá to, že tieto notifikácie už existujú. Nič som nezmenil.');
  process.exit(1);
}

const OLD = `module.exports = { notifyAdminRejection, notifyAdvertiserPrArticlePublished, notifyAdvertiserPrArticleFailed, notifyAdvertiserPrArticleReadyForApproval };`;

if (!src.includes(OLD)) {
  console.error('❌ Nenašiel som presný očakávaný export riadok na konci notify.js. Nič som nezmenil.');
  console.error('   Over, či už boli aplikované 02-notify-pr-article.js a 08-notify-pr-article-approval.js.');
  process.exit(1);
}

const ADDITION = `async function notifyAdvertiserCampaignExpiringSoon({ advertiserEmail, itemType, daysLeft }) {
  const label = itemType === 'video' ? 'video reklama' : 'banner';
  if (!transporter) {
    console.warn('⚠️  Kampaň čoskoro skončí, ale SMTP nie je nastavený — email inzerentovi sa neposlal.', { advertiserEmail, itemType });
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: advertiserEmail,
      subject: \`Tvoja \${label} reklama na SP Tréner Ads čoskoro skončí\`,
      text: \`Ahoj,\\n\\ntvoja \${label} reklama na ad.sptrener.online sa skončí o \${daysLeft} dni. Ak chceš pokračovať v zobrazovaní, predĺž si predplatné v dashboarde (ad.sptrener.online/dashboard) skôr, než sa automaticky deaktivuje.\\n\\nSP Tréner Ads\`
    });
  } catch (e) {
    console.error('notify advertiser (expiring soon) email failed:', e.message);
  }
}

async function notifyAdvertiserCampaignLive({ advertiserEmail, itemType }) {
  const label = itemType === 'video' ? 'video reklama' : 'banner';
  if (!transporter) {
    console.warn('⚠️  Kampaň je live, ale SMTP nie je nastavený — email inzerentovi sa neposlal.', { advertiserEmail, itemType });
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: advertiserEmail,
      subject: \`Tvoja \${label} reklama je teraz live! 🎉\`,
      text: \`Ahoj,\\n\\ntvoja \${label} reklama práve začala bežať na ad.sptrener.online. Priebežné štatistiky si pozri v dashboarde (ad.sptrener.online/dashboard).\\n\\nSP Tréner Ads\`
    });
  } catch (e) {
    console.error('notify advertiser (campaign live) email failed:', e.message);
  }
}

async function notifyAdvertiserPrArticleApprovalReminder({ advertiserEmail }) {
  if (!transporter) {
    console.warn('⚠️  PR článok stále čaká na schválenie, ale SMTP nie je nastavený — pripomienka sa neposlala.', { advertiserEmail });
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: advertiserEmail,
      subject: 'Tvoj PR článok na SP Tréner stále čaká na schválenie',
      text: \`Ahoj,\\n\\npripomíname, že návrh tvojho PR článku je už pár dní pripravený, ale ešte si ho neschválil ani nezamietol v dashboarde.\\n\\nOtvor si dashboard (ad.sptrener.online/dashboard), pozri si návrh a rozhodni sa — kým to neurobíš, článok sa nevypublikuje.\\n\\nSP Tréner Ads\`
    });
  } catch (e) {
    console.error('notify advertiser (pr approval reminder) email failed:', e.message);
  }
}

async function notifyAdminFraudFlag({ advertiserEmail, detail }) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.warn('⚠️  Automaticky odhalený rizikový signál, ale ADMIN_EMAIL nie je nastavený — email sa neposlal.', { advertiserEmail, detail });
    return;
  }
  if (!transporter) {
    console.warn('⚠️  Automaticky odhalený rizikový signál, ale SMTP nie je nastavený — email sa neposlal.', { advertiserEmail, detail });
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: adminEmail,
      subject: '⚠️ Automaticky odhalený rizikový signál — reklamný partner',
      text: \`Automatická kontrola odhalila podozrivú aktivitu u advertisera \${advertiserEmail || '(email neznámy)'}:\\n\\n\${detail}\\n\\nÚčet nebol nijako obmedzený — len sa označil na tvoje posúdenie v admin rozhraní (GET /api/admin/flags).\\n\\nSP Tréner Ads\`
    });
  } catch (e) {
    console.error('notify admin (fraud flag) email failed:', e.message);
  }
}

module.exports = { notifyAdminRejection, notifyAdvertiserPrArticlePublished, notifyAdvertiserPrArticleFailed, notifyAdvertiserPrArticleReadyForApproval, notifyAdvertiserCampaignExpiringSoon, notifyAdvertiserCampaignLive, notifyAdvertiserPrArticleApprovalReminder, notifyAdminFraudFlag };`;

const backupPath = FILE_PATH + '.pre-automation-notify-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
const out = src.replace(OLD, ADDITION);
fs.writeFileSync(FILE_PATH, out);

console.log('✅ 4 nové notifikácie pridané do notify.js a exportované.');
console.log('   Záloha pôvodného notify.js:', backupPath);
console.log('   Over syntax: node -c notify.js');
console.log('   Nezabudni nastaviť ADMIN_EMAIL v .env, inak sa notifyAdminFraudFlag len zaloguje.');
