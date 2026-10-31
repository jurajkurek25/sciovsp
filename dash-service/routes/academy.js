// Editor obsahu Partner Akadémie — priamy CRUD nad partner_academy_lessons
// (rovnaká tabuľka, z ktorej číta partner app cez /api/partner/academy).
const express = require('express');
const router = express.Router();
const { requireDashAuth } = require('../lib/auth');
const { supabase } = require('../lib/db-partner');

router.get('/api/dash/academy', requireDashAuth, async (req, res) => {
  const { data, error } = await supabase.from('partner_academy_lessons').select('*').order('sort_order');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ lessons: data || [] });
});

router.put('/api/dash/academy/:id', requireDashAuth, async (req, res) => {
  const { title, content, minutes, sortOrder } = req.body;
  const update = { updated_at: new Date().toISOString() };
  if (title !== undefined) update.title = title;
  if (content !== undefined) update.content = content;
  if (minutes !== undefined) update.minutes = minutes;
  if (sortOrder !== undefined) update.sort_order = sortOrder;
  const { data, error } = await supabase.from('partner_academy_lessons').update(update).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, lesson: data });
});

router.post('/api/dash/academy', requireDashAuth, async (req, res) => {
  const { lessonKey, title, content, minutes, sortOrder } = req.body;
  if (!lessonKey || !title || !content) return res.status(400).json({ error: 'Chýba lessonKey, title alebo content.' });
  const { data, error } = await supabase.from('partner_academy_lessons').insert({
    lesson_key: lessonKey, title, content, minutes: minutes || 3, sort_order: sortOrder || 0
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, lesson: data });
});

router.delete('/api/dash/academy/:id', requireDashAuth, async (req, res) => {
  const { error } = await supabase.from('partner_academy_lessons').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;
