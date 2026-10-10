// DIAGNOSTICKY skript -- NIC NEMENI. main-app-patches/232 ukázal, že
// server.js obsahuje "Cache-Control" 2x -- potrebujem presne kde, aby
// som nový middleware nevložil do konfliktu s existujúcou logikou.
//
// Spusti z koreňa hlavnej appky a pošli mi CELÝ výpis:
//   node main-app-patches/233-diag-cache-control-existing.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som server.js — spusti z koreňa hlavnej appky.');
  process.exit(1);
}
const src = fs.readFileSync(SERVER_PATH, 'utf8');

console.log('════════════ Kontext okolo KAŽDÉHO "Cache-Control" ════════════');
let searchFrom = 0, occ = 0;
while (true) {
  const idx = src.indexOf('Cache-Control', searchFrom);
  if (idx === -1) break;
  occ++;
  const start = Math.max(0, idx - 500);
  const end = Math.min(src.length, idx + 300);
  console.log('--- výskyt #' + occ + ' (znak ' + idx + ') ---');
  console.log(JSON.stringify(src.slice(start, end)));
  console.log('');
  searchFrom = idx + 'Cache-Control'.length;
}
if (occ === 0) console.log('❌ Nenašiel som "Cache-Control".');

console.log('════════════ Kontext okolo KAŽDÉHO výskytu "express.json(" ════════════');
searchFrom = 0; occ = 0;
while (true) {
  const idx = src.indexOf('express.json(', searchFrom);
  if (idx === -1) break;
  occ++;
  const start = Math.max(0, idx - 150);
  const end = Math.min(src.length, idx + 200);
  console.log('--- výskyt #' + occ + ' (znak ' + idx + ') ---');
  console.log(JSON.stringify(src.slice(start, end)));
  console.log('');
  searchFrom = idx + 'express.json('.length;
}

console.log('Skopíruj CELÝ výpis vyššie a pošli mi ho.');
