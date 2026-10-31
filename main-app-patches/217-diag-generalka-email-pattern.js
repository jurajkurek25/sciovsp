// DIAGNOSTICKY skript -- NIC NEMENI. patches/216 ukázal, že sendMail sa
// importuje lokálne per-blok ako "const { sendMail } = require('./mailer');"
// (napr. v generalka-purchase bloku okolo znaku 16297). Generalka je
// najbližší existujúci vzor pre "jednorázový nákup -> potvrdzovací email",
// tak potrebujem CELÝ ten blok presne, plus implementácie
// loadWebinarEmailTemplate/fillWebinarTemplate/getOrCreateUnsubscribeToken,
// aby som vedel, či mám tieto helpery znovupoužiť alebo si spraviť vlastné
// "loadCourseEmailTemplate" podľa rovnakého vzoru.
//
// Spusti z koreňa hlavnej appky a pošli mi CELÝ výpis:
//   node main-app-patches/217-diag-generalka-email-pattern.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const src = fs.readFileSync(SERVER_PATH, 'utf8');

// 1) Celý kontext okolo generalka sendMail bloku -- od "attempt_token: attemptToken" (~o 300 znakov pred require('./mailer')) po 1500 znakov po druhom sendMail volaní.
const marker = "const { sendMail } = require('./mailer');\n            const startUrl";
const idx = src.indexOf(marker);
console.log('════════════ generalka purchase email blok ════════════');
if (idx === -1) {
  console.log('❌ Nenašiel som presný marker, skúšam voľnejšie...');
  const idx2 = src.indexOf("require('./mailer')");
  if (idx2 !== -1) {
    console.log(JSON.stringify(src.slice(Math.max(0, idx2 - 600), Math.min(src.length, idx2 + 2000))));
  }
} else {
  console.log(JSON.stringify(src.slice(Math.max(0, idx - 600), Math.min(src.length, idx + 2000))));
}
console.log('');

function printFunctionSource(fnName) {
  const marker = 'function ' + fnName + '(';
  const idx = src.indexOf(marker);
  console.log('════════════ ' + fnName + '() ════════════');
  if (idx === -1) { console.log('❌ Nenašiel som "' + marker + '".'); console.log(''); return; }
  const parenStart = idx + marker.length - 1;
  let parenDepth = 0, parenEnd = -1;
  for (let i = parenStart; i < src.length; i++) {
    if (src[i] === '(') parenDepth++;
    else if (src[i] === ')') { parenDepth--; if (parenDepth === 0) { parenEnd = i; break; } }
  }
  if (parenEnd === -1) { console.log('❌ koniec parametrov nenájdený'); console.log(''); return; }
  const braceStart = src.indexOf('{', parenEnd);
  if (braceStart === -1) { console.log('❌ telo funkcie nenájdené'); console.log(''); return; }
  let depth = 0, i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  const fnSrc = src.slice(idx, i);
  console.log('dĺžka: ' + fnSrc.length + ' znakov');
  console.log(JSON.stringify(fnSrc));
  console.log('');
}

printFunctionSource('loadWebinarEmailTemplate');
printFunctionSource('fillWebinarTemplate');
printFunctionSource('getOrCreateUnsubscribeToken');

console.log('Skopíruj CELÝ výpis vyššie a pošli mi ho.');
