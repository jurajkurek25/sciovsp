// Zapája nový router automation.js do server.js — presne rovnaký vzor ako
// 03-server-wire-pr-articles.js použil pre pr-articles.js: require +
// app.use() hneď vedľa neho. Žiadna existujúca logika sa nemení.
//
// Presný textový match proti overenému živému súboru server.js (po
// aplikovaní 03-server-wire-pr-articles.js).
//
// Spusti z /home/sptrener-ad/htdocs/ad.sptrener.online:
//   node /root/ad-subdomain-service/11-server-wire-automation.js
// (predpokladá, že automation.js je skopírovaný do tohto priečinka a že
//  10-notify-automation.js aj schema-ad-automation.sql už boli aplikované)

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'server.js');
const src = fs.readFileSync(FILE_PATH, 'utf8');

if (src.includes('automationRouter')) {
  console.error('❌ Vyzerá to, že automation už je zapojený. Nič som nezmenil.');
  process.exit(1);
}

if (!fs.existsSync(path.join(process.cwd(), 'automation.js'))) {
  console.error('❌ automation.js sa nenašiel v tomto priečinku. Skopíruj ho sem pred spustením tohto skriptu.');
  process.exit(1);
}

const OLD_REQUIRES = `const { router: prArticlesRouter, handlePrArticlePaid } = require('./pr-articles');`;

const NEW_REQUIRES = `const { router: prArticlesRouter, handlePrArticlePaid } = require('./pr-articles');
const { router: automationRouter } = require('./automation');`;

const OLD_MOUNT = `app.use(prArticlesRouter);`;

const NEW_MOUNT = `app.use(prArticlesRouter);
app.use(automationRouter);`;

for (const [name, needle] of [['requires', OLD_REQUIRES], ['mount', OLD_MOUNT]]) {
  if (!src.includes(needle)) {
    console.error(`❌ Nenašiel som presný očakávaný blok "${name}" v server.js. Nič som nezmenil.`);
    console.error('   Over, či už bol aplikovaný 03-server-wire-pr-articles.js.');
    process.exit(1);
  }
}

const backupPath = FILE_PATH + '.pre-automation-wire-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
let out = src.replace(OLD_REQUIRES, NEW_REQUIRES);
out = out.replace(OLD_MOUNT, NEW_MOUNT);
fs.writeFileSync(FILE_PATH, out);

console.log('✅ automation router zapojený (POST /api/admin/cron/daily, GET/POST /api/admin/flags*).');
console.log('   Záloha pôvodného server.js:', backupPath);
console.log('   Over syntax: node -c server.js');
