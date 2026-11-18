// Zákaz používania celej appky (duplicitné účty zneužívajúce bezplatné AI
// testy) — samostatné od users.community_banned_at v routes/community.js,
// ktoré rieši len prístup do komunity. Rovnaký vzor ako community.js:
// priamy zápis do hlavného Supabase projektu cez service-role kľúč.
const express = require('express');
const router = express.Router();
const { requireDashAuth } = require('../lib/auth');
const { supabase: mainDb } = require('../lib/db-main');

router.get('/api/dash/users/search', requireDashAuth, async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.json({ users: [] });
  const { data: users, error } = await mainDb.from('users')
    .select('email, created_at, is_premium, plan, trial_count, app_banned_at, app_ban_reason')
    .ilike('email', `%${q}%`)
    .order('created_at', { ascending: false })
    .limit(25);
  if (error) { console.error('users route error:', error); return res.status(500).json({ error: error.message }); }
  res.json({ users });
});

router.post('/api/dash/users/:email/ban', requireDashAuth, async (req, res) => {
  const reason = (req.body?.reason || 'Duplicitný účet').toString().slice(0, 500);
  const { error } = await mainDb.from('users').update({
    app_banned_at: new Date().toISOString(),
    app_ban_reason: reason
  }).eq('email', req.params.email);
  if (error) { console.error('users route error:', error); return res.status(500).json({ error: error.message }); }
  res.json({ ok: true });
});

router.post('/api/dash/users/:email/unban', requireDashAuth, async (req, res) => {
  const { error } = await mainDb.from('users').update({
    app_banned_at: null,
    app_ban_reason: null
  }).eq('email', req.params.email);
  if (error) { console.error('users route error:', error); return res.status(500).json({ error: error.message }); }
  res.json({ ok: true });
});

module.exports = router;
