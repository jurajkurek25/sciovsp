// DIAGNOSTICKY skript -- NIC NEMENI. main-app-patches/215 nenašiel žiadnu
// definíciu bare "sendMail" (len "courseCommentTransporter.sendMail" a
// jeden výskyt "sendMail:" na znaku 320805) -- potrebujem vidieť ÚPLNE
// VŠETKY výskyty reťazca "sendMail" v súbore (každý s krátkym kontextom),
// aby som zistil, ako je definovaná/importovaná tá, čo sa volá ako bare
// sendMail({...}) v main-app-patches/151/153.
//
// Spusti z koreňa hlavnej appky a pošli mi CELÝ výpis:
//   node main-app-patches/216-diag-sendmail-full-scan.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const src = fs.readFileSync(SERVER_PATH, 'utf8');

console.log('=== VŠETKY výskyty "sendMail" v server.js (' + (src.match(/sendMail/g) || []).length + ' celkom) ===\n');
let searchFrom = 0;
let occurrence = 0;
while (true) {
  const idx = src.indexOf('sendMail', searchFrom);
  if (idx === -1) break;
  occurrence++;
  const start = Math.max(0, idx - 120);
  const end = Math.min(src.length, idx + 120);
  console.log('#' + occurrence + ' (znak ' + idx + '): ' + JSON.stringify(src.slice(start, end)));
  searchFrom = idx + 'sendMail'.length;
}

console.log('');
console.log('=== Kontext okolo prvého "nodemailer" (znak ' + src.indexOf('nodemailer') + ') ===');
const nmIdx = src.indexOf('nodemailer');
if (nmIdx !== -1) {
  console.log(JSON.stringify(src.slice(Math.max(0, nmIdx - 200), Math.min(src.length, nmIdx + 600))));
}

console.log('');
console.log('Skopíruj CELÝ výpis vyššie a pošli mi ho.');
