// Pridáva dve nové emailové notifikácie do notify.js pre inzerenta samotného
// (nie len admina) — pri PR článku ide o jednorazovú platbu 249€, takže ak
// automatické generovanie/publikovanie zlyhá, inzerent MUSÍ dostať správu,
// inak zaplatil a nevie prečo nič nevidí. Rovnaký "ak SMTP nie je nastavený,
// aspoň sa to zaloguje" princíp ako existujúca notifyAdminRejection.
//
// Presný textový match proti overenému živému súboru notify.js.
//
// Spusti z /home/sptrener-ad/htdocs/ad.sptrener.online:
//   node /root/ad-subdomain-service/02-notify-pr-article.js

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'notify.js');
const src = fs.readFileSync(FILE_PATH, 'utf8');

if (src.includes('notifyAdvertiserPrArticlePublished')) {
  console.error('❌ Vyzerá to, že notifikácie pre PR článok už existujú. Nič som nezmenil.');
  process.exit(1);
}

const OLD = `module.exports = { notifyAdminRejection };`;

if (!src.includes(OLD)) {
  console.error('❌ Nenašiel som presný očakávaný export riadok na konci notify.js. Nič som nezmenil.');
  process.exit(1);
}

const ADDITION = `async function notifyAdvertiserPrArticlePublished({ advertiserEmail, blogUrl }) {
  if (!transporter) {
    console.warn('⚠️  PR článok vypublikovaný, ale SMTP nie je nastavený — email inzerentovi sa neposlal.', { advertiserEmail, blogUrl });
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: advertiserEmail,
      subject: 'Tvoj PR článok je na blogu SP Tréner živý! 🎉',
      text: \`Ahoj,\\n\\ntvoj PR článok bol automaticky vygenerovaný, prešiel kontrolou obsahu a je teraz živý na blogu SP Tréner:\\n\${blogUrl}\\n\\nĎakujeme za spoluprácu.\\nSP Tréner Ads\`
    });
  } catch (e) {
    console.error('notify advertiser (published) email failed:', e.message);
  }
}

async function notifyAdvertiserPrArticleFailed({ advertiserEmail, reason }) {
  if (!transporter) {
    console.warn('⚠️  PR článok sa nepodarilo automaticky vypublikovať, ale SMTP nie je nastavený — email inzerentovi sa neposlal.', { advertiserEmail, reason });
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: advertiserEmail,
      subject: 'Tvoj PR článok na SP Tréner sa nepodarilo automaticky vypublikovať',
      text: \`Ahoj,\\n\\nplatba za tvoj PR článok prebehla v poriadku, ale automatické vygenerovanie/publikovanie článku sa nepodarilo dokončiť.\\n\\nDôvod: \${reason || 'neznámy dôvod, preveríme to ručne.'}\\n\\nOzveme sa ti čo najskôr s riešením (buď opravíme a vypublikujeme ručne, alebo vrátime platbu) — netreba nič robiť, sme na to už upozornení.\\n\\nSP Tréner Ads\`
    });
  } catch (e) {
    console.error('notify advertiser (failed) email failed:', e.message);
  }
}

module.exports = { notifyAdminRejection, notifyAdvertiserPrArticlePublished, notifyAdvertiserPrArticleFailed };`;

const backupPath = FILE_PATH + '.pre-pr-article-notify-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
const out = src.replace(OLD, ADDITION);
fs.writeFileSync(FILE_PATH, out);

console.log('✅ notifyAdvertiserPrArticlePublished/Failed pridané do notify.js a exportované.');
console.log('   Záloha pôvodného notify.js:', backupPath);
console.log('   Over syntax: node -c notify.js');
