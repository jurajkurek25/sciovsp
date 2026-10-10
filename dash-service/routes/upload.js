// Nahrávanie cover obrázkov (kurzy aj blog) do Supabase Storage hlavnej appky —
// jeden spoločný endpoint, kind rozlišuje priečinok (blog/courses).
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requireDashAuth } = require('../lib/auth');
const { supabase: mainDb } = require('../lib/db-main');

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_SIZE } });

router.post('/api/dash/upload-cover', requireDashAuth, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Nahrávanie zlyhalo.' });
    if (!req.file) return res.status(400).json({ error: 'Chýba súbor.' });
    const ext = ALLOWED_MIME[req.file.mimetype];
    if (!ext) return res.status(400).json({ error: 'Povolené sú len PNG, JPEG alebo WEBP.' });
    const kind = ['blog', 'courses'].includes(req.body.kind) ? req.body.kind : 'blog';
    try {
      const path = `${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await mainDb.storage.from('covers').upload(path, req.file.buffer, { contentType: req.file.mimetype });
      if (upErr) throw upErr;
      const { data: pub } = mainDb.storage.from('covers').getPublicUrl(path);
      res.json({ ok: true, url: pub.publicUrl });
    } catch (e) {
      console.error('cover upload error:', e.message || e);
      res.status(500).json({ error: 'Nahrávanie na server zlyhalo.' });
    }
  });
});

module.exports = router;
