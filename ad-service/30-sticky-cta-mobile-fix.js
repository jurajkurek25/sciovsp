// Rovnaký bug ako v premium popupe (28-index-mobile-fixes.js): .sticky-cta-text
// má flex:1 ale žiadny min-width, takže flexbox ho nedovolí zmenšiť pod jeho
// obsahovú šírku ("Prvé 3 testy zadarmo" + "Bez karty, bez záväzku" vedľa
// tlačidla "Začať →") — spodná plávajúca lišta na mobile pretiekla mimo
// obrazovky a vynucovala scrollovanie do boku.
//
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online/public:
//   node /root/ad-service/30-sticky-cta-mobile-fix.js

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'index.html');
const src = fs.readFileSync(FILE_PATH, 'utf8');

const OLD_CSS = `.sticky-cta-text{flex:1;font-family:var(--mono);font-size:.72rem;color:var(--text2);line-height:1.3}`;
const NEW_CSS = `.sticky-cta-text{flex:1;min-width:0;font-family:var(--mono);font-size:.72rem;color:var(--text2);line-height:1.3}`;

if (src.includes(NEW_CSS)) {
  console.error('❌ Vyzerá to, že oprava je už aplikovaná. Nič som nezmenil.');
  process.exit(1);
}
if (!src.includes(OLD_CSS)) {
  console.error('❌ Nenašiel som očakávané CSS pre .sticky-cta-text presne. Nič som nezmenil.');
  process.exit(1);
}

const backupPath = FILE_PATH + '.pre-sticky-cta-fix-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
fs.writeFileSync(FILE_PATH, src.replace(OLD_CSS, NEW_CSS));

console.log('✅ Spodná plávajúca lišta (sticky-cta) sa už nezmestí mimo obrazovku na mobile.');
console.log('   Záloha pôvodného index.html:', backupPath);
