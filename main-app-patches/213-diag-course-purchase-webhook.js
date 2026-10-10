// DIAGNOSTICKY skript -- NIC NEMENI. Potrebujem presný aktuálny kód
// vetvy Stripe webhooku, ktorá spracúva nákup kurzu (course_purchases),
// aby som vedel pridať uvítací/potvrdzovací email po kúpe -- rovnaká
// disciplína ako predtým (napr. main-app-patches/206), nerekonštruovať
// z histórie patchov.
//
// Spusti z korena hlavnej appky a pošli mi CELÝ výpis:
//   node main-app-patches/213-diag-course-purchase-webhook.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const src = fs.readFileSync(SERVER_PATH, 'utf8');

console.log('=== Existujúce email helpery/premenné (rýchla kontrola) ===');
['function sendMail', 'function loadWebinarEmailTemplate', 'function fillWebinarTemplate', 'function getOrCreateUnsubscribeToken', 'EXAM_APP_URL'].forEach(m => {
  console.log(m + ':', src.includes(m));
});
console.log('');

// Nájdi VŠETKY výskyty "Kurz zakúpený" a pre každý vypíš širší kontext okolo neho.
const marker = 'Kurz zakúpený';
let searchFrom = 0;
let occurrence = 0;
while (true) {
  const idx = src.indexOf(marker, searchFrom);
  if (idx === -1) break;
  occurrence++;
  const start = Math.max(0, idx - 1800);
  const end = Math.min(src.length, idx + 800);
  console.log('════════════ výskyt #' + occurrence + ' okolo "' + marker + '" (znak ' + idx + ') ════════════');
  console.log(JSON.stringify(src.slice(start, end)));
  console.log('');
  searchFrom = idx + marker.length;
}
if (occurrence === 0) {
  console.log('❌ Nenašiel som žiadny výskyt "' + marker + '" v server.js.');
}

console.log('Skopíruj CELÝ výpis vyššie a pošli mi ho.');
