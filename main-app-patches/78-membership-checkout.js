// Jednorazové (nie recurring) členstvo pre /ponuka — Premium/Elite na
// 3/6/12 mesiacov. Na rozdiel od skutočného Stripe predplatného (mode:
// 'subscription', v tomto súbore inde) použije mode:'payment' a webhook
// mu priamo nastaví is_premium/plan presne ako pri reálnom predplatnom
// (inak by Elite kupujúci nedostal funkčné Elite endpointy — requireElite
// kontroluje len surové stĺpce is_premium+plan, nič iné).
//
// Keďže appka dnes nemá ŽIADNY mechanizmus na automatické vypnutie
// is_premium po jednorazovej platbe (skutočné predplatné sa vypína len
// cez Stripe webhook customer.subscription.deleted, ktorý pri
// jednorazovej platbe nikdy nepríde), pridáva sa nový stĺpec
// users.membership_expires_at (tvrdý limit, oddelený od existujúceho
// bonusového premium_expires_at) a in-process interval expireMemberships(),
// ktorý ho raz za 6 hodín vynúti. Chráni sa proti prípadu, že by mal ten
// istý email súbežne aj reálne aktívne predplatné (subscription_status
// === 'active') — vtedy sa is_premium NEVYPNE, aby jednorazová platba
// navyše neukradla prístup zo skutočného predplatného.
const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('membership_purchase')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

let patched = src;

// ── 1) Webhook: nová vetva membership_purchase, pred fallthrough na skutočné predplatné ──
patched = replaceOnce(patched,
`        if (session.metadata?.type === 'gift_card_purchase') {
          const { data: gcOption } = await supabase.from('gift_card_options').select('*').eq('id', session.metadata.optionId).single();
          let gcCode;
          for (let attempt = 0; attempt < 5; attempt++) {
            gcCode = generateGiftCardCode();
            const { data: clash } = await supabase.from('gift_cards').select('id').eq('code', gcCode).maybeSingle();
            if (!clash) break;
          }
          await supabase.from('gift_cards').insert({
            code: gcCode, option_id: gcOption?.id || null, kind: gcOption?.kind || 'premium', duration_days: gcOption?.duration_days || null,
            amount_cents: session.amount_total, buyer_email: session.customer_details?.email || session.customer_email || 'unknown',
            recipient_name: session.metadata.recipientName || null, message: session.metadata.message || null,
            stripe_session_id: session.id, includes_course: session.metadata.includesCourse === 'true'
          });
          console.log('✅ Darčeková karta vytvorená:', gcCode);
          break;
        }

        const customer = await stripe.customers.retrieve(session.customer);
        const email = customer.email;`,
`        if (session.metadata?.type === 'gift_card_purchase') {
          const { data: gcOption } = await supabase.from('gift_card_options').select('*').eq('id', session.metadata.optionId).single();
          let gcCode;
          for (let attempt = 0; attempt < 5; attempt++) {
            gcCode = generateGiftCardCode();
            const { data: clash } = await supabase.from('gift_cards').select('id').eq('code', gcCode).maybeSingle();
            if (!clash) break;
          }
          await supabase.from('gift_cards').insert({
            code: gcCode, option_id: gcOption?.id || null, kind: gcOption?.kind || 'premium', duration_days: gcOption?.duration_days || null,
            amount_cents: session.amount_total, buyer_email: session.customer_details?.email || session.customer_email || 'unknown',
            recipient_name: session.metadata.recipientName || null, message: session.metadata.message || null,
            stripe_session_id: session.id, includes_course: session.metadata.includesCourse === 'true'
          });
          console.log('✅ Darčeková karta vytvorená:', gcCode);
          break;
        }

        if (session.metadata?.type === 'membership_purchase') {
          const membershipCustomer = await stripe.customers.retrieve(session.customer);
          const membershipEmail = membershipCustomer.email;
          const membershipTier = session.metadata.tier === 'elite' ? 'elite' : 'premium';
          const membershipMonths = parseInt(session.metadata.months, 10) || 3;
          const membershipExpiresAt = new Date(Date.now() + membershipMonths * 30 * 24 * 60 * 60 * 1000);
          await supabase.from('users').upsert({
            email: membershipEmail,
            is_premium: true,
            plan: membershipTier,
            stripe_customer_id: session.customer,
            membership_expires_at: membershipExpiresAt.toISOString()
          });
          console.log('✅ Členstvo aktivované:', membershipEmail, membershipTier, membershipMonths + 'm');
          break;
        }

        const customer = await stripe.customers.retrieve(session.customer);
        const email = customer.email;`,
  '1: webhook membership_purchase branch');

// ── 2) Checkout endpoint + expiračný interval, pred app.listen ──
patched = replaceOnce(patched,
  `app.listen(PORT, () => {`,
  `const MEMBERSHIP_PRICES = { premium: { 3: 2700, 6: 5700, 12: 9700 }, elite: { 3: 5700, 6: 9700, 12: 19700 } };

app.post('/api/membership/checkout', rateLimit, async (req, res) => {
  const { email, tier, months } = req.body || {};
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Neplatný email.' });
  const cleanTier = tier === 'elite' ? 'elite' : 'premium';
  const cleanMonths = Number(months);
  const priceCents = MEMBERSHIP_PRICES[cleanTier] && MEMBERSHIP_PRICES[cleanTier][cleanMonths];
  if (!priceCents) return res.status(400).json({ error: 'Neplatná dĺžka členstva.' });
  try {
    let customerId;
    const { data: user } = await supabase.from('users').select('stripe_customer_id').eq('email', email).maybeSingle();
    if (user?.stripe_customer_id) {
      customerId = user.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({ email });
      customerId = customer.id;
      await supabase.from('users').upsert({ email, stripe_customer_id: customerId });
    }
    const tierLabel = cleanTier === 'elite' ? 'Elite' : 'Premium';
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: { currency: 'eur', unit_amount: priceCents, product_data: { name: 'SP Tréner ' + tierLabel + ' členstvo — ' + cleanMonths + ' mesiacov' } },
        quantity: 1
      }],
      success_url: APP_URL + '/?premium=1' + (cleanTier === 'elite' ? '&plan=elite' : '') + '&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: BASE_URL_BLOG + '/ponuka?cancelled=1',
      locale: 'sk',
      metadata: { type: 'membership_purchase', tier: cleanTier, months: String(cleanMonths) }
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('membership checkout error:', err.message);
    res.status(500).json({ error: 'Chyba vytvorenia platby.' });
  }
});

// Jednorazové členstvo nemá Stripe subscription objekt, takže nič ho
// automaticky nezruší po uplynutí zaplatenej doby — kontrolujeme to sami.
// NEVYPÍNA is_premium, ak má ten istý email súbežne aktívne skutočné
// predplatné (subscription_status === 'active'), aby jednorazová platba
// navyše nikdy neukradla prístup zo skutočného predplatného.
async function expireMemberships() {
  try {
    const { data: expired, error } = await supabase.from('users')
      .select('email, subscription_status')
      .eq('is_premium', true)
      .not('membership_expires_at', 'is', null)
      .lt('membership_expires_at', new Date().toISOString());
    if (error) throw error;
    const toExpire = (expired || []).filter(u => u.subscription_status !== 'active').map(u => u.email);
    if (toExpire.length) {
      await supabase.from('users').update({ is_premium: false, membership_expires_at: null }).in('email', toExpire);
      console.log('⏳ Vypršané jednorazové členstvá:', toExpire.join(', '));
    }
  } catch (e) {
    console.error('expireMemberships error:', e.message);
  }
}
setInterval(expireMemberships, 6 * 60 * 60 * 1000);
expireMemberships();

app.listen(PORT, () => {`,
  '2: checkout endpoint + expiry interval');

const backup = FILE + '.pre-membership-checkout-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
