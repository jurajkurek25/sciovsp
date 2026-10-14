// DIAGNOSTICKY skript -- NIC NEMENI. Riešim 2 ďalšie nálezy zo scanu:
// X-Powered-By (Express ho posiela aj cez helmet, treba app.disable) a
// "Default server error pages" (najpravdepodobnejšie Express-ov vlastný
// "Cannot POST /xyz" pre iné metódy než GET na nezhodnú cestu, keďže SPA
// fallback je len app.get('*', ...)). Potrebujem presný koniec server.js
// (static serving, SPA fallback, error handler, app.listen) pred tým, než
// tam niečo vložím.
//
// Spusti z koreňa hlavnej appky a pošli mi CELÝ výpis:
//   node main-app-patches/236-diag-server-tail.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som server.js — spusti z koreňa hlavnej appky.');
  process.exit(1);
}
const src = fs.readFileSync(SERVER_PATH, 'utf8');

console.log('=== Rýchla kontrola ===');
['x-powered-by', 'X-Powered-By', "app.listen(PORT", 'express.static', "app.get(\'*\'"].forEach(m => {
  const count = (src.match(new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  console.log(m + ':', count, 'výskytov');
});
console.log('');

console.log('════════════ Posledných 2500 znakov server.js ════════════');
console.log(JSON.stringify(src.slice(Math.max(0, src.length - 2500))));

console.log('');
console.log('Skopíruj CELÝ výpis vyššie a pošli mi ho.');
