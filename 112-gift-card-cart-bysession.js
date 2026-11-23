const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');
if (src.includes('expectedTotal')) { console.error('Uz je aplikovane, nic som nezmenil.'); process.exit(1); }
const OLD = `app.get('/api/gift-cards/by-session/:sessionId', async (req, res) => {
  try {
    const { data } = await supabase.from('gift_cards').select('code,kind,status').eq('stripe_session_id', req.params.sessionId).maybeSingle();
    if (!data) return res.status(404).json({ error: 'Zatiaľ sa nespracovalo, skús o chvíľu znova.' });
    res.json({ card: data });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});`;
const NEW = `app.get('/api/gift-cards/by-session/:sessionId', async (req, res) => {
  try {
    const { data: cards } = await supabase.from('gift_cards').select('code,kind,status').eq('stripe_session_id', req.params.sessionId);
    if (!cards || !cards.length) return res.status(404).json({ error: 'Zatiaľ sa nespracovalo, skús o chvíľu znova.' });

    let expectedTotal = null;
    try {
      const stripeSession = await stripe.checkout.sessions.retrieve(req.params.sessionId);
      const cartItems = JSON.parse(stripeSession.metadata?.cartItems || '[]');
      expectedTotal = cartItems.reduce((sum, it) => sum + Math.min(20, Math.max(1, parseInt(it.q, 10) || 1)), 0);
    } catch (e) { expectedTotal = null; }

    if (expectedTotal !== null && expectedTotal > 0 && cards.length < expectedTotal) {
      return res.status(404).json({ error: 'Zatiaľ sa nespracovalo, skús o chvíľu znova.' });
    }
    res.json({ cards });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});`;
const count = src.split(OLD).length - 1;
if (count !== 1) { console.error(`ABORT: anchor occurs ${count} times. No changes.`); process.exit(1); }
const backup = FILE + '.pre-gift-card-cart-bysession-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src.split(OLD).join(NEW));
console.log('OK - zaloha:', backup);
