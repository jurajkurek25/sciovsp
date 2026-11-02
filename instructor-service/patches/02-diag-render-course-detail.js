// DIAGNOSTICKY skript -- NIC NEMENI. patches/01 zistil, že produkcia
// nemá vôbec žiadnu accessMode UI (kotva "f-access-mode" sa nenašla) --
// treba vidieť CELÚ funkciu, čo vykresľuje formulár na úpravu kurzu,
// aby som vedel, kam presne vložiť aj accessMode aj category select.
//
// Spusti z koreňa instructor-service a pošli mi CELÝ výpis:
//   node patches/02-diag-render-course-detail.js

const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(process.cwd(), 'public', 'index.html');
if (!fs.existsSync(HTML_PATH)) {
  console.error('❌ Nenašiel som public/index.html — spusti z koreňa instructor-service.');
  process.exit(1);
}
const htmlSrc = fs.readFileSync(HTML_PATH, 'utf8');

function printFunctionSource(fnName) {
  const marker = 'function ' + fnName + '(';
  const idx = htmlSrc.indexOf(marker);
  console.log('════════════ ' + fnName + '() ════════════');
  if (idx === -1) {
    console.log('❌ Nenašiel som "' + marker + '".');
    console.log('');
    return;
  }
  const parenStart = idx + marker.length - 1;
  let parenDepth = 0;
  let parenEnd = -1;
  for (let i = parenStart; i < htmlSrc.length; i++) {
    if (htmlSrc[i] === '(') parenDepth++;
    else if (htmlSrc[i] === ')') { parenDepth--; if (parenDepth === 0) { parenEnd = i; break; } }
  }
  if (parenEnd === -1) { console.log('❌ Nenašiel som koniec parametrov.'); console.log(''); return; }
  const braceStart = htmlSrc.indexOf('{', parenEnd);
  if (braceStart === -1) { console.log('❌ Nenašiel som telo funkcie.'); console.log(''); return; }
  let depth = 0;
  let i = braceStart;
  for (; i < htmlSrc.length; i++) {
    if (htmlSrc[i] === '{') depth++;
    else if (htmlSrc[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  const fnSrc = htmlSrc.slice(idx, i);
  console.log('dĺžka: ' + fnSrc.length + ' znakov');
  console.log(JSON.stringify(fnSrc));
  console.log('');
}

printFunctionSource('renderCourseDetail');
printFunctionSource('createCourse');

console.log('Skopíruj CELÝ výpis vyššie a pošli mi ho.');
