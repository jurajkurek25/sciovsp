// CORS bol úplne otvorený (ALLOWED_ORIGIN nebol v .env nastavený, spadal
// na wildcard '*'). Obmedzuje na presný zoznam vlastných domén SP Tréner
// ekosystému (potvrdené: ad/dash/instructor/partner.sptrener.online
// reálne volajú toto API cross-origin) — štandardný dynamický allowlist
// vzor (reflect Origin, ak je v zozname, inak header vôbec nepošli).
//
// Navyše pridáva Authorization do povolených hlavičiek — doteraz bol
// povolený len Content-Type, čo by blokovalo akékoľvek cross-origin
// volanie posielajúce Bearer token (napr. z inzerentského portálu).
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/275-cors-allowlist.js
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.275-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (' + LOCK + '). Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

function replaceExactCount(s, oldStr, newStr, expectedCount, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== expectedCount) {
    console.error('❌ ' + label + ' — očakávaných ' + expectedCount + ' výskytov, nájdených ' + count + '. Nič som nezmenil.');
    process.exit(1);
  }
  return s.split(oldStr).join(newStr);
}

if (!fs.existsSync(FILE)) {
  console.error('❌ Nenašiel som súbor:', FILE, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

let src = fs.readFileSync(FILE, 'utf8');

if (src.includes('CORS_ALLOWED_ORIGINS')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

const OLD = `// ── CORS ──────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});`;

const NEW = `// ── CORS ──────────────────────────────────────────────────────
const CORS_ALLOWED_ORIGINS = [
  'https://sptrener.online',
  'https://ad.sptrener.online',
  'https://dash.sptrener.online',
  'https://instructor.sptrener.online',
  'https://partner.sptrener.online'
];
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && CORS_ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});`;

src = replaceExactCount(src, OLD, NEW, 1, 'CORS middleware blok');

const backup = FILE + '.pre-275-cors-allowlist-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);

console.log('✅ server.js: CORS obmedzený na 5 vlastných domén (predtým wildcard *).');
console.log('   Záloha:', backup);
console.log('   pm2 restart sptrener-main');
console.log('   DÔLEŽITÉ: otestuj ihneď potom checkout z ad.sptrener.online (vytvorenie bannera/video reklamy)');
console.log('   a z instructor/dash/partner subdomén, nech sa nič nerozbilo.');
