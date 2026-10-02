// DIAGNOSTICKY skript -- NIC NEMENI. Potrebujem presný zdrojový kód
// funkcie blogPostCard() (kartička článku na /blog), aby som vedel
// pridať data-tag a data-search atribúty pre klientský filter/vyhľadávanie,
// rovnaký princíp ako main-app-patches/208 na /odporucame.
//
// Spusti z korena hlavnej appky a pošli mi CELÝ výpis:
//   node main-app-patches/210-diag-blogpostcard.js

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

printFunctionSource('blogPostCard');
printFunctionSource('blogLocalized');

// BLOG_I18N je objekt, nie funkcia -- vypíš prvých 2500 znakov od deklarácie.
const declMarker = 'const BLOG_I18N';
const declIdx = src.indexOf(declMarker);
console.log('════════════ BLOG_I18N (prvých 2500 znakov od deklarácie) ════════════');
if (declIdx === -1) {
  console.log('❌ Nenašiel som "' + declMarker + '".');
} else {
  console.log(JSON.stringify(src.slice(declIdx, declIdx + 2500)));
}
console.log('');

console.log('Skopíruj CELÝ výpis vyššie a pošli mi ho.');
