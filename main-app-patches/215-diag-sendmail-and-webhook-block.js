// DIAGNOSTICKY skript -- NIC NEMENI. main-app-patches/213 ukázal, že
// "function sendMail" sa v server.js nenašlo, hoci sendMail(...) sa volá
// (viď main-app-patches/151/153) -- musí byť definované inak (const/import).
// Potrebujem aj CELÝ blok "course_purchase" webhooku (213 ho odrezal na
// pevných 800 znakoch po markeri), aby som vedel presne kam vložiť email.
//
// Spusti z koreňa hlavnej appky a pošli mi CELÝ výpis:
//   node main-app-patches/215-diag-sendmail-and-webhook-block.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const src = fs.readFileSync(SERVER_PATH, 'utf8');

console.log('=== Definícia sendMail (hľadám rôzne varianty) ===');
['const sendMail', 'let sendMail', 'var sendMail', 'function sendMail', 'async function sendMail', 'sendMail =', 'sendMail:', 'require(\'./lib/mail\')', 'require("./lib/mail")', 'nodemailer'].forEach(m => {
  const idx = src.indexOf(m);
  console.log(m + ':', idx !== -1 ? ('found at char ' + idx) : 'NOT FOUND');
});
console.log('');

// Vypíš širší kontext okolo PRVÉHO výskytu "sendMail" v súbore (predpoklad: definícia/import je skôr než prvé volanie).
const firstIdx = src.indexOf('sendMail');
if (firstIdx !== -1) {
  const start = Math.max(0, firstIdx - 400);
  const end = Math.min(src.length, firstIdx + 400);
  console.log('════════════ kontext okolo prvého výskytu "sendMail" (znak ' + firstIdx + ') ════════════');
  console.log(JSON.stringify(src.slice(start, end)));
  console.log('');
}

// Vypíš CELÝ "course_purchase" webhook blok -- od "type === 'course_purchase'" po zodpovedajúcu uzatváraciu zátvorku bloku "if".
const blockMarker = "session.metadata?.type === 'course_purchase'";
const blockIdx = src.indexOf(blockMarker);
if (blockIdx === -1) {
  console.log('❌ Nenašiel som "' + blockMarker + '".');
} else {
  // over "if (" pred markerom
  const ifStart = src.lastIndexOf('if (', blockIdx);
  const braceStart = src.indexOf('{', blockIdx);
  let depth = 0;
  let i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  const fullBlock = src.slice(ifStart, i);
  console.log('════════════ CELÝ course_purchase blok (znaky ' + ifStart + '-' + i + ', dĺžka ' + fullBlock.length + ') ════════════');
  console.log(JSON.stringify(fullBlock));
  console.log('');
}

console.log('Skopíruj CELÝ výpis vyššie a pošli mi ho.');
