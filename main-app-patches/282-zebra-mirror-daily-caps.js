// FINANČNÁ ZÁPLATA — /api/zebra-builder a /api/generate-mirror sú
// Elite-only AI funkcie, ktoré nemali ŽIADEN denný strop -- len generický
// 20 req/min IP rate limit, rovnaký problém, aký mal /api/mentor pred
// main-app-patches/276 (mentor-daily-cap). /api/generate-mirror je
// obzvlášť nákladný: JEDEN request môže spustiť až 6 paralelných Claude
// volaní po 4096 tokenov (až 24576 tokenov kapacity na jedno kliknutie).
//
// Pridáva:
//   /api/zebra-builder   → 30 volaní/deň
//   /api/generate-mirror → 10 volaní/deň (každé = až 6× 4096-token generácia)
//
// Vyžaduje db/migrate_zebra_mirror_daily_caps.sql (uz spustený).
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/282-zebra-mirror-daily-caps.js
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.282-lock';
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

if (src.includes('ZEBRA_BUILDER_DAILY_LIMIT') || src.includes('MIRROR_MODE_DAILY_LIMIT')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// ── /api/zebra-builder ──────────────────────────────────────
const ZEBRA_OLD = `app.post('/api/zebra-builder', rateLimit, requireElite, async (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: 'Server nie je nakonfigurovaný.' });
  const { context, question, options, answer, lang = 'sk' } = req.body;
  if (!context) return res.status(400).json({ error: 'Chýba kontext.' });

  const isCZ = lang === 'cz';`;

const ZEBRA_NEW = `app.post('/api/zebra-builder', rateLimit, requireElite, async (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: 'Server nie je nakonfigurovaný.' });
  const { context, question, options, answer, lang = 'sk' } = req.body;
  if (!context) return res.status(400).json({ error: 'Chýba kontext.' });

  const ZEBRA_BUILDER_DAILY_LIMIT = 30;
  const zebraToday = new Date().toISOString().slice(0, 10);
  const { data: zebraUser } = await supabase.from('users').select('zebra_builder_count, zebra_builder_date').eq('email', req.userEmail).maybeSingle();
  const zebraTodaysCount = (zebraUser?.zebra_builder_date === zebraToday) ? (zebraUser.zebra_builder_count || 0) : 0;
  if (zebraTodaysCount >= ZEBRA_BUILDER_DAILY_LIMIT) {
    return res.status(429).json({ error: 'Dosiahol/a si denný limit Zebra Builder (' + ZEBRA_BUILDER_DAILY_LIMIT + '/deň). Skús to znova zajtra.' });
  }
  await supabase.from('users').update({ zebra_builder_count: zebraTodaysCount + 1, zebra_builder_date: zebraToday }).eq('email', req.userEmail);

  const isCZ = lang === 'cz';`;

src = replaceExactCount(src, ZEBRA_OLD, ZEBRA_NEW, 1, '/api/zebra-builder handler');

// ── /api/generate-mirror ────────────────────────────────────
const MIRROR_OLD = `app.post('/api/generate-mirror', rateLimit, requireElite, async (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: 'Server nie je nakonfigurovaný.' });
  const { topics, lang = 'sk' } = req.body;
  if (!topics?.length) return res.status(400).json({ error: 'Chýbajú okruhy.' });

  const isCZ = lang === 'cz';`;

const MIRROR_NEW = `app.post('/api/generate-mirror', rateLimit, requireElite, async (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: 'Server nie je nakonfigurovaný.' });
  const { topics, lang = 'sk' } = req.body;
  if (!topics?.length) return res.status(400).json({ error: 'Chýbajú okruhy.' });

  const MIRROR_MODE_DAILY_LIMIT = 10;
  const mirrorToday = new Date().toISOString().slice(0, 10);
  const { data: mirrorUser } = await supabase.from('users').select('mirror_mode_count, mirror_mode_date').eq('email', req.userEmail).maybeSingle();
  const mirrorTodaysCount = (mirrorUser?.mirror_mode_date === mirrorToday) ? (mirrorUser.mirror_mode_count || 0) : 0;
  if (mirrorTodaysCount >= MIRROR_MODE_DAILY_LIMIT) {
    return res.status(429).json({ error: 'Dosiahol/a si denný limit Mirror Mode (' + MIRROR_MODE_DAILY_LIMIT + '/deň). Skús to znova zajtra.' });
  }
  await supabase.from('users').update({ mirror_mode_count: mirrorTodaysCount + 1, mirror_mode_date: mirrorToday }).eq('email', req.userEmail);

  const isCZ = lang === 'cz';`;

src = replaceExactCount(src, MIRROR_OLD, MIRROR_NEW, 1, '/api/generate-mirror handler');

const backup = FILE + '.pre-282-zebra-mirror-daily-caps-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);

console.log('✅ server.js: /api/zebra-builder teraz má denný strop 30 volaní/deň.');
console.log('✅ server.js: /api/generate-mirror teraz má denný strop 10 volaní/deň.');
console.log('   Záloha:', backup);
console.log('   Over, že db/migrate_zebra_mirror_daily_caps.sql už bežal, potom: pm2 restart sptrener-main');
