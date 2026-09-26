// Rozširuje notifyAdvertiserPerformanceReport (z 11-notify-performance-
// report.js) o odhlasovací odkaz na konci emailu — jediný "marketingový"
// typ emailu z automation.js, ostatné (expirácia/live/PR pripomienka) sa
// priamo týkajú advertiserovej vlastnej platenej kampane a opt-out nemajú.
//
// Presný textový match proti overenému živému súboru notify.js (po
// aplikovaní 12-notify-performance-report.js).
//
// Spusti z /home/sptrener-ad/htdocs/ad.sptrener.online:
//   node /root/ad-subdomain-service/13-notify-performance-report-unsubscribe.js

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'notify.js');
const src = fs.readFileSync(FILE_PATH, 'utf8');

if (src.includes('unsubscribeUrl')) {
  console.error('❌ Vyzerá to, že odhlasovací odkaz už je zapojený. Nič som nezmenil.');
  process.exit(1);
}

const OLD = `async function notifyAdvertiserPerformanceReport({ advertiserEmail, days, impressions, clicks, views, videoClicks }) {
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
}`;

if (!src.includes(OLD)) {
  console.error('❌ Nenašiel som presný očakávaný text notifyAdvertiserPerformanceReport v notify.js. Nič som nezmenil.');
  console.error('   Over, či už bol aplikovaný 12-notify-performance-report.js.');
  process.exit(1);
}

const NEW = `async function notifyAdvertiserPerformanceReport({ advertiserEmail, days, impressions, clicks, views, videoClicks, unsubscribeUrl }) {
  if (!transporter) {
    console.warn('⚠️  Report výkonu pripravený, ale SMTP nie je nastavený — email sa neposlal.', { advertiserEmail, impressions, clicks, views, videoClicks });
    return;
  }
  const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(1) : '0.0';
  const lines = [];
  if (impressions > 0 || clicks > 0) lines.push(\`Bannery: \${impressions} zobrazení, \${clicks} klikov (CTR \${ctr}%)\`);
  if (views > 0 || videoClicks > 0) lines.push(\`Video reklama: \${views} dopozretí, \${videoClicks} klikov\`);
  const unsubLine = unsubscribeUrl ? \`\\n\\n---\\nToto je automatický týždenný report. Odhlásiť sa: \${unsubscribeUrl}\` : '';
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: advertiserEmail,
      subject: \`📊 Tvoj report výkonu za posledných \${days} dní\`,
      text: \`Ahoj,\\n\\nsúhrn výkonu tvojej reklamy na SP Tréner Ads za posledných \${days} dní:\\n\\n\${lines.join('\\n')}\\n\\nPodrobnosti nájdeš v dashboarde (ad.sptrener.online/dashboard).\\n\\nSP Tréner Ads\${unsubLine}\`
    });
  } catch (e) {
    console.error('notify advertiser (performance report) email failed:', e.message);
  }
}`;

const backupPath = FILE_PATH + '.pre-performance-report-unsubscribe-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
const out = src.replace(OLD, NEW);
fs.writeFileSync(FILE_PATH, out);

console.log('✅ notifyAdvertiserPerformanceReport teraz obsahuje odhlasovací odkaz.');
console.log('   Záloha pôvodného notify.js:', backupPath);
console.log('   Over syntax: node -c notify.js');
