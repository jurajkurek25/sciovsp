const { pool } = require('../db/pool');

// public.html hardcodes these same values client-side — the anon key is not a secret,
// it's meant to be exposed to the browser. Kept overridable via env for other environments.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zrnqiwareacqyndwchsv.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpybnFpd2FyZWFjcXluZHdjaHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMDA3NTAsImV4cCI6MjA4OTc3Njc1MH0.iUne23YDxp12Iwxdk9U8MfcV0NTBtrNf9OgsjQdiADk';

// Overuje token priamo cez Supabase Auth API (nezávisle od JWT_SECRET/requireAuth,
// ktorých vzťah k Supabase v tomto projekte nie je overený). Lazy-sync do lokálnej
// users tabuľky, aby cudzí kľúč video_ad_views.user_id mal na čo ukazovať.
async function requireSupabaseAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Chýba prihlásenie.' });

  try {
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY }
    });
    if (!resp.ok) return res.status(401).json({ error: 'Neplatný alebo expirovaný token.' });

    const supaUser = await resp.json();
    if (!supaUser?.id || !supaUser?.email) return res.status(401).json({ error: 'Neplatný token.' });

    let localUserId = supaUser.id;
    try {
      await pool.query(
        `INSERT INTO users (id, email, password_hash, verified) VALUES ($1, $2, '', TRUE) ON CONFLICT (id) DO NOTHING`,
        [supaUser.id, supaUser.email]
      );
    } catch (e) {
      // email UNIQUE clash s existujúcim (napr. legacy) riadkom — použi jeho id namiesto Supabase id
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [supaUser.email]);
      if (existing.rows[0]) localUserId = existing.rows[0].id;
      else throw e;
    }

    req.supaUser = { id: localUserId, email: supaUser.email };
    next();
  } catch (e) {
    console.error('supabase auth error:', e);
    res.status(401).json({ error: 'Neplatný alebo expirovaný token.' });
  }
}

module.exports = { requireSupabaseAuth };
