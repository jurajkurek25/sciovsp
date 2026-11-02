// DIAGNOSTICKY skript -- NIC NEMENI. main-app-patches/236 ukázal, že
// app.listen(PORT...) je úplne na konci súboru, ZA mnohými neskoršie
// pridanými routami -- potrebujem potvrdiť, či tam existuje globálny
// error handler (err, req, res, next) a kde presne, aby som pri vkladaní
// univerzálneho 404 handlera nič neposunul na nesprávne miesto.
//
// Spusti z koreňa hlavnej appky a pošli mi CELÝ výpis:
//   node main-app-patches/237-diag-error-handler.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som server.js — spusti z koreňa hlavnej appky.');
  process.exit(1);
}
const src = fs.readFileSync(SERVER_PATH, 'utf8');

console.log('=== Rýchla kontrola ===');
['(err, req, res, next)', 'Unhandled error', "process.env.NODE_ENV"].forEach(m => {
  const count = (src.match(new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  console.log(m + ':', count, 'výskytov');
});
console.log('');

const marker = '(err, req, res, next)';
let searchFrom = 0, occ = 0;
console.log('════════════ Kontext okolo KAŽDÉHO "(err, req, res, next)" ════════════');
while (true) {
  const idx = src.indexOf(marker, searchFrom);
  if (idx === -1) break;
  occ++;
  const start = Math.max(0, idx - 200);
  const end = Math.min(src.length, idx + 400);
  console.log('--- výskyt #' + occ + ' (znak ' + idx + ') ---');
  console.log(JSON.stringify(src.slice(start, end)));
  console.log('');
  searchFrom = idx + marker.length;
}
if (occ === 0) console.log('❌ Nenašiel som žiadny globálny error handler s touto signatúrou.');

console.log('');
console.log('════════════ Prvých 2 výskytov "app.get(\'*\'" ════════════');
searchFrom = 0; occ = 0;
while (true) {
  const idx = src.indexOf("app.get('*'", searchFrom);
  if (idx === -1) break;
  occ++;
  console.log('--- výskyt #' + occ + ' (znak ' + idx + ') ---');
  console.log(JSON.stringify(src.slice(Math.max(0, idx - 100), idx + 300)));
  console.log('');
  searchFrom = idx + 10;
  if (occ >= 2) break;
}

console.log('Skopíruj CELÝ výpis vyššie a pošli mi ho.');
