// Moderácia študentskej komunity (routes/community.js v hlavnej appke) —
// mazanie príspevkov/komentárov a blokovanie používateľov. Rovnaký vzor
// ako routes/webinar.js a routes/reviews.js: číta/zapisuje priamo do
// hlavného Supabase projektu cez service-role kľúč (db-main.js).
const express = require('express');
const router = express.Router();
const { requireDashAuth } = require('../lib/auth');
const { supabase: mainDb } = require('../lib/db-main');

router.get('/api/dash/community/posts', requireDashAuth, async (req, res) => {
  const { data: posts, error } = await mainDb.from('community_posts').select('*').is('deleted_at', null).order('created_at', { ascending: false }).limit(200);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ posts });
});

router.delete('/api/dash/community/posts/:id', requireDashAuth, async (req, res) => {
  const { error } = await mainDb.from('community_posts').update({ deleted_at: new Date().toISOString() }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

router.get('/api/dash/community/comments', requireDashAuth, async (req, res) => {
  const { data: comments, error } = await mainDb.from('community_comments').select('*').is('deleted_at', null).order('created_at', { ascending: false }).limit(200);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ comments });
});

router.delete('/api/dash/community/comments/:id', requireDashAuth, async (req, res) => {
  const { error } = await mainDb.from('community_comments').update({ deleted_at: new Date().toISOString() }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

router.post('/api/dash/community/users/:email/ban', requireDashAuth, async (req, res) => {
  const { error } = await mainDb.from('users').update({ community_banned_at: new Date().toISOString() }).eq('email', req.params.email);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

router.post('/api/dash/community/users/:email/unban', requireDashAuth, async (req, res) => {
  const { error } = await mainDb.from('users').update({ community_banned_at: null }).eq('email', req.params.email);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;
