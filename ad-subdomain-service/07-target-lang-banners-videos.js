// Pridáva targetLang (SK/CZ/oba) pri nahrávaní banneru aj video reklamy, a
// filtrovanie podľa jazyka v GET /api/ads/serve — súčasť delenia reklám
// podľa jazyka publika (SK vs CZ testovacia appka).
//
// Ak klient (hlavná appka) pošle ?lang=sk alebo ?lang=cz, /api/ads/serve
// vráti len bannery s target_lang='both' alebo zhodným jazykom. Bez
// ?lang= parametra sa správanie nemení (žiadny filter, spätná kompatibilita).
//
// Presný textový match proti overenému živému súboru server.js.
// Predpoklad: schema-target-lang.sql už bola spustená (stĺpec target_lang
// existuje).
//
// Spusti z /home/sptrener-ad/htdocs/ad.sptrener.online:
//   node /root/ad-subdomain-service/07-target-lang-banners-videos.js

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'server.js');
const src = fs.readFileSync(FILE_PATH, 'utf8');

if (src.includes('VALID_TARGET_LANGS')) {
  console.error('❌ Vyzerá to, že targetLang už je zapojený. Nič som nezmenil.');
  process.exit(1);
}

const OLD_CONST_BLOCK = `const MAX_ACTIVE_BANNERS = 4;
const MAX_ACTIVE_VIDEO_ADS = 3;`;

const NEW_CONST_BLOCK = `const MAX_ACTIVE_BANNERS = 4;
const MAX_ACTIVE_VIDEO_ADS = 3;
const VALID_TARGET_LANGS = ['sk', 'cz', 'both'];
function normalizeTargetLang(v) { return VALID_TARGET_LANGS.includes(v) ? v : 'both'; }`;

const OLD_BANNER_DESTRUCTURE = `    const { linkUrl } = req.body || {};
    if (!req.file) return res.status(400).json({ error: 'Chýba súbor.' });
    if (!BANNER_MIME.includes(req.file.mimetype)) return res.status(400).json({ error: 'Povolené sú PNG, GIF alebo MP4.' });
    if (req.file.size > MAX_BANNER_SIZE) return res.status(400).json({ error: 'Súbor je príliš veľký (max 8 MB).' });
    if (!linkUrl || !/^https?:\\/\\//.test(linkUrl)) return res.status(400).json({ error: 'Zadaj platnú cieľovú URL (vrátane https://).' });`;

const NEW_BANNER_DESTRUCTURE = `    const { linkUrl, targetLang } = req.body || {};
    if (!req.file) return res.status(400).json({ error: 'Chýba súbor.' });
    if (!BANNER_MIME.includes(req.file.mimetype)) return res.status(400).json({ error: 'Povolené sú PNG, GIF alebo MP4.' });
    if (req.file.size > MAX_BANNER_SIZE) return res.status(400).json({ error: 'Súbor je príliš veľký (max 8 MB).' });
    if (!linkUrl || !/^https?:\\/\\//.test(linkUrl)) return res.status(400).json({ error: 'Zadaj platnú cieľovú URL (vrátane https://).' });
    const finalTargetLang = normalizeTargetLang(targetLang);`;

const OLD_BANNER_INSERT = `      const [result] = await db.query(
        'INSERT INTO ad_banners (advertiser_id, public_url, mime_type, link_url) VALUES (?, ?, ?, ?)',
        [req.advertiser.id, publicUrl, req.file.mimetype, linkUrl]
      );`;

const NEW_BANNER_INSERT = `      const [result] = await db.query(
        'INSERT INTO ad_banners (advertiser_id, public_url, mime_type, link_url, target_lang) VALUES (?, ?, ?, ?, ?)',
        [req.advertiser.id, publicUrl, req.file.mimetype, linkUrl, finalTargetLang]
      );`;

const OLD_VIDEO_DESTRUCTURE = `    const { linkUrl, durationS } = req.body || {};
    if (!req.file) return res.status(400).json({ error: 'Chýba súbor.' });
    if (req.file.mimetype !== 'video/mp4') return res.status(400).json({ error: 'Povolené je len MP4.' });
    if (req.file.size > MAX_VIDEO_SIZE) return res.status(400).json({ error: 'Súbor je príliš veľký (max 25 MB).' });
    if (!linkUrl || !/^https?:\\/\\//.test(linkUrl)) return res.status(400).json({ error: 'Zadaj platnú cieľovú URL.' });
    const duration = parseInt(durationS, 10);
    if (!Number.isFinite(duration) || duration < MIN_VIDEO_DURATION || duration > MAX_VIDEO_DURATION) {
      return res.status(400).json({ error: \`Zadaj dĺžku videa v sekundách (\${MIN_VIDEO_DURATION}–\${MAX_VIDEO_DURATION}).\` });
    }`;

const NEW_VIDEO_DESTRUCTURE = `    const { linkUrl, durationS, targetLang } = req.body || {};
    if (!req.file) return res.status(400).json({ error: 'Chýba súbor.' });
    if (req.file.mimetype !== 'video/mp4') return res.status(400).json({ error: 'Povolené je len MP4.' });
    if (req.file.size > MAX_VIDEO_SIZE) return res.status(400).json({ error: 'Súbor je príliš veľký (max 25 MB).' });
    if (!linkUrl || !/^https?:\\/\\//.test(linkUrl)) return res.status(400).json({ error: 'Zadaj platnú cieľovú URL.' });
    const duration = parseInt(durationS, 10);
    if (!Number.isFinite(duration) || duration < MIN_VIDEO_DURATION || duration > MAX_VIDEO_DURATION) {
      return res.status(400).json({ error: \`Zadaj dĺžku videa v sekundách (\${MIN_VIDEO_DURATION}–\${MAX_VIDEO_DURATION}).\` });
    }
    const finalTargetLang = normalizeTargetLang(targetLang);`;

const OLD_VIDEO_INSERT = `      const [result] = await db.query(
        'INSERT INTO video_ads (advertiser_id, public_url, mime_type, duration_s, link_url) VALUES (?, ?, ?, ?, ?)',
        [req.advertiser.id, publicUrl, 'video/mp4', duration, linkUrl]
      );`;

const NEW_VIDEO_INSERT = `      const [result] = await db.query(
        'INSERT INTO video_ads (advertiser_id, public_url, mime_type, duration_s, link_url, target_lang) VALUES (?, ?, ?, ?, ?, ?)',
        [req.advertiser.id, publicUrl, 'video/mp4', duration, linkUrl, finalTargetLang]
      );`;

const OLD_SERVE = `app.get('/api/ads/serve', async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, public_url, mime_type FROM ad_banners WHERE active = 1 AND status = 'active' AND current_period_end > NOW() ORDER BY created_at DESC LIMIT 20"
    );
    res.json({ banners: rows.map(b => ({ id: b.id, url: b.public_url, mimeType: b.mime_type })) });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});`;

const NEW_SERVE = `app.get('/api/ads/serve', async (req, res) => {
  try {
    const lang = ['sk', 'cz'].includes(req.query.lang) ? req.query.lang : null;
    const langClause = lang ? "AND (target_lang = 'both' OR target_lang = ?)" : '';
    const params = lang ? [lang] : [];
    const [rows] = await db.query(
      \`SELECT id, public_url, mime_type FROM ad_banners WHERE active = 1 AND status = 'active' AND current_period_end > NOW() \${langClause} ORDER BY created_at DESC LIMIT 20\`,
      params
    );
    res.json({ banners: rows.map(b => ({ id: b.id, url: b.public_url, mimeType: b.mime_type })) });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});`;

const REPLACEMENTS = [
  ['const block', OLD_CONST_BLOCK, NEW_CONST_BLOCK],
  ['banner destructure', OLD_BANNER_DESTRUCTURE, NEW_BANNER_DESTRUCTURE],
  ['banner insert', OLD_BANNER_INSERT, NEW_BANNER_INSERT],
  ['video destructure', OLD_VIDEO_DESTRUCTURE, NEW_VIDEO_DESTRUCTURE],
  ['video insert', OLD_VIDEO_INSERT, NEW_VIDEO_INSERT],
  ['serve route', OLD_SERVE, NEW_SERVE]
];

for (const [name, needle] of REPLACEMENTS) {
  if (!src.includes(needle)) {
    console.error(`❌ Nenašiel som presný očakávaný blok "${name}" v server.js. Nič som nezmenil.`);
    process.exit(1);
  }
}

const backupPath = FILE_PATH + '.pre-target-lang-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
let out = src;
for (const [, oldStr, newStr] of REPLACEMENTS) {
  out = out.replace(oldStr, newStr);
}
fs.writeFileSync(FILE_PATH, out);

console.log('✅ targetLang (SK/CZ/oba) zapojený do upload endpointov a /api/ads/serve.');
console.log('   Záloha pôvodného server.js:', backupPath);
console.log('   Over syntax: node -c server.js');
