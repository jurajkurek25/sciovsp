const express = require('express');
const router = express.Router();
const { randomBytes } = require('crypto');
const { pool } = require('../db/pool');
const { requireSupabaseAuth } = require('../middleware/supabaseAuth');

const DAILY_LIMIT = 3;
// Tolerancia voči sieťovému/eventovému oneskoreniu medzi 'ended' na videu a naším /complete volaním
const GRACE_MS = 1500;

async function isPremium(userId) {
  const { rows } = await pool.query(
    'SELECT plan, status, current_period_end FROM subscriptions WHERE user_id = $1',
    [userId]
  );
  const sub = rows[0];
  if (!sub) return false;
  return sub.plan === 'pro' && sub.status === 'active' &&
    (!sub.current_period_end || new Date(sub.current_period_end) > new Date());
}

async function todaysRewardCount(userId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM video_ad_views
     WHERE user_id = $1 AND reward_granted = TRUE AND completed_at::date = CURRENT_DATE`,
    [userId]
  );
  return rows[0].n;
}

// GET /api/rewards/video-status — má zmysel ponúknuť used-up free userovi možnosť pozrieť reklamu za test?
router.get('/api/rewards/video-status', requireSupabaseAuth, async (req, res) => {
  try {
    if (await isPremium(req.supaUser.id)) return res.json({ available: false, dailyRemaining: 0 });

    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM video_ads
       WHERE active = TRUE AND status = 'active' AND (current_period_end IS NULL OR current_period_end > NOW())`
    );
    const hasVideoAd = rows[0].n > 0;
    const used = await todaysRewardCount(req.supaUser.id);
    const dailyRemaining = Math.max(0, DAILY_LIMIT - used);

    res.json({ available: hasVideoAd && dailyRemaining > 0, dailyRemaining });
  } catch (e) {
    console.error('rewards status error:', e);
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

// POST /api/rewards/video/start — vyberie náhodné aktívne video, vydá anti-cheat session token
router.post('/api/rewards/video/start', requireSupabaseAuth, async (req, res) => {
  try {
    if (await isPremium(req.supaUser.id)) return res.status(400).json({ error: 'Premium účet nepotrebuje bonus testy.' });

    const used = await todaysRewardCount(req.supaUser.id);
    if (used >= DAILY_LIMIT) {
      return res.status(429).json({ error: `Dnes si už vyčerpal denný limit ${DAILY_LIMIT} bonus testov za reklamu.` });
    }

    const { rows } = await pool.query(
      `SELECT id, mime_type, duration_s, link_url FROM video_ads
       WHERE active = TRUE AND status = 'active' AND (current_period_end IS NULL OR current_period_end > NOW())
       ORDER BY RANDOM() LIMIT 1`
    );
    const ad = rows[0];
    if (!ad) return res.status(404).json({ error: 'Momentálne nemáme dostupnú video reklamu.' });

    const sessionToken = randomBytes(24).toString('hex');
    await pool.query(
      `INSERT INTO video_ad_views (video_ad_id, user_id, session_token) VALUES ($1, $2, $3)`,
      [ad.id, req.supaUser.id, sessionToken]
    );

    res.json({
      sessionToken,
      videoAdId: ad.id,
      durationS: ad.duration_s,
      fileUrl: '/api/video-ads/file/' + ad.id,
      linkUrl: ad.link_url
    });
  } catch (e) {
    console.error('rewards start error:', e);
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

// POST /api/rewards/video/complete — overí, že reálne uplynul čas >= dĺžke videa, prizná bonus test
router.post('/api/rewards/video/complete', requireSupabaseAuth, async (req, res) => {
  const { sessionToken } = req.body || {};
  if (!sessionToken) return res.status(400).json({ error: 'Chýba session token.' });

  try {
    const { rows } = await pool.query(
      `SELECT w.id, w.started_at, w.completed_at, v.duration_s
       FROM video_ad_views w
       JOIN video_ads v ON v.id = w.video_ad_id
       WHERE w.session_token = $1 AND w.user_id = $2`,
      [sessionToken, req.supaUser.id]
    );
    const view = rows[0];
    if (!view) return res.status(404).json({ error: 'Neplatná session.' });
    if (view.completed_at) return res.status(400).json({ error: 'Táto reklama už bola vyhodnotená.' });

    const elapsedMs = Date.now() - new Date(view.started_at).getTime();
    if (elapsedMs < view.duration_s * 1000 - GRACE_MS) {
      return res.status(400).json({ error: 'Video nebolo dopozreté celé.' });
    }

    const used = await todaysRewardCount(req.supaUser.id);
    if (used >= DAILY_LIMIT) {
      await pool.query('UPDATE video_ad_views SET completed_at = NOW() WHERE id = $1', [view.id]);
      return res.status(429).json({ error: `Dnes si už vyčerpal denný limit ${DAILY_LIMIT} bonus testov za reklamu.` });
    }

    await pool.query(
      'UPDATE video_ad_views SET completed_at = NOW(), reward_granted = TRUE WHERE id = $1',
      [view.id]
    );

    res.json({ allowed: true, dailyRemaining: Math.max(0, DAILY_LIMIT - used - 1) });
  } catch (e) {
    console.error('rewards complete error:', e);
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

module.exports = router;
