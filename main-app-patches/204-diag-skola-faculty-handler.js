// DIAGNOSTICKY skript -- NIC NEMENI. main-app-patches/200 zlyhal (kotva
// "nájdených: 0") pretože moja rekonštrukcia /skola/:uSlug/:fSlug
// handlera (cez trasovanie patchov 173->184) sa v niečom nezhoduje so
// skutočným aktuálnym kódom na produkcii. Namiesto ďalšieho hádania
// tento skript vypíše PRESNÝ aktuálny zdrojový kód tej routy.
//
// Spusti z korena hlavnej appky a pošli mi CELÝ výpis:
//   node main-app-patches/204-diag-skola-faculty-handler.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const src = fs.readFileSync(SERVER_PATH, 'utf8');

const marker = `app.get('/skola/:uSlug/:fSlug'`;
const startIdx = src.indexOf(marker);
if (startIdx === -1) {
  console.log('❌ Nenašiel som "' + marker + '" v server.js vôbec.');
  process.exit(1);
}

// Nájdi ďalší "app.get(" alebo "app.post(" PO tomto markeri -- to je
// spoľahlivá hranica konca tejto routy (routy sú v súbore za sebou).
const nextRouteRegex = /app\.(get|post)\(/g;
nextRouteRegex.lastIndex = startIdx + marker.length;
const nextMatch = nextRouteRegex.exec(src);
const endIdx = nextMatch ? nextMatch.index : Math.min(src.length, startIdx + 12000);

console.log('════════════ /skola/:uSlug/:fSlug -- presný aktuálny kód (od "' + marker + '" po ďalšiu routu) ════════════');
console.log(src.slice(startIdx, endIdx));
console.log('════════════ koniec ════════════');
console.log('');
console.log('Skopíruj CELÝ výpis vyššie (medzi ════ značkami) a pošli mi ho.');
