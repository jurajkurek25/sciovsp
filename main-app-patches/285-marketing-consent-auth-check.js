// BEZPEČNOSTNÁ ZÁPLATA (nižšia priorita, flagnuté v predošlom audite) —
// /api/stripe/checkout, /api/courses/:slug/checkout a /api/gift-cards/checkout
// zapisovali marketing_emails_opt_out pre email z tela požiadavky BEZ
// overenia, že volajúci je naozaj tou osobou. Ktokoľvek mohol poslať
// cudzí email + marketingConsent a prepísať jeho súhlas s marketingom,
// bez toho, aby sa prihlásil ako on.
//
// (Pre porovnanie: /api/membership/checkout, /api/gift-cards/redeem a
// /api/webinar/register toto riziko NEMAJÚ — všetky tri už dnes riešia
// email výhradne server-side/z overeného tokenu, nikdy z tela požiadavky
// pre tento zápis. Táto záplata sa ich netýka.)
//
// Oprava: nový helper marketingConsentAllowedFor(req, email) — ak je v
// požiadavke Bearer token, musí patriť presne tomuto emailu; ak token
// chýba (zámerný anonymný checkout nového klienta), zápis prebehne ako
// doteraz (nemá sa čím overiť, a blokovanie by rozbilo legitímny
// anonymný nákup). Toto zatvára prípad, kde existujúci prihlásený
// útočník skúša prepísať súhlas INEJ existujúcej osoby.
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/285-marketing-consent-auth-check.js
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.285-lock';
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

if (src.includes('function marketingConsentAllowedFor(')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// ── 1) Vlož helper hneď pred prvý výskyt (začiatok /api/stripe/checkout) ──
const ANCHOR = `app.post('/api/stripe/checkout', rateLimit, async (req, res) => {`;

const HELPER_PLUS_ANCHOR = `// (patch 285) Overí, že \`email\` buď patrí prihlásenému volajúcemu (ak
// poslal Bearer token), alebo že ide o anonymný checkout bez tokenu
// (zámerný flow pre nového klienta) -- bráni scenáru, kde niekto pošle
// cudzí email a prepíše JEHO marketing_emails_opt_out bez prihlásenia
// ako on.
async function marketingConsentAllowedFor(req, email) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return true;
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return true;
    return user.email === email;
  } catch (e) {
    return true;
  }
}

app.post('/api/stripe/checkout', rateLimit, async (req, res) => {`;

src = replaceExactCount(src, ANCHOR, HELPER_PLUS_ANCHOR, 1, 'helper insertion before /api/stripe/checkout');

// ── 2) /api/stripe/checkout ─────────────────────────────────────
src = replaceExactCount(
  src,
  `    const { refCode, refType, plan, marketingConsent } = req.body;
    if (marketingConsent !== undefined) {
      await supabase.from('users').update({ marketing_emails_opt_out: !marketingConsent }).eq('email', email);
    }`,
  `    const { refCode, refType, plan, marketingConsent } = req.body;
    if (marketingConsent !== undefined && await marketingConsentAllowedFor(req, email)) {
      await supabase.from('users').update({ marketing_emails_opt_out: !marketingConsent }).eq('email', email);
    }`,
  1, '/api/stripe/checkout marketingConsent block'
);

// ── 3) /api/courses/:slug/checkout ──────────────────────────────
src = replaceExactCount(
  src,
  `  if (marketingConsent !== undefined) {
    await supabase.from('users').update({ marketing_emails_opt_out: !marketingConsent }).eq('email', email);
  }
  try {
    const { data: course } = await supabase.from('courses').select('*').eq('slug', req.params.slug).eq('published', true).single();`,
  `  if (marketingConsent !== undefined && await marketingConsentAllowedFor(req, email)) {
    await supabase.from('users').update({ marketing_emails_opt_out: !marketingConsent }).eq('email', email);
  }
  try {
    const { data: course } = await supabase.from('courses').select('*').eq('slug', req.params.slug).eq('published', true).single();`,
  1, '/api/courses/:slug/checkout marketingConsent block'
);

// ── 4) /api/gift-cards/checkout ─────────────────────────────────
src = replaceExactCount(
  src,
  `  if (marketingConsent !== undefined) {
    await supabase.from('users').update({ marketing_emails_opt_out: !marketingConsent }).eq('email', buyerEmail);
  }`,
  `  if (marketingConsent !== undefined && await marketingConsentAllowedFor(req, buyerEmail)) {
    await supabase.from('users').update({ marketing_emails_opt_out: !marketingConsent }).eq('email', buyerEmail);
  }`,
  1, '/api/gift-cards/checkout marketingConsent block'
);

const backup = FILE + '.pre-285-marketing-consent-auth-check-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);

console.log('✅ server.js: marketing_emails_opt_out zápis v /api/stripe/checkout, /api/courses/:slug/checkout a /api/gift-cards/checkout teraz overuje, že prihlásený volajúci (ak poslal token) je tou istou osobou.');
console.log('   Záloha:', backup);
console.log('   pm2 restart sptrener-main');
