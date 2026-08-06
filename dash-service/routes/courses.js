// Editor video kurzov (sptrener.online/kurzy) — CRUD nad courses + course_lessons
// v hlavnej appke. Kurz = jednorázová platba 57 €, lekcie = video + PDF + kvíz
// (jedna otázka A/B/C/D), postupné odomykanie po správnej odpovedi.
const express = require('express');
const router = express.Router();
const { requireDashAuth } = require('../lib/auth');
const { supabase: mainDb } = require('../lib/db-main');

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

router.get('/api/dash/courses', requireDashAuth, async (req, res) => {
  const { data: courses, error } = await mainDb.from('courses').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  const withCounts = await Promise.all((courses || []).map(async c => {
    const { count: lessonCount } = await mainDb.from('course_lessons').select('*', { count: 'exact', head: true }).eq('course_id', c.id);
    const { count: purchaseCount } = await mainDb.from('course_purchases').select('*', { count: 'exact', head: true }).eq('course_id', c.id);
    return { ...c, lessonCount: lessonCount || 0, purchaseCount: purchaseCount || 0 };
  }));
  res.json({ courses: withCounts });
});

router.post('/api/dash/courses', requireDashAuth, async (req, res) => {
  const { title, description, priceCents, coverImageUrl } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Chýba title.' });
  let slug = slugify(title);
  if (!slug) return res.status(400).json({ error: 'Z názvu sa nedá vytvoriť slug.' });
  const { data: existing } = await mainDb.from('courses').select('id').eq('slug', slug);
  if ((existing || []).length) slug = `${slug}-${Date.now().toString(36)}`;
  const { data, error } = await mainDb.from('courses').insert({
    slug, title, description: description || '', price_cents: Number(priceCents) || 5700,
    cover_image_url: coverImageUrl || null, published: false
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, course: data });
});

router.put('/api/dash/courses/:id', requireDashAuth, async (req, res) => {
  const { title, description, priceCents, coverImageUrl, published } = req.body || {};
  const update = {};
  if (title !== undefined) update.title = title;
  if (description !== undefined) update.description = description;
  if (priceCents !== undefined) update.price_cents = Number(priceCents);
  if (coverImageUrl !== undefined) update.cover_image_url = coverImageUrl;
  if (published !== undefined) update.published = !!published;
  const { data, error } = await mainDb.from('courses').update(update).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, course: data });
});

router.delete('/api/dash/courses/:id', requireDashAuth, async (req, res) => {
  const { error } = await mainDb.from('courses').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

router.get('/api/dash/courses/:id/lessons', requireDashAuth, async (req, res) => {
  const { data, error } = await mainDb.from('course_lessons').select('*').eq('course_id', req.params.id).order('sort_order');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ lessons: data || [] });
});

router.post('/api/dash/courses/:id/lessons', requireDashAuth, async (req, res) => {
  const { title, videoUrl, docUrl, quizQuestion, quizOptionA, quizOptionB, quizOptionC, quizOptionD, quizCorrect, sortOrder } = req.body || {};
  if (!title || !videoUrl) return res.status(400).json({ error: 'Chýba title alebo videoUrl.' });
  if (quizCorrect && !['a', 'b', 'c', 'd'].includes(quizCorrect)) return res.status(400).json({ error: 'quizCorrect musí byť a/b/c/d.' });
  let order = sortOrder;
  if (order === undefined || order === null) {
    const { data: existing } = await mainDb.from('course_lessons').select('sort_order').eq('course_id', req.params.id).order('sort_order', { ascending: false }).limit(1);
    order = existing?.[0] ? existing[0].sort_order + 1 : 0;
  }
  const { data, error } = await mainDb.from('course_lessons').insert({
    course_id: req.params.id, title, video_url: videoUrl, doc_url: docUrl || null,
    quiz_question: quizQuestion || null, quiz_option_a: quizOptionA || null, quiz_option_b: quizOptionB || null,
    quiz_option_c: quizOptionC || null, quiz_option_d: quizOptionD || null, quiz_correct: quizCorrect || null,
    sort_order: order
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, lesson: data });
});

router.put('/api/dash/courses/:id/lessons/:lessonId', requireDashAuth, async (req, res) => {
  const { title, videoUrl, docUrl, quizQuestion, quizOptionA, quizOptionB, quizOptionC, quizOptionD, quizCorrect, sortOrder } = req.body || {};
  if (quizCorrect && !['a', 'b', 'c', 'd'].includes(quizCorrect)) return res.status(400).json({ error: 'quizCorrect musí byť a/b/c/d.' });
  const update = {};
  if (title !== undefined) update.title = title;
  if (videoUrl !== undefined) update.video_url = videoUrl;
  if (docUrl !== undefined) update.doc_url = docUrl;
  if (quizQuestion !== undefined) update.quiz_question = quizQuestion;
  if (quizOptionA !== undefined) update.quiz_option_a = quizOptionA;
  if (quizOptionB !== undefined) update.quiz_option_b = quizOptionB;
  if (quizOptionC !== undefined) update.quiz_option_c = quizOptionC;
  if (quizOptionD !== undefined) update.quiz_option_d = quizOptionD;
  if (quizCorrect !== undefined) update.quiz_correct = quizCorrect;
  if (sortOrder !== undefined) update.sort_order = sortOrder;
  const { data, error } = await mainDb.from('course_lessons').update(update).eq('id', req.params.lessonId).eq('course_id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, lesson: data });
});

router.delete('/api/dash/courses/:id/lessons/:lessonId', requireDashAuth, async (req, res) => {
  const { error } = await mainDb.from('course_lessons').delete().eq('id', req.params.lessonId).eq('course_id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;
