// DIAGNOSTICKY skript -- NIC NEMENI. Riešim race condition v discount
// kódoch: course_discount_codes.max_uses sa kontroluje len raz pri
// vytvorení checkout session (used_count < max_uses), ale samotný zápis
// used_count+1 prebieha až neskôr, asynchrónne, vo webhooku -- bez zámku.
// Pri súbežných checkoutoch na kóde s posledným voľným použitím môžu
// obaja prejsť kontrolou skôr, než sa čokoľvek inkrementuje.
//
// main-app-patches/73 je stará a vrstvená ďalšími patchmi (74, 75, 113...),
// takže aktuálny presný kód checkout handlera v produkcii nepoznám s
// istotou -- potrebujem ho priamo odtiaľ, nie rekonštruovať z historie.
//
// Spusti z koreňa hlavnej appky a pošli mi CELÝ výpis:
//   node main-app-patches/228-diag-discount-code-checkout-context.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som server.js — spusti z koreňa hlavnej appky.');
  process.exit(1);
}
const src = fs.readFileSync(SERVER_PATH, 'utf8');

console.log('=== Rýchla kontrola ===');
['course_discount_codes', 'discountCode', 'used_count', 'max_uses', 'appliedDiscountCode'].forEach(m => {
  const count = (src.match(new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  console.log(m + ':', count, 'výskytov');
});
console.log('');

// Vypíš 2500 znakov okolo KAŽDÉHO výskytu "course_discount_codes" --
// to pokryje validáciu pri checkout-e aj inkrement vo webhooku.
console.log('════════════ Kontext okolo "course_discount_codes" ════════════');
let searchFrom = 0, occ = 0;
while (true) {
  const idx = src.indexOf('course_discount_codes', searchFrom);
  if (idx === -1) break;
  occ++;
  const start = Math.max(0, idx - 1200);
  const end = Math.min(src.length, idx + 1300);
  console.log('--- výskyt #' + occ + ' (znak ' + idx + ') ---');
  console.log(JSON.stringify(src.slice(start, end)));
  console.log('');
  searchFrom = idx + 'course_discount_codes'.length;
}
if (occ === 0) console.log('❌ Nenašiel som "course_discount_codes" v server.js.');

console.log('Skopíruj CELÝ výpis vyššie a pošli mi ho.');
