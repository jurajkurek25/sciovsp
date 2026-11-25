// Posiela aktuálny jazyk appky (currentLang, 'sk' alebo 'cz') do všetkých
// troch miest, kde appka získava reklamy — súčasť delenia reklám podľa
// jazyka publika. Bez tejto zmeny by ad.sptrener.online/hlavná appka
// nevedeli, akým jazykom sa má riadiť filtrovanie.
//
// Presný textový match proti overenému živému kódu public/app.html.
//
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online:
//   node /root/ad-service/47-app-html-lang-to-ads.js

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'public', 'app.html');
const src = fs.readFileSync(FILE_PATH, 'utf8');

if (src.includes("'/api/ads/serve?lang='")) {
  console.error('❌ Vyzerá to, že lang parameter už je pridaný. Nič som nezmenil.');
  process.exit(1);
}

const OLD_ADS_SERVE = `fetch(AD_ORIGIN + '/api/ads/serve').then(r => r.json()).then(data => {`;
const NEW_ADS_SERVE = `fetch(AD_ORIGIN + '/api/ads/serve?lang=' + currentLang).then(r => r.json()).then(data => {`;

const OLD_VIDEO_STATUS = `const res = await fetch('/api/rewards/video-status', { headers });`;
const NEW_VIDEO_STATUS = `const res = await fetch('/api/rewards/video-status?lang=' + currentLang, { headers });`;

const OLD_VIDEO_START = `const res = await fetch('/api/rewards/video/start', { method: 'POST', headers });`;
const NEW_VIDEO_START = `const res = await fetch('/api/rewards/video/start?lang=' + currentLang, { method: 'POST', headers });`;

const REPLACEMENTS = [
  ['ads/serve fetch', OLD_ADS_SERVE, NEW_ADS_SERVE],
  ['video-status fetch', OLD_VIDEO_STATUS, NEW_VIDEO_STATUS],
  ['video/start fetch', OLD_VIDEO_START, NEW_VIDEO_START]
];

for (const [name, needle] of REPLACEMENTS) {
  if (!src.includes(needle)) {
    console.error(`❌ Nenašiel som presný očakávaný kód "${name}" v app.html. Nič som nezmenil.`);
    process.exit(1);
  }
}

const backupPath = FILE_PATH + '.pre-lang-to-ads-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
let out = src;
for (const [, oldStr, newStr] of REPLACEMENTS) {
  out = out.replace(oldStr, newStr);
}
fs.writeFileSync(FILE_PATH, out);

console.log('✅ currentLang sa teraz posiela pri všetkých 3 volaniach na reklamy.');
console.log('   Záloha pôvodného app.html:', backupPath);
