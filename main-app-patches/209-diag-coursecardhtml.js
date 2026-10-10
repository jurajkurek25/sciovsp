// DIAGNOSTICKY skript -- NIC NEMENI. Potrebujem presný zdrojový kód
// funkcie courseCardHtml() (a KURZY_STYLE, ak existuje ako samostatná
// premenná) použitej na /kurzy, aby som vedel pridať data-search
// atribút na karty kurzov pre textové vyhľadávanie -- nechcem to
// rekonštruovať z histórie patchov (viackrát sa to už ukázalo ako
// nespoľahlivé).
//
// Spusti z korena hlavnej appky a pošli mi CELÝ výpis:
//   node main-app-patches/209-diag-coursecardhtml.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const src = fs.readFileSync(SERVER_PATH, 'utf8');

function printFunctionSource(fnName) {
  const marker = 'function ' + fnName + '(';
  const idx = src.indexOf(marker);
  console.log('════════════ ' + fnName + '() ════════════');
  if (idx === -1) {
    console.log('❌ Nenašiel som "' + marker + '" v server.js.');
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

console.log('=== KURZY_STYLE existuje?', src.includes('KURZY_STYLE'), '===');
const kIdx = src.indexOf('KURZY_STYLE');
if (kIdx !== -1) {
  // Nájdi najbližšiu deklaráciu (const KURZY_STYLE = ...) pred prvým použitím
  const declMarker = 'const KURZY_STYLE';
  const declIdx = src.indexOf(declMarker);
  if (declIdx !== -1) {
    // Vypíš do prvého výskytu ";\n" po dlhšom bloku (štýl je zvyčajne template literal)
    const chunk = src.slice(declIdx, declIdx + 3000);
    console.log('=== KURZY_STYLE deklarácia (prvých 3000 znakov od "' + declMarker + '") ===');
    console.log(JSON.stringify(chunk));
    console.log('');
  }
}

printFunctionSource('courseCardHtml');
printFunctionSource('courseCoverUrl');

console.log('Skopíruj CELÝ výpis vyššie a pošli mi ho.');
