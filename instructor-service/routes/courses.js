// Editor kurzov pre inštruktora — rovnaké tabuľky ako dash-service/routes/courses.js,
// ale vždy obmedzené na courses.instructor_id = prihlásený inštruktor.
// Inštruktor si nastaví cenu a obsah, ale NIE published/platform_cut_percent/
// referral_cut_percent/instructor_id — to riadi len Juraj cez dash. Namiesto
// priameho publikovania si vie kurz označiť ako "submitted_for_review".
const express = require('express');
const router = express.Router();
const { requireInstructorAuth } = require('../lib/auth');
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

// Overí, že kurz existuje a patrí prihlásenému inštruktorovi. Vráti kurz alebo pošle chybu.
async function ownCourseOr404(req, res) {
  const { data: course, error } = await mainDb.from('courses').select('*').eq('id', req.params.id).maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return null; }
  if (!course || course.instructor_id !== req.instructor.id) { res.status(404).json({ error: 'Kurz sa nenašiel.' }); return null; }
  return course;
}

router.get('/api/instructor/courses', requireInstructorAuth, async (req, res) => {
  const { data: courses, error } = await mainDb.from('courses').select('*').eq('instructor_id', req.instructor.id).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  const withCounts = await Promise.all((courses || []).map(async c => {
    const { count: lessonCount } = await mainDb.from('course_lessons').select('*', { count: 'exact', head: true }).eq('course_id', c.id);
    const { count: purchaseCount } = await mainDb.from('course_purchases').select('*', { count: 'exact', head: true }).eq('course_id', c.id);
    return { ...c, lessonCount: lessonCount || 0, purchaseCount: purchaseCount || 0 };
  }));
  res.json({ courses: withCounts });
});

router.post('/api/instructor/courses', requireInstructorAuth, async (req, res) => {
  const { title, description, priceCents, coverImageUrl, salesContent, introVideoUrl } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Chýba title.' });
  let slug = slugify(title);
  if (!slug) return res.status(400).json({ error: 'Z názvu sa nedá vytvoriť slug.' });
  const { data: existing } = await mainDb.from('courses').select('id').eq('slug', slug);
  if ((existing || []).length) slug = `${slug}-${Date.now().toString(36)}`;
  const priceCentsValue = priceCents === undefined || priceCents === null || priceCents === ''
    ? 5700 : Math.max(0, Number(priceCents) || 0);
  const { data, error } = await mainDb.from('courses').insert({
    slug, title, description: description || '', price_cents: priceCentsValue,
    cover_image_url: coverImageUrl || null, sales_content: salesContent || null,
    intro_video_url: introVideoUrl || null, published: false,
    instructor_id: req.instructor.id,
    instructor_name: req.instructor.name || null, instructor_bio: req.instructor.bio || null, instructor_photo_url: req.instructor.photo_url || null,
    platform_cut_percent: req.instructor.default_cut_percent
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, course: data });
});

router.put('/api/instructor/courses/:id', requireInstructorAuth, async (req, res) => {
  const course = await ownCourseOr404(req, res);
  if (!course) return;
  const { title, description, priceCents, coverImageUrl, salesContent, introVideoUrl, submittedForReview } = req.body || {};
  const update = {};
  if (title !== undefined) update.title = title;
  if (description !== undefined) update.description = description;
  if (priceCents !== undefined) update.price_cents = Number(priceCents);
  if (coverImageUrl !== undefined) update.cover_image_url = coverImageUrl;
  if (salesContent !== undefined) update.sales_content = salesContent;
  if (introVideoUrl !== undefined) update.intro_video_url = introVideoUrl;
  if (submittedForReview !== undefined) update.submitted_for_review = !!submittedForReview;
  const { data, error } = await mainDb.from('courses').update(update).eq('id', course.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, course: data });
});

router.delete('/api/instructor/courses/:id', requireInstructorAuth, async (req, res) => {
  const course = await ownCourseOr404(req, res);
  if (!course) return;
  if (course.published) return res.status(400).json({ error: 'Zverejnený kurz nemôžeš zmazať, napíš Jurajovi.' });
  const { error } = await mainDb.from('courses').delete().eq('id', course.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

router.get('/api/instructor/courses/:id/lessons', requireInstructorAuth, async (req, res) => {
  const course = await ownCourseOr404(req, res);
  if (!course) return;
  const { data: lessons, error } = await mainDb.from('course_lessons').select('*').eq('course_id', course.id).order('sort_order');
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

router.post('/api/instructor/courses/:id/lessons', requireInstructorAuth, async (req, res) => {
  const course = await ownCourseOr404(req, res);
  if (!course) return;
  const { title, videoUrl, docUrl, quizQuestions, sortOrder, requiresUpload, uploadInstructions, aiGradingCriteria } = req.body || {};
  if (!title || !videoUrl) return res.status(400).json({ error: 'Chýba title alebo videoUrl.' });
  const qErr = validateQuizQuestions(quizQuestions);
  if (qErr) return res.status(400).json({ error: qErr });
  let order = sortOrder;
  if (order === undefined || order === null) {
    const { data: existingLessons } = await mainDb.from('course_lessons').select('sort_order').eq('course_id', course.id).order('sort_order', { ascending: false }).limit(1);
    order = existingLessons?.[0] ? existingLessons[0].sort_order + 1 : 0;
  }
  const { data, error } = await mainDb.from('course_lessons').insert({
    course_id: course.id, title, video_url: videoUrl, doc_url: docUrl || null,
    sort_order: order, requires_upload: !!requiresUpload, upload_instructions: uploadInstructions || null,
    ai_grading_criteria: aiGradingCriteria || null
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  await replaceQuizQuestions(data.id, quizQuestions);
  res.json({ ok: true, lesson: { ...data, quizQuestions: quizQuestions || [] } });
});

router.put('/api/instructor/courses/:id/lessons/:lessonId', requireInstructorAuth, async (req, res) => {
  const course = await ownCourseOr404(req, res);
  if (!course) return;
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
  const { data, error } = await mainDb.from('course_lessons').update(update).eq('id', req.params.lessonId).eq('course_id', course.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  if (quizQuestions !== undefined) await replaceQuizQuestions(req.params.lessonId, quizQuestions);
  res.json({ ok: true, lesson: { ...data, quizQuestions: quizQuestions !== undefined ? quizQuestions : undefined } });
});

router.delete('/api/instructor/courses/:id/lessons/:lessonId', requireInstructorAuth, async (req, res) => {
  const course = await ownCourseOr404(req, res);
  if (!course) return;
  await mainDb.from('course_lesson_quiz_questions').delete().eq('lesson_id', req.params.lessonId);
  const { error } = await mainDb.from('course_lessons').delete().eq('id', req.params.lessonId).eq('course_id', course.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

router.get('/api/instructor/courses/:id/final-test', requireInstructorAuth, async (req, res) => {
  const course = await ownCourseOr404(req, res);
  if (!course) return;
  const { data: qs } = await mainDb.from('course_final_test_questions').select('*').eq('course_id', course.id).order('sort_order');
  res.json({
    timeLimitMinutes: course.final_test_time_limit_minutes ?? null,
    questions: (qs || []).map(q => ({ id: q.id, question: q.question, optionA: q.option_a, optionB: q.option_b, optionC: q.option_c, optionD: q.option_d, correct: q.correct }))
  });
});

router.put('/api/instructor/courses/:id/final-test', requireInstructorAuth, async (req, res) => {
  const course = await ownCourseOr404(req, res);
  if (!course) return;
  const { timeLimitMinutes, questions } = req.body || {};
  const qErr = validateQuizQuestions(questions);
  if (qErr) return res.status(400).json({ error: qErr });
  await mainDb.from('courses').update({ final_test_time_limit_minutes: timeLimitMinutes ? Number(timeLimitMinutes) : null }).eq('id', course.id);
  await mainDb.from('course_final_test_questions').delete().eq('course_id', course.id);
  if (Array.isArray(questions) && questions.length) {
    const rows = questions.map((q, i) => ({
      course_id: course.id, sort_order: i, question: q.question,
      option_a: q.optionA || null, option_b: q.optionB || null, option_c: q.optionC || null, option_d: q.optionD || null,
      correct: q.correct
    }));
    await mainDb.from('course_final_test_questions').insert(rows);
  }
  res.json({ ok: true });
});

module.exports = router;
