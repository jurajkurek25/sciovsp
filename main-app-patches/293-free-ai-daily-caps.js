// FINANČNÁ ZÁPLATA — /api/generate, /api/generate-topic, /api/solution a
// /api/coach boli po main-app-patches/280 chránené LEN cez requireLogin
// (čokoľvek prihlásené), bez AKÉHOKOĽVEK stropu na počet volaní pre
// bezplatné (neplatiace) účty -- len zdieľaný 20 req/min IP rate limit,
// ktorý neplatí na úroveň účtu a dá sa obísť viacerými účtami.
//
// Pridáva (rovnaký vzor ako main-app-patches/276 a /282):
//   /api/generate         → 10 volaní/deň (bezplatní; Premium/Elite bez stropu)
//   /api/generate-topic   → 10 volaní/deň (bezplatní; Premium/Elite bez stropu)
//                            + orezanie "count" na max 20 (klient ho doteraz
//                            mohol poslať ľubovoľné, žiadna validácia)
//   /api/solution         → 20 volaní/deň (bezplatní; Premium/Elite bez stropu)
//   /api/coach            → 20 volaní/deň (bezplatní; Premium/Elite bez stropu)
//
// Vyžaduje: db/migrate_free_ai_daily_caps.sql (uz spustený),
// main-app-patches/280-auth-gate-open-ai-endpoints.js (uz aplikovaný --
// potrebuje req.userEmail z requireLogin).
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/293-free-ai-daily-caps.js
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.293-lock';
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

if (src.includes('GENERATE_DAILY_LIMIT')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}
if (!src.includes('async function requireLogin(')) {
  console.error('❌ server.js: main-app-patches/280-auth-gate-open-ai-endpoints.js ešte nie je aplikovaný. Spusti ho najprv -- táto záplata naňho nadväzuje.');
  process.exit(1);
}

// ── /api/generate ────────────────────────────────────────────
const GENERATE_OLD = `app.post('/api/generate', rateLimit, requireLogin, (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: 'Server nie je nakonfigurovaný.' });
  const { system, messages } = req.body;`;

const GENERATE_NEW = `app.post('/api/generate', rateLimit, requireLogin, async (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: 'Server nie je nakonfigurovaný.' });

  const GENERATE_DAILY_LIMIT = 10;
  const generateToday = new Date().toISOString().slice(0, 10);
  const { data: generateUser } = await supabase.from('users').select('is_premium, generate_count, generate_date').eq('email', req.userEmail).maybeSingle();
  if (!generateUser?.is_premium) {
    const generateTodaysCount = (generateUser?.generate_date === generateToday) ? (generateUser.generate_count || 0) : 0;
    if (generateTodaysCount >= GENERATE_DAILY_LIMIT) {
      return res.status(429).json({ error: 'Dosiahol/a si denný limit (' + GENERATE_DAILY_LIMIT + '/deň) pre bezplatný účet. Skús to znova zajtra, alebo si zváž Premium.' });
    }
    await supabase.from('users').update({ generate_count: generateTodaysCount + 1, generate_date: generateToday }).eq('email', req.userEmail);
  }

  const { system, messages } = req.body;`;

src = replaceExactCount(src, GENERATE_OLD, GENERATE_NEW, 1, '/api/generate handler');

// ── /api/generate-topic ──────────────────────────────────────
const GENTOPIC_OLD = `app.post('/api/generate-topic', rateLimit, requireLogin, (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: 'Server nie je nakonfigurovaný.' });
  const { topic, part, count = 5, difficulty = 'medium', lang = 'sk' } = req.body;`;

const GENTOPIC_NEW = `app.post('/api/generate-topic', rateLimit, requireLogin, async (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: 'Server nie je nakonfigurovaný.' });

  const GENERATE_TOPIC_DAILY_LIMIT = 10;
  const genTopicToday = new Date().toISOString().slice(0, 10);
  const { data: genTopicUser } = await supabase.from('users').select('is_premium, generate_topic_count, generate_topic_date').eq('email', req.userEmail).maybeSingle();
  if (!genTopicUser?.is_premium) {
    const genTopicTodaysCount = (genTopicUser?.generate_topic_date === genTopicToday) ? (genTopicUser.generate_topic_count || 0) : 0;
    if (genTopicTodaysCount >= GENERATE_TOPIC_DAILY_LIMIT) {
      return res.status(429).json({ error: 'Dosiahol/a si denný limit (' + GENERATE_TOPIC_DAILY_LIMIT + '/deň) pre bezplatný účet. Skús to znova zajtra, alebo si zváž Premium.' });
    }
    await supabase.from('users').update({ generate_topic_count: genTopicTodaysCount + 1, generate_topic_date: genTopicToday }).eq('email', req.userEmail);
  }

  let { topic, part, count = 5, difficulty = 'medium', lang = 'sk' } = req.body;
  count = Math.min(Math.max(1, parseInt(count, 10) || 5), 20);`;

src = replaceExactCount(src, GENTOPIC_OLD, GENTOPIC_NEW, 1, '/api/generate-topic handler');

// ── /api/solution ────────────────────────────────────────────
const SOLUTION_OLD = `app.post('/api/solution', rateLimit, requireLogin, async (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: 'Server nie je nakonfigurovaný.' });

  const { topic, text, context, options, answer, correctOption, lang = 'sk' } = req.body;`;

const SOLUTION_NEW = `app.post('/api/solution', rateLimit, requireLogin, async (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: 'Server nie je nakonfigurovaný.' });

  const SOLUTION_DAILY_LIMIT = 20;
  const solutionToday = new Date().toISOString().slice(0, 10);
  const { data: solutionUser } = await supabase.from('users').select('is_premium, solution_count, solution_date').eq('email', req.userEmail).maybeSingle();
  if (!solutionUser?.is_premium) {
    const solutionTodaysCount = (solutionUser?.solution_date === solutionToday) ? (solutionUser.solution_count || 0) : 0;
    if (solutionTodaysCount >= SOLUTION_DAILY_LIMIT) {
      return res.status(429).json({ error: 'Dosiahol/a si denný limit (' + SOLUTION_DAILY_LIMIT + '/deň) pre bezplatný účet. Skús to znova zajtra, alebo si zváž Premium.' });
    }
    await supabase.from('users').update({ solution_count: solutionTodaysCount + 1, solution_date: solutionToday }).eq('email', req.userEmail);
  }

  const { topic, text, context, options, answer, correctOption, lang = 'sk' } = req.body;`;

src = replaceExactCount(src, SOLUTION_OLD, SOLUTION_NEW, 1, '/api/solution handler');

// ── /api/coach ────────────────────────────────────────────────
const COACH_OLD = `app.post('/api/coach', rateLimit, requireLogin, (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: 'Server nie je nakonfigurovaný.' });
  const { correct, total, topicStats, estimatedPercentile, testsCount } = req.body;`;

const COACH_NEW = `app.post('/api/coach', rateLimit, requireLogin, async (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: 'Server nie je nakonfigurovaný.' });

  const COACH_DAILY_LIMIT = 20;
  const coachToday = new Date().toISOString().slice(0, 10);
  const { data: coachUser } = await supabase.from('users').select('is_premium, coach_count, coach_date').eq('email', req.userEmail).maybeSingle();
  if (!coachUser?.is_premium) {
    const coachTodaysCount = (coachUser?.coach_date === coachToday) ? (coachUser.coach_count || 0) : 0;
    if (coachTodaysCount >= COACH_DAILY_LIMIT) {
      return res.status(429).json({ error: 'Dosiahol/a si denný limit (' + COACH_DAILY_LIMIT + '/deň) pre bezplatný účet. Skús to znova zajtra, alebo si zváž Premium.' });
    }
    await supabase.from('users').update({ coach_count: coachTodaysCount + 1, coach_date: coachToday }).eq('email', req.userEmail);
  }

  const { correct, total, topicStats, estimatedPercentile, testsCount } = req.body;`;

src = replaceExactCount(src, COACH_OLD, COACH_NEW, 1, '/api/coach handler');

const backup = FILE + '.pre-293-free-ai-daily-caps-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);

console.log('✅ server.js: /api/generate, /api/generate-topic, /api/solution, /api/coach teraz majú denný strop pre bezplatné účty (Premium/Elite bez stropu).');
console.log('✅ server.js: /api/generate-topic "count" orezaný na max 20.');
console.log('   Záloha:', backup);
console.log('   Over, že db/migrate_free_ai_daily_caps.sql už bežal, potom: pm2 restart sptrener-main');
