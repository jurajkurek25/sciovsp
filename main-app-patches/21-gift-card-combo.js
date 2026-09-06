const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('includes_course')) {
  console.error('Uz je aplikovane (najdene includes_course), nic som nezmenil.');
  process.exit(1);
}

// ── 1) Webhook: persist includes_course on the created gift card ──────────
const WEBHOOK_OLD = `          await supabase.from('gift_cards').insert({
            code: gcCode, option_id: gcOption?.id || null, kind: gcOption?.kind || 'premium', duration_days: gcOption?.duration_days || null,
            amount_cents: session.amount_total, buyer_email: session.customer_details?.email || session.customer_email || 'unknown',
            recipient_name: session.metadata.recipientName || null, message: session.metadata.message || null,
            stripe_session_id: session.id
          });`;
const WEBHOOK_NEW = `          await supabase.from('gift_cards').insert({
            code: gcCode, option_id: gcOption?.id || null, kind: gcOption?.kind || 'premium', duration_days: gcOption?.duration_days || null,
            amount_cents: session.amount_total, buyer_email: session.customer_details?.email || session.customer_email || 'unknown',
            recipient_name: session.metadata.recipientName || null, message: session.metadata.message || null,
            stripe_session_id: session.id, includes_course: session.metadata.includesCourse === 'true'
          });`;
if (!src.includes(WEBHOOK_OLD)) { console.error('Nenasiel som webhook insert kotvu. Nic som nezmenil.'); process.exit(1); }

// ── 2) Checkout: optional course add-on for premium cards ─────────────────
const CHECKOUT_OLD = `app.post('/api/gift-cards/checkout', rateLimit, async (req, res) => {
  const { optionId, buyerEmail, recipientName, message } = req.body || {};
  if (!buyerEmail || !buyerEmail.includes('@')) return res.status(400).json({ error: 'Zadaj platný e-mail.' });
  try {
    const { data: option } = await supabase.from('gift_card_options').select('*').eq('id', optionId).eq('active', true).single();
    if (!option) return res.status(404).json({ error: 'Táto možnosť už nie je dostupná.' });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: buyerEmail,
      line_items: [{
        price_data: { currency: 'eur', unit_amount: option.price_cents, product_data: { name: option.label } },
        quantity: 1
      }],
      success_url: BASE_URL_BLOG + '/darcekova-karta/hotovo?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: BASE_URL_BLOG + '/darcekova-karta?cancelled=1',
      locale: 'sk',
      metadata: {
        type: 'gift_card_purchase', optionId: option.id,
        recipientName: (recipientName || '').slice(0, 100),
        message: (message || '').slice(0, 300)
      }
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('gift card checkout error:', err.message);
    res.status(500).json({ error: 'Chyba vytvorenia platby.' });
  }
});`;
const CHECKOUT_NEW = `app.post('/api/gift-cards/checkout', rateLimit, async (req, res) => {
  const { optionId, buyerEmail, recipientName, message, includeCourse } = req.body || {};
  if (!buyerEmail || !buyerEmail.includes('@')) return res.status(400).json({ error: 'Zadaj platný e-mail.' });
  try {
    const { data: option } = await supabase.from('gift_card_options').select('*').eq('id', optionId).eq('active', true).single();
    if (!option) return res.status(404).json({ error: 'Táto možnosť už nie je dostupná.' });

    let courseAddon = null;
    if (option.kind === 'premium' && includeCourse) {
      const { data: addon } = await supabase.from('gift_card_options').select('*').eq('kind', 'course').eq('active', true).order('sort_order').limit(1).maybeSingle();
      courseAddon = addon || null;
    }

    const lineItems = [{
      price_data: { currency: 'eur', unit_amount: option.price_cents, product_data: { name: option.label } },
      quantity: 1
    }];
    if (courseAddon) {
      lineItems.push({
        price_data: { currency: 'eur', unit_amount: courseAddon.price_cents, product_data: { name: '+ 1 online kurz podľa vlastného výberu' } },
        quantity: 1
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: buyerEmail,
      line_items: lineItems,
      success_url: BASE_URL_BLOG + '/darcekova-karta/hotovo?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: BASE_URL_BLOG + '/darcekova-karta?cancelled=1',
      locale: 'sk',
      metadata: {
        type: 'gift_card_purchase', optionId: option.id,
        recipientName: (recipientName || '').slice(0, 100),
        message: (message || '').slice(0, 300),
        includesCourse: courseAddon ? 'true' : 'false'
      }
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('gift card checkout error:', err.message);
    res.status(500).json({ error: 'Chyba vytvorenia platby.' });
  }
});`;
if (!src.includes(CHECKOUT_OLD)) { console.error('Nenasiel som checkout route kotvu. Nic som nezmenil.'); process.exit(1); }

// ── 3) Check endpoint: expose includes_course to the redeem page ──────────
const CHECK_OLD = `    const { data } = await supabase.from('gift_cards').select('kind,status').eq('code', req.params.code.toUpperCase()).maybeSingle();`;
const CHECK_NEW = `    const { data } = await supabase.from('gift_cards').select('kind,status,includes_course').eq('code', req.params.code.toUpperCase()).maybeSingle();`;
if (!src.includes(CHECK_OLD)) { console.error('Nenasiel som check route kotvu. Nic som nezmenil.'); process.exit(1); }

// ── 4) PDF: render the combo line without overlapping other text ─────────
const PDF_OLD = `    const label = card.kind === 'premium'
      ? \`Premium prístup na \${card.duration_days} dní\`
      : '1 online kurz podľa vlastného výberu';
    doc.fillColor('#a1a1bc').fontSize(12).font('Helvetica').text(label, 30, 95);
    if (card.recipient_name) doc.fillColor('#eeeef5').fontSize(11).text('Pre: ' + card.recipient_name, 30, 120);
    if (card.message) doc.fillColor('#a1a1bc').fontSize(9).text(String(card.message).slice(0, 140), 30, 140, { width: 360 });`;
const PDF_NEW = `    const label = card.kind === 'premium'
      ? \`Premium prístup na \${card.duration_days} dní\`
      : '1 online kurz podľa vlastného výberu';
    doc.fillColor('#a1a1bc').fontSize(12).font('Helvetica').text(label, 30, 95);
    let cardY = 115;
    if (card.kind === 'premium' && card.includes_course) {
      doc.fillColor('#c8ff00').fontSize(9).font('Helvetica-Bold').text('+ 1 online kurz podľa vlastného výberu', 30, cardY);
      cardY += 16;
    }
    if (card.recipient_name) { doc.fillColor('#eeeef5').fontSize(11).font('Helvetica').text('Pre: ' + card.recipient_name, 30, cardY); cardY += 20; }
    if (card.message) doc.fillColor('#a1a1bc').fontSize(9).text(String(card.message).slice(0, 140), 30, cardY, { width: 360 });`;
if (!src.includes(PDF_OLD)) { console.error('Nenasiel som PDF render kotvu. Nic som nezmenil.'); process.exit(1); }

// ── 5) Redeem: grant both premium days AND a chosen course in one call ───
const REDEEM_OLD = `    if (card.kind === 'premium') {
      const { data: user } = await supabase.from('users').select('id,premium_expires_at').eq('email', email).maybeSingle();
      const now = new Date();
      const base = (user?.premium_expires_at && new Date(user.premium_expires_at) > now) ? new Date(user.premium_expires_at) : now;
      const newExpiry = new Date(base.getTime() + card.duration_days * 24 * 60 * 60 * 1000);
      if (user) {
        await supabase.from('users').update({ premium_expires_at: newExpiry.toISOString() }).eq('email', email);
      } else {
        await supabase.from('users').insert({ email, is_premium: false, premium_expires_at: newExpiry.toISOString() });
      }
      await supabase.from('gift_cards').update({
        status: 'redeemed', redeemed_by_email: email, redeemed_at: new Date().toISOString()
      }).eq('id', card.id);
      return res.json({ ok: true, kind: 'premium', premiumExpiresAt: newExpiry.toISOString() });
    }`;
const REDEEM_NEW = `    if (card.kind === 'premium') {
      let bundledCourse = null;
      if (card.includes_course) {
        if (!courseId) return res.status(400).json({ error: 'Táto karta obsahuje aj kurz — vyber si ho.' });
        const { data: courseRow } = await supabase.from('courses').select('id,slug').eq('id', courseId).eq('published', true).single();
        if (!courseRow) return res.status(404).json({ error: 'Kurz sa nenašiel.' });
        const { data: already } = await supabase.from('course_purchases').select('id').eq('course_id', courseRow.id).eq('email', email).maybeSingle();
        if (already) return res.status(400).json({ error: 'Tento kurz už máš zakúpený.' });
        bundledCourse = courseRow;
      }

      const { data: user } = await supabase.from('users').select('id,premium_expires_at').eq('email', email).maybeSingle();
      const now = new Date();
      const base = (user?.premium_expires_at && new Date(user.premium_expires_at) > now) ? new Date(user.premium_expires_at) : now;
      const newExpiry = new Date(base.getTime() + card.duration_days * 24 * 60 * 60 * 1000);
      if (user) {
        await supabase.from('users').update({ premium_expires_at: newExpiry.toISOString() }).eq('email', email);
      } else {
        await supabase.from('users').insert({ email, is_premium: false, premium_expires_at: newExpiry.toISOString() });
      }
      if (bundledCourse) {
        await supabase.from('course_purchases').insert({
          course_id: bundledCourse.id, email, stripe_session_id: 'giftcard_' + card.code, amount_paid_cents: 0
        });
      }
      await supabase.from('gift_cards').update({
        status: 'redeemed', redeemed_by_email: email, redeemed_course_id: bundledCourse ? bundledCourse.id : null, redeemed_at: new Date().toISOString()
      }).eq('id', card.id);
      return res.json({ ok: true, kind: 'premium', premiumExpiresAt: newExpiry.toISOString(), courseSlug: bundledCourse ? bundledCourse.slug : null });
    }`;
if (!src.includes(REDEEM_OLD)) { console.error('Nenasiel som redeem premium kotvu. Nic som nezmenil.'); process.exit(1); }

const patched = src
  .replace(WEBHOOK_OLD, WEBHOOK_NEW)
  .replace(CHECKOUT_OLD, CHECKOUT_NEW)
  .replace(CHECK_OLD, CHECK_NEW)
  .replace(PDF_OLD, PDF_NEW)
  .replace(REDEEM_OLD, REDEEM_NEW);

const backup = FILE + '.pre-gift-combo-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
