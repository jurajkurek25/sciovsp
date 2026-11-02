const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("gift_card_purchase")) {
  console.error('Uz je aplikovane (najdene gift_card_purchase), nic som nezmenil.');
  process.exit(1);
}

const REQUIRE_OLD = `const Stripe = require('stripe');`;
const REQUIRE_NEW = `const Stripe = require('stripe');
const PDFDocument = require('pdfkit');`;
if (!src.includes(REQUIRE_OLD)) { console.error('Nenasiel som Stripe require kotvu. Nic som nezmenil.'); process.exit(1); }

const WEBHOOK_OLD = `        if (session.metadata?.type === 'course_purchase') {
          const courseCustomer = await stripe.customers.retrieve(session.customer);
          await supabase.from('course_purchases').upsert({
            course_id: session.metadata.courseId,
            email: courseCustomer.email,
            stripe_session_id: session.id,
            amount_paid_cents: session.amount_total
          }, { onConflict: 'course_id,email' });
          console.log('✅ Kurz zakúpený:', courseCustomer.email, session.metadata.courseSlug);
          break;
        }`;
const WEBHOOK_NEW = `        if (session.metadata?.type === 'course_purchase') {
          const courseCustomer = await stripe.customers.retrieve(session.customer);
          await supabase.from('course_purchases').upsert({
            course_id: session.metadata.courseId,
            email: courseCustomer.email,
            stripe_session_id: session.id,
            amount_paid_cents: session.amount_total
          }, { onConflict: 'course_id,email' });
          console.log('✅ Kurz zakúpený:', courseCustomer.email, session.metadata.courseSlug);
          break;
        }

        if (session.metadata?.type === 'gift_card_purchase') {
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
            stripe_session_id: session.id
          });
          console.log('✅ Darčeková karta vytvorená:', gcCode);
          break;
        }`;
if (!src.includes(WEBHOOK_OLD)) { console.error('Nenasiel som presny webhook course_purchase blok. Nic som nezmenil.'); process.exit(1); }

const LISTEN_OLD = `app.listen(PORT, () => {`;
const GIFT_ROUTES = `// ── Darčekové karty ──────────────────────────────────────────
function generateGiftCardCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'SPT';
  for (let g = 0; g < 3; g++) {
    out += '-';
    for (let i = 0; i < 4; i++) out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function getGoogleEmail(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.email) return null;
  return data.user.email;
}

app.get('/darcekova-karta', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'darcekova-karta.html')); });
app.get('/darcekova-karta/hotovo', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'darcekova-karta-hotovo.html')); });
app.get('/uplatnit-darcek', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'uplatnit-darcek.html')); });

app.get('/api/courses', async (req, res) => {
  try {
    const { data, error } = await supabase.from('courses').select('id,slug,title').eq('published', true).order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ courses: data || [] });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.get('/api/gift-cards/options', async (req, res) => {
  try {
    const { data, error } = await supabase.from('gift_card_options').select('*').eq('active', true).order('sort_order');
    if (error) throw error;
    res.json({ options: data || [] });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.post('/api/gift-cards/checkout', rateLimit, async (req, res) => {
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
});

app.get('/api/gift-cards/by-session/:sessionId', async (req, res) => {
  try {
    const { data } = await supabase.from('gift_cards').select('code,kind,status').eq('stripe_session_id', req.params.sessionId).maybeSingle();
    if (!data) return res.status(404).json({ error: 'Zatiaľ sa nespracovalo, skús o chvíľu znova.' });
    res.json({ card: data });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.get('/api/gift-cards/:code/check', async (req, res) => {
  try {
    const { data } = await supabase.from('gift_cards').select('kind,status').eq('code', req.params.code.toUpperCase()).maybeSingle();
    if (!data) return res.status(404).json({ error: 'Kód nenájdený.' });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.get('/api/gift-cards/:code/pdf', async (req, res) => {
  try {
    const { data: card } = await supabase.from('gift_cards').select('*').eq('code', req.params.code.toUpperCase()).maybeSingle();
    if (!card) return res.status(404).send('Kód nenájdený.');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', \`inline; filename="darcekova-karta-\${card.code}.pdf"\`);
    const doc = new PDFDocument({ size: [420, 260], margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    doc.pipe(res);
    doc.rect(0, 0, 420, 260).fill('#08080d');
    doc.rect(0, 0, 420, 8).fill('#c8ff00');
    doc.fillColor('#eeeef5').fontSize(11).font('Helvetica-Bold').text('SP TRÉNER', 30, 30);
    doc.fillColor('#7c5cff').fontSize(20).font('Helvetica-Bold').text('Darčeková karta', 30, 55);
    const label = card.kind === 'premium'
      ? \`Premium prístup na \${card.duration_days} dní\`
      : '1 online kurz podľa vlastného výberu';
    doc.fillColor('#a1a1bc').fontSize(12).font('Helvetica').text(label, 30, 95);
    if (card.recipient_name) doc.fillColor('#eeeef5').fontSize(11).text('Pre: ' + card.recipient_name, 30, 120);
    if (card.message) doc.fillColor('#a1a1bc').fontSize(9).text(String(card.message).slice(0, 140), 30, 140, { width: 360 });
    doc.rect(30, 185, 360, 50).fill('#15151f');
    doc.fillColor('#5c5c7a').fontSize(8).font('Helvetica').text('KÓD NA UPLATNENIE', 45, 195);
    doc.fillColor('#c8ff00').fontSize(18).font('Helvetica-Bold').text(card.code, 45, 208);
    doc.fillColor('#5c5c7a').fontSize(8).font('Helvetica').text('Uplatni na sptrener.online/uplatnit-darcek', 30, 245);
    doc.end();
  } catch (e) {
    console.error('gift card pdf error:', e.message);
    res.status(500).send('Chyba servera.');
  }
});

app.post('/api/gift-cards/redeem', rateLimit, async (req, res) => {
  const email = await getGoogleEmail(req);
  if (!email) return res.status(401).json({ error: 'Prihlás sa cez Google.' });
  const { code, courseId } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Zadaj kód.' });
  try {
    const { data: card } = await supabase.from('gift_cards').select('*').eq('code', String(code).toUpperCase().trim()).maybeSingle();
    if (!card) return res.status(404).json({ error: 'Kód nenájdený.' });
    if (card.status === 'redeemed') return res.status(400).json({ error: 'Táto karta je už uplatnená.' });

    if (card.kind === 'premium') {
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
    }

    if (!courseId) return res.status(400).json({ error: 'Vyber si kurz.' });
    const { data: course } = await supabase.from('courses').select('id,slug').eq('id', courseId).eq('published', true).single();
    if (!course) return res.status(404).json({ error: 'Kurz sa nenašiel.' });
    const { data: already } = await supabase.from('course_purchases').select('id').eq('course_id', course.id).eq('email', email).maybeSingle();
    if (already) return res.status(400).json({ error: 'Tento kurz už máš zakúpený.' });
    await supabase.from('course_purchases').insert({
      course_id: course.id, email, stripe_session_id: 'giftcard_' + card.code, amount_paid_cents: 0
    });
    await supabase.from('gift_cards').update({
      status: 'redeemed', redeemed_by_email: email, redeemed_course_id: course.id, redeemed_at: new Date().toISOString()
    }).eq('id', card.id);
    return res.json({ ok: true, kind: 'course', courseSlug: course.slug });
  } catch (e) {
    console.error('gift card redeem error:', e.message);
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.listen(PORT, () => {`;
if (!src.includes(LISTEN_OLD)) { console.error('Nenasiel som app.listen kotvu. Nic som nezmenil.'); process.exit(1); }

const patched = src.replace(REQUIRE_OLD, REQUIRE_NEW).replace(WEBHOOK_OLD, WEBHOOK_NEW).replace(LISTEN_OLD, GIFT_ROUTES);

const backup = FILE + '.pre-gift-cards-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
