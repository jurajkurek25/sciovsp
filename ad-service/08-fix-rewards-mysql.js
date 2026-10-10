// Prepája rewards flow (pozri video, získaj +1 test) v hlavnej appke na
// MySQL databázu "reklama" namiesto Supabase — video reklamy tam teraz
// žijú (spravuje ich ad-service), takže hlavná appka ich musí hľadať tam.
// users/is_premium/trial_count zostávajú v Supabase — nemenia sa.
//
// Predpoklad: v hlavnej appke je nainštalovaný balík mysql2
// (npm install mysql2) a .env má MYSQL_HOST/PORT/DATABASE/USER/PASSWORD
// (rovnaké ako ad-service, zdieľaná databáza).
//
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online:
//   node /root/ad-service/08-fix-rewards-mysql.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
const src = fs.readFileSync(SERVER_PATH, 'utf8');

const OLD_BLOCK = `// ─── Rewards — pozri video, získaj +1 test (max 3×/deň) ────────
// Integruje sa priamo do existujúceho trial_count na users — po
// overenom dopozretí ho jednoducho o 1 znížime, žiadny nový stĺpec.

async function getSupaUserEmail(req) {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.email;
}

async function todaysRewardCount(email) {
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const { count } = await supabase.from('video_ad_views').select('*', { count: 'exact', head: true })
    .eq('user_email', email).eq('reward_granted', true).gte('completed_at', startOfDay.toISOString());
  return count || 0;
}

app.get('/api/rewards/video-status', rateLimit, async (req, res) => {
  const email = await getSupaUserEmail(req);
  if (!email) return res.status(401).json({ error: 'Chýba prihlásenie.' });
  try {
    const { data: user } = await supabase.from('users').select('is_premium, premium_expires_at').eq('email', email).single();
    const bonusActive = user?.premium_expires_at && new Date(user.premium_expires_at) > new Date();
    if (user?.is_premium || bonusActive) return res.json({ available: false, dailyRemaining: 0 });

    const { count: adsAvailable } = await supabase.from('video_ads').select('*', { count: 'exact', head: true })
      .eq('active', true).eq('status', 'active').gt('current_period_end', new Date().toISOString());
    const used = await todaysRewardCount(email);
    const dailyRemaining = Math.max(0, DAILY_REWARD_LIMIT - used);
    res.json({ available: (adsAvailable || 0) > 0 && dailyRemaining > 0, dailyRemaining });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.post('/api/rewards/video/start', rateLimit, async (req, res) => {
  const email = await getSupaUserEmail(req);
  if (!email) return res.status(401).json({ error: 'Chýba prihlásenie.' });
  try {
    const used = await todaysRewardCount(email);
    if (used >= DAILY_REWARD_LIMIT) return res.status(429).json({ error: \`Dnes si už vyčerpal denný limit \${DAILY_REWARD_LIMIT} bonus testov za reklamu.\` });

    const { data: ads } = await supabase.from('video_ads').select('id, public_url, duration_s, link_url')
      .eq('active', true).eq('status', 'active').gt('current_period_end', new Date().toISOString());
    if (!ads || !ads.length) return res.status(404).json({ error: 'Momentálne nemáme dostupnú video reklamu.' });
    const ad = ads[Math.floor(Math.random() * ads.length)];

    const sessionToken = require('crypto').randomBytes(24).toString('hex');
    await supabase.from('video_ad_views').insert({ video_ad_id: ad.id, user_email: email, session_token: sessionToken });

    res.json({ sessionToken, videoAdId: ad.id, durationS: ad.duration_s, fileUrl: ad.public_url, linkUrl: ad.link_url });
  } catch (e) {
    console.error('reward start error:', e);
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.post('/api/rewards/video/complete', rateLimit, async (req, res) => {
  const email = await getSupaUserEmail(req);
  if (!email) return res.status(401).json({ error: 'Chýba prihlásenie.' });
  const { sessionToken } = req.body || {};
  if (!sessionToken) return res.status(400).json({ error: 'Chýba session token.' });

  try {
    const { data: view } = await supabase.from('video_ad_views').select('id, started_at, completed_at, video_ad_id').eq('session_token', sessionToken).eq('user_email', email).single();
    if (!view) return res.status(404).json({ error: 'Neplatná session.' });
    if (view.completed_at) return res.status(400).json({ error: 'Táto reklama už bola vyhodnotená.' });

    const { data: ad } = await supabase.from('video_ads').select('duration_s').eq('id', view.video_ad_id).single();
    const elapsedMs = Date.now() - new Date(view.started_at).getTime();
    if (elapsedMs < ad.duration_s * 1000 - REWARD_GRACE_MS) {
      return res.status(400).json({ error: 'Video nebolo dopozreté celé.' });
    }

    const used = await todaysRewardCount(email);
    if (used >= DAILY_REWARD_LIMIT) {
      await supabase.from('video_ad_views').update({ completed_at: new Date().toISOString() }).eq('id', view.id);
      return res.status(429).json({ error: \`Dnes si už vyčerpal denný limit \${DAILY_REWARD_LIMIT} bonus testov za reklamu.\` });
    }

    await supabase.from('video_ad_views').update({ completed_at: new Date().toISOString(), reward_granted: true }).eq('id', view.id);

    // Odmena = zníž trial_count o 1 (min. 0), nech ďalší /api/trial/check znova prejde
    const { data: user } = await supabase.from('users').select('trial_count').eq('email', email).single();
    if (user) {
      await supabase.from('users').update({ trial_count: Math.max(0, (user.trial_count || 0) - 1) }).eq('email', email);
    }

    res.json({ allowed: true, dailyRemaining: Math.max(0, DAILY_REWARD_LIMIT - used - 1) });
  } catch (e) {
    console.error('reward complete error:', e);
    res.status(500).json({ error: 'Chyba servera.' });
  }
});`;

const NEW_BLOCK = `// ─── Rewards — pozri video, získaj +1 test (max 3×/deň) ────────
// Integruje sa priamo do existujúceho trial_count na users — po
// overenom dopozretí ho jednoducho o 1 znížime, žiadny nový stĺpec.
// Video reklamy žijú v MySQL databáze "reklama" (spravuje ich ad-service
// na ad.sptrener.online) — users/trial_count zostávajú v Supabase.

const mysql = require('mysql2/promise');
const adsDb = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT) || 3306,
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  waitForConnections: true,
  connectionLimit: 5,
  dateStrings: true
});
const AD_SERVICE_ORIGIN = process.env.AD_APP_URL || 'https://ad.sptrener.online';

async function getSupaUserEmail(req) {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.email;
}

async function todaysRewardCount(email) {
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const [[{ cnt }]] = await adsDb.query(
    'SELECT COUNT(*) AS cnt FROM video_ad_views WHERE user_email = ? AND reward_granted = 1 AND completed_at >= ?',
    [email, startOfDay]
  );
  return cnt || 0;
}

app.get('/api/rewards/video-status', rateLimit, async (req, res) => {
  const email = await getSupaUserEmail(req);
  if (!email) return res.status(401).json({ error: 'Chýba prihlásenie.' });
  try {
    const { data: user } = await supabase.from('users').select('is_premium, premium_expires_at').eq('email', email).single();
    const bonusActive = user?.premium_expires_at && new Date(user.premium_expires_at) > new Date();
    if (user?.is_premium || bonusActive) return res.json({ available: false, dailyRemaining: 0 });

    const [[{ cnt: adsAvailable }]] = await adsDb.query(
      "SELECT COUNT(*) AS cnt FROM video_ads WHERE active = 1 AND status = 'active' AND current_period_end > NOW()"
    );
    const used = await todaysRewardCount(email);
    const dailyRemaining = Math.max(0, DAILY_REWARD_LIMIT - used);
    res.json({ available: (adsAvailable || 0) > 0 && dailyRemaining > 0, dailyRemaining });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.post('/api/rewards/video/start', rateLimit, async (req, res) => {
  const email = await getSupaUserEmail(req);
  if (!email) return res.status(401).json({ error: 'Chýba prihlásenie.' });
  try {
    const used = await todaysRewardCount(email);
    if (used >= DAILY_REWARD_LIMIT) return res.status(429).json({ error: \`Dnes si už vyčerpal denný limit \${DAILY_REWARD_LIMIT} bonus testov za reklamu.\` });

    const [ads] = await adsDb.query(
      "SELECT id, public_url, duration_s, link_url FROM video_ads WHERE active = 1 AND status = 'active' AND current_period_end > NOW()"
    );
    if (!ads || !ads.length) return res.status(404).json({ error: 'Momentálne nemáme dostupnú video reklamu.' });
    const ad = ads[Math.floor(Math.random() * ads.length)];

    const sessionToken = require('crypto').randomBytes(24).toString('hex');
    await adsDb.query(
      'INSERT INTO video_ad_views (video_ad_id, user_email, session_token) VALUES (?, ?, ?)',
      [ad.id, email, sessionToken]
    );

    res.json({ sessionToken, videoAdId: ad.id, durationS: ad.duration_s, fileUrl: AD_SERVICE_ORIGIN + ad.public_url, linkUrl: ad.link_url });
  } catch (e) {
    console.error('reward start error:', e);
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.post('/api/rewards/video/complete', rateLimit, async (req, res) => {
  const email = await getSupaUserEmail(req);
  if (!email) return res.status(401).json({ error: 'Chýba prihlásenie.' });
  const { sessionToken } = req.body || {};
  if (!sessionToken) return res.status(400).json({ error: 'Chýba session token.' });

  try {
    const [viewRows] = await adsDb.query(
      'SELECT id, started_at, completed_at, video_ad_id FROM video_ad_views WHERE session_token = ? AND user_email = ?',
      [sessionToken, email]
    );
    const view = viewRows[0];
    if (!view) return res.status(404).json({ error: 'Neplatná session.' });
    if (view.completed_at) return res.status(400).json({ error: 'Táto reklama už bola vyhodnotená.' });

    const [adRows] = await adsDb.query('SELECT duration_s FROM video_ads WHERE id = ?', [view.video_ad_id]);
    const ad = adRows[0];
    const elapsedMs = Date.now() - new Date(view.started_at).getTime();
    if (elapsedMs < ad.duration_s * 1000 - REWARD_GRACE_MS) {
      return res.status(400).json({ error: 'Video nebolo dopozreté celé.' });
    }

    const used = await todaysRewardCount(email);
    if (used >= DAILY_REWARD_LIMIT) {
      await adsDb.query('UPDATE video_ad_views SET completed_at = NOW() WHERE id = ?', [view.id]);
      return res.status(429).json({ error: \`Dnes si už vyčerpal denný limit \${DAILY_REWARD_LIMIT} bonus testov za reklamu.\` });
    }

    await adsDb.query('UPDATE video_ad_views SET completed_at = NOW(), reward_granted = 1 WHERE id = ?', [view.id]);

    // Odmena = zníž trial_count o 1 (min. 0), nech ďalší /api/trial/check znova prejde
    const { data: user } = await supabase.from('users').select('trial_count').eq('email', email).single();
    if (user) {
      await supabase.from('users').update({ trial_count: Math.max(0, (user.trial_count || 0) - 1) }).eq('email', email);
    }

    res.json({ allowed: true, dailyRemaining: Math.max(0, DAILY_REWARD_LIMIT - used - 1) });
  } catch (e) {
    console.error('reward complete error:', e);
    res.status(500).json({ error: 'Chyba servera.' });
  }
});`;

if (!src.includes(OLD_BLOCK)) {
  if (src.includes('adsDb = mysql.createPool')) {
    console.error('❌ Vyzerá to, že oprava je už aplikovaná (adsDb pool sa už v súbore nachádza). Nič som nezmenil.');
  } else {
    console.error('❌ Nenašiel som očakávaný pôvodný rewards blok presne — nič som nezmenil. Over ručne.');
  }
  process.exit(1);
}

const backupPath = SERVER_PATH + '.pre-rewards-mysql-fix-' + Date.now();
fs.copyFileSync(SERVER_PATH, backupPath);
fs.writeFileSync(SERVER_PATH, src.replace(OLD_BLOCK, NEW_BLOCK));

console.log('✅ Rewards flow prepojený na MySQL databázu "reklama".');
console.log('   Záloha pôvodného server.js:', backupPath);
console.log('   Teraz over syntax: node -c server.js');
