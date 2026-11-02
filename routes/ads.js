const express = require('express');
const router = express.Router();
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { pool } = require('../db/pool');
const { requireAdvertiserAuth } = require('../middleware/adsAuth');

// Každý banner má VLASTNÉ mesačné Stripe predplatné — pri viacerých banneroch
// naraz sa platí za každý zvlášť. 1 rotujúci slot v appke, max. 4 aktívne bannery.
const MAX_ACTIVE_BANNERS = 4;
const ALLOWED_MIME = ['image/png', 'image/gif', 'video/mp4'];
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(new Error('Nepodporovaný formát. Povolené sú PNG, GIF alebo MP4.'));
    }
    cb(null, true);
  }
});

const AD_FRONTEND_URL = process.env.AD_FRONTEND_URL || 'https://ad.sptrener.online';

function signAdvertiserToken(advertiserId) {
  return jwt.sign({ advertiserId }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

// ─── Verejné API — slúži na zobrazovanie bannerov v hlavnej appke ──────────

// GET /api/ads/serve — zoznam aktuálne zaplatených a aktívnych bannerov (bez súborových dát)
router.get('/api/ads/serve', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, mime_type FROM ad_banners
       WHERE active = TRUE AND status = 'active'
         AND (current_period_end IS NULL OR current_period_end > NOW())
       ORDER BY created_at DESC
       LIMIT 20`
    );
    res.json({ banners: rows.map(r => ({ id: r.id, mimeType: r.mime_type })) });
  } catch (e) {
    console.error('ads serve error:', e);
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

// GET /api/ads/file/:id — streamuje kreatívu (obrázok/video) z DB — funguje aj na náhľad v dashboarde pred platbou
router.get('/api/ads/file/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT mime_type, file_data FROM ad_banners WHERE id = $1',
      [req.params.id]
    );
    const banner = rows[0];
    if (!banner) return res.status(404).end();
    res.set('Content-Type', banner.mime_type);
    res.set('Cache-Control', 'public, max-age=300');
    res.send(banner.file_data);
  } catch (e) {
    console.error('ads file error:', e);
    res.status(500).end();
  }
});

// GET /api/ads/go/:id — zaloguje klik a presmeruje na cieľovú URL inzerenta
router.get('/api/ads/go/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT link_url FROM ad_banners WHERE id = $1', [req.params.id]);
    const banner = rows[0];
    if (!banner) return res.status(404).send('Banner sa nenašiel.');
    pool.query(`INSERT INTO ad_events (banner_id, event_type) VALUES ($1, 'click')`, [req.params.id])
      .catch(e => console.error('ads click log error:', e));
    res.redirect(302, banner.link_url);
  } catch (e) {
    console.error('ads go error:', e);
    res.status(500).send('Chyba servera.');
  }
});

// POST /api/ads/impression/:id — zaloguje zobrazenie (volané cez sendBeacon)
router.post('/api/ads/impression/:id', async (req, res) => {
  try {
    await pool.query(`INSERT INTO ad_events (banner_id, event_type) VALUES ($1, 'impression')`, [req.params.id]);
  } catch (e) {
    // banner mohol medzičasom zaniknúť — nič sa nedeje
  }
  res.status(204).end();
});

// ─── Autentifikácia inzerentov ──────────────────────────────────────────────

// POST /api/ads-auth/register
router.post('/api/ads-auth/register', async (req, res) => {
  const { email, password, companyName } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email a heslo sú povinné.' });
  if (password.length < 8) return res.status(400).json({ error: 'Heslo musí mať aspoň 8 znakov.' });
  if (!/\S+@\S+\.\S+/.test(email)) return res.status(400).json({ error: 'Neplatný email.' });

  try {
    const existing = await pool.query('SELECT id FROM advertisers WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Tento email je už zaregistrovaný.' });

    const hash = await bcrypt.hash(password, 12);
    const advertiserId = uuidv4();
    await pool.query(
      'INSERT INTO advertisers (id, email, password_hash, company_name) VALUES ($1, $2, $3, $4)',
      [advertiserId, email.toLowerCase(), hash, companyName || null]
    );

    const token = signAdvertiserToken(advertiserId);
    res.status(201).json({ token, advertiser: { id: advertiserId, email: email.toLowerCase(), companyName } });
  } catch (e) {
    console.error('ads register error:', e);
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

// POST /api/ads-auth/login
router.post('/api/ads-auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Vyplň email a heslo.' });

  try {
    const result = await pool.query('SELECT * FROM advertisers WHERE email = $1', [email.toLowerCase()]);
    const advertiser = result.rows[0];
    if (!advertiser) return res.status(401).json({ error: 'Nesprávny email alebo heslo.' });

    const valid = await bcrypt.compare(password, advertiser.password_hash);
    if (!valid) return res.status(401).json({ error: 'Nesprávny email alebo heslo.' });

    const token = signAdvertiserToken(advertiser.id);
    res.json({
      token,
      advertiser: { id: advertiser.id, email: advertiser.email, companyName: advertiser.company_name }
    });
  } catch (e) {
    console.error('ads login error:', e);
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

// GET /api/ads-auth/me
router.get('/api/ads-auth/me', requireAdvertiserAuth, async (req, res) => {
  res.json({
    advertiser: {
      id: req.advertiser.id,
      email: req.advertiser.email,
      companyName: req.advertiser.company_name,
      hasBilling: !!req.advertiser.stripe_customer_id
    }
  });
});

// ─── Fakturácia (Stripe) — predplatné je viazané na konkrétny banner ───────

// POST /api/ads/banners/:id/checkout — spustí platbu za KONKRÉTNY banner (49€/mesiac za tento jeden banner)
router.post('/api/ads/banners/:id/checkout', requireAdvertiserAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, status, current_period_end FROM ad_banners WHERE id = $1 AND advertiser_id = $2',
      [req.params.id, req.advertiser.id]
    );
    const banner = rows[0];
    if (!banner) return res.status(404).json({ error: 'Banner sa nenašiel.' });
    if (banner.status === 'active' && (!banner.current_period_end || new Date(banner.current_period_end) > new Date())) {
      return res.status(400).json({ error: 'Tento banner je už zaplatený a aktívny.' });
    }

    const { rows: activeRows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM ad_banners
       WHERE status = 'active' AND (current_period_end IS NULL OR current_period_end > NOW())`
    );
    if (activeRows[0].n >= MAX_ACTIVE_BANNERS) {
      return res.status(409).json({ error: 'Aktuálne máme plný počet bannerov v rotácii. Skús to prosím neskôr.' });
    }

    let customerId = req.advertiser.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.advertiser.email,
        metadata: { advertiserId: req.advertiser.id }
      });
      customerId = customer.id;
      await pool.query('UPDATE advertisers SET stripe_customer_id = $1 WHERE id = $2', [customerId, req.advertiser.id]);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_AD_PRICE_ID, quantity: 1 }],
      success_url: `${AD_FRONTEND_URL}/dashboard?payment=success`,
      cancel_url: `${AD_FRONTEND_URL}/dashboard?payment=cancelled`,
      metadata: { advertiserId: req.advertiser.id, bannerId: banner.id },
      subscription_data: { metadata: { advertiserId: req.advertiser.id, bannerId: banner.id } }
    });

    res.json({ url: session.url });
  } catch (e) {
    console.error('ads checkout error:', e);
    res.status(500).json({ error: 'Nepodarilo sa vytvoriť platobný link.' });
  }
});

// POST /api/ads/portal — jeden Stripe zákaznícky portál, spravuje všetky predplatné bannery naraz
router.post('/api/ads/portal', requireAdvertiserAuth, async (req, res) => {
  try {
    if (!req.advertiser.stripe_customer_id) return res.status(400).json({ error: 'Zatiaľ nemáš žiadnu platbu.' });
    const session = await stripe.billingPortal.sessions.create({
      customer: req.advertiser.stripe_customer_id,
      return_url: `${AD_FRONTEND_URL}/dashboard`
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error('ads portal error:', e);
    res.status(500).json({ error: 'Nepodarilo sa otvoriť portál.' });
  }
});

// ─── Správa bannerov ────────────────────────────────────────────────────────

// GET /api/ads/banners — vlastné bannery + štatistiky + stav platby ku každému
router.get('/api/ads/banners', requireAdvertiserAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.id, b.file_name, b.mime_type, b.link_url, b.active, b.status, b.current_period_end, b.created_at,
        COALESCE(SUM(CASE WHEN e.event_type = 'impression' THEN 1 ELSE 0 END), 0)::int AS impressions,
        COALESCE(SUM(CASE WHEN e.event_type = 'click' THEN 1 ELSE 0 END), 0)::int AS clicks
       FROM ad_banners b
       LEFT JOIN ad_events e ON e.banner_id = b.id
       WHERE b.advertiser_id = $1
       GROUP BY b.id
       ORDER BY b.created_at DESC`,
      [req.advertiser.id]
    );
    res.json({ banners: rows });
  } catch (e) {
    console.error('ads list banners error:', e);
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

// POST /api/ads/banners — nahratie novej kreatívy (bez platby — tá sa spúšťa samostatne cez /checkout)
router.post('/api/ads/banners', requireAdvertiserAuth, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Nahrávanie zlyhalo.' });

    const { linkUrl } = req.body || {};
    if (!req.file) return res.status(400).json({ error: 'Chýba súbor.' });
    if (!linkUrl || !/^https?:\/\//.test(linkUrl)) {
      return res.status(400).json({ error: 'Zadaj platnú cieľovú URL (vrátane https://).' });
    }

    try {
      const { rows } = await pool.query(
        `INSERT INTO ad_banners (advertiser_id, file_name, mime_type, file_data, link_url)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, file_name, mime_type, link_url, active, status, current_period_end, created_at`,
        [req.advertiser.id, req.file.originalname, req.file.mimetype, req.file.buffer, linkUrl]
      );
      res.status(201).json({ banner: rows[0] });
    } catch (e) {
      console.error('ads upload error:', e);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });
});

// PATCH /api/ads/banners/:id — pozastaviť/obnoviť zobrazovanie, zmeniť odkaz (neovplyvňuje platbu)
router.patch('/api/ads/banners/:id', requireAdvertiserAuth, async (req, res) => {
  const { active, linkUrl } = req.body || {};
  if (linkUrl && !/^https?:\/\//.test(linkUrl)) {
    return res.status(400).json({ error: 'Zadaj platnú cieľovú URL (vrátane https://).' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE ad_banners SET
        active = COALESCE($1, active),
        link_url = COALESCE($2, link_url)
       WHERE id = $3 AND advertiser_id = $4
       RETURNING id, file_name, mime_type, link_url, active, status, current_period_end, created_at`,
      [typeof active === 'boolean' ? active : null, linkUrl || null, req.params.id, req.advertiser.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Banner sa nenašiel.' });
    res.json({ banner: rows[0] });
  } catch (e) {
    console.error('ads update banner error:', e);
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

// DELETE /api/ads/banners/:id — zruší aj prípadné bežiace predplatné tohto bannera
router.delete('/api/ads/banners/:id', requireAdvertiserAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT stripe_subscription_id FROM ad_banners WHERE id = $1 AND advertiser_id = $2',
      [req.params.id, req.advertiser.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Banner sa nenašiel.' });

    if (rows[0].stripe_subscription_id) {
      try { await stripe.subscriptions.cancel(rows[0].stripe_subscription_id); }
      catch (e) { console.error('ads cancel subscription error:', e); }
    }

    await pool.query('DELETE FROM ad_banners WHERE id = $1 AND advertiser_id = $2', [req.params.id, req.advertiser.id]);
    res.status(204).end();
  } catch (e) {
    console.error('ads delete banner error:', e);
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

module.exports = router;
