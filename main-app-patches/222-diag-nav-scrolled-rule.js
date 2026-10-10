// DIAGNOSTICKY skript -- NIC NEMENI. Patches/221 ukázal
// "nav.scrolled{background:rgba(8,8,..." orezané -- potrebujem CELÉ
// pravidlo, aby som overil, či obsahuje backdrop-filter/transform/filter/
// will-change (ktorékoľvek z toho na <nav> by rozbilo position:fixed
// potomka .nav-links-wrap, presne keď je trieda .scrolled aktívna po
// scrollovaní -- čo sedí na nahlásený bug).
//
// Spusti z koreňa hlavnej appky a pošli mi CELÝ výpis:
//   node main-app-patches/222-diag-nav-scrolled-rule.js

const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(process.cwd(), 'public', 'index.html');
if (!fs.existsSync(HTML_PATH)) {
  console.error('❌ Nenašiel som public/index.html — spusti z koreňa hlavnej appky.');
  process.exit(1);
}
const src = fs.readFileSync(HTML_PATH, 'utf8');

const marker = 'nav.scrolled{';
const idx = src.indexOf(marker);
console.log('════════════ nav.scrolled{...} CELÉ pravidlo ════════════');
if (idx === -1) {
  console.log('❌ Nenašiel som "nav.scrolled{".');
} else {
  const end = src.indexOf('}', idx) + 1;
  console.log(JSON.stringify(src.slice(idx, end)));
}
console.log('');

// Aj JS, čo pridáva/odoberá triedu "scrolled" (scroll listener)
console.log('════════════ JS okolo "scrolled" triedy (classList) ════════════');
let searchFrom = 0, occ = 0;
while (true) {
  const i = src.indexOf("'scrolled'", searchFrom);
  const i2 = src.indexOf('"scrolled"', searchFrom);
  const next = (i === -1) ? i2 : (i2 === -1 ? i : Math.min(i, i2));
  if (next === -1) break;
  occ++;
  console.log('--- výskyt #' + occ + ' (znak ' + next + ') ---');
  console.log(JSON.stringify(src.slice(Math.max(0, next - 200), Math.min(src.length, next + 200))));
  searchFrom = next + 10;
}
if (occ === 0) console.log('❌ Nenašiel som žiadny výskyt "scrolled" v uvodzovkách (JS classList).');

console.log('');
console.log('Skopíruj CELÝ výpis vyššie a pošli mi ho.');
