// Zapojí routes/community.js (require('./routes/community')(app) — presne
// rovnaký vzor ako maintenanceMode/autoseoWebhook, ktoré sú jediné dva
// routes/*.js súbory, čo server.js doteraz naozaj require()-oval) a
// označí webinárovú cestu nákupu Premium/Elite (main-app-patches/114)
// príznakom viaWebinar v Stripe metadata, aby webhook vedel, kedy nastaviť
// users.community_access_until — komunita je bonus VÝHRADNE pre webinárovú
// cestu, nie pre kvízovú (/kam-na-vysoku) ani bežné mesačné predplatné.
//
// VYŽADUJE: main-app-patches/114-webinar-offer-window-server.js už
// nasadený (tento patch stavia presne na jeho výstupnom texte).
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.118-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK zo zlyhaneho behu (' + LOCK + ' existuje). Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("require('./routes/community')")) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

let patched = src;

// ── 1) Zapoj routes/community.js ──
patched = replaceOnce(patched,
`const app = express();
require('./routes/maintenanceMode')(app);
require('./routes/autoseoWebhook')(app);`,
`const app = express();
require('./routes/maintenanceMode')(app);
require('./routes/autoseoWebhook')(app);
require('./routes/community')(app);`,
  '1: require routes/community');

// ── 2) Checkout: track viaWebinar + pridaj do metadata ──
patched = replaceOnce(patched,
`  if (token) {
    const resolved = await resolveQuizOfferToken(token);
    if (!resolved) return res.status(400).json({ error: 'Neplatný alebo expirovaný odkaz.' });
    email = resolved.email;
    pricingMode = resolved.expired ? 'classic' : 'promo';
  } else {
    // Webinárová cesta (bez tokenu) — email aj pricingMode SA NEDÔVERUJÚ
    // klientovi vôbec, obe sa určia výhradne tu zo server-side stavu.
    const user = await verifySupabaseToken(req);
    if (!user) return res.status(401).json({ error: 'Nie si prihlásený.' });
    email = (user.email || '').toString().trim().toLowerCase();
    const webinarOffer = await getWebinarOfferStatus(email);
    pricingMode = webinarOffer.state === 'active' ? 'promo' : 'classic';
    if (webinarOffer.state !== 'active') {
      console.log('⏳ Webinárová ponuka nie je aktívna (stav: ' + webinarOffer.state + '), účtuje sa bežná cena:', email);
    }
  }
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Neplatný email.' });`,
`  let viaWebinar = false;
  if (token) {
    const resolved = await resolveQuizOfferToken(token);
    if (!resolved) return res.status(400).json({ error: 'Neplatný alebo expirovaný odkaz.' });
    email = resolved.email;
    pricingMode = resolved.expired ? 'classic' : 'promo';
  } else {
    // Webinárová cesta (bez tokenu) — email aj pricingMode SA NEDÔVERUJÚ
    // klientovi vôbec, obe sa určia výhradne tu zo server-side stavu.
    viaWebinar = true;
    const user = await verifySupabaseToken(req);
    if (!user) return res.status(401).json({ error: 'Nie si prihlásený.' });
    email = (user.email || '').toString().trim().toLowerCase();
    const webinarOffer = await getWebinarOfferStatus(email);
    pricingMode = webinarOffer.state === 'active' ? 'promo' : 'classic';
    if (webinarOffer.state !== 'active') {
      console.log('⏳ Webinárová ponuka nie je aktívna (stav: ' + webinarOffer.state + '), účtuje sa bežná cena:', email);
    }
  }
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Neplatný email.' });`,
  '2: viaWebinar flag');

patched = replaceOnce(patched,
  `      metadata: { type: 'membership_purchase', tier: cleanTier, months: String(cleanMonths), refCode: (refCode || '').toString().toUpperCase(), pricingMode: cleanPricingMode }`,
  `      metadata: { type: 'membership_purchase', tier: cleanTier, months: String(cleanMonths), refCode: (refCode || '').toString().toUpperCase(), pricingMode: cleanPricingMode, viaWebinar: viaWebinar ? '1' : '0' }`,
  '3: metadata viaWebinar');

// ── 4) Webhook: nastav community_access_until len pre webinárovú cestu ──
patched = replaceOnce(patched,
`          await supabase.from('users').upsert({
            email: membershipEmail,
            is_premium: true,
            plan: membershipTier,
            stripe_customer_id: session.customer,
            membership_expires_at: membershipExpiresAt.toISOString()
          });`,
`          const membershipUpsert = {
            email: membershipEmail,
            is_premium: true,
            plan: membershipTier,
            stripe_customer_id: session.customer,
            membership_expires_at: membershipExpiresAt.toISOString()
          };
          // Komunita je bonus VÝHRADNE pre webinárovú cestu — kvízová
          // (/kam-na-vysoku) ani bežné mesačné predplatné ju nedostanú.
          // Viazaná na túto konkrétnu platbu — vyprší spolu s ňou.
          if (session.metadata?.viaWebinar === '1') {
            membershipUpsert.community_access_until = membershipExpiresAt.toISOString();
          }
          await supabase.from('users').upsert(membershipUpsert);`,
  '4: community_access_until webhook');

const backup = FILE + '.pre-community-backend-wiring-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('Over, ze db/migrate_community.sql uz bezal a ze existuje verejny Supabase Storage bucket "community".');
