// Doplnok k 78-membership-checkout.js: /api/membership/checkout doteraz VŽDY
// účtoval akciovú cenu (MEMBERSHIP_PRICES) bez ohľadu na to, či ponuka na
// /ponuka už vypršala — klasická (nezvýhodnená) cena zobrazená na stránke
// po vypršaní bola teda len kozmetická, reálne sa vždy strhla zľavnená suma.
// Tento patch pridá druhú cenovú tabuľku a endpoint podľa `pricingMode`
// ('classic'/'promo') z requestu vyberie tú správnu.
//
// POZOR: vyžaduje, aby už bol nasadený 78-membership-checkout.js (tento
// patch stavia na jeho anchore). Ak ešte nebol spustený, tento patch
// zlyhá s jasnou chybou nižšie — najprv spusti 78, potom tento.
const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('CLASSIC_MEMBERSHIP_PRICES')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

const ANCHOR = `const MEMBERSHIP_PRICES = { premium: { 3: 2700, 6: 4900, 12: 9700 }, elite: { 3: 5700, 6: 9700, 12: 18700 } };

app.post('/api/membership/checkout', rateLimit, async (req, res) => {
  const { email, tier, months } = req.body || {};
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Neplatný email.' });
  const cleanTier = tier === 'elite' ? 'elite' : 'premium';
  const cleanMonths = Number(months);
  const priceCents = MEMBERSHIP_PRICES[cleanTier] && MEMBERSHIP_PRICES[cleanTier][cleanMonths];
  if (!priceCents) return res.status(400).json({ error: 'Neplatná dĺžka členstva.' });`;

const anchorCount = src.split(ANCHOR).length - 1;
if (anchorCount !== 1) {
  console.error('Kotva z 78-membership-checkout.js nenajdena (najdenych: ' + anchorCount + '). Najprv spusti 78-membership-checkout.js, potom tento patch. Nic som nezmenil.');
  process.exit(1);
}

const NEW = `const MEMBERSHIP_PRICES = { premium: { 3: 2700, 6: 4900, 12: 9700 }, elite: { 3: 5700, 6: 9700, 12: 18700 } };
// Bežná (neakciová) cena po vypršaní ponuky na /ponuka — lineárny prepočet
// z reálnej mesačnej sadzby appky (Premium 9,90 €/mes., Elite 19,90 €/mes.).
const CLASSIC_MEMBERSHIP_PRICES = { premium: { 3: 2970, 6: 5940, 12: 11880 }, elite: { 3: 5970, 6: 11940, 12: 23880 } };

app.post('/api/membership/checkout', rateLimit, async (req, res) => {
  const { email, tier, months, pricingMode } = req.body || {};
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Neplatný email.' });
  const cleanTier = tier === 'elite' ? 'elite' : 'premium';
  const cleanMonths = Number(months);
  const cleanPricingMode = pricingMode === 'classic' ? 'classic' : 'promo';
  const priceTable = cleanPricingMode === 'classic' ? CLASSIC_MEMBERSHIP_PRICES : MEMBERSHIP_PRICES;
  const priceCents = priceTable[cleanTier] && priceTable[cleanTier][cleanMonths];
  if (!priceCents) return res.status(400).json({ error: 'Neplatná dĺžka členstva.' });`;

const patched = src.replace(ANCHOR, NEW);

const backup = FILE + '.pre-membership-classic-pricing-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
