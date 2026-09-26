const express = require('express');
const router = express.Router();
const multer = require('multer');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { pool } = require('../db/pool');
const { requireAdvertiserAuth } = require('../middleware/adsAuth');

// Rewarded video reklama (so zvukom) — drahšia než banner, max 3 aktívne naraz (rotujú sa)
const MAX_ACTIVE_VIDEO_ADS = 3;
const MAX_VIDEO_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const MIN_DURATION_S = 5;
const MAX_DURATION_S = 180;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'video/mp4') return cb(new Error('Nepodporovaný formát. Povolené je len MP4.'));
    cb(null, true);
  }
});

const AD_FRONTEND_URL = process.env.AD_FRONTEND_URL || 'https://ad.sptrener.online';

// ─── Verejné API — streamovanie súboru a klik cez CTA ──────────────────────

// GET /api/video-ads/file/:id — streamuje video z DB (funguje aj na náhľad v dashboarde pred platbou)
router.get('/api/video-ads/file/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT mime_type, file_data FROM video_ads WHERE id = $1', [req.params.id]);
    const ad = rows[0];
    if (!ad) return res.status(404).end();
    res.set('Content-Type', ad.mime_type);
    res.set('Cache-Control', 'public, max-age=300');
    res.set('Accept-Ranges', 'none');
    res.send(ad.file_data);
  } catch (e) {
    console.error('video-ads file error:', e);
    res.status(500).end();
  }
});

// GET /api/video-ads/go/:id — klik na CTA počas/po videu, voliteľne označí konkrétne zhliadnutie
router.get('/api/video-ads/go/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT link_url FROM video_ads WHERE id = $1', [req.params.id]);
    const ad = rows[0];
    if (!ad) return res.status(404).send('Reklama sa nenašla.');
    if (req.query.session) {
      pool.query('UPDATE video_ad_views SET clicked = TRUE WHERE session_token = $1', [req.query.session])
        .catch(e => console.error('video-ads click log error:', e));
    }
    res.redirect(302, ad.link_url);
  } catch (e) {
    console.error('video-ads go error:', e);
    res.status(500).send('Chyba servera.');
  }
});

// ─── Fakturácia (Stripe) — predplatné viazané na konkrétne video ───────────

// POST /api/video-ads/:id/checkout
router.post('/api/video-ads/:id/checkout', requireAdvertiserAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, status, current_period_end FROM video_ads WHERE id = $1 AND advertiser_id = $2',
      [req.params.id, req.advertiser.id]
    );
    const ad = rows[0];
    if (!ad) return res.status(404).json({ error: 'Video reklama sa nenašla.' });
    if (ad.status === 'active' && (!ad.current_period_end || new Date(ad.current_period_end) > new Date())) {
      return res.status(400).json({ error: 'Toto video je už zaplatené a aktívne.' });
    }

    const { rows: activeRows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM video_ads
       WHERE status = 'active' AND (current_period_end IS NULL OR current_period_end > NOW())`
    );
    if (activeRows[0].n >= MAX_ACTIVE_VIDEO_ADS) {
      return res.status(409).json({ error: 'Aktuálne máme plný počet video reklám v rotácii. Skús to prosím neskôr.' });
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
      line_items: [{ price: process.env.STRIPE_VIDEO_AD_PRICE_ID, quantity: 1 }],
      success_url: `${AD_FRONTEND_URL}/dashboard?payment=success`,
      cancel_url: `${AD_FRONTEND_URL}/dashboard?payment=cancelled`,
      metadata: { advertiserId: req.advertiser.id, videoAdId: ad.id },
      subscription_data: { metadata: { advertiserId: req.advertiser.id, videoAdId: ad.id } }
    });

    res.json({ url: session.url });
  } catch (e) {
    console.error('video-ads checkout error:', e);
    res.status(500).json({ error: 'Nepodarilo sa vytvoriť platobný link.' });
  }
});

// ─── Správa video reklám ────────────────────────────────────────────────────

// GET /api/video-ads — vlastné video reklamy + štatistiky
router.get('/api/video-ads', requireAdvertiserAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT v.id, v.file_name, v.mime_type, v.duration_s, v.link_url, v.active, v.status, v.current_period_end, v.created_at,
        COALESCE(SUM(CASE WHEN w.completed_at IS NOT NULL THEN 1 ELSE 0 END), 0)::int AS views,
        COALESCE(SUM(CASE WHEN w.clicked THEN 1 ELSE 0 END), 0)::int AS clicks
       FROM video_ads v
       LEFT JOIN video_ad_views w ON w.video_ad_id = v.id
       WHERE v.advertiser_id = $1
       GROUP BY v.id
       ORDER BY v.created_at DESC`,
      [req.advertiser.id]
    );
    res.json({ videoAds: rows });
  } catch (e) {
    console.error('video-ads list error:', e);
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

// POST /api/video-ads — nahratie nového videa (bez platby — tá sa spúšťa samostatne cez /checkout)
router.post('/api/video-ads', requireAdvertiserAuth, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Nahrávanie zlyhalo.' });

    const { linkUrl, durationS } = req.body || {};
    if (!req.file) return res.status(400).json({ error: 'Chýba súbor.' });
    if (!linkUrl || !/^https?:\/\//.test(linkUrl)) {
      return res.status(400).json({ error: 'Zadaj platnú cieľovú URL (vrátane https://).' });
    }
    const duration = parseInt(durationS, 10);
    if (!Number.isFinite(duration) || duration < MIN_DURATION_S || duration > MAX_DURATION_S) {
      return res.status(400).json({ error: `Zadaj dĺžku videa v sekundách (${MIN_DURATION_S}–${MAX_DURATION_S}). Musí zodpovedať skutočnej dĺžke súboru — používa sa na overenie plného dopozerania.` });
    }

    try {
      const { rows } = await pool.query(
        `INSERT INTO video_ads (advertiser_id, file_name, mime_type, file_data, duration_s, link_url)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, file_name, mime_type, duration_s, link_url, active, status, current_period_end, created_at`,
        [req.advertiser.id, req.file.originalname, req.file.mimetype, req.file.buffer, duration, linkUrl]
      );
      res.status(201).json({ videoAd: rows[0] });
    } catch (e) {
      console.error('video-ads upload error:', e);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });
});

// PATCH /api/video-ads/:id — pozastaviť/obnoviť zobrazovanie, zmeniť odkaz (neovplyvňuje platbu)
router.patch('/api/video-ads/:id', requireAdvertiserAuth, async (req, res) => {
  const { active, linkUrl } = req.body || {};
  if (linkUrl && !/^https?:\/\//.test(linkUrl)) {
    return res.status(400).json({ error: 'Zadaj platnú cieľovú URL (vrátane https://).' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE video_ads SET
        active = COALESCE($1, active),
        link_url = COALESCE($2, link_url)
       WHERE id = $3 AND advertiser_id = $4
       RETURNING id, file_name, mime_type, duration_s, link_url, active, status, current_period_end, created_at`,
      [typeof active === 'boolean' ? active : null, linkUrl || null, req.params.id, req.advertiser.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Video reklama sa nenašla.' });
    res.json({ videoAd: rows[0] });
  } catch (e) {
    console.error('video-ads update error:', e);
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

// DELETE /api/video-ads/:id — zruší aj prípadné bežiace predplatné tohto videa
router.delete('/api/video-ads/:id', requireAdvertiserAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT stripe_subscription_id FROM video_ads WHERE id = $1 AND advertiser_id = $2',
      [req.params.id, req.advertiser.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Video reklama sa nenašla.' });

    if (rows[0].stripe_subscription_id) {
      try { await stripe.subscriptions.cancel(rows[0].stripe_subscription_id); }
      catch (e) { console.error('video-ads cancel subscription error:', e); }
    }

    await pool.query('DELETE FROM video_ads WHERE id = $1 AND advertiser_id = $2', [req.params.id, req.advertiser.id]);
    res.status(204).end();
  } catch (e) {
    console.error('video-ads delete error:', e);
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

module.exports = router;
