require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Stripe = require('stripe');
const db = require('./db');

const PORT = process.env.PORT || 3849;
const APP_URL = process.env.APP_URL || 'https://ad.sptrener.online';
const MAIN_APP_ORIGIN = process.env.MAIN_APP_ORIGIN || 'https://sptrener.online';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ Chýba JWT_SECRET v .env. Appka sa nespustí bez neho.');
  process.exit(1);
}

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const app = express();

// Stripe webhook potrebuje surové telo requestu na overenie podpisu —
// MUSÍ byť zaregistrovaný pred express.json(), inak by json parser telo
// už skonzumoval/pretransformoval a podpis by nesedel.
function mapStripeStatus(stripeStatus) {
  if (stripeStatus === 'active' || stripeStatus === 'trialing') return 'active';
  if (stripeStatus === 'past_due') return 'past_due';
  return 'cancelled';
}

async function syncFromSubscription(subscriptionId) {
  if (!subscriptionId) return;
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const metadata = sub.metadata || {};
  const status = mapStripeStatus(sub.status);
  const periodEnd = new Date(sub.current_period_end * 1000);
  if (metadata.bannerId) {
    await db.query(
      'UPDATE ad_banners SET status = ?, current_period_end = ?, stripe_subscription_id = ? WHERE id = ?',
      [status, periodEnd, subscriptionId, metadata.bannerId]
    );
  }
  if (metadata.videoAdId) {
    await db.query(
      'UPDATE video_ads SET status = ?, current_period_end = ?, stripe_subscription_id = ? WHERE id = ?',
      [status, periodEnd, subscriptionId, metadata.videoAdId]
    );
  }
}

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const obj = event.data.object;
    const subscriptionId =
      event.type === 'checkout.session.completed' ? obj.subscription :
      event.type === 'invoice.payment_succeeded' ? obj.subscription :
      (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') ? obj.id :
      null;
    if (subscriptionId) await syncFromSubscription(subscriptionId);
  } catch (e) {
    console.error('webhook handling error:', e);
  }

  res.json({ received: true });
});

app.use(express.json());
app.use(cors({ origin: [MAIN_APP_ORIGIN, APP_URL], methods: ['GET', 'POST', 'PATCH', 'DELETE'] }));

const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(path.join(UPLOADS_DIR, 'banners'), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, 'videos'), { recursive: true });

const upload = multer({ storage: multer.memoryStorage() });

// ─── Jednoduchý in-memory rate limiter ─────────────────────────
const hits = new Map();
function rateLimit(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  const windowMs = 60_000, max = 20;
  const arr = (hits.get(key) || []).filter(t => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (arr.length > max) return res.status(429).json({ error: 'Príliš veľa požiadaviek, skús to prosím o chvíľu.' });
  next();
}

const MAX_ACTIVE_BANNERS = 4;
const MAX_ACTIVE_VIDEO_ADS = 3;
const BANNER_MIME = ['image/png', 'image/gif', 'video/mp4'];
const MAX_BANNER_SIZE = 8 * 1024 * 1024;
const MAX_VIDEO_SIZE = 25 * 1024 * 1024;
const MIN_VIDEO_DURATION = 5, MAX_VIDEO_DURATION = 180;

function safeFilename(advertiserId, originalname) {
  const ext = (originalname.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  return `${advertiserId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
}

async function unlinkPublicUrl(publicUrl) {
  if (!publicUrl) return;
  const filePath = path.join(__dirname, 'public', publicUrl.replace(/^\/+/, ''));
  fs.promises.unlink(filePath).catch(() => {});
}

// ─── Vlastná autentifikácia inzerentov (email + heslo, JWT) ─────

function signToken(advertiser) {
  return jwt.sign({ id: advertiser.id, email: advertiser.email }, JWT_SECRET, { expiresIn: '30d' });
}

function advertiserJson(a) {
  return { email: a.email, companyName: a.company_name, hasBilling: !!a.stripe_customer_id };
}

async function requireAdvertiser(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Chýba prihlásenie.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const [rows] = await db.query('SELECT * FROM advertisers WHERE id = ?', [payload.id]);
    if (!rows[0]) return res.status(401).json({ error: 'Neplatný token.' });
    req.advertiser = rows[0];
    next();
  } catch (e) {
    res.status(401).json({ error: 'Neplatný alebo expirovaný token.' });
  }
}

app.post('/api/ads-auth/register', rateLimit, async (req, res) => {
  const { email, password, companyName } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Neplatný email.' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Heslo musí mať aspoň 8 znakov.' });
  try {
    const [existing] = await db.query('SELECT id FROM advertisers WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ error: 'Tento email je už zaregistrovaný. Skús sa prihlásiť.' });
    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await db.query(
      'INSERT INTO advertisers (email, password_hash, company_name) VALUES (?, ?, ?)',
      [email, passwordHash, companyName || null]
    );
    const advertiser = { id: result.insertId, email, company_name: companyName || null, stripe_customer_id: null };
    res.status(201).json({ token: signToken(advertiser), advertiser: advertiserJson(advertiser) });
  } catch (err) {
    console.error('register error:', err);
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.post('/api/ads-auth/login', rateLimit, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Zadaj email aj heslo.' });
  try {
    const [rows] = await db.query('SELECT * FROM advertisers WHERE email = ?', [email]);
    const advertiser = rows[0];
    if (!advertiser) return res.status(401).json({ error: 'Nesprávny email alebo heslo.' });
    const ok = await bcrypt.compare(password, advertiser.password_hash);
    if (!ok) return res.status(401).json({ error: 'Nesprávny email alebo heslo.' });
    res.json({ token: signToken(advertiser), advertiser: advertiserJson(advertiser) });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.get('/api/ads-auth/me', requireAdvertiser, (req, res) => {
  res.json({ advertiser: advertiserJson(req.advertiser) });
});

// ─── Bannery — fakturácia je PER BANNER, nie per účet ──────────

app.post('/api/ads/banners/:id/checkout', requireAdvertiser, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM ad_banners WHERE id = ? AND advertiser_id = ?', [req.params.id, req.advertiser.id]);
    const banner = rows[0];
    if (!banner) return res.status(404).json({ error: 'Banner sa nenašiel.' });
    if (banner.status === 'active' && (!banner.current_period_end || new Date(banner.current_period_end) > new Date())) {
      return res.status(400).json({ error: 'Tento banner je už zaplatený a aktívny.' });
    }

    const [[{ cnt }]] = await db.query("SELECT COUNT(*) AS cnt FROM ad_banners WHERE status = 'active' AND current_period_end > NOW()");
    if (cnt >= MAX_ACTIVE_BANNERS) {
      return res.status(409).json({ error: 'Aktuálne máme plný počet bannerov v rotácii. Skús to prosím neskôr.' });
    }

    let customerId = req.advertiser.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: req.advertiser.email, metadata: { advertiserId: String(req.advertiser.id) } });
      customerId = customer.id;
      await db.query('UPDATE advertisers SET stripe_customer_id = ? WHERE id = ?', [customerId, req.advertiser.id]);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_AD_PRICE_ID, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${APP_URL}/?payment=success`,
      cancel_url: `${APP_URL}/?payment=cancelled`,
      metadata: { advertiserId: String(req.advertiser.id), bannerId: String(banner.id) },
      subscription_data: { metadata: { advertiserId: String(req.advertiser.id), bannerId: String(banner.id) } }
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error('ads banner checkout error:', e);
    res.status(500).json({ error: 'Nepodarilo sa vytvoriť platobný link.' });
  }
});

app.post('/api/ads/portal', requireAdvertiser, async (req, res) => {
  try {
    if (!req.advertiser.stripe_customer_id) return res.status(400).json({ error: 'Zatiaľ nemáš žiadnu platbu.' });
    const session = await stripe.billingPortal.sessions.create({ customer: req.advertiser.stripe_customer_id, return_url: `${APP_URL}/` });
    res.json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: 'Nepodarilo sa otvoriť portál.' });
  }
});

app.get('/api/ads/banners', requireAdvertiser, async (req, res) => {
  try {
    const [banners] = await db.query('SELECT * FROM ad_banners WHERE advertiser_id = ? ORDER BY created_at DESC', [req.advertiser.id]);
    const withStats = await Promise.all(banners.map(async b => {
      const [[{ impressions }]] = await db.query("SELECT COUNT(*) AS impressions FROM ad_events WHERE banner_id = ? AND event_type = 'impression'", [b.id]);
      const [[{ clicks }]] = await db.query("SELECT COUNT(*) AS clicks FROM ad_events WHERE banner_id = ? AND event_type = 'click'", [b.id]);
      return { ...b, impressions, clicks };
    }));
    res.json({ banners: withStats });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.post('/api/ads/banners', requireAdvertiser, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Nahrávanie zlyhalo.' });
    const { linkUrl } = req.body || {};
    if (!req.file) return res.status(400).json({ error: 'Chýba súbor.' });
    if (!BANNER_MIME.includes(req.file.mimetype)) return res.status(400).json({ error: 'Povolené sú PNG, GIF alebo MP4.' });
    if (req.file.size > MAX_BANNER_SIZE) return res.status(400).json({ error: 'Súbor je príliš veľký (max 8 MB).' });
    if (!linkUrl || !/^https?:\/\//.test(linkUrl)) return res.status(400).json({ error: 'Zadaj platnú cieľovú URL (vrátane https://).' });

    try {
      const filename = safeFilename(req.advertiser.id, req.file.originalname);
      await fs.promises.writeFile(path.join(UPLOADS_DIR, 'banners', filename), req.file.buffer);
      const publicUrl = `/uploads/banners/${filename}`;

      const [result] = await db.query(
        'INSERT INTO ad_banners (advertiser_id, public_url, mime_type, link_url) VALUES (?, ?, ?, ?)',
        [req.advertiser.id, publicUrl, req.file.mimetype, linkUrl]
      );
      const [rows] = await db.query('SELECT * FROM ad_banners WHERE id = ?', [result.insertId]);
      res.status(201).json({ banner: rows[0] });
    } catch (e) {
      console.error('ads banner upload error:', e);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });
});

app.patch('/api/ads/banners/:id', requireAdvertiser, async (req, res) => {
  const { active, linkUrl } = req.body || {};
  if (linkUrl && !/^https?:\/\//.test(linkUrl)) return res.status(400).json({ error: 'Zadaj platnú cieľovú URL.' });
  try {
    if (typeof active === 'boolean') {
      await db.query('UPDATE ad_banners SET active = ? WHERE id = ? AND advertiser_id = ?', [active ? 1 : 0, req.params.id, req.advertiser.id]);
    }
    if (linkUrl) {
      await db.query('UPDATE ad_banners SET link_url = ? WHERE id = ? AND advertiser_id = ?', [linkUrl, req.params.id, req.advertiser.id]);
    }
    const [rows] = await db.query('SELECT * FROM ad_banners WHERE id = ? AND advertiser_id = ?', [req.params.id, req.advertiser.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Banner sa nenašiel.' });
    res.json({ banner: rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.delete('/api/ads/banners/:id', requireAdvertiser, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT stripe_subscription_id, public_url FROM ad_banners WHERE id = ? AND advertiser_id = ?', [req.params.id, req.advertiser.id]);
    const banner = rows[0];
    if (!banner) return res.status(404).json({ error: 'Banner sa nenašiel.' });
    if (banner.stripe_subscription_id) {
      try { await stripe.subscriptions.cancel(banner.stripe_subscription_id); } catch (e) { console.error('cancel sub error:', e); }
    }
    await unlinkPublicUrl(banner.public_url);
    await db.query('DELETE FROM ad_banners WHERE id = ? AND advertiser_id = ?', [req.params.id, req.advertiser.id]);
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

// ─── Verejné — volá ich hlavná appka (sptrener.online) cez CORS ────

app.get('/api/ads/serve', async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, public_url, mime_type FROM ad_banners WHERE active = 1 AND status = 'active' AND current_period_end > NOW() ORDER BY created_at DESC LIMIT 20"
    );
    res.json({ banners: rows.map(b => ({ id: b.id, url: b.public_url, mimeType: b.mime_type })) });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.get('/api/ads/go/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT link_url FROM ad_banners WHERE id = ?', [req.params.id]);
    const banner = rows[0];
    if (!banner) return res.status(404).send('Banner sa nenašiel.');
    db.query("INSERT INTO ad_events (banner_id, event_type) VALUES (?, 'click')", [req.params.id]).catch(() => {});
    res.redirect(302, banner.link_url);
  } catch (e) {
    res.status(500).send('Chyba servera.');
  }
});

app.post('/api/ads/impression/:id', (req, res) => {
  db.query("INSERT INTO ad_events (banner_id, event_type) VALUES (?, 'impression')", [req.params.id]).catch(() => {});
  res.status(204).end();
});

// ─── Video reklamy — rovnaký princíp, iný priečinok, + duration_s ────

app.post('/api/video-ads/:id/checkout', requireAdvertiser, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM video_ads WHERE id = ? AND advertiser_id = ?', [req.params.id, req.advertiser.id]);
    const ad = rows[0];
    if (!ad) return res.status(404).json({ error: 'Video reklama sa nenašla.' });
    if (ad.status === 'active' && (!ad.current_period_end || new Date(ad.current_period_end) > new Date())) {
      return res.status(400).json({ error: 'Toto video je už zaplatené a aktívne.' });
    }
    const [[{ cnt }]] = await db.query("SELECT COUNT(*) AS cnt FROM video_ads WHERE status = 'active' AND current_period_end > NOW()");
    if (cnt >= MAX_ACTIVE_VIDEO_ADS) {
      return res.status(409).json({ error: 'Aktuálne máme plný počet video reklám v rotácii. Skús to prosím neskôr.' });
    }

    let customerId = req.advertiser.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: req.advertiser.email, metadata: { advertiserId: String(req.advertiser.id) } });
      customerId = customer.id;
      await db.query('UPDATE advertisers SET stripe_customer_id = ? WHERE id = ?', [customerId, req.advertiser.id]);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_VIDEO_AD_PRICE_ID, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${APP_URL}/?payment=success`,
      cancel_url: `${APP_URL}/?payment=cancelled`,
      metadata: { advertiserId: String(req.advertiser.id), videoAdId: String(ad.id) },
      subscription_data: { metadata: { advertiserId: String(req.advertiser.id), videoAdId: String(ad.id) } }
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error('video ad checkout error:', e);
    res.status(500).json({ error: 'Nepodarilo sa vytvoriť platobný link.' });
  }
});

app.get('/api/video-ads', requireAdvertiser, async (req, res) => {
  try {
    const [ads] = await db.query('SELECT * FROM video_ads WHERE advertiser_id = ? ORDER BY created_at DESC', [req.advertiser.id]);
    const withStats = await Promise.all(ads.map(async a => {
      const [[{ views }]] = await db.query('SELECT COUNT(*) AS views FROM video_ad_views WHERE video_ad_id = ? AND completed_at IS NOT NULL', [a.id]);
      const [[{ clicks }]] = await db.query('SELECT COUNT(*) AS clicks FROM video_ad_views WHERE video_ad_id = ? AND clicked = 1', [a.id]);
      return { ...a, views, clicks };
    }));
    res.json({ videoAds: withStats });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.post('/api/video-ads', requireAdvertiser, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Nahrávanie zlyhalo.' });
    const { linkUrl, durationS } = req.body || {};
    if (!req.file) return res.status(400).json({ error: 'Chýba súbor.' });
    if (req.file.mimetype !== 'video/mp4') return res.status(400).json({ error: 'Povolené je len MP4.' });
    if (req.file.size > MAX_VIDEO_SIZE) return res.status(400).json({ error: 'Súbor je príliš veľký (max 25 MB).' });
    if (!linkUrl || !/^https?:\/\//.test(linkUrl)) return res.status(400).json({ error: 'Zadaj platnú cieľovú URL.' });
    const duration = parseInt(durationS, 10);
    if (!Number.isFinite(duration) || duration < MIN_VIDEO_DURATION || duration > MAX_VIDEO_DURATION) {
      return res.status(400).json({ error: `Zadaj dĺžku videa v sekundách (${MIN_VIDEO_DURATION}–${MAX_VIDEO_DURATION}).` });
    }

    try {
      const filename = safeFilename(req.advertiser.id, 'video.mp4');
      await fs.promises.writeFile(path.join(UPLOADS_DIR, 'videos', filename), req.file.buffer);
      const publicUrl = `/uploads/videos/${filename}`;

      const [result] = await db.query(
        'INSERT INTO video_ads (advertiser_id, public_url, mime_type, duration_s, link_url) VALUES (?, ?, ?, ?, ?)',
        [req.advertiser.id, publicUrl, 'video/mp4', duration, linkUrl]
      );
      const [rows] = await db.query('SELECT * FROM video_ads WHERE id = ?', [result.insertId]);
      res.status(201).json({ videoAd: rows[0] });
    } catch (e) {
      console.error('video ad upload error:', e);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });
});

app.patch('/api/video-ads/:id', requireAdvertiser, async (req, res) => {
  const { active, linkUrl } = req.body || {};
  if (linkUrl && !/^https?:\/\//.test(linkUrl)) return res.status(400).json({ error: 'Zadaj platnú cieľovú URL.' });
  try {
    if (typeof active === 'boolean') {
      await db.query('UPDATE video_ads SET active = ? WHERE id = ? AND advertiser_id = ?', [active ? 1 : 0, req.params.id, req.advertiser.id]);
    }
    if (linkUrl) {
      await db.query('UPDATE video_ads SET link_url = ? WHERE id = ? AND advertiser_id = ?', [linkUrl, req.params.id, req.advertiser.id]);
    }
    const [rows] = await db.query('SELECT * FROM video_ads WHERE id = ? AND advertiser_id = ?', [req.params.id, req.advertiser.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Video reklama sa nenašla.' });
    res.json({ videoAd: rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.delete('/api/video-ads/:id', requireAdvertiser, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT stripe_subscription_id, public_url FROM video_ads WHERE id = ? AND advertiser_id = ?', [req.params.id, req.advertiser.id]);
    const ad = rows[0];
    if (!ad) return res.status(404).json({ error: 'Video reklama sa nenašla.' });
    if (ad.stripe_subscription_id) {
      try { await stripe.subscriptions.cancel(ad.stripe_subscription_id); } catch (e) { console.error('cancel sub error:', e); }
    }
    await unlinkPublicUrl(ad.public_url);
    await db.query('DELETE FROM video_ads WHERE id = ? AND advertiser_id = ?', [req.params.id, req.advertiser.id]);
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

// Verejný presmerovací endpoint pre video reklamy — klik-tracking.
// Zhliadnutie/odmena (+1 test v hlavnej appke) sa rieši mimo tejto appky.
app.get('/api/video-ads/go/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT link_url FROM video_ads WHERE id = ?', [req.params.id]);
    const ad = rows[0];
    if (!ad) return res.status(404).send('Reklama sa nenašla.');
    if (req.query.session) {
      db.query('UPDATE video_ad_views SET clicked = 1 WHERE session_token = ?', [req.query.session]).catch(() => {});
    }
    res.redirect(302, ad.link_url);
  } catch (e) {
    res.status(500).send('Chyba servera.');
  }
});

app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ads.html'));
});

app.listen(PORT, () => {
  console.log(`SP Tréner Ads beží na porte ${PORT} (${APP_URL})`);
});
