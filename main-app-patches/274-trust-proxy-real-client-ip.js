// Appka beží za Cloudflare (+ lokálny Nginx). Bez trust proxy a bez
// prioritného čítania CF-Connecting-IP mohol req.ip vidieť IP proxy
// namiesto reálneho klienta — čo by znamenalo, že rateLimit() aj
// ip_anon_fulltest anti-abuse kontrola (main-app-patches/254) bucketujú
// VŠETKÝCH anonymných návštevníkov pod jednu zdieľanú "IP".
//
// CF-Connecting-IP nastavuje Cloudflare priamo na edge a klient ho
// nevie sfalšovať (Cloudflare ho prepíše) — spoľahlivejšie než počítanie
// X-Forwarded-For hopov cez trust proxy.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/274-trust-proxy-real-client-ip.js
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.274-lock';
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

if (src.includes('function getClientIp')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// ── 1) trust proxy, hneď za vytvorením appky ──
src = replaceExactCount(
  src,
  `const app = express();`,
  `const app = express();
app.set('trust proxy', true);`,
  1,
  'const app = express()'
);

// ── 2) zdieľaný helper pre reálnu IP klienta, pred rateLimitMap ──
src = replaceExactCount(
  src,
  `const rateLimitMap = new Map();`,
  `// Cloudflare nastavuje tento header priamo na edge, klient ho nevie
// sfalšovať (Cloudflare ho vždy prepíše svojou hodnotou).
function getClientIp(req) {
  return req.headers['cf-connecting-ip'] || req.ip || req.connection.remoteAddress;
}

const rateLimitMap = new Map();`,
  1,
  'rateLimitMap deklarácia'
);

// ── 3) rateLimit() použi getClientIp ──
src = replaceExactCount(
  src,
  `  const ip = req.ip || req.connection.remoteAddress;`,
  `  const ip = getClientIp(req);`,
  1,
  'rateLimit() ip premenná'
);

// ── 4) ip_anon_fulltest anti-abuse (main-app-patches/254) ──
src = replaceExactCount(
  src,
  `    const anonIp = req.ip || req.connection.remoteAddress || 'unknown';`,
  `    const anonIp = getClientIp(req) || 'unknown';`,
  1,
  'ip_anon_fulltest anonIp premenná'
);

const backup = FILE + '.pre-274-trust-proxy-real-client-ip-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);

console.log('✅ server.js: trust proxy + CF-Connecting-IP prioritné čítanie reálnej IP klienta.');
console.log('   Záloha:', backup);
console.log('   pm2 restart sptrener-main');
