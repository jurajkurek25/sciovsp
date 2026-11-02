// DIAGNOSTICKY skript -- NIC NEMENI. Bezpečnostná kontrola: Stripe webhook
// (checkout.session.completed -> kurz/generalka/membership/gift card
// zadarmo) MUSÍ overovať podpis (stripe-signature header + STRIPE_WEBHOOK_SECRET)
// cez stripe.webhooks.constructEvent(), inak môže ktokoľvek poslať falošný
// POST priamo na endpoint a získať kurz/predplatné zadarmo bez platby.
// V main-app-patches/*.js som nenašiel ŽIADNU zmienku o constructEvent ani
// STRIPE_WEBHOOK_SECRET -- buď to je súčasť pôvodného (pred-patchového)
// server.js, alebo to chýba. Potrebujem to overiť priamo na produkcii.
//
// Spusti z koreňa hlavnej appky a pošli mi CELÝ výpis:
//   node main-app-patches/224-diag-security-webhook-signature.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som server.js — spusti z koreňa hlavnej appky.');
  process.exit(1);
}
const src = fs.readFileSync(SERVER_PATH, 'utf8');

console.log('=== Rýchla kontrola kľúčových bezpečnostných vzorov ===');
['stripe.webhooks.constructEvent', 'STRIPE_WEBHOOK_SECRET', 'stripe-signature', "req.headers['stripe-signature']", 'express.raw', 'express.json()'].forEach(m => {
  const count = (src.match(new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  console.log(m + ': ' + count + ' výskytov');
});
console.log('');

// Vypíš celý webhook route handler (hľadaj app.post s 'webhook' v ceste)
console.log('════════════ Webhook route handler(y) ════════════');
let searchFrom = 0, occ = 0;
while (true) {
  const idx = src.indexOf("app.post(", searchFrom);
  if (idx === -1) break;
  const lineEnd = src.indexOf('\n', idx);
  const line = src.slice(idx, lineEnd);
  if (/webhook/i.test(line)) {
    occ++;
    // vypíš 1200 znakov od začiatku route definície
    console.log('--- výskyt #' + occ + ' (znak ' + idx + ') ---');
    console.log(JSON.stringify(src.slice(idx, idx + 1500)));
    console.log('');
  }
  searchFrom = idx + 1;
}
if (occ === 0) console.log('❌ Nenašiel som žiadny app.post(...) obsahujúci "webhook" na riadku definície.');

console.log('Skopíruj CELÝ výpis vyššie a pošli mi ho.');
