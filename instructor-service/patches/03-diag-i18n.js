// DIAGNOSTICKY skript -- NIC NEMENI. Potrebujem vidieť, ako funguje
// preklad (funkcia t()) a kde presne v SK/CS slovníku pribudnú nové
// kľúče pre accessMode a category, aby som ich vedel bezpečne pridať
// (git verzia tieto kľúče má, ale produkcia môže byť staršia -- presne
// ako s accessMode v routes/courses.js).
//
// Spusti z koreňa instructor-service a pošli mi CELÝ výpis:
//   node patches/03-diag-i18n.js

const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(process.cwd(), 'public', 'index.html');
if (!fs.existsSync(HTML_PATH)) {
  console.error('❌ Nenašiel som public/index.html — spusti z koreňa instructor-service.');
  process.exit(1);
}
const src = fs.readFileSync(HTML_PATH, 'utf8');

console.log('=== obsahuje "accessModeLabel"?', src.includes('accessModeLabel'), '===');
console.log('=== obsahuje "categoryLabel"?', src.includes('categoryLabel'), '===');
console.log('');

function printFunctionSource(fnName) {
  const marker = 'function ' + fnName + '(';
  const idx = src.indexOf(marker);
  console.log('════════════ ' + fnName + '() ════════════');
  if (idx === -1) {
    console.log('❌ Nenašiel som "' + marker + '".');
    console.log('');
    return;
  }
  const parenStart = idx + marker.length - 1;
  let parenDepth = 0;
  let parenEnd = -1;
  for (let i = parenStart; i < src.length; i++) {
    if (src[i] === '(') parenDepth++;
    else if (src[i] === ')') { parenDepth--; if (parenDepth === 0) { parenEnd = i; break; } }
  }
  if (parenEnd === -1) { console.log('❌ Nenašiel som koniec parametrov.'); console.log(''); return; }
  const braceStart = src.indexOf('{', parenEnd);
  if (braceStart === -1) { console.log('❌ Nenašiel som telo funkcie.'); console.log(''); return; }
  let depth = 0;
  let i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  const fnSrc = src.slice(idx, i);
  console.log('dĺžka: ' + fnSrc.length + ' znakov');
  console.log(JSON.stringify(fnSrc));
  console.log('');
}

printFunctionSource('t');

// Nájdi i18n slovník -- hľadaj "fieldTitle" (existujúci kľúč, použitý v
// renderCourseDetail) a vypíš 250 znakov pred + 250 po pre SK aj (druhý
// výskyt) CS variant.
const marker = 'fieldTitle';
let searchFrom = 0;
let occurrence = 0;
while (true) {
  const idx = src.indexOf(marker, searchFrom);
  if (idx === -1) break;
  occurrence++;
  const start = Math.max(0, idx - 250);
  const end = Math.min(src.length, idx + 250);
  console.log('════════════ okolie "' + marker + '" výskyt #' + occurrence + ' ════════════');
  console.log(JSON.stringify(src.slice(start, end)));
  console.log('');
  searchFrom = idx + marker.length;
  if (occurrence >= 4) break;
}

console.log('Skopíruj CELÝ výpis vyššie a pošli mi ho.');
