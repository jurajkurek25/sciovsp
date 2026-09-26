// Pridáva notifyAdvertiserPrArticleReadyForApproval do notify.js — Inzerent
// dostane email, keď AI vygeneruje a automatická kontrola schváli návrh
// PR článku, ktorý teraz čaká na jeho manuálne schválenie v dashboarde
// (predtým sa v tomto bode rovno publikovalo bez zásahu Inzerenta).
//
// Presný textový match proti overenému živému súboru notify.js (po
// aplikovaní 02-notify-pr-article.js).
//
// Spusti z /home/sptrener-ad/htdocs/ad.sptrener.online:
//   node /root/ad-subdomain-service/08-notify-pr-article-approval.js

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'notify.js');
const src = fs.readFileSync(FILE_PATH, 'utf8');

if (src.includes('notifyAdvertiserPrArticleReadyForApproval')) {
  console.error('❌ Vyzerá to, že táto notifikácia už existuje. Nič som nezmenil.');
  process.exit(1);
}

const OLD = `module.exports = { notifyAdminRejection, notifyAdvertiserPrArticlePublished, notifyAdvertiserPrArticleFailed };`;

if (!src.includes(OLD)) {
  console.error('❌ Nenašiel som presný očakávaný export riadok na konci notify.js. Nič som nezmenil.');
  process.exit(1);
}

const ADDITION = `async function notifyAdvertiserPrArticleReadyForApproval({ advertiserEmail }) {
  if (!transporter) {
    console.warn('⚠️  PR článok čaká na schválenie, ale SMTP nie je nastavený — email inzerentovi sa neposlal.', { advertiserEmail });
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: advertiserEmail,
      subject: 'Tvoj PR článok na SP Tréner je pripravený na schválenie',
      text: \`Ahoj,\\n\\nAI vygenerovala a skontrolovala návrh tvojho PR článku — teraz čaká na tvoje schválenie v dashboarde, kým sa vypublikuje na blog.sptrener.online.\\n\\nOtvor si dashboard (ad.sptrener.online/dashboard), pozri si návrh a buď ho schváľ, alebo ho zamietni s dôvodom, ak niečo nesedí.\\n\\nSP Tréner Ads\`
    });
  } catch (e) {
    console.error('notify advertiser (pending approval) email failed:', e.message);
  }
}

module.exports = { notifyAdminRejection, notifyAdvertiserPrArticlePublished, notifyAdvertiserPrArticleFailed, notifyAdvertiserPrArticleReadyForApproval };`;

const backupPath = FILE_PATH + '.pre-pr-article-approval-notify-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
const out = src.replace(OLD, ADDITION);
fs.writeFileSync(FILE_PATH, out);

console.log('✅ notifyAdvertiserPrArticleReadyForApproval pridané do notify.js a exportované.');
console.log('   Záloha pôvodného notify.js:', backupPath);
console.log('   Over syntax: node -c notify.js');
