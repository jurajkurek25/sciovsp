const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('houseAdsRouter')) {
  console.error('Uz je aplikovane (najdene houseAdsRouter), nic som nezmenil.');
  process.exit(1);
}

// 1) require + wire router (rovnaky vzor ako automationRouter/prArticlesRouter).
const REQUIRE_OLD = `const { router: automationRouter } = require('./automation');`;
const REQUIRE_NEW = `const { router: automationRouter } = require('./automation');
const houseAdsRouter = require('./house-ads');`;
if (!src.includes(REQUIRE_OLD)) { console.error('Nenasiel som require automationRouter. Nic som nezmenil.'); process.exit(1); }

const WIRE_OLD = `app.use(prArticlesRouter);
app.use(automationRouter);`;
const WIRE_NEW = `app.use(prArticlesRouter);
app.use(automationRouter);
app.use(houseAdsRouter);`;
if (!src.includes(WIRE_OLD)) { console.error('Nenasiel som app.use(automationRouter). Nic som nezmenil.'); process.exit(1); }

// 2) banner serve - platene reklamy vzdy, interne len do zvysnej kapacity.
const SERVE_OLD = `app.get('/api/ads/serve', async (req, res) => {
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
const SERVE_NEW = `app.get('/api/ads/serve', async (req, res) => {
  try {
    const lang = ['sk', 'cz'].includes(req.query.lang) ? req.query.lang : null;
    const langClause = lang ? "AND (target_lang = 'both' OR target_lang = ?)" : '';
    const params = lang ? [lang] : [];
    const [rows] = await db.query(
      \`SELECT id, public_url, mime_type, is_house FROM ad_banners WHERE active = 1 AND status = 'active' AND current_period_end > NOW() \${langClause} ORDER BY is_house ASC, created_at DESC LIMIT 20\`,
      params
    );
    // Platene reklamy sa zobrazia vzdy vsetky, interne (is_house) len do
    // zvysnej kapacity MAX_ACTIVE_BANNERS — platiaci klient ma vzdy prednost.
    const paid = rows.filter(b => !b.is_house);
    const house = rows.filter(b => b.is_house);
    const remaining = Math.max(0, MAX_ACTIVE_BANNERS - paid.length);
    const shown = [...paid, ...house.slice(0, remaining)];
    res.json({ banners: shown.map(b => ({ id: b.id, url: b.public_url, mimeType: b.mime_type })) });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});`;
if (!src.includes(SERVE_OLD)) { console.error('Nenasiel som /api/ads/serve. Nic som nezmenil.'); process.exit(1); }

// 3) banner checkout kapacita - nepocitaj interne reklamy (nikdy neblokuju platiaceho klienta).
const BANNER_CAP_OLD = `const [[{ cnt }]] = await db.query("SELECT COUNT(*) AS cnt FROM ad_banners WHERE status = 'active' AND current_period_end > NOW()");
    if (cnt >= MAX_ACTIVE_BANNERS) {`;
const BANNER_CAP_NEW = `const [[{ cnt }]] = await db.query("SELECT COUNT(*) AS cnt FROM ad_banners WHERE status = 'active' AND current_period_end > NOW() AND is_house = 0");
    if (cnt >= MAX_ACTIVE_BANNERS) {`;
if (!src.includes(BANNER_CAP_OLD)) { console.error('Nenasiel som banner kapacitnu kontrolu. Nic som nezmenil.'); process.exit(1); }

// 4) video checkout kapacita - to iste.
const VIDEO_CAP_OLD = `const [[{ cnt }]] = await db.query("SELECT COUNT(*) AS cnt FROM video_ads WHERE status = 'active' AND current_period_end > NOW()");
    if (cnt >= MAX_ACTIVE_VIDEO_ADS) {`;
const VIDEO_CAP_NEW = `const [[{ cnt }]] = await db.query("SELECT COUNT(*) AS cnt FROM video_ads WHERE status = 'active' AND current_period_end > NOW() AND is_house = 0");
    if (cnt >= MAX_ACTIVE_VIDEO_ADS) {`;
if (!src.includes(VIDEO_CAP_OLD)) { console.error('Nenasiel som video kapacitnu kontrolu. Nic som nezmenil.'); process.exit(1); }

const patched = src
  .replace(REQUIRE_OLD, REQUIRE_NEW)
  .replace(WIRE_OLD, WIRE_NEW)
  .replace(SERVE_OLD, SERVE_NEW)
  .replace(BANNER_CAP_OLD, BANNER_CAP_NEW)
  .replace(VIDEO_CAP_OLD, VIDEO_CAP_NEW);

const backup = FILE + '.pre-house-ads-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
