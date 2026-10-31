// BEZPEČNOSTNÁ/FINANČNÁ ZÁPLATA — niekoľko endpointov, ktoré volajú platené
// Anthropic API, bolo chránených LEN generickým IP rate limitom (20/min),
// bez AKEJKOĽVEK väzby na prihlásenie, trial_count alebo predplatné:
//
//   /api/generate         — KRITICKÉ: posiela ĽUBOVOĹNÝ system+messages od
//                            klienta priamo do Claude API. Efektívne otvorený
//                            AI proxy na náklady majiteľa stránky.
//   /api/generate-topic   — generuje SCIO úlohy, žiadna väzba na účet.
//   /api/solution         — AI vysvetlenie úlohy, žiadna väzba na účet.
//   /api/coach            — AI koučovacia správa, žiadna väzba na účet.
//   /api/analysis         — komentár v kóde hovorí "len Premium + ai-full/full",
//                            ale kód to nikdy nevynucoval.
//
// Táto záplata:
//   1. Pridáva requireLogin (akýkoľvek prihlásený Supabase user) na
//      /api/generate, /api/generate-topic, /api/solution, /api/coach.
//   2. Pridáva requirePremium (is_premium = true, Premium ALEBO Elite) na
//      /api/analysis — presne podľa pôvodného zámeru v komentári.
//
// NEMENÍ /api/generate-full-test — ten má svoju vlastnú, zámernú logiku
// pre anonymný "1 test zadarmo bez registrácie" flow (trial_abuse_signals /
// ip_anon_fulltest), tú nechávam bezo zmeny.
//
// POZOR na /api/generate-topic: ak frontend niekde používa tento endpoint
// pre anonymný náhľad (ešte pred registráciou), tento patch to zablokuje —
// over si to na stránke po nasadení. Ak to tak je, daj vedieť, urobíme
// výnimku podobnú anon-trial logike z /api/generate-full-test.
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/280-auth-gate-open-ai-endpoints.js
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.280-lock';
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

if (src.includes('async function requireLogin(')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// 1) Vloženie requireLogin + requirePremium tesne pred definíciu requireElite
//    (tá už existuje presne raz v súbore — overené pred patchom).
const ELITE_ANCHOR = `async function requireElite(req, res, next) {`;

const NEW_MIDDLEWARE = `async function requireLogin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Nie si prihlásený.' });
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Neplatný token.' });
    req.userEmail = user.email;
    next();
  } catch(e) {
    res.status(500).json({ error: 'Chyba overenia.' });
  }
}

async function requirePremium(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Nie si prihlásený.' });
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Neplatný token.' });
    const { data: dbUser } = await supabase
      .from('users').select('is_premium').eq('email', user.email).single();
    if (!dbUser?.is_premium) {
      return res.status(403).json({ error: 'Táto funkcia je len pre Premium a Elite.' });
    }
    req.userEmail = user.email;
    next();
  } catch(e) {
    res.status(500).json({ error: 'Chyba overenia.' });
  }
}

async function requireElite(req, res, next) {`;

src = replaceExactCount(src, ELITE_ANCHOR, NEW_MIDDLEWARE, 1, 'requireElite anchor (pre vloženie requireLogin/requirePremium)');

// 2) Aplikuj requireLogin na 4 endpointy
src = replaceExactCount(
  src,
  `app.post('/api/generate', rateLimit, (req, res) => {`,
  `app.post('/api/generate', rateLimit, requireLogin, (req, res) => {`,
  1, '/api/generate route'
);
src = replaceExactCount(
  src,
  `app.post('/api/generate-topic', rateLimit, (req, res) => {`,
  `app.post('/api/generate-topic', rateLimit, requireLogin, (req, res) => {`,
  1, '/api/generate-topic route'
);
src = replaceExactCount(
  src,
  `app.post('/api/solution', rateLimit, async (req, res) => {`,
  `app.post('/api/solution', rateLimit, requireLogin, async (req, res) => {`,
  1, '/api/solution route'
);
src = replaceExactCount(
  src,
  `app.post('/api/coach', rateLimit, (req, res) => {`,
  `app.post('/api/coach', rateLimit, requireLogin, (req, res) => {`,
  1, '/api/coach route'
);

// 3) Aplikuj requirePremium na /api/analysis (presne podľa pôvodného
//    zámeru "len Premium + ai-full/full" z komentára nad touto routou)
src = replaceExactCount(
  src,
  `app.post('/api/analysis', rateLimit, async (req, res) => {`,
  `app.post('/api/analysis', rateLimit, requirePremium, async (req, res) => {`,
  1, '/api/analysis route'
);

const backup = FILE + '.pre-280-auth-gate-open-ai-endpoints-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);

console.log('✅ server.js: requireLogin pridaný na /api/generate, /api/generate-topic, /api/solution, /api/coach.');
console.log('✅ server.js: requirePremium pridaný na /api/analysis.');
console.log('   Záloha:', backup);
console.log('');
console.log('🚨 DÔLEŽITÉ:');
console.log('   1. pm2 restart sptrener-main');
console.log('   2. Over na stránke, že generovanie testu, vysvetlenie úlohy a AI coach fungujú pre PRIHLÁSENÉHO usera.');
console.log('   3. Over, že /api/generate-full-test (anonymný 1 test zadarmo) STÁLE funguje bez prihlásenia — ten sa nemenil.');
console.log('   4. Ak frontend niekde volá /api/generate-topic pre anonymný náhľad PRED registráciou, tento patch to zablokuje — daj vedieť, ak to tak je.');
