// public/js/faculty-quiz-full.js sa menil viackrat za sebou (login flow,
// plny vysledok po prihlaseni, appCat CTA, fit-aware CTA), ale
// <script src="/js/faculty-quiz-full.js"> nemal ziadny cache-busting
// query param. Stranka je za Cloudflare (proxied domena) a statické .js
// súbory sa tam bežne cachujú aj bez explicitných Cache-Control hlavičiek
// — takže je reálne, že návštevník (aj po úspešnom wget-nutí novšej
// verzie na server) dostal starú, cachovanú verziu súboru z edge cache
// alebo z vlastnej cache prehliadača, a video staré (opravené) bugy.
//
// Tento patch pridáva ?v=4 na script tag. Pri KAŽDEJ ďalšej zmene
// public/js/faculty-quiz-full.js treba toto číslo zvýšiť (v novom
// patchi), inak sa zmena môže znova "stratiť" v cache.
//
// Predpoklad: main-app-patches/177 uz je aplikovany.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/181-faculty-quiz-js-cachebust.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');

if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.181-faculty-quiz-js-cachebust-lock');
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (' + LOCK + '). Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

function replaceOnce(src, oldStr, newStr, label) {
  const count = src.split(oldStr).length - 1;
  if (count !== 1) {
    console.error('❌ ' + label + ' — kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil.');
    process.exit(1);
  }
  return src.replace(oldStr, () => newStr);
}

let server = fs.readFileSync(SERVER_PATH, 'utf8');

if (server.includes('faculty-quiz-full.js?v=')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}
if (!server.includes("'<script src=\"/js/faculty-quiz-full.js\"></script>'")) {
  console.error('❌ Nenašiel som script tag pre faculty-quiz-full.js — over, či je main-app-patches/177 už aplikovaný. Nič som nezmenil.');
  process.exit(1);
}

server = replaceOnce(server,
  `'<script src="/js/faculty-quiz-full.js"></script>';`,
  `'<script src="/js/faculty-quiz-full.js?v=4"></script>';`,
  'script tag -> ?v=4 cache-busting');

const backup = SERVER_PATH + '.pre-faculty-quiz-js-cachebust-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, server);

console.log('✅ /js/faculty-quiz-full.js má teraz ?v=4 — Cloudflare/prehliadač ho už nebude servírovať zo starej cache.');
console.log('   Záloha:', backup);
console.log('   Over syntax pred reštartom: node -c server.js');
