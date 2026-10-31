// DIAGNOSTICKY skript -- NIC NEMENI. Potrebujem presný aktuálny kód
// /go/:id redirect routy (affiliate click-through), aby som vedel pridať
// rozlíšenie SK/CZ affiliate odkazu podľa jazyka stránky -- nerekonštruovať
// z histórie patchov (patch 150 ju naposledy menil, ale over priamo).
//
// Spusti z koreňa hlavnej appky a pošli mi CELÝ výpis:
//   node main-app-patches/219-diag-go-redirect-route.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som server.js — spusti z koreňa hlavnej appky.');
  process.exit(1);
}

const src = fs.readFileSync(SERVER_PATH, 'utf8');

const marker = "app.get('/go/:id'";
const idx = src.indexOf(marker);
console.log('════════════ /go/:id route ════════════');
if (idx === -1) {
  console.log('❌ Nenašiel som "' + marker + '".');
} else {
  const braceStart = src.indexOf('{', idx);
  let depth = 0, i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  // najdi koniec ");" za uzatváracou zátvorkou callbacku
  let end = i;
  while (end < src.length && src[end] !== ';') end++;
  end++;
  const routeSrc = src.slice(idx, end);
  console.log('dĺžka: ' + routeSrc.length + ' znakov');
  console.log(JSON.stringify(routeSrc));
}

console.log('');
console.log('Skopíruj CELÝ výpis vyššie a pošli mi ho.');
