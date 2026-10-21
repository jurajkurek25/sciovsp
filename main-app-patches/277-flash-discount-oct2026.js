// JEDNORAZOVÝ skript — NIE je to patch na server.js, spúšťa sa PRIAMO
// (node main-app-patches/277-flash-discount-oct2026.js) z koreňa hlavnej
// appky (kde je .env, node_modules, mailer.js).
//
// 1) Vytvorí Stripe coupon (-35%, jednorazovo na prvú platbu) + promo kód
//    FLASH35, platný len do 21.10.2026 23:59 (SEČ). Bezpečne spustiteľné
//    viackrát — ak kód už existuje, znova ho nevytvára.
// 2) Pošle email VŠETKÝM userom bez Premium/Elite (is_premium = false
//    alebo null) s týmto kódom. Bezpečne opakovateľné — každému sa pošle
//    len raz (filter flash_discount_oct2026_sent_at IS NULL).
//
// Vyžaduje: db/migrate_flash_discount_oct2026.sql už spustený +
// emails/flash-discount-oct2026.html. allow_promotion_codes je už
// zapnuté na /api/stripe/checkout, žiadna ďalšia zmena nie je potrebná.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
const { sendMail } = require('../mailer');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PROMO_CODE = 'FLASH35';
const DISCOUNT_PERCENT = 35;
const EXPIRES_AT_ISO = '2026-10-21T23:59:59+02:00';

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
    name: 'Flash zľava -35% (21.10.2026)'
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

async function main() {
  await ensurePromotionCode();

  const { data: users, error } = await supabase
    .from('users')
    .select('email')
    .or('is_premium.is.null,is_premium.eq.false')
    .is('flash_discount_oct2026_sent_at', null);
  if (error) { console.error('Chyba načítania users:', error.message); process.exit(1); }
  console.log('Počet na odoslanie:', (users || []).length);

  const html = loadTemplate('flash-discount-oct2026.html');
  let sent = 0, failed = 0;
  for (const u of (users || [])) {
    try {
      await sendMail({ to: u.email, subject: '🔥 Len dnes: -35% na Premium aj Elite', html });
      await supabase.from('users').update({ flash_discount_oct2026_sent_at: new Date().toISOString() }).eq('email', u.email);
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
