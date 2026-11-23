// JEDNORAZOVÝ skript — NIE je to patch na server.js, spúšťa sa PRIAMO
// (node main-app-patches/301-blackweek2026-send.js) z koreňa hlavnej
// appky (kde je .env, node_modules, mailer.js). Rovnaký vzor ako
// main-app-patches/277-flash-discount-oct2026.js.
//
// 1) Vytvorí Stripe coupon (-40%, jednorazovo na prvú platbu) + promo kód
//    BLACKWEEK40, platný len do 27.11.2026 23:59 (SEČ). Bezpečne
//    spustiteľné viackrát — ak kód už existuje, znova ho nevytvára.
// 2) Pošle email VŠETKÝM userom bez Premium/Elite (is_premium = false
//    alebo null). Jazyk (SK/CZ) podľa users.lang. Bezpečne opakovateľné —
//    každému sa pošle len raz (filter blackweek2026_sent_at IS NULL).
//
//    (rozhodnutie majiteľa, nov 2026) marketing_emails_opt_out sa tu
//    ZÁMERNE NEKONTROLUJE -- v DB má v tejto chvíli explicitne true úplne
//    každý účet (pravdepodobne DB default pri registrácii), takže by sa
//    touto kampaňou nedostal nikto. Pre tento jeden jednorazový Black
//    Week email majiteľ rozhodol poslať aj tak. Pre budúce kampane buď
//    tento filter vráť, alebo oprav default pri registrácii.
//
// Vyžaduje: db/migrate_blackweek2026.sql už spustený + emails/blackweek2026.html
// a emails/blackweek2026-cz.html + main-app-patches/300-blackweek-route.js
// (routa /blackweek, na ktorú email odkazuje) + public/blackweek.html.
// allow_promotion_codes je už zapnuté na /api/stripe/checkout, žiadna
// ďalšia zmena v server.js nie je potrebná — appka už vie spustiť
// checkout rovno z deep-linku /app?upgrade=premium alebo /app?upgrade=elite.
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/301-blackweek2026-send.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
const { sendMail } = require('../mailer');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const BASE_URL = 'https://sptrener.online';
const PROMO_CODE = 'BLACKWEEK40';
const DISCOUNT_PERCENT = 40;
const EXPIRES_AT_ISO = '2026-11-27T23:59:59+01:00';

async function ensurePromotionCode() {
  const existing = await stripe.promotionCodes.list({ code: PROMO_CODE, limit: 1 });
  if (existing.data.length) {
    console.log('Promo kód už existuje:', existing.data[0].id);
    return existing.data[0];
  }
  const expiresAtUnix = Math.floor(new Date(EXPIRES_AT_ISO).getTime() / 1000);
  const coupon = await stripe.coupons.create({
    percent_off: DISCOUNT_PERCENT,
    duration: 'once',
    redeem_by: expiresAtUnix,
    name: 'Black Week -40% (do 27.11.2026)'
  });
  const promo = await stripe.promotionCodes.create({
    promotion: { type: 'coupon', coupon: coupon.id },
    code: PROMO_CODE,
    expires_at: expiresAtUnix
  });
  console.log('✅ Vytvorený nový Stripe coupon + promo kód:', promo.id, '(' + PROMO_CODE + ')');
  return promo;
}

function loadTemplate(name) {
  return fs.readFileSync(path.join(__dirname, '..', 'emails', name), 'utf8');
}

async function getOrCreateUnsubscribeToken(email) {
  const { data: row } = await supabase.from('users').select('unsubscribe_token').eq('email', email).maybeSingle();
  if (row?.unsubscribe_token) return row.unsubscribe_token;
  const token = crypto.randomBytes(24).toString('hex');
  await supabase.from('users').update({ unsubscribe_token: token }).eq('email', email);
  return token;
}

async function main() {
  await ensurePromotionCode();

  const { data: users, error } = await supabase
    .from('users')
    .select('email, lang')
    .or('is_premium.is.null,is_premium.eq.false')
    .is('blackweek2026_sent_at', null);
  if (error) { console.error('Chyba načítania users:', error.message); process.exit(1); }
  console.log('Počet na odoslanie:', (users || []).length);

  const htmlSk = loadTemplate('blackweek2026.html');
  const htmlCz = loadTemplate('blackweek2026-cz.html');
  let sent = 0, failed = 0;
  for (const u of (users || [])) {
    try {
      const isCz = u.lang === 'cz';
      const unsubToken = await getOrCreateUnsubscribeToken(u.email);
      const html = (isCz ? htmlCz : htmlSk).replace(/\[UNSUBSCRIBE\]/g, BASE_URL + '/api/account/unsubscribe?token=' + unsubToken);
      const subject = isCz ? 'Black Week — -40 % na Premium i Elite (jen do pátku)' : 'Black Week — -40% na Premium aj Elite (len do piatku)';
      await sendMail({ to: u.email, subject, html });
      await supabase.from('users').update({ blackweek2026_sent_at: new Date().toISOString() }).eq('email', u.email);
      sent++;
      console.log('OK:', u.email);
    } catch (e) {
      failed++;
      console.error('CHYBA pri', u.email, ':', e.message);
    }
    await new Promise(r => setTimeout(r, 300));
  }
  console.log('Hotovo. Odoslané:', sent, 'Zlyhalo:', failed);
}

main().catch(e => { console.error('Fatálna chyba:', e.message); process.exit(1); });
