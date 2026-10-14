// Vlastné (interné) reklamy Juraja na ad.sptrener.online — zadarmo, bez
// Stripe, doplňujú voľné miesta v rotácii. Platiaci klienti majú vždy
// prednosť (viď ad-service's house-ads.js + priority serve logika).
// Táto route len proxuje na ad-service admin endpointy (x-admin-key).
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requireDashAuth } = require('../lib/auth');
const { adAdminFetch } = require('../lib/db-ads');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/api/dash/ads/house', requireDashAuth, async (req, res) => {
  try {
    const data = await adAdminFetch('/api/admin/house-ads');
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/dash/ads/house/banner', requireDashAuth, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Nahrávanie zlyhalo.' });
    if (!req.file) return res.status(400).json({ error: 'Chýba súbor.' });
    try {
      const fd = new FormData();
      fd.append('file', new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname || 'banner');
      fd.append('linkUrl', req.body.linkUrl || '');
      fd.append('targetLang', req.body.targetLang || 'both');
      const data = await adAdminFetch('/api/admin/house-ads/banner', { method: 'POST', body: fd });
      res.status(201).json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});

router.post('/api/dash/ads/house/video', requireDashAuth, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Nahrávanie zlyhalo.' });
    if (!req.file) return res.status(400).json({ error: 'Chýba súbor.' });
    try {
      const fd = new FormData();
      fd.append('file', new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname || 'video.mp4');
      fd.append('linkUrl', req.body.linkUrl || '');
      fd.append('durationS', req.body.durationS || '');
      fd.append('targetLang', req.body.targetLang || 'both');
      const data = await adAdminFetch('/api/admin/house-ads/video', { method: 'POST', body: fd });
      res.status(201).json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});

router.patch('/api/dash/ads/house/:type/:id', requireDashAuth, async (req, res) => {
  try {
    const data = await adAdminFetch(`/api/admin/house-ads/${req.params.type}/${req.params.id}`, {
      method: 'PATCH', body: JSON.stringify(req.body || {})
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/api/dash/ads/house/:type/:id', requireDashAuth, async (req, res) => {
  try {
    const data = await adAdminFetch(`/api/admin/house-ads/${req.params.type}/${req.params.id}`, { method: 'DELETE' });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
