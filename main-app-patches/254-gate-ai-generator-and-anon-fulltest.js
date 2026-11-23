// Dve ďalšie diery v ochrane nákladov na Claude API (zistené pri audite
// Anthropic Console usage, ~3.4M input / ~4.1M output tokenov za mesiac
// bez zodpovedajúcich platiacich zákazníkov):
//
// 1) POST /api/generate-topic (routes/generate.js) -- "AI Generátor
//    úloh" na homescreene appky, nemal VÔBEC žiadne obmedzenie (žiadny
//    login, žiadny trial limit, len všeobecný rate limit 30/hod/IP).
//    Pritom je to marketingovo prezentované ako PLATENÁ Premium funkcia
//    ("AI generátor — nové úlohy každý deň" v cenníku) -- jeho sesterská
//    routa routes/ai.js (/api/ai/generate, zjavne staršia/nepoužívaná
//    cesta) requireAuth+requirePro MÁ. Pridáva rovnaké obmedzenie sem,
//    len cez aktuálny (Supabase) auth mechanizmus, nie cez stale
//    middleware/auth.js (ten je pre starý JWT_SECRET+Postgres subscriptions
//    systém, ktorý appka už nepoužíva).
//
// 2) POST /api/generate-full-test (server.js) pre ANONYMNÝCH
//    používateľov (bez emailu v tele requestu) nemalo ŽIADNU serverovú
//    kontrolu -- "1 test zadarmo bez registrácie" bol vynucovaný len
//    cez localStorage na klientovi (vymazanie/inkognito = neobmedzene).
//    Pridáva kontrolu podľa IP adresy cez existujúcu tabuľku
//    trial_abuse_signals (nový signal_type 'ip_anon_fulltest') --
//    rovnaký vzor ako main-app-patches/187.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/254-gate-ai-generator-and-anon-fulltest.js

const fs = require('fs');
const path = require('path');

const GENERATE_PATH = path.join(process.cwd(), 'routes', 'generate.js');
const SERVER_PATH = path.join(process.cwd(), 'server.js');
const APP_HTML_PATH = path.join(process.cwd(), 'public', 'app.html');

for (const p of [GENERATE_PATH, SERVER_PATH, APP_HTML_PATH]) {
  if (!fs.existsSync(p)) {
    console.error('❌ Nenašiel som súbor:', p, '— spusti tento skript z koreňa hlavnej appky.');
    process.exit(1);
  }
}

const LOCK = path.join(process.cwd(), '.254-gate-ai-generator-and-anon-fulltest-lock');
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

// ═══════════════════════ 1) routes/generate.js ═══════════════════════
let gen = fs.readFileSync(GENERATE_PATH, 'utf8');

if (gen.includes('vyžaduje Premium predplatné')) {
  console.error('❌ routes/generate.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

const GEN_OLD_HEADER = `const express = require('express');
const router = express.Router();

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';`;
const GEN_NEW_HEADER = `const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function verifyToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';`;

if (!gen.includes(GEN_OLD_HEADER)) {
  console.error('❌ Nenašiel som presnú kotvu (header routes/generate.js). Nič som nezmenil.');
  process.exit(1);
}
gen = replaceOnce(gen, GEN_OLD_HEADER, GEN_NEW_HEADER, 'routes/generate.js: Supabase + verifyToken');

const GEN_ROUTE_OLD = `router.post('/generate-topic', async (req, res) => {
  const { topic, part = 'verbal', count = 5, difficulty = 'medium', lang = 'sk' } = req.body || {};

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: { message: 'AI generátor nie je nakonfigurovaný (chýba ANTHROPIC_API_KEY).' } });
  }`;
const GEN_ROUTE_NEW = `router.post('/generate-topic', async (req, res) => {
  const { topic, part = 'verbal', count = 5, difficulty = 'medium', lang = 'sk' } = req.body || {};

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: { message: 'AI generátor nie je nakonfigurovaný (chýba ANTHROPIC_API_KEY).' } });
  }

  // Platená Premium/Elite funkcia -- predtým bez akéhokoľvek obmedzenia.
  const authUser = await verifyToken(req);
  if (!authUser) return res.status(401).json({ error: { message: 'Musíš byť prihlásený.' } });
  const { data: dbUser } = await supabase.from('users').select('is_premium').eq('email', (authUser.email || '').toLowerCase()).maybeSingle();
  if (!dbUser?.is_premium) return res.status(403).json({ error: { message: 'AI Generátor úloh vyžaduje Premium predplatné.' } });`;

if (!gen.includes(GEN_ROUTE_OLD)) {
  console.error('❌ Nenašiel som presnú kotvu (/generate-topic handler). Nič som nezmenil.');
  process.exit(1);
}
gen = replaceOnce(gen, GEN_ROUTE_OLD, GEN_ROUTE_NEW, 'routes/generate.js: requireAuth + Premium gate');

// ═══════════════════════ 2) server.js ═══════════════════════
let server = fs.readFileSync(SERVER_PATH, 'utf8');

if (server.includes('ip_anon_fulltest')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

const SERVER_OLD = `app.post('/api/generate-full-test', rateLimit, async (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: 'Server nie je nakonfigurovaný.' });
  const { difficulty = 'medium', lang = 'sk' } = req.body;
  const isCZ = lang === 'cz';

  try {`;
const SERVER_NEW = `app.post('/api/generate-full-test', rateLimit, async (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: 'Server nie je nakonfigurovaný.' });
  const { difficulty = 'medium', lang = 'sk', email } = req.body;
  const isCZ = lang === 'cz';

  // Anonymný používateľ (bez emailu v tele) -- "1 test zadarmo bez
  // registrácie" bol doteraz vynucovaný len cez localStorage na
  // klientovi. Serverová kontrola podľa IP, rovnaký vzor ako
  // main-app-patches/187 (trial_abuse_signals).
  if (!email) {
    const anonIp = req.ip || req.connection.remoteAddress || 'unknown';
    const { data: existingIp } = await supabase.from('trial_abuse_signals')
      .select('signal_value').eq('signal_type', 'ip_anon_fulltest').eq('signal_value', anonIp).maybeSingle();
    if (existingIp) {
      return res.status(403).json({ error: 'Bezplatný test bez registrácie si už vyčerpal. Zaregistruj sa a dostaneš ďalšie 3 testy zadarmo.' });
    }
    await supabase.from('trial_abuse_signals').upsert(
      { signal_type: 'ip_anon_fulltest', signal_value: anonIp, first_email: 'anonymous' },
      { onConflict: 'signal_type,signal_value', ignoreDuplicates: true }
    );
  }

  try {`;

if (!server.includes(SERVER_OLD)) {
  console.error('❌ Nenašiel som presnú kotvu (/api/generate-full-test handler). Nič som nezmenil.');
  process.exit(1);
}
server = replaceOnce(server, SERVER_OLD, SERVER_NEW, 'server.js: IP-based anon fulltest gate');

// ═══════════════════════ 3) public/app.html ═══════════════════════
let appHtml = fs.readFileSync(APP_HTML_PATH, 'utf8');

if (appHtml.includes('if(!isPremium()){showPaywall();return;}')) {
  console.error('❌ app.html: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// 3a) generateQuestions() -- Premium gate hneď na začiatku, nezávisle od
// toho, ktorou cestou sa používateľ na obrazovku AI generátora dostal.
const APP_OLD_GEN = `async function generateQuestions(){
  const part=currentGenSubject==='vsp'?(document.querySelector('#genPartChips .chip.active')?.dataset.val||'verbal'):currentGenSubject;`;
const APP_NEW_GEN = `async function generateQuestions(){
  if(!isPremium()){showPaywall();return;}
  const part=currentGenSubject==='vsp'?(document.querySelector('#genPartChips .chip.active')?.dataset.val||'verbal'):currentGenSubject;`;

if (!appHtml.includes(APP_OLD_GEN)) {
  console.error('❌ Nenašiel som presnú kotvu (generateQuestions()). Nič som nezmenil.');
  process.exit(1);
}
appHtml = replaceOnce(appHtml, APP_OLD_GEN, APP_NEW_GEN, 'app.html: generateQuestions() Premium gate');

// 3b) startAIFullTest() -- posli email (ak prihlásený), aby server vedel
// rozlíšiť anonymného používateľa od registrovaného.
const APP_OLD_FULL = `    const response=await fetch('/api/generate-full-test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({difficulty:'medium',lang:currentLang})});`;
const APP_NEW_FULL = `    const response=await fetch('/api/generate-full-test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({difficulty:'medium',lang:currentLang,email:currentUser?currentUser.email:undefined})});`;

if (!appHtml.includes(APP_OLD_FULL)) {
  console.error('❌ Nenašiel som presnú kotvu (startAIFullTest() fetch). Nič som nezmenil.');
  process.exit(1);
}
appHtml = replaceOnce(appHtml, APP_OLD_FULL, APP_NEW_FULL, 'app.html: startAIFullTest() posiela email');

const now = Date.now();
fs.copyFileSync(GENERATE_PATH, GENERATE_PATH + '.pre-254-' + now);
fs.copyFileSync(SERVER_PATH, SERVER_PATH + '.pre-254-' + now);
fs.copyFileSync(APP_HTML_PATH, APP_HTML_PATH + '.pre-254-' + now);
fs.writeFileSync(GENERATE_PATH, gen);
fs.writeFileSync(SERVER_PATH, server);
fs.writeFileSync(APP_HTML_PATH, appHtml);

console.log('✅ /api/generate-topic je teraz Premium-only (requireAuth + is_premium).');
console.log('✅ /api/generate-full-test pre anonymných používateľov teraz kontroluje IP v trial_abuse_signals.');
console.log('✅ app.html: AI Generátor zobrazí paywall namiesto generovania, ak nie si Premium.');
console.log('   Over syntax pred reštartom: node -c server.js');
console.log('   pm2 restart sptrener-main (routes/generate.js aj server.js nie sú statické súbory)');
