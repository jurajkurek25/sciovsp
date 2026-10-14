// Posledný nájdený nekonzistentný odkaz v lfuk.html: footer odkazoval na
// https://sptrener.online/legal.html namiesto čistého /legal (canonical
// z main-app-patches/191). Related-section odkazy na lf-szu-bratislava a
// uvlf-kosice sú v lfuk.html už správne (zodpovedajú main-app-patches/195
// a main-app-patches/196) -- tie sa netreba dotýkať.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/199-lfuk-footer-legal-link.js

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const TARGET = path.join(PUBLIC_DIR, 'lfuk.html');

if (!fs.existsSync(TARGET)) {
  console.error('❌ Nenašiel som public/lfuk.html.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.199-lfuk-footer-legal-link-lock');
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (' + LOCK + '). Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

function replaceOnce(src, oldStr, newStr, label) {
  const count = src.split(oldStr).length - 1;
  if (count !== 1) {
    console.error('❌ ' + label + ' — kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil.');
    process.exit(1);
  }
  return src.replace(oldStr, () => newStr);
}

let html = fs.readFileSync(TARGET, 'utf8');

if (!html.includes('https://sptrener.online/legal.html')) {
  console.error('ℹ️  public/lfuk.html už neobsahuje /legal.html odkaz (už opravené alebo iný stav) — nič som nezmenil.');
  process.exit(0);
}

html = replaceOnce(html,
  `<a href="https://sptrener.online/legal.html">Obchodné podmienky</a>`,
  `<a href="https://sptrener.online/legal">Obchodné podmienky</a>`,
  'footer -> /legal namiesto /legal.html');

const backup = TARGET + '.pre-lfuk-footer-legal-link-' + Date.now();
fs.copyFileSync(TARGET, backup);
fs.writeFileSync(TARGET, html);

console.log('✅ public/lfuk.html: footer odkaz opravený na čisté /legal.');
console.log('   Záloha:', backup);
console.log('   Statický súbor -- žiadny pm2 restart netreba, stačí tvrdý refresh v prehliadači.');
