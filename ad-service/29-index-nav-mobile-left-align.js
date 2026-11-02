// Nadväzuje na 28-index-mobile-fixes.js: mení mobilné rozloženie nav lišty
// zo "zalom na 2 riadky, vycentrovať" na "zalom na 2 riadky, zarovnať
// vľavo" (bližšie k logu, nie do stredu) a pridáva !important na kľúčové
// layoutové vlastnosti ako poistku, keby niečo iné so špecifickosťou
// prekáž alo. Aj vnútorný <div> (Blog/SK/CZ/CTA) teraz smie sám vnútorne
// zalomiť, keby sa aj tak nezmestil na jeden riadok — dvojitá poistka proti
// pretečeniu.
//
// Predpoklad: 28-index-mobile-fixes.js už bol aplikovaný.
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online/public:
//   node /root/ad-service/29-index-nav-mobile-left-align.js

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'index.html');
const src = fs.readFileSync(FILE_PATH, 'utf8');

const OLD_BLOCK = `@media(max-width:480px){
  nav{flex-wrap:wrap;row-gap:.6rem;padding:.85rem 1.25rem}
  nav > div{width:100%;justify-content:center}
  .nav-logo{font-size:11px}
  .nav-link{padding:.45rem .6rem}
  .nav-cta{padding:.5rem .85rem;font-size:.74rem}
}`;

const NEW_BLOCK = `@media(max-width:480px){
  nav{flex-wrap:wrap!important;justify-content:flex-start!important;row-gap:.5rem;padding:.85rem 1.25rem}
  nav > div{width:100%!important;justify-content:flex-start!important;flex-wrap:wrap;gap:.5rem!important}
  .nav-logo{font-size:11px}
  .nav-link{padding:.4rem .55rem}
  .nav-cta{padding:.45rem .75rem;font-size:.7rem}
}`;

if (src.includes(NEW_BLOCK)) {
  console.error('❌ Vyzerá to, že oprava je už aplikovaná. Nič som nezmenil.');
  process.exit(1);
}
if (!src.includes(OLD_BLOCK)) {
  console.error('❌ Nenašiel som očakávaný 480px blok presne. Nič som nezmenil. Over, či je aplikovaný 28-index-mobile-fixes.js.');
  process.exit(1);
}

const backupPath = FILE_PATH + '.pre-nav-left-align-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
fs.writeFileSync(FILE_PATH, src.replace(OLD_BLOCK, NEW_BLOCK));

console.log('✅ Nav lišta na mobile je teraz zarovnaná vľavo (nie na stred), s !important poistkou.');
console.log('   Záloha pôvodného index.html:', backupPath);
