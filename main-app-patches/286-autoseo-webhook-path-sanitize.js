// BEZPEČNOSTNÁ ZÁPLATA (nižšia priorita, flagnuté v predošlom audite) —
// routes/autoseoWebhook.js používal payload.id priamo (nesanitizovane) v
// názve ukladaného obrázka: `'article-' + payload.id + '-' + Date.now()`,
// následne poslaného do path.join(UPLOAD_DIR, filename). Keďže payload.id
// prichádza z tela webhook požiadavky, ak by obsahoval "../" sekvencie,
// výsledná cesta by mohla uniknúť z UPLOAD_DIR (path traversal → zápis
// súboru kamkoľvek, kam má node proces oprávnenie).
//
// Zneužiteľnosť je obmedzená povinným AUTOSEO_WEBHOOK_TOKEN (overovaný
// crypto.timingSafeEqual pred čímkoľvek iným) — útočník by najprv
// potreboval tento token. Ide teda o defense-in-depth, nie samostatnú
// otvorenú dieru, ale lacné a bezpečné opraviť.
//
// Oprava: payload.id sa pred použitím v názve súboru sanitizuje na
// bezpečnú podmnožinu znakov (alfanumerické, pomlčka, podčiarknik).
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/286-autoseo-webhook-path-sanitize.js
const fs = require('fs');
const FILE = 'routes/autoseoWebhook.js';

const LOCK = FILE.replace('/', '_') + '.286-lock';
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

if (src.includes('safePayloadId')) {
  console.error('❌ ' + FILE + ': už je aplikované, nič som nezmenil.');
  process.exit(1);
}

src = replaceExactCount(
  src,
  `        const basename = 'article-' + payload.id + '-' + Date.now();`,
  `        // (patch 286) payload.id sanitizovaný na bezpečnú podmnožinu znakov
        // pred použitím v názve súboru -- bráni path traversal cez "../" v
        // id, ktoré by inak uniklo z UPLOAD_DIR.
        const safePayloadId = String(payload.id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100) || 'unknown';
        const basename = 'article-' + safePayloadId + '-' + Date.now();`,
  1, 'autoseoWebhook basename construction'
);

const backup = FILE.replace('/', '_') + '.pre-286-autoseo-webhook-path-sanitize-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);

console.log('✅ ' + FILE + ': payload.id sa teraz sanitizuje pred použitím v názve súboru.');
console.log('   Záloha:', backup);
console.log('   pm2 restart sptrener-main');
