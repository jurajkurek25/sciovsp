// BEZPEČNOSTNÁ ZÁPLATA — nálezy z celkového bezpečnostného auditu (4 oddelené opravy):
//
// 1. KRITICKÉ/HIGH — /api/auth/status berie `email` priamo z tela
//    požiadavky, BEZ AKEJKOĽVEK autentifikácie a BEZ rate limitu.
//    Vrátane: is_premium, presný termín prijímačiek (exam_date),
//    premium_expires_at, plan, refCode. Ktokoľvek mohol poslať cudzí
//    email a zistiť, či je platiacim klientom + jeho presný termín
//    skúšky — citlivý osobný údaj. Oprava: vyžaduje Bearer token,
//    email sa berie VÝLUČNE z overeného tokenu, nie z tela požiadavky.
//
// 2. MEDIUM — /api/courses/:slug/checkout, vetva pre bezplatný kurz
//    (price_cents === 0): vytvárala záznam v course_purchases pre
//    AKÝKOĽVEK email z tela požiadavky, bez prihlásenia. Oprava:
//    táto vetva teraz vyžaduje platný Bearer token a použije email
//    z neho (nie z tela). Platené kurzy (Stripe checkout) ostávajú
//    bezo zmeny — tam je anonymný checkout pre nového klienta zámerný.
//
// 3. MEDIUM — /api/courses/:slug/lessons/:lessonId/submit (spúšťa
//    platené Claude vyhodnotenie + upload) nemal žiadny rate limit
//    (na rozdiel od takmer všetkých ostatných POST routes v súbore).
//
// 4. LOW — /api/gift-cards/:code/check a /:code/pdf nemali rate limit
//    (nekonzistentné s ostatnými routes; prakticky ťažko zneužiteľné
//    pre veľký keyspace kódu, ale zjednotené pre poriadok).
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/283-auth-status-pii-and-misc-hardening.js
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.283-lock';
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

if (src.includes('patch 283')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// ── 1) /api/auth/status: vyžaduj Bearer token, email len z tokenu ──
const STATUS_OLD = `app.post('/api/auth/status', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Chýba email.' });
  try {`;

const STATUS_NEW = `app.post('/api/auth/status', rateLimit, async (req, res) => {
  // (patch 283) email sa už neberie z tela požiadavky -- predtým mohol
  // ktokoľvek poslať cudzí email a zistiť is_premium/exam_date/plan pre
  // AKÚKOĽVEK osobu, bez prihlásenia. Teraz výlučne z overeného tokenu.
  const authHeader = req.headers.authorization || '';
  const statusToken = authHeader.replace('Bearer ', '').trim();
  if (!statusToken) return res.status(401).json({ error: 'Nie si prihlásený.' });
  const { data: { user: statusAuthUser }, error: statusAuthErr } = await supabase.auth.getUser(statusToken);
  if (statusAuthErr || !statusAuthUser) return res.status(401).json({ error: 'Neplatný token.' });
  const email = statusAuthUser.email;
  try {`;

src = replaceExactCount(src, STATUS_OLD, STATUS_NEW, 1, '/api/auth/status handler');

// ── 2) /api/courses/:slug/checkout: bezplatný kurz vyžaduje prihlásenie ──
const FREE_COURSE_OLD = `    // Bezplatny kurz (price_cents = 0) — pristup sa udeli rovno po Google
    // prihlaseni, bez Stripe checkoutu.
    if (course.price_cents === 0) {
      const { error: freeError } = await supabase.from('course_purchases').insert({
        course_id: course.id, email, stripe_session_id: 'free_' + require('crypto').randomBytes(8).toString('hex'), amount_paid_cents: 0
      });
      if (freeError) throw freeError;
      return res.json({ url: BASE_URL_BLOG + '/kurzy/' + course.slug + '/watch?free=1' });
    }`;

const FREE_COURSE_NEW = `    // Bezplatny kurz (price_cents = 0) — pristup sa udeli rovno po Google
    // prihlaseni, bez Stripe checkoutu.
    if (course.price_cents === 0) {
      // (patch 283) predtým sa tu vytváral course_purchases záznam pre
      // AKÝKOĽVEK email z tela požiadavky bez prihlásenia -- teraz
      // vyžaduje platný Bearer token a použije email z neho.
      const freeAuthHeader = req.headers.authorization || '';
      const freeToken = freeAuthHeader.replace('Bearer ', '').trim();
      if (!freeToken) return res.status(401).json({ error: 'Prihlás sa, aby si si mohol/a aktivovať bezplatný kurz.' });
      const { data: { user: freeAuthUser }, error: freeAuthErr } = await supabase.auth.getUser(freeToken);
      if (freeAuthErr || !freeAuthUser) return res.status(401).json({ error: 'Neplatná session.' });
      const freeEmail = freeAuthUser.email;
      const { error: freeError } = await supabase.from('course_purchases').insert({
        course_id: course.id, email: freeEmail, stripe_session_id: 'free_' + require('crypto').randomBytes(8).toString('hex'), amount_paid_cents: 0
      });
      if (freeError) throw freeError;
      return res.json({ url: BASE_URL_BLOG + '/kurzy/' + course.slug + '/watch?free=1' });
    }`;

src = replaceExactCount(src, FREE_COURSE_OLD, FREE_COURSE_NEW, 1, '/api/courses/:slug/checkout free-course branch');

// ── 3) /api/courses/:slug/lessons/:lessonId/submit: pridaj rate limit ──
src = replaceExactCount(
  src,
  `app.post('/api/courses/:slug/lessons/:lessonId/submit', requireCourseBuyer, (req, res) => {`,
  `app.post('/api/courses/:slug/lessons/:lessonId/submit', rateLimit, requireCourseBuyer, (req, res) => {`,
  1, '/api/courses/:slug/lessons/:lessonId/submit route'
);

// ── 4) /api/gift-cards/:code/check a /:code/pdf: pridaj rate limit ──
src = replaceExactCount(
  src,
  `app.get('/api/gift-cards/:code/check', async (req, res) => {`,
  `app.get('/api/gift-cards/:code/check', rateLimit, async (req, res) => {`,
  1, '/api/gift-cards/:code/check route'
);
src = replaceExactCount(
  src,
  `app.get('/api/gift-cards/:code/pdf', async (req, res) => {`,
  `app.get('/api/gift-cards/:code/pdf', rateLimit, async (req, res) => {`,
  1, '/api/gift-cards/:code/pdf route'
);

const backup = FILE + '.pre-283-auth-status-pii-and-misc-hardening-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);

console.log('✅ server.js: /api/auth/status teraz vyžaduje Bearer token (email len z tokenu, nie z tela).');
console.log('✅ server.js: /api/courses/:slug/checkout bezplatná vetva teraz vyžaduje prihlásenie.');
console.log('✅ server.js: rate limit doplnený na /submit, /gift-cards/:code/check, /gift-cards/:code/pdf.');
console.log('   Záloha:', backup);
console.log('');
console.log('🚨 DÔLEŽITÉ:');
console.log('   1. pm2 restart sptrener-main');
console.log('   2. Over, že frontend volajúci /api/auth/status posiela Authorization header (Bearer token) -- ak dnes posiela len {email}, treba doplniť na frontende, inak status check prestane fungovať pre prihlásených userov.');
console.log('   3. Over, že claim bezplatného kurzu na stránke posiela Authorization header rovnako.');
