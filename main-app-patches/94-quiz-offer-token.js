// Extends /api/membership/checkout to accept an optional {token} from the
// /kam-na-vysoku discount email (career_quiz_results.discount_token),
// resolving email + pricingMode SERVER-SIDE from it instead of trusting the
// client-sent values — the existing webinar-cookie path (no token) is
// completely untouched and keeps behaving exactly as before.
// Also adds GET /api/quiz-offer/validate?token=... for /ponuka's frontend
// to fetch the deadline + email to display when arriving via ?src=quiz.
//
// REQUIRES: 78-membership-checkout.js AND 81-membership-classic-pricing.js
// already applied (this patch's anchor is 81's exact output). If this
// aborts with "anchor not found", run:
//   grep -n "api/membership/checkout" server.js
// and send me the output — I'll adjust the anchor.
const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('quiz-offer/validate')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

const ANCHOR = `const MEMBERSHIP_PRICES = { premium: { 3: 2700, 6: 4900, 12: 9700 }, elite: { 3: 5700, 6: 9700, 12: 18700 } };
// Bežná (neakciová) cena po vypršaní ponuky na /ponuka — lineárny prepočet
// z reálnej mesačnej sadzby appky (Premium 9,90 €/mes., Elite 19,90 €/mes.).
const CLASSIC_MEMBERSHIP_PRICES = { premium: { 3: 2970, 6: 5940, 12: 11880 }, elite: { 3: 5970, 6: 11940, 12: 23880 } };

app.post('/api/membership/checkout', rateLimit, async (req, res) => {
  const { email, tier, months, pricingMode, refCode } = req.body || {};
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Neplatný email.' });
  const cleanTier = tier === 'elite' ? 'elite' : 'premium';
  const cleanMonths = Number(months);
  const cleanPricingMode = pricingMode === 'classic' ? 'classic' : 'promo';
  const priceTable = cleanPricingMode === 'classic' ? CLASSIC_MEMBERSHIP_PRICES : MEMBERSHIP_PRICES;
  const priceCents = priceTable[cleanTier] && priceTable[cleanTier][cleanMonths];
  if (!priceCents) return res.status(400).json({ error: 'Neplatná dĺžka členstva.' });`;

const count = src.split(ANCHOR).length - 1;
if (count !== 1) {
  console.error(`ABORT: anchor occurs ${count} times (expected 1). No changes made.`);
  process.exit(1);
}

const NEW = `const MEMBERSHIP_PRICES = { premium: { 3: 2700, 6: 4900, 12: 9700 }, elite: { 3: 5700, 6: 9700, 12: 18700 } };
// Bežná (neakciová) cena po vypršaní ponuky na /ponuka — lineárny prepočet
// z reálnej mesačnej sadzby appky (Premium 9,90 €/mes., Elite 19,90 €/mes.).
const CLASSIC_MEMBERSHIP_PRICES = { premium: { 3: 2970, 6: 5940, 12: 11880 }, elite: { 3: 5970, 6: 11940, 12: 23880 } };

async function resolveQuizOfferToken(token) {
  const { data: lead } = await supabase.from('career_quiz_results').select('email, discount_deadline').eq('discount_token', token).maybeSingle();
  if (!lead) return null;
  const expired = !lead.discount_deadline || new Date(lead.discount_deadline) < new Date();
  return { email: lead.email, expired, deadline: lead.discount_deadline };
}

app.get('/api/quiz-offer/validate', rateLimit, async (req, res) => {
  const token = (req.query.token || '').toString();
  if (!token) return res.status(400).json({ error: 'Chýba token.' });
  const resolved = await resolveQuizOfferToken(token);
  if (!resolved) return res.status(404).json({ error: 'Neplatný odkaz.' });
  res.json({ valid: true, email: resolved.email, expired: resolved.expired, deadline: resolved.deadline });
});

app.post('/api/membership/checkout', rateLimit, async (req, res) => {
  let { email, tier, months, pricingMode, refCode } = req.body || {};
  const token = (req.body && req.body.token || '').toString();
  // Token z e-mailu po teste odboru — email aj cena SA NEDÔVERUJÚ klientovi,
  // vyriešia sa server-side z career_quiz_results (na rozdiel od pôvodnej
  // webinárovej cesty nižšie, ktorá token nepoužíva a ostáva nezmenená).
  if (token) {
    const resolved = await resolveQuizOfferToken(token);
    if (!resolved) return res.status(400).json({ error: 'Neplatný alebo expirovaný odkaz.' });
    email = resolved.email;
    pricingMode = resolved.expired ? 'classic' : 'promo';
  }
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Neplatný email.' });
  const cleanTier = tier === 'elite' ? 'elite' : 'premium';
  const cleanMonths = Number(months);
  const cleanPricingMode = pricingMode === 'classic' ? 'classic' : 'promo';
  const priceTable = cleanPricingMode === 'classic' ? CLASSIC_MEMBERSHIP_PRICES : MEMBERSHIP_PRICES;
  const priceCents = priceTable[cleanTier] && priceTable[cleanTier][cleanMonths];
  if (!priceCents) return res.status(400).json({ error: 'Neplatná dĺžka členstva.' });`;

const backup = FILE + '.pre-quiz-offer-token-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src.split(ANCHOR).join(NEW));
console.log('OK - zaloha:', backup);
