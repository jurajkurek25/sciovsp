// DIAGNOSTICKY skript -- NIC NEMENI. Riešim Cache-Control: scanner
// nahlásil, že appka posiela "public, max-age=0" (default Express/
// serve-static), čo je OK pre verejné statické stránky, ale NIE pre /api/*
// odpovede s citlivými/personalizovanými dátami (môže to zostať v
// zdieľanej cache/proxy). Potrebujem presný aktuálny kontext okolo
// express.json()/express.urlencoded() a potvrdiť, či patch 231 (CSP) už
// bol nasadený, aby som vedel bezpečne zakotviť nový middleware.
//
// Spusti z koreňa hlavnej appky a pošli mi CELÝ výpis:
//   node main-app-patches/232-diag-cache-control-context.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som server.js — spusti z koreňa hlavnej appky.');
  process.exit(1);
}
const src = fs.readFileSync(SERVER_PATH, 'utf8');

console.log('=== Rýchla kontrola ===');
['Cache-Control', "res.setHeader('Content-Security-Policy'", 'Content-Security-Policy-Report-Only', 'express.json(', 'express.urlencoded('].forEach(m => {
  const count = (src.match(new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  console.log(m + ':', count, 'výskytov');
});
console.log('');

const marker = 'express.json(';
const idx = src.indexOf(marker);
console.log('════════════ Kontext okolo "express.json(" ════════════');
if (idx === -1) {
  console.log('❌ Nenašiel som "' + marker + '".');
} else {
  const start = Math.max(0, idx - 700);
  const end = Math.min(src.length, idx + 500);
  console.log(JSON.stringify(src.slice(start, end)));
}

console.log('');
console.log('Skopíruj CELÝ výpis vyššie a pošli mi ho.');
