// /api/mentor (Elite "AI Mentor chat", z cenníka) nemal žiadny denný
// strop — len generický 20 req/min rate limit, ktorý jedného prihláseného
// power-usera vôbec nezastaví. Pridáva 40 správ/deň strop (generous na
// bežné štúdium, ale ohraničuje API náklady voči Elite predplatnému).
//
// Vyžaduje db/migrate_mentor_daily_cap.sql (uz spustený).
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/276-mentor-daily-cap.js
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.276-lock';
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

if (src.includes('MENTOR_DAILY_LIMIT')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

const OLD = `app.post('/api/mentor', rateLimit, requireElite, async (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: 'Server nie je nakonfigurovaný.' });
  const { question, topic, qText, options, correctAnswer, explanation, lang = 'sk' } = req.body;
  if (!question) return res.status(400).json({ error: 'Chýba otázka.' });

  const isCZ = lang === 'cz';`;

const NEW = `app.post('/api/mentor', rateLimit, requireElite, async (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: 'Server nie je nakonfigurovaný.' });
  const { question, topic, qText, options, correctAnswer, explanation, lang = 'sk' } = req.body;
  if (!question) return res.status(400).json({ error: 'Chýba otázka.' });

  const MENTOR_DAILY_LIMIT = 40;
  const today = new Date().toISOString().slice(0, 10);
  const { data: mentorUser } = await supabase.from('users').select('mentor_messages_count, mentor_messages_date').eq('email', req.userEmail).maybeSingle();
  const mentorTodaysCount = (mentorUser?.mentor_messages_date === today) ? (mentorUser.mentor_messages_count || 0) : 0;
  if (mentorTodaysCount >= MENTOR_DAILY_LIMIT) {
    return res.status(429).json({ error: 'Dosiahol/a si denný limit AI Mentor správ (' + MENTOR_DAILY_LIMIT + '/deň). Skús to znova zajtra.' });
  }
  await supabase.from('users').update({ mentor_messages_count: mentorTodaysCount + 1, mentor_messages_date: today }).eq('email', req.userEmail);

  const isCZ = lang === 'cz';`;

src = replaceExactCount(src, OLD, NEW, 1, '/api/mentor handler');

const backup = FILE + '.pre-276-mentor-daily-cap-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);

console.log('✅ server.js: /api/mentor teraz má denný strop 40 správ/deň.');
console.log('   Záloha:', backup);
console.log('   Over, že db/migrate_mentor_daily_cap.sql už bežal, potom: pm2 restart sptrener-main');
