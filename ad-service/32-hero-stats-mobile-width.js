// .hero-stats je flex kontajner bez explicitnej šírky — na desktope je to
// v poriadku (riadok vedľa seba, šírka podľa obsahu), ale v mobilnej
// @media(max-width:768px) sekcii sa prepína na flex-direction:column bez
// pridania width:100%, takže box zostáva široký len ako jeho najširší
// riadok textu namiesto celej dostupnej šírky — vznikla prázdna medzera
// vpravo (presne to, čo bolo vidieť na screenshote).
//
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online/public:
//   node /root/ad-service/32-hero-stats-mobile-width.js

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'index.html');
const src = fs.readFileSync(FILE_PATH, 'utf8');

const OLD_CSS = `  .hero-stats{flex-direction:column}`;
const NEW_CSS = `  .hero-stats{flex-direction:column;width:100%}`;

if (src.includes(NEW_CSS)) {
  console.error('❌ Vyzerá to, že oprava je už aplikovaná. Nič som nezmenil.');
  process.exit(1);
}
if (!src.includes(OLD_CSS)) {
  console.error('❌ Nenašiel som očakávané CSS pre .hero-stats v mobilnej media query presne. Nič som nezmenil.');
  process.exit(1);
}

const backupPath = FILE_PATH + '.pre-hero-stats-width-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
fs.writeFileSync(FILE_PATH, src.replace(OLD_CSS, NEW_CSS));

console.log('✅ .hero-stats box teraz na mobile vyplní celú šírku namiesto prázdnej medzery vpravo.');
console.log('   Záloha pôvodného index.html:', backupPath);
