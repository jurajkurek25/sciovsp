// Bezpečnostná/spoľahlivostná oprava: Stripe explicitne priznáva, že vie
// ten istý webhook event doručiť viackrát (retry pri pomalom/zlyhanom
// handshaku). POST /api/stripe/webhook nemal ŽIADNU ochranu proti
// opakovanému doručeniu -- pri retry na checkout.session.completed by sa
// znova odoslal uvítací email, znova zaplatila partnerská provízia
// partnerovi (notifyPartnerCourseCredit) a znova inkrementoval discount
// code used_count. Táto oprava vloží event.id do stripe_webhook_events
// HNEĎ po overení podpisu -- ak už existuje (unique constraint conflict),
// event bol spracovaný skôr a ignoruje sa.
//
// Vyžaduje najprv db/add_stripe_webhook_events.sql (vytvorí tabuľku).
//
// Kotva je byte-presne overená z tvojho výstupu main-app-patches/224.
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/227-stripe-webhook-idempotency.js
// Potom: pm2 restart <meno procesu hlavnej appky>

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som server.js — spusti z koreňa hlavnej appky.');
  process.exit(1);
}
let src = fs.readFileSync(SERVER_PATH, 'utf8');

if (src.includes('stripe_webhook_events')) {
  console.log('ℹ️  Už je aplikované, preskakujem.');
  process.exit(0);
}

const OLD = `app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch(err) {
    console.error('Webhook chyba:', err.message);
    return res.status(400).json({ error: 'Invalid signature.' });
  }
  try {
    switch(event.type) {`;

const NEW = `app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch(err) {
    console.error('Webhook chyba:', err.message);
    return res.status(400).json({ error: 'Invalid signature.' });
  }

  // Stripe môže ten istý event doručiť viackrát (retry) -- bez tohto by sa
  // pri opakovanom doručení znova odoslal uvítací email, znova zaplatila
  // partnerská provízia a znova inkrementoval discount usage.
  try {
    const { error: dupErr } = await supabase.from('stripe_webhook_events').insert({ id: event.id });
    if (dupErr) {
      if (dupErr.code === '23505') {
        console.log('↩️  Webhook event už bol spracovaný, ignorujem:', event.id);
        return res.json({ received: true, duplicate: true });
      }
      console.error('Webhook idempotency insert error:', dupErr.message);
    }
  } catch (e) {
    console.error('Webhook idempotency insert error:', e.message);
  }

  try {
    switch(event.type) {`;

const count = src.split(OLD).length - 1;
if (count !== 1) { console.error('❌ Kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil. Pošli mi aktuálny obsah okolo "/api/stripe/webhook" v server.js, over.'); process.exit(1); }

src = src.replace(OLD, () => NEW);

const backup = SERVER_PATH + '.pre-227-stripe-webhook-idempotency-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, src);
console.log('✅ server.js prepísaný (Stripe webhook teraz ignoruje opakovane doručené eventy). Záloha:', backup);
console.log('');
console.log('Over: node -c server.js');
console.log('Pred reštartom musí byť spustená db/add_stripe_webhook_events.sql.');
console.log('Reštart: pm2 restart <meno procesu hlavnej appky>');
