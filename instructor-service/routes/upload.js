// Upload videí/obrázkov/PDF pre kurzy a lekcie do Supabase Storage
// (verejný bucket 'course-content' — treba ho vopred vytvoriť v Supabase
// dashboarde ako Public bucket, rovnako ako 'submissions').
//
// Súbor sa najprv odloží na disk cez multer (diskStorage) a odtiaľ sa
// STREAMuje do Supabase, nie bufferuje celý v pamäti — táto appka beží
// na 2 GB RAM VPS spolu s ~8 ďalšími procesmi, takže načítanie stoviek MB
// videa naraz do pamäte by ju mohlo zhodiť.
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { requireInstructorAuth } = require('../lib/auth');
const { supabase: mainDb } = require('../lib/db-main');

const BUCKET = 'course-content';
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_DOC_BYTES = 25 * 1024 * 1024;

const KIND_RULES = {
  video: { mime: ['video/mp4', 'video/webm', 'video/quicktime'], max: MAX_VIDEO_BYTES, ext: { 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov' } },
  image: { mime: ['image/png', 'image/jpeg', 'image/webp'], max: MAX_IMAGE_BYTES, ext: { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' } },
  doc: { mime: ['application/pdf'], max: MAX_DOC_BYTES, ext: { 'application/pdf': '.pdf' } }
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, os.tmpdir()),
    filename: (req, file, cb) => cb(null, 'instr-up-' + crypto.randomBytes(16).toString('hex') + path.extname(file.originalname || ''))
  }),
  limits: { fileSize: MAX_VIDEO_BYTES }
});

router.post('/api/instructor/upload', requireInstructorAuth, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Nahrávanie zlyhalo (súbor je pravdepodobne príliš veľký).' });
    if (!req.file) return res.status(400).json({ error: 'Chýba súbor.' });
    const cleanup = () => fs.unlink(req.file.path, () => {});

    const rules = KIND_RULES[req.body.kind];
    if (!rules) { cleanup(); return res.status(400).json({ error: 'Neznámy typ súboru.' }); }
    if (!rules.mime.includes(req.file.mimetype)) { cleanup(); return res.status(400).json({ error: 'Nepodporovaný typ súboru.' }); }
    if (req.file.size > rules.max) { cleanup(); return res.status(400).json({ error: 'Súbor je príliš veľký (max ' + Math.round(rules.max / 1024 / 1024) + ' MB).' }); }

    const storagePath = `${req.instructor.id}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}${rules.ext[req.file.mimetype]}`;
    try {
      const stream = fs.createReadStream(req.file.path);
      const { error: upErr } = await mainDb.storage.from(BUCKET).upload(storagePath, stream, {
        contentType: req.file.mimetype, upsert: false, duplex: 'half'
      });
      if (upErr) { console.error(upErr); return res.status(500).json({ error: upErr.message }); }
      const { data: pub } = mainDb.storage.from(BUCKET).getPublicUrl(storagePath);
      res.json({ ok: true, url: pub.publicUrl });
    } catch (e) {
      res.status(500).json({ error: 'Nahrávanie zlyhalo.' });
    } finally {
      cleanup();
    }
  });
});

module.exports = router;
