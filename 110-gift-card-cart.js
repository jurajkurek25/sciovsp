const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');
if (src.includes('Košík je prázdny')) { console.error('Uz je aplikovane, nic som nezmenil.'); process.exit(1); }
const OLD = `app.post('/api/gift-cards/checkout', rateLimit, async (req, res) => {
  const { optionId, buyerEmail, recipientName, message, includeCourse, refCode } = req.body || {};
  if (!buyerEmail || !buyerEmail.includes('@')) return res.status(400).json({ error: 'Zadaj platný e-mail.' });
  try {
    const { data: option } = await supabase.from('gift_card_options').select('*').eq('id', optionId).eq('active', true).single();
    if (!option) return res.status(404).json({ error: 'Táto možnosť už nie je dostupná.' });

    let courseAddon = null;
    if ((option.kind === 'premium' || option.kind === 'elite') && includeCourse) {
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
        includesCourse: courseAddon ? 'true' : 'false',
        refCode: (refCode || '').toString().toUpperCase().slice(0, 20)
      }
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('gift card checkout error:', err.message);
    res.status(500).json({ error: 'Chyba vytvorenia platby.' });
  }
});`;
const NEW = `app.post('/api/gift-cards/checkout', rateLimit, async (req, res) => {
  const { buyerEmail, recipientName, message, refCode } = req.body || {};
  let items = Array.isArray(req.body?.items) ? req.body.items : null;
  if (!items && req.body?.optionId) {
    items = [{ optionId: req.body.optionId, quantity: 1, includeCourse: !!req.body.includeCourse }];
  }
  if (!buyerEmail || !buyerEmail.includes('@')) return res.status(400).json({ error: 'Zadaj platný e-mail.' });
  if (!items || !items.length) return res.status(400).json({ error: 'Košík je prázdny.' });
  if (items.length > 6) return res.status(400).json({ error: 'Príliš veľa rôznych položiek v jednej objednávke (max 6).' });

  try {
    let courseAddonOption = null;
    const lineItems = [];
    const cartMeta = [];
    let totalUnits = 0;

    for (const raw of items) {
      const optionId = String(raw?.optionId || '');
      const quantity = Math.min(20, Math.max(1, parseInt(raw?.quantity, 10) || 1));
      const includeCourse = !!raw?.includeCourse;
      totalUnits += quantity + (includeCourse ? quantity : 0);
      if (totalUnits > 60) return res.status(400).json({ error: 'Príliš veľké množstvo v jednej objednávke.' });

      const { data: option } = await supabase.from('gift_card_options').select('*').eq('id', optionId).eq('active', true).single();
      if (!option) return res.status(404).json({ error: 'Niektorá z vybraných možností už nie je dostupná.' });

      lineItems.push({
        price_data: { currency: 'eur', unit_amount: option.price_cents, product_data: { name: option.label } },
        quantity
      });

      let bundleCourse = false;
      if ((option.kind === 'premium' || option.kind === 'elite') && includeCourse) {
        if (!courseAddonOption) {
          const { data: addon } = await supabase.from('gift_card_options').select('*').eq('kind', 'course').eq('active', true).order('sort_order').limit(1).maybeSingle();
          courseAddonOption = addon || null;
        }
        if (courseAddonOption) {
          bundleCourse = true;
          lineItems.push({
            price_data: { currency: 'eur', unit_amount: courseAddonOption.price_cents, product_data: { name: '+ 1 online kurz podľa vlastného výberu (' + option.label + ')' } },
            quantity
          });
        }
      }

      cartMeta.push({ o: option.id, q: quantity, c: bundleCourse ? 1 : 0 });
    }

    const cartItemsJson = JSON.stringify(cartMeta);
    if (cartItemsJson.length > 480) return res.status(400).json({ error: 'Príliš veľká objednávka, rozdeľ ju prosím na viac objednávok.' });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: buyerEmail,
      line_items: lineItems,
      success_url: BASE_URL_BLOG + '/darcekova-karta/hotovo?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: BASE_URL_BLOG + '/darcekova-karta?cancelled=1',
      locale: 'sk',
      metadata: {
        type: 'gift_card_purchase',
        cartItems: cartItemsJson,
        recipientName: (recipientName || '').slice(0, 100),
        message: (message || '').slice(0, 300),
        refCode: (refCode || '').toString().toUpperCase().slice(0, 20)
      }
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('gift card checkout error:', err.message);
    res.status(500).json({ error: 'Chyba vytvorenia platby.' });
  }
});`;
const count = src.split(OLD).length - 1;
if (count !== 1) { console.error(`ABORT: anchor occurs ${count} times. No changes.`); process.exit(1); }
const backup = FILE + '.pre-gift-card-cart-checkout-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src.split(OLD).join(NEW));
console.log('OK - zaloha:', backup);
