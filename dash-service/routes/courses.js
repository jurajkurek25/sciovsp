// Editor video kurzov (sptrener.online/kurzy) — CRUD nad courses + course_lessons
// v hlavnej appke. Kurz = jednorázová platba 57 €, lekcie = video + PDF + kvíz
// (viacero otázok A/B/C/D na lekciu) a/alebo nahratie materiálu, ktoré
// vyhodnotí AI. "aiGradingCriteria" sú skryté kritériá pre AI, ktoré žiak
// nikdy nevidí — samostatné od "uploadInstructions" (tie žiak vidí).
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

function validateQuizQuestions(quizQuestions) {
  if (quizQuestions === undefined) return null;
  if (!Array.isArray(quizQuestions)) return 'quizQuestions musí byť pole.';
  for (const q of quizQuestions) {
    if (!q || !q.question) return 'Každá otázka musí mať text.';
    if (!['a', 'b', 'c', 'd'].includes(q.correct)) return 'Každá otázka musí mať správnu odpoveď a/b/c/d.';
  }
  return null;
}

async function replaceQuizQuestions(lessonId, quizQuestions) {
  await mainDb.from('course_lesson_quiz_questions').delete().eq('lesson_id', lessonId);
  if (!Array.isArray(quizQuestions) || !quizQuestions.length) return;
  const rows = quizQuestions.map((q, i) => ({
    lesson_id: lessonId, sort_order: i, question: q.question,
    option_a: q.optionA || null, option_b: q.optionB || null,
    option_c: q.optionC || null, option_d: q.optionD || null,
    correct: q.correct
  }));
  await mainDb.from('course_lesson_quiz_questions').insert(rows);
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
  const { title, description, priceCents, coverImageUrl, salesContent } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Chýba title.' });
  let slug = slugify(title);
  if (!slug) return res.status(400).json({ error: 'Z názvu sa nedá vytvoriť slug.' });
  const { data: existing } = await mainDb.from('courses').select('id').eq('slug', slug);
  if ((existing || []).length) slug = `${slug}-${Date.now().toString(36)}`;
  const priceCentsValue = priceCents === undefined || priceCents === null || priceCents === ''
    ? 5700 : Math.max(0, Number(priceCents) || 0);
  const { data, error } = await mainDb.from('courses').insert({
    slug, title, description: description || '', price_cents: priceCentsValue,
    cover_image_url: coverImageUrl || null, sales_content: salesContent || null, published: false
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, course: data });
});

router.put('/api/dash/courses/:id', requireDashAuth, async (req, res) => {
  const { title, description, priceCents, coverImageUrl, salesContent, published } = req.body || {};
  const update = {};
  if (title !== undefined) update.title = title;
  if (description !== undefined) update.description = description;
  if (priceCents !== undefined) update.price_cents = Number(priceCents);
  if (coverImageUrl !== undefined) update.cover_image_url = coverImageUrl;
  if (salesContent !== undefined) update.sales_content = salesContent;
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
  const { data: lessons, error } = await mainDb.from('course_lessons').select('*').eq('course_id', req.params.id).order('sort_order');
  if (error) return res.status(500).json({ error: error.message });
  const withQuiz = await Promise.all((lessons || []).map(async l => {
    const { data: qs } = await mainDb.from('course_lesson_quiz_questions').select('*').eq('lesson_id', l.id).order('sort_order');
    return {
      ...l,
      quizQuestions: (qs || []).map(q => ({
        id: q.id, question: q.question, optionA: q.option_a, optionB: q.option_b,
        optionC: q.option_c, optionD: q.option_d, correct: q.correct
      }))
    };
  }));
  res.json({ lessons: withQuiz });
});

router.post('/api/dash/courses/:id/lessons', requireDashAuth, async (req, res) => {
  const { title, videoUrl, docUrl, quizQuestions, sortOrder, requiresUpload, uploadInstructions, aiGradingCriteria } = req.body || {};
  if (!title || !videoUrl) return res.status(400).json({ error: 'Chýba title alebo videoUrl.' });
  const qErr = validateQuizQuestions(quizQuestions);
  if (qErr) return res.status(400).json({ error: qErr });
  let order = sortOrder;
  if (order === undefined || order === null) {
    const { data: existing } = await mainDb.from('course_lessons').select('sort_order').eq('course_id', req.params.id).order('sort_order', { ascending: false }).limit(1);
    order = existing?.[0] ? existing[0].sort_order + 1 : 0;
  }
  const { data, error } = await mainDb.from('course_lessons').insert({
    course_id: req.params.id, title, video_url: videoUrl, doc_url: docUrl || null,
    sort_order: order, requires_upload: !!requiresUpload, upload_instructions: uploadInstructions || null,
    ai_grading_criteria: aiGradingCriteria || null
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  await replaceQuizQuestions(data.id, quizQuestions);
  res.json({ ok: true, lesson: { ...data, quizQuestions: quizQuestions || [] } });
});

router.put('/api/dash/courses/:id/lessons/:lessonId', requireDashAuth, async (req, res) => {
  const { title, videoUrl, docUrl, quizQuestions, sortOrder, requiresUpload, uploadInstructions, aiGradingCriteria } = req.body || {};
  const qErr = validateQuizQuestions(quizQuestions);
  if (qErr) return res.status(400).json({ error: qErr });
  const update = {};
  if (title !== undefined) update.title = title;
  if (videoUrl !== undefined) update.video_url = videoUrl;
  if (docUrl !== undefined) update.doc_url = docUrl;
  if (sortOrder !== undefined) update.sort_order = sortOrder;
  if (requiresUpload !== undefined) update.requires_upload = !!requiresUpload;
  if (uploadInstructions !== undefined) update.upload_instructions = uploadInstructions;
  if (aiGradingCriteria !== undefined) update.ai_grading_criteria = aiGradingCriteria;
  const { data, error } = await mainDb.from('course_lessons').update(update).eq('id', req.params.lessonId).eq('course_id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  if (quizQuestions !== undefined) await replaceQuizQuestions(req.params.lessonId, quizQuestions);
  res.json({ ok: true, lesson: { ...data, quizQuestions: quizQuestions !== undefined ? quizQuestions : undefined } });
});

router.delete('/api/dash/courses/:id/lessons/:lessonId', requireDashAuth, async (req, res) => {
  await mainDb.from('course_lesson_quiz_questions').delete().eq('lesson_id', req.params.lessonId);
  const { error } = await mainDb.from('course_lessons').delete().eq('id', req.params.lessonId).eq('course_id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;
