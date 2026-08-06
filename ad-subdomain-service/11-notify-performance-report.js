// Pridáva notifyAdvertiserPerformanceReport do notify.js — týždenný email
// so súhrnom impressions/klikov (bannery) a zhliadnutí/klikov (videá) za
// automation.js -> sendPerformanceReports().
//
// Presný textový match proti overenému živému súboru notify.js (po
// aplikovaní 09-notify-automation.js).
//
// Spusti z /home/sptrener-ad/htdocs/ad.sptrener.online:
//   node /root/ad-subdomain-service/11-notify-performance-report.js

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'notify.js');
const src = fs.readFileSync(FILE_PATH, 'utf8');

if (src.includes('notifyAdvertiserPerformanceReport')) {
  console.error('❌ Vyzerá to, že táto notifikácia už existuje. Nič som nezmenil.');
  process.exit(1);
}

const OLD = `module.exports = { notifyAdminRejection, notifyAdvertiserPrArticlePublished, notifyAdvertiserPrArticleFailed, notifyAdvertiserPrArticleReadyForApproval, notifyAdvertiserCampaignExpiringSoon, notifyAdvertiserCampaignLive, notifyAdvertiserPrArticleApprovalReminder, notifyAdminFraudFlag };`;

if (!src.includes(OLD)) {
  console.error('❌ Nenašiel som presný očakávaný export riadok na konci notify.js. Nič som nezmenil.');
  console.error('   Over, či už bol aplikovaný 09-notify-automation.js.');
  process.exit(1);
}

const ADDITION = `async function notifyAdvertiserPerformanceReport({ advertiserEmail, days, impressions, clicks, views, videoClicks }) {
  if (!transporter) {
    console.warn('⚠️  Report výkonu pripravený, ale SMTP nie je nastavený — email sa neposlal.', { advertiserEmail, impressions, clicks, views, videoClicks });
    return;
  }
  const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(1) : '0.0';
  const lines = [];
  if (impressions > 0 || clicks > 0) lines.push(\`Bannery: \${impressions} zobrazení, \${clicks} klikov (CTR \${ctr}%)\`);
  if (views > 0 || videoClicks > 0) lines.push(\`Video reklama: \${views} dopozretí, \${videoClicks} klikov\`);
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: advertiserEmail,
      subject: \`📊 Tvoj report výkonu za posledných \${days} dní\`,
      text: \`Ahoj,\\n\\nsúhrn výkonu tvojej reklamy na SP Tréner Ads za posledných \${days} dní:\\n\\n\${lines.join('\\n')}\\n\\nPodrobnosti nájdeš v dashboarde (ad.sptrener.online/dashboard).\\n\\nSP Tréner Ads\`
    });
  } catch (e) {
    console.error('notify advertiser (performance report) email failed:', e.message);
  }
}

module.exports = { notifyAdminRejection, notifyAdvertiserPrArticlePublished, notifyAdvertiserPrArticleFailed, notifyAdvertiserPrArticleReadyForApproval, notifyAdvertiserCampaignExpiringSoon, notifyAdvertiserCampaignLive, notifyAdvertiserPrArticleApprovalReminder, notifyAdminFraudFlag, notifyAdvertiserPerformanceReport };`;

const backupPath = FILE_PATH + '.pre-performance-report-notify-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
const out = src.replace(OLD, ADDITION);
fs.writeFileSync(FILE_PATH, out);

console.log('✅ notifyAdvertiserPerformanceReport pridané do notify.js a exportované.');
console.log('   Záloha pôvodného notify.js:', backupPath);
console.log('   Over syntax: node -c notify.js');
