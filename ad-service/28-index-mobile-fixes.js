// Opravuje dva reálne mobilné bugy na index.html, nájdené a overené cez
// Playwright na 375px viewporte:
//
// 1. Popup referral kód: .popup-ref-input má flex:1 ale žiadny min-width,
//    takže flexbox nedovolí zmenšiť ho pod jeho obsahovú šírku — riadok
//    (input + tlačidlo "Overiť") pretiekol o ~33px mimo popup na úzkych
//    telefónoch (scrollWidth 405 vs clientWidth 327 na 375px viewporte).
//
// 2. Horná nav lišta: logo + "Blog" odkaz + SK/CZ prepínač + CTA tlačidlo
//    sa na mobile natlačia do jedného riadku, ktorý sa nezmestí — text sa
//    láme (\"SP TRÉNER\" na dva riadky, \"Začať zadarmo →\" tiež) a lišta
//    vyzerá neporiadne. Rieši sa kontrolovaným zalomením na 2 riadky pod
//    480px (namiesto náhodného lámania textu vnútri jednotlivých prvkov) —
//    .hero má už aj tak 8rem padding-top, takže vyššia nav lišta na mobile
//    nič neprekryje.
//
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online/public:
//   node /root/ad-service/28-index-mobile-fixes.js

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'index.html');
const src = fs.readFileSync(FILE_PATH, 'utf8');

const OLD_REF_INPUT = `.popup-ref-input{flex:1;padding:.65rem .9rem;background:var(--black3);border:1px solid var(--border2);border-radius:9px;color:var(--text);font-family:var(--mono);font-size:.85rem;letter-spacing:.12em;text-transform:uppercase;outline:none;transition:border-color .2s}`;
const NEW_REF_INPUT = `.popup-ref-input{flex:1;min-width:0;padding:.65rem .9rem;background:var(--black3);border:1px solid var(--border2);border-radius:9px;color:var(--text);font-family:var(--mono);font-size:.85rem;letter-spacing:.12em;text-transform:uppercase;outline:none;transition:border-color .2s}`;

const OLD_768_BLOCK = `@media(max-width:768px){
  nav{padding:1rem 1.5rem}
  .hero-stats{flex-direction:column}
  .hero-stat{border-right:none;border-bottom:1px solid var(--border)}
  .hero-stat:last-child{border-bottom:none}
  .feature-grid{grid-template-columns:1fr}
  .owntests-example-row{flex-direction:column;gap:.2rem}
  .owntests-example-school{min-width:0}
  .lang-btn{padding:.4rem .55rem;font-size:.68rem}
  footer{flex-direction:column;text-align:center}
  body{padding-bottom:70px}
}
@media(max-width:600px){
  .pricing-grid{grid-template-columns:1fr}
}`;

const NEW_768_BLOCK = `@media(max-width:768px){
  nav{padding:1rem 1.5rem}
  .hero-stats{flex-direction:column}
  .hero-stat{border-right:none;border-bottom:1px solid var(--border)}
  .hero-stat:last-child{border-bottom:none}
  .feature-grid{grid-template-columns:1fr}
  .owntests-example-row{flex-direction:column;gap:.2rem}
  .owntests-example-school{min-width:0}
  .lang-btn{padding:.4rem .55rem;font-size:.68rem}
  footer{flex-direction:column;text-align:center}
  body{padding-bottom:70px}
}
@media(max-width:600px){
  .pricing-grid{grid-template-columns:1fr}
}
@media(max-width:480px){
  nav{flex-wrap:wrap;row-gap:.6rem;padding:.85rem 1.25rem}
  nav > div{width:100%;justify-content:center}
  .nav-logo{font-size:11px}
  .nav-link{padding:.45rem .6rem}
  .nav-cta{padding:.5rem .85rem;font-size:.74rem}
}`;

if (src.includes('nav > div{width:100%;justify-content:center}')) {
  console.error('❌ Vyzerá to, že oprava je už aplikovaná. Nič som nezmenil.');
  process.exit(1);
}
if (!src.includes(OLD_REF_INPUT)) {
  console.error('❌ Nenašiel som očakávané CSS pre .popup-ref-input presne. Nič som nezmenil.');
  process.exit(1);
}
if (!src.includes(OLD_768_BLOCK)) {
  console.error('❌ Nenašiel som očakávaný blok mobilných @media pravidiel presne. Nič som nezmenil.');
  process.exit(1);
}

const backupPath = FILE_PATH + '.pre-mobile-fixes-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
let out = src.replace(OLD_REF_INPUT, NEW_REF_INPUT);
out = out.replace(OLD_768_BLOCK, NEW_768_BLOCK);
fs.writeFileSync(FILE_PATH, out);

console.log('✅ Mobilné bugy opravené: referral input sa už nezmestí mimo popup, nav lišta sa čisto zalomí na 2 riadky namiesto lámania textu.');
console.log('   Záloha pôvodného index.html:', backupPath);
