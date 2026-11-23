// DIAGNOSTICKY skript -- NIC NEMENI. Patche main-app-patches/62 a 68
// postavili Content-Security-Policy-Report-Only hlavičku s vyladeným
// zoznamom domén -- nikdy sa to ale neprepnulo na vynucujúci režim.
// Potrebujem presný aktuálny obsah toho bloku (mohli ho medzitým upraviť
// ďalšie patche), aby som ho bezpečne prepol na Content-Security-Policy.
//
// Spusti z koreňa hlavnej appky a pošli mi CELÝ výpis:
//   node main-app-patches/230-diag-current-csp-block.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som server.js — spusti z koreňa hlavnej appky.');
  process.exit(1);
}
const src = fs.readFileSync(SERVER_PATH, 'utf8');

console.log('=== Rýchla kontrola ===');
['Content-Security-Policy-Report-Only', 'Content-Security-Policy\'', 'Strict-Transport-Security', 'Cross-Origin-Opener-Policy', 'report-uri', 'report-to'].forEach(m => {
  console.log(m + ':', src.includes(m));
});
console.log('');

const marker = 'Strict-Transport-Security';
const idx = src.indexOf(marker);
console.log('════════════ Celý bezpečnostné-hlavičky blok ════════════');
if (idx === -1) {
  console.log('❌ Nenašiel som "' + marker + '" v server.js.');
} else {
  const start = Math.max(0, idx - 400);
  // najdi koniec: hľadaj najbližšie "next();\n});" po markeri
  const endMarker = 'next();\n});';
  let end = src.indexOf(endMarker, idx);
  end = end === -1 ? idx + 2000 : end + endMarker.length;
  console.log(JSON.stringify(src.slice(start, end)));
}

console.log('');
console.log('Skopíruj CELÝ výpis vyššie a pošli mi ho.');
