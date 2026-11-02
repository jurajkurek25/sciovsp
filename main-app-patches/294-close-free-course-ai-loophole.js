// FINANČNÁ ZÁPLATA — AI Coach pod lekciou (/api/courses/:slug/lessons/:lessonId/coach,
// s web_search nástrojom až 5×/volanie) a AI vyhodnotenie nahrávky
// (/api/courses/:slug/lessons/:lessonId/submit, vision model) sú chránené
// len cez requireCourseBuyer -- ktorý vyžaduje LEN existenciu riadku v
// course_purchases, nie že za kurz bolo niečo zaplatené. Appka podporuje
// bezplatné kurzy (price_cents = 0, course_purchases.amount_paid_cents = 0),
// takže KTOKOĽVEK prihlásený si "kúpi" bezplatný kurz za 0 € a získa
// neobmedzený prístup k týmto dvom najdrahším AI funkciám v appke.
//
// Táto záplata pridáva kontrolu amount_paid_cents > 0 na oba endpointy --
// AI Coach a AI vyhodnotenie zostávajú dostupné len pre skutočne zaplatené
// kurzy (nulová platba cez 100%-zľavový kód sa tiež zachytí, keďže sa
// kontroluje to, čo bolo SKUTOČNE zaplatené, nie katalógová cena kurzu).
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/294-close-free-course-ai-loophole.js
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.294-lock';
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

if (src.includes('AI Coach je dostupný len pre platené kurzy')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// ── AI Coach pod lekciou ──────────────────────────────────────
// Rovnaký vzor "course+purchase lookup" sa opakuje v 8 rôznych routách
// (komentáre, progres, lekcie...), takže kotvíme na širší, jedinečný
// blok od deklarácie routy nižšie, nie len na samotnú purchase kontrolu.
const COACH_OLD = `app.post('/api/courses/:slug/lessons/:lessonId/coach', rateLimit, requireCourseBuyer, async (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: 'Server nie je nakonfigurovaný.' });
  const { question } = req.body || {};
  if (!question || !question.trim()) return res.status(400).json({ error: 'Chýba otázka.' });
  try {
    const { data: course } = await supabase.from('courses').select('id,title').eq('slug', req.params.slug).single();
    if (!course) return res.status(404).json({ error: 'Kurz sa nenašiel.' });
    const { data: purchase } = await supabase.from('course_purchases').select('id').eq('course_id', course.id).eq('email', req.userEmail).maybeSingle();
    if (!purchase) return res.status(403).json({ error: 'Tento kurz nemáš zakúpený.' });`;

const COACH_NEW = `app.post('/api/courses/:slug/lessons/:lessonId/coach', rateLimit, requireCourseBuyer, async (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: 'Server nie je nakonfigurovaný.' });
  const { question } = req.body || {};
  if (!question || !question.trim()) return res.status(400).json({ error: 'Chýba otázka.' });
  try {
    const { data: course } = await supabase.from('courses').select('id,title').eq('slug', req.params.slug).single();
    if (!course) return res.status(404).json({ error: 'Kurz sa nenašiel.' });
    const { data: purchase } = await supabase.from('course_purchases').select('id, amount_paid_cents').eq('course_id', course.id).eq('email', req.userEmail).maybeSingle();
    if (!purchase) return res.status(403).json({ error: 'Tento kurz nemáš zakúpený.' });
    if (!purchase.amount_paid_cents) return res.status(403).json({ error: 'AI Coach je dostupný len pre platené kurzy.' });`;

src = replaceExactCount(src, COACH_OLD, COACH_NEW, 1, 'AI Coach pod lekciou -- kontrola amount_paid_cents');

// ── AI vyhodnotenie nahratého súboru ─────────────────────────
const SUBMIT_OLD = `app.post('/api/courses/:slug/lessons/:lessonId/submit', requireCourseBuyer, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Nahrávanie zlyhalo.' });
    if (!req.file) return res.status(400).json({ error: 'Chýba súbor.' });
    if (!SUBMISSION_MIME.includes(req.file.mimetype)) return res.status(400).json({ error: 'Povolené je PNG, JPG, WEBP alebo PDF.' });
    if (req.file.size > MAX_SUBMISSION_SIZE) return res.status(400).json({ error: 'Súbor je príliš veľký (max 10 MB).' });
    try {
      const { data: course } = await supabase.from('courses').select('id').eq('slug', req.params.slug).single();
      if (!course) return res.status(404).json({ error: 'Kurz sa nenašiel.' });
      const { data: purchase } = await supabase.from('course_purchases').select('id').eq('course_id', course.id).eq('email', req.userEmail).maybeSingle();
      if (!purchase) return res.status(403).json({ error: 'Tento kurz nemáš zakúpený.' });`;

const SUBMIT_NEW = `app.post('/api/courses/:slug/lessons/:lessonId/submit', requireCourseBuyer, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Nahrávanie zlyhalo.' });
    if (!req.file) return res.status(400).json({ error: 'Chýba súbor.' });
    if (!SUBMISSION_MIME.includes(req.file.mimetype)) return res.status(400).json({ error: 'Povolené je PNG, JPG, WEBP alebo PDF.' });
    if (req.file.size > MAX_SUBMISSION_SIZE) return res.status(400).json({ error: 'Súbor je príliš veľký (max 10 MB).' });
    try {
      const { data: course } = await supabase.from('courses').select('id').eq('slug', req.params.slug).single();
      if (!course) return res.status(404).json({ error: 'Kurz sa nenašiel.' });
      const { data: purchase } = await supabase.from('course_purchases').select('id, amount_paid_cents').eq('course_id', course.id).eq('email', req.userEmail).maybeSingle();
      if (!purchase) return res.status(403).json({ error: 'Tento kurz nemáš zakúpený.' });
      if (!purchase.amount_paid_cents) return res.status(403).json({ error: 'AI vyhodnotenie je dostupné len pre platené kurzy.' });`;

src = replaceExactCount(src, SUBMIT_OLD, SUBMIT_NEW, 1, 'AI vyhodnotenie nahrávky -- kontrola amount_paid_cents');

const backup = FILE + '.pre-294-close-free-course-ai-loophole-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);

console.log('✅ server.js: AI Coach pod lekciou a AI vyhodnotenie nahrávky teraz vyžadujú skutočne zaplatený kurz (amount_paid_cents > 0), nie len "kúpu" za 0 €.');
console.log('   Záloha:', backup);
console.log('   pm2 restart sptrener-main');
console.log('');
console.log('ℹ️  Ak máš legitímne bezplatné kurzy, kde CHCEŠ aby AI Coach fungoval aj');
console.log('   zadarmo, daj vedieť -- spravíme výnimku podľa course_id namiesto plošného zákazu.');
