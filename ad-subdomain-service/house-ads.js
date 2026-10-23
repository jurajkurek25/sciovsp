// Vlastné (interné) reklamy Juraja — banner/video zadarmo cez dash, bez
// Stripe. Vypĺňajú voľné miesta v rotácii; platiaci klient má VŽDY
// prednosť — pri servovaní (viď /api/ads/serve v server.js a
// /api/rewards/video/* v hlavnej appke) sa platené reklamy zobrazia vždy
// všetky a interné doplnia zvyšné miesta do MAX_ACTIVE_BANNERS/
// MAX_ACTIVE_VIDEO_ADS. Pri checkout kapacitnej kontrole sa interné
// reklamy nepočítajú, takže nikdy neblokujú platiaceho klienta.
const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const ADMIN_KEY = process.env.ADMIN_KEY;
function checkAdminKey(req) {
  const key = req.headers['x-admin-key'];
  if (!key || !ADMIN_KEY) return false;
  return key === ADMIN_KEY;
}
function requireAdminKey(req, res, next) {
  if (!checkAdminKey(req)) return res.status(403).json({ error: 'Forbidden.' });
  next();
}

const HOUSE_ADVERTISER_EMAIL = 'house@sptrener.online';
let houseAdvertiserId = null;
async function getHouseAdvertiserId() {
  if (houseAdvertiserId) return houseAdvertiserId;
  const [rows] = await db.query('SELECT id FROM advertisers WHERE email = ?', [HOUSE_ADVERTISER_EMAIL]);
  if (!rows[0]) throw new Error('House advertiser nenájdený — spusti najprv SQL migráciu.');
  houseAdvertiserId = rows[0].id;
  return houseAdvertiserId;
}

// MySQL TIMESTAMP je 32-bit (Y2038 limit, max 2038-01-19 03:14:07) — nedá sa
// dať naozaj "navždy", len čo najviac do budúcnosti v rámci rozsahu.
const FAR_FUTURE = '2037-12-31 23:59:59';
const BANNER_MIME = ['image/png', 'image/gif', 'video/mp4'];
const MAX_BANNER_SIZE = 8 * 1024 * 1024;
const MAX_VIDEO_SIZE = 25 * 1024 * 1024;
const MIN_VIDEO_DURATION = 5, MAX_VIDEO_DURATION = 180;
const VALID_TARGET_LANGS = ['sk', 'cz', 'both'];
function normalizeTargetLang(v) { return VALID_TARGET_LANGS.includes(v) ? v : 'both'; }

const upload = multer({ storage: multer.memoryStorage() });
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

function safeFilename(prefix, originalname) {
  const ext = (originalname.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
}

router.get('/api/admin/house-ads', requireAdminKey, async (req, res) => {
  try {
    const advertiserId = await getHouseAdvertiserId();
    const [banners] = await db.query('SELECT * FROM ad_banners WHERE advertiser_id = ? ORDER BY created_at DESC', [advertiserId]);
    const [videos] = await db.query('SELECT * FROM video_ads WHERE advertiser_id = ? ORDER BY created_at DESC', [advertiserId]);
    res.json({ banners, videos });
  } catch (e) {
    console.error('house-ads list error:', e.message);
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

router.post('/api/admin/house-ads/banner', requireAdminKey, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Nahrávanie zlyhalo.' });
    if (!req.file) return res.status(400).json({ error: 'Chýba súbor.' });
    if (!BANNER_MIME.includes(req.file.mimetype)) return res.status(400).json({ error: 'Povolené je PNG, GIF alebo MP4.' });
    if (req.file.size > MAX_BANNER_SIZE) return res.status(400).json({ error: 'Súbor je príliš veľký (max 8 MB).' });
    const { linkUrl, targetLang } = req.body || {};
    if (!linkUrl || !/^https?:\/\//.test(linkUrl)) return res.status(400).json({ error: 'Zadaj platnú cieľovú URL.' });
    try {
      const advertiserId = await getHouseAdvertiserId();
      const filename = safeFilename('house-banner', req.file.originalname);
      fs.mkdirSync(path.join(UPLOADS_DIR, 'banners'), { recursive: true });
      fs.writeFileSync(path.join(UPLOADS_DIR, 'banners', filename), req.file.buffer);
      const publicUrl = `/uploads/banners/${filename}`;
      const [result] = await db.query(
        `INSERT INTO ad_banners (advertiser_id, public_url, mime_type, link_url, active, status, current_period_end, target_lang, is_house)
         VALUES (?, ?, ?, ?, 1, 'active', ?, ?, 1)`,
        [advertiserId, publicUrl, req.file.mimetype, linkUrl, FAR_FUTURE, normalizeTargetLang(targetLang)]
      );
      res.status(201).json({ ok: true, id: result.insertId });
    } catch (e) {
      console.error('house banner create error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });
});

router.post('/api/admin/house-ads/video', requireAdminKey, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Nahrávanie zlyhalo.' });
    if (!req.file) return res.status(400).json({ error: 'Chýba súbor.' });
    if (req.file.mimetype !== 'video/mp4') return res.status(400).json({ error: 'Povolené je len MP4.' });
    if (req.file.size > MAX_VIDEO_SIZE) return res.status(400).json({ error: 'Súbor je príliš veľký (max 25 MB).' });
    const { linkUrl, durationS, targetLang } = req.body || {};
    if (!linkUrl || !/^https?:\/\//.test(linkUrl)) return res.status(400).json({ error: 'Zadaj platnú cieľovú URL.' });
    const duration = parseInt(durationS, 10);
    if (!Number.isFinite(duration) || duration < MIN_VIDEO_DURATION || duration > MAX_VIDEO_DURATION) {
      return res.status(400).json({ error: `Zadaj dĺžku videa v sekundách (${MIN_VIDEO_DURATION}–${MAX_VIDEO_DURATION}).` });
    }
    try {
      const advertiserId = await getHouseAdvertiserId();
      const filename = safeFilename('house-video', req.file.originalname);
      fs.mkdirSync(path.join(UPLOADS_DIR, 'videos'), { recursive: true });
      fs.writeFileSync(path.join(UPLOADS_DIR, 'videos', filename), req.file.buffer);
      const publicUrl = `/uploads/videos/${filename}`;
      const [result] = await db.query(
        `INSERT INTO video_ads (advertiser_id, public_url, mime_type, duration_s, link_url, active, status, current_period_end, target_lang, is_house)
         VALUES (?, ?, 'video/mp4', ?, ?, 1, 'active', ?, ?, 1)`,
        [advertiserId, publicUrl, duration, linkUrl, FAR_FUTURE, normalizeTargetLang(targetLang)]
      );
      res.status(201).json({ ok: true, id: result.insertId });
    } catch (e) {
      console.error('house video create error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });
});

router.patch('/api/admin/house-ads/:type/:id', requireAdminKey, async (req, res) => {
  const table = req.params.type === 'banner' ? 'ad_banners' : req.params.type === 'video' ? 'video_ads' : null;
  if (!table) return res.status(400).json({ error: 'Neplatný typ.' });
  const { active, linkUrl } = req.body || {};
  if (linkUrl && !/^https?:\/\//.test(linkUrl)) return res.status(400).json({ error: 'Zadaj platnú cieľovú URL.' });
  try {
    const advertiserId = await getHouseAdvertiserId();
    const sets = [];
    const params = [];
    if (typeof active === 'boolean') { sets.push('active = ?'); params.push(active ? 1 : 0); }
    if (linkUrl) { sets.push('link_url = ?'); params.push(linkUrl); }
    if (!sets.length) return res.status(400).json({ error: 'Nič na úpravu.' });
    params.push(req.params.id, advertiserId);
    const [result] = await db.query(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ? AND advertiser_id = ?`, params);
    if (!result.affectedRows) return res.status(404).json({ error: 'Nenájdené.' });
    res.json({ ok: true });
  } catch (e) {
    console.error('house-ads patch error:', e.message);
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

router.delete('/api/admin/house-ads/:type/:id', requireAdminKey, async (req, res) => {
  const table = req.params.type === 'banner' ? 'ad_banners' : req.params.type === 'video' ? 'video_ads' : null;
  if (!table) return res.status(400).json({ error: 'Neplatný typ.' });
  try {
    const advertiserId = await getHouseAdvertiserId();
    const [rows] = await db.query(`SELECT public_url FROM ${table} WHERE id = ? AND advertiser_id = ?`, [req.params.id, advertiserId]);
    if (!rows[0]) return res.status(404).json({ error: 'Nenájdené.' });
    const filePath = path.join(__dirname, 'public', rows[0].public_url.replace(/^\/+/, ''));
    fs.promises.unlink(filePath).catch(() => {});
    await db.query(`DELETE FROM ${table} WHERE id = ? AND advertiser_id = ?`, [req.params.id, advertiserId]);
    res.json({ ok: true });
  } catch (e) {
    console.error('house-ads delete error:', e.message);
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

module.exports = router;
