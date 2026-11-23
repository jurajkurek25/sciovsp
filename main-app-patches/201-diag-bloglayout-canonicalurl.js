// DIAGNOSTICKY skript -- NIC NEMENI, len vypise, ako presne funguje
// canonicalUrl a blogLang() vo vnutri blogLayout(), aby som mohol
// bezpecne pridat hreflang tagy (main-app-patches/202) bez hadania.
// Tato cast blogLayout() je z povodneho kodu spred tejto session,
// takze ju nemam v repe a nechcem robit slepu upravu.
//
// Spusti z korena hlavnej appky a posli mi cely vystup:
//   node main-app-patches/201-diag-bloglayout-canonicalurl.js

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
  if (idx === -1) {
    console.log('❌ Nenašiel som "' + marker + '" v server.js.');
    return;
  }
  // Krok 1: nájdi koniec PARAMETROV vyvážením okrúhlych zátvoriek od '(' za
  // menom funkcie -- destructured parametre (napr. "{ title, ... }") môžu
  // samé obsahovať zložené zátvorky, tie sa tu nepočítajú.
  const parenStart = idx + marker.length - 1; // pozícia '('
  let parenDepth = 0;
  let parenEnd = -1;
  for (let i = parenStart; i < src.length; i++) {
    if (src[i] === '(') parenDepth++;
    else if (src[i] === ')') {
      parenDepth--;
      if (parenDepth === 0) { parenEnd = i; break; }
    }
  }
  if (parenEnd === -1) { console.log('❌ Nenašiel som koniec parametrov pre', fnName); return; }
  // Krok 2: nájdi telo funkcie -- prvú '{' AŽ ZA koncom parametrov.
  const braceStart = src.indexOf('{', parenEnd);
  if (braceStart === -1) { console.log('❌ Nenašiel som otváraciu zátvorku tela pre', fnName); return; }
  let depth = 0;
  let i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) { i++; break; }
    }
  }
  console.log('════════════ ' + fnName + '() -- celý zdrojový kód ════════════');
  console.log(src.slice(idx, i));
  console.log('════════════ koniec ' + fnName + '() ════════════');
  console.log('');
}

printFunctionSource('blogLayout');
printFunctionSource('blogLang');

console.log('Skopíruj CELÝ výpis vyššie (medzi ════ značkami) a pošli mi ho.');
