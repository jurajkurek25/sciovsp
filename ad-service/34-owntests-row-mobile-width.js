// Rovnaký bug ako .hero-stats (32-hero-stats-mobile-width.js): .owntests-example-row
// je display:flex bez šírky (shrink-to-fit), na mobile sa prepína na
// flex-direction:column bez width:100% — box (aj jeho border-bottom deliaca
// čiara) zostáva úzky namiesto plnej šírky, čo vyzerá ako prázdna medzera
// vpravo, opakovane pre každý riadok v zozname.
//
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online/public:
//   node /root/ad-service/34-owntests-row-mobile-width.js

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'index.html');
const src = fs.readFileSync(FILE_PATH, 'utf8');

const OLD_CSS = `  .owntests-example-row{flex-direction:column;gap:.2rem}`;
const NEW_CSS = `  .owntests-example-row{flex-direction:column;gap:.2rem;width:100%}`;

if (src.includes(NEW_CSS)) {
  console.error('❌ Vyzerá to, že oprava je už aplikovaná. Nič som nezmenil.');
  process.exit(1);
}
if (!src.includes(OLD_CSS)) {
  console.error('❌ Nenašiel som očakávané CSS pre .owntests-example-row v mobilnej media query presne. Nič som nezmenil.');
  process.exit(1);
}

const backupPath = FILE_PATH + '.pre-owntests-width-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
fs.writeFileSync(FILE_PATH, src.replace(OLD_CSS, NEW_CSS));

console.log('✅ .owntests-example-row teraz na mobile vyplní celú šírku (rovnaká oprava ako .hero-stats).');
console.log('   Záloha pôvodného index.html:', backupPath);
