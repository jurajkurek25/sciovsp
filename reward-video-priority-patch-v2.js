const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('paidAds = ads.filter')) {
  console.error('Uz je aplikovane (najdene paidAds = ads.filter), nic som nezmenil.');
  process.exit(1);
}

if (!src.includes('const MAX_ACTIVE_VIDEO_ADS')) {
  console.error('MAX_ACTIVE_VIDEO_ADS uz neexistuje v subore — over rucne, kod sa mohol zmenit. Nic som nezmenil.');
  process.exit(1);
}

const START_OLD = `    const [ads] = await adsDb.query(
      \`SELECT id, public_url, duration_s, link_url FROM video_ads WHERE active = 1 AND status = 'active' AND current_period_end > NOW() \${startLangClause}\`,
      startLangParams
    );
    if (!ads || !ads.length) return res.status(404).json({ error: 'Momentálne nemáme dostupnú video reklamu.' });
    const ad = ads[Math.floor(Math.random() * ads.length)];`;
if (!src.includes(START_OLD)) { console.error('Nenasiel som /api/rewards/video/start vyber reklamy. Nic som nezmenil.'); process.exit(1); }
const START_NEW = `    const [ads] = await adsDb.query(
      \`SELECT id, public_url, duration_s, link_url, is_house FROM video_ads WHERE active = 1 AND status = 'active' AND current_period_end > NOW() \${startLangClause}\`,
      startLangParams
    );
    if (!ads || !ads.length) return res.status(404).json({ error: 'Momentálne nemáme dostupnú video reklamu.' });
    // Platene video reklamy maju vzdy prednost — interne (is_house) doplnaju
    // len zvysnu kapacitu MAX_ACTIVE_VIDEO_ADS, rovnaky princip ako v ad-service.
    const paidAds = ads.filter(a => !a.is_house);
    const houseAds = ads.filter(a => a.is_house);
    const remaining = Math.max(0, MAX_ACTIVE_VIDEO_ADS - paidAds.length);
    const pool = [...paidAds, ...houseAds.slice(0, remaining)];
    const ad = pool[Math.floor(Math.random() * pool.length)];`;

const patched = src.replace(START_OLD, START_NEW);

const backup = FILE + '.pre-reward-video-priority-v2-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
