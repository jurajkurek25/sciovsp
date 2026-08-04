const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

// POST /api/stripe/checkout — vytvorí platobný link
router.post('/checkout', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const email = req.user.email;

  try {
    // Nájdi alebo vytvor Stripe zákazníka
    let customerId = null;
    const sub = await pool.query('SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1', [userId]);
    customerId = sub.rows[0]?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { userId }
      });
      customerId = customer.id;
      await pool.query(
        'UPDATE subscriptions SET stripe_customer_id = $1 WHERE user_id = $2',
        [customerId, userId]
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}?payment=success`,
      cancel_url: `${process.env.FRONTEND_URL}?payment=cancelled`,
      metadata: { userId },
      subscription_data: {
        metadata: { userId }
      }
    });

    res.json({ url: session.url });
  } catch (e) {
    console.error('Checkout error:', e);
    res.status(500).json({ error: 'Nepodarilo sa vytvoriť platobný link.' });
  }
});

// POST /api/stripe/portal — zákaznícky portál (správa predplatného)
router.post('/portal', requireAuth, async (req, res) => {
  try {
    const sub = await pool.query('SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1', [req.user.id]);
    const customerId = sub.rows[0]?.stripe_customer_id;
    if (!customerId) return res.status(400).json({ error: 'Nemáš aktívne predplatné.' });

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: process.env.FRONTEND_URL
    });
    res.json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: 'Nepodarilo sa otvoriť portál.' });
  }
});

// GET /api/stripe/status — stav predplatného
router.get('/status', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT plan, status, current_period_end, cancel_at_period_end FROM subscriptions WHERE user_id = $1',
      [req.user.id]
    );
    const sub = result.rows[0] || { plan: 'free', status: 'inactive' };
    const isPro = sub.plan === 'pro' && sub.status === 'active' &&
      (!sub.current_period_end || new Date(sub.current_period_end) > new Date());
    res.json({ ...sub, isPro });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

// POST /api/stripe/webhook — Stripe eventy (raw body!)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    console.error('Webhook signature error:', e.message);
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }

  const data = event.data.object;

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const userId = data.metadata?.userId;
        const advertiserId = data.metadata?.advertiserId;
        if (advertiserId) {
          const sub = await stripe.subscriptions.retrieve(data.subscription);
          await pool.query(
            `UPDATE advertisers SET
              stripe_subscription_id = $1,
              status = $2,
              current_period_end = to_timestamp($3)
             WHERE id = $4`,
            [sub.id, sub.status, sub.current_period_end, advertiserId]
          );
          console.log(`✅ Reklamné predplatné aktivované pre advertisera ${advertiserId}`);
          break;
        }
        if (!userId) break;
        const sub = await stripe.subscriptions.retrieve(data.subscription);
        await pool.query(
          `UPDATE subscriptions SET
            stripe_subscription_id = $1,
            plan = 'pro',
            status = $2,
            current_period_start = to_timestamp($3),
            current_period_end = to_timestamp($4),
            updated_at = NOW()
           WHERE user_id = $5`,
          [sub.id, sub.status, sub.current_period_start, sub.current_period_end, userId]
        );
        console.log(`✅ Predplatné aktivované pre user ${userId}`);
        break;
      }

      case 'customer.subscription.updated': {
        const userId = data.metadata?.userId;
        const advertiserId = data.metadata?.advertiserId;
        if (advertiserId) {
          await pool.query(
            `UPDATE advertisers SET status = $1, current_period_end = to_timestamp($2)
             WHERE stripe_subscription_id = $3`,
            [data.status, data.current_period_end, data.id]
          );
          break;
        }
        if (!userId) break;
        await pool.query(
          `UPDATE subscriptions SET
            status = $1,
            plan = CASE WHEN $1 = 'active' THEN 'pro' ELSE plan END,
            current_period_start = to_timestamp($2),
            current_period_end = to_timestamp($3),
            cancel_at_period_end = $4,
            updated_at = NOW()
           WHERE stripe_subscription_id = $5`,
          [data.status, data.current_period_start, data.current_period_end, data.cancel_at_period_end, data.id]
        );
        break;
      }

      case 'customer.subscription.deleted': {
        await pool.query(
          `UPDATE advertisers SET status = 'cancelled' WHERE stripe_subscription_id = $1`,
          [data.id]
        );
        await pool.query(
          `UPDATE subscriptions SET plan = 'free', status = 'cancelled', updated_at = NOW()
           WHERE stripe_subscription_id = $1`,
          [data.id]
        );
        console.log(`❌ Predplatné zrušené: ${data.id}`);
        break;
      }

      case 'invoice.payment_failed': {
        await pool.query(
          `UPDATE advertisers SET status = 'past_due' WHERE stripe_customer_id = $1`,
          [data.customer]
        );
        await pool.query(
          `UPDATE subscriptions SET status = 'past_due', updated_at = NOW()
           WHERE stripe_customer_id = $1`,
          [data.customer]
        );
        break;
      }
    }
  } catch (e) {
    console.error('Webhook handling error:', e);
  }

  res.json({ received: true });
});

module.exports = router;
