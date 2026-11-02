// DIAGNOSTICKY skript -- NIC NEMENI. Potvrdené: patches/05 nasadilo
// renderCourseDetail()/saveCourse() (volajú t('categoryLabel'), t('accessModePaid')
// atď.), ALE nikdy nenasadilo samotné hodnoty týchto kľúčov do T.sk/T.cs --
// t() preto padá na fallback (vráti surový kľúč), presne to vidno na
// screenshotoch (accessModePaid/categoryNone namiesto textu). Potrebujem
// PRESNÝ aktuálny obsah SK aj CS slovníka okolo fieldSales/saveBtn, aby
// som postavil opravný patch na skutočnom stave, nie na rekonštrukcii.
//
// Spusti z koreňa instructor-service a pošli mi CELÝ výpis:
//   node patches/07-diag-i18n-dict-gap.js

const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(process.cwd(), 'public', 'index.html');
if (!fs.existsSync(HTML_PATH)) {
  console.error('❌ Nenašiel som public/index.html — spusti z koreňa instructor-service.');
  process.exit(1);
}
const src = fs.readFileSync(HTML_PATH, 'utf8');

console.log('=== Rýchla kontrola chýbajúcich i18n kľúčov ===');
['accessModeLabel', 'accessModePaid', 'accessModeFree', 'accessModeSubscription', 'accessModeNote', 'tierPremium', 'tierElite', 'categoryLabel', 'categoryNone', 'categoryHint', 'categoryPrep', 'categoryApp', 'categoryGrowth'].forEach(k => {
  console.log(k + ':', src.includes(k + ':') ? 'PRÍTOMNÝ' : 'CHÝBA');
});
console.log('');

// Vypíš každý výskyt "fieldSales" so širokým kontextom (SK aj CS blok).
let searchFrom = 0;
let occurrence = 0;
while (true) {
  const idx = src.indexOf('fieldSales', searchFrom);
  if (idx === -1) break;
  occurrence++;
  const start = Math.max(0, idx - 300);
  const end = Math.min(src.length, idx + 400);
  console.log('════════════ výskyt #' + occurrence + ' okolo "fieldSales" (znak ' + idx + ') ════════════');
  console.log(JSON.stringify(src.slice(start, end)));
  console.log('');
  searchFrom = idx + 'fieldSales'.length;
}

// Over aj presný aktuálny stav renderCourseDetail()/saveCourse() (má byť RENDER_NEW/SAVE_NEW z patches/05).
function printFunctionSource(fnName) {
  const marker = 'function ' + fnName + '(';
  const idx = src.indexOf(marker);
  console.log('════════════ ' + fnName + '() -- dĺžka ════════════');
  if (idx === -1) { console.log('❌ nenájdené'); return; }
  const parenStart = idx + marker.length - 1;
  let parenDepth = 0, parenEnd = -1;
  for (let i = parenStart; i < src.length; i++) {
    if (src[i] === '(') parenDepth++;
    else if (src[i] === ')') { parenDepth--; if (parenDepth === 0) { parenEnd = i; break; } }
  }
  const braceStart = src.indexOf('{', parenEnd);
  let depth = 0, i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  console.log((i - idx) + ' znakov');
}
printFunctionSource('renderCourseDetail');
printFunctionSource('saveCourse');

console.log('');
console.log('Skopíruj CELÝ výpis vyššie a pošli mi ho.');
