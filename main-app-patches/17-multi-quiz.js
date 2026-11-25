const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("lessons/:lessonId/quiz-answer'")) {
  console.error('Uz je aplikovane (najdene quiz-answer route), nic som nezmenil.');
  process.exit(1);
}

const HELPERS = `function checkLessonQuizCount(lessonId) {
  return supabase.from('course_lesson_quiz_questions').select('*', { count: 'exact', head: true }).eq('lesson_id', lessonId)
    .then(({ count }) => count || 0);
}

async function maybeCompleteLesson(course, lesson, email, allLessons) {
  const quizCount = await checkLessonQuizCount(lesson.id);
  let quizOk = true;
  if (quizCount > 0) {
    const { data: qp } = await supabase.from('course_lesson_quiz_progress').select('id').eq('course_id', course.id).eq('lesson_id', lesson.id).eq('email', email).maybeSingle();
    quizOk = !!qp;
  }
  let uploadOk = true;
  if (lesson.requires_upload) {
    const { data: sub } = await supabase.from('course_lesson_submissions').select('ai_verdict').eq('lesson_id', lesson.id).eq('email', email).order('created_at', { ascending: false }).limit(1).maybeSingle();
    uploadOk = !!sub && sub.ai_verdict === 'pass';
  }
  if (!quizOk || !uploadOk) return { completed: false, nextLessonId: null };
  await supabase.from('course_lesson_progress').upsert({
    course_id: course.id, lesson_id: lesson.id, email
  }, { onConflict: 'course_id,lesson_id,email' });
  const nextLesson = (allLessons || []).find(l => l.sort_order === lesson.sort_order + 1);
  return { completed: true, nextLessonId: nextLesson?.id || null };
}

`;
const HELPERS_ANCHOR = `app.get('/api/courses/:slug/access', requireCourseBuyer, async (req, res) => {`;
if (!src.includes(HELPERS_ANCHOR)) { console.error('Nenasiel som /access kotvu pre helpery. Nic som nezmenil.'); process.exit(1); }

const ACCESS_OLD = `app.get('/api/courses/:slug/access', requireCourseBuyer, async (req, res) => {
  try {
    const { data: course } = await supabase.from('courses').select('*').eq('slug', req.params.slug).single();
    if (!course) return res.status(404).json({ error: 'Kurz sa nenašiel.' });
    const { data: purchase } = await supabase.from('course_purchases').select('id').eq('course_id', course.id).eq('email', req.userEmail).maybeSingle();
    if (!purchase) return res.status(403).json({ error: 'Tento kurz nemáš zakúpený.' });

    const { data: lessons } = await supabase.from('course_lessons').select('*').eq('course_id', course.id).order('sort_order');
    const { data: progress } = await supabase.from('course_lesson_progress').select('lesson_id').eq('course_id', course.id).eq('email', req.userEmail);
    const completedIds = new Set((progress || []).map(p => p.lesson_id));

    let unlocked = true;
    const outLessons = [];
    for (const l of (lessons || [])) {
      const isUnlocked = unlocked;
      if (!completedIds.has(l.id)) unlocked = false;
      let lastSubmission = null;
      if (isUnlocked && !completedIds.has(l.id) && l.requires_upload) {
        const { data: sub } = await supabase.from('course_lesson_submissions').select('ai_verdict,ai_feedback')
          .eq('lesson_id', l.id).eq('email', req.userEmail).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (sub) lastSubmission = { verdict: sub.ai_verdict, feedback: sub.ai_feedback };
      }
      outLessons.push({
        id: l.id, title: l.title, sortOrder: l.sort_order, completed: completedIds.has(l.id), unlocked: isUnlocked,
        videoUrl: isUnlocked ? l.video_url : null,
        docUrl: isUnlocked ? l.doc_url : null,
        quizQuestion: isUnlocked ? l.quiz_question : null,
        quizOptionA: isUnlocked ? l.quiz_option_a : null,
        quizOptionB: isUnlocked ? l.quiz_option_b : null,
        quizOptionC: isUnlocked ? l.quiz_option_c : null,
        quizOptionD: isUnlocked ? l.quiz_option_d : null,
        requiresUpload: isUnlocked ? !!l.requires_upload : false,
        uploadInstructions: isUnlocked ? l.upload_instructions : null,
        lastSubmission
      });
    }
    res.json({ course: { title: course.title, slug: course.slug }, lessons: outLessons });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});`;
const ACCESS_NEW = `app.get('/api/courses/:slug/access', requireCourseBuyer, async (req, res) => {
  try {
    const { data: course } = await supabase.from('courses').select('*').eq('slug', req.params.slug).single();
    if (!course) return res.status(404).json({ error: 'Kurz sa nenašiel.' });
    const { data: purchase } = await supabase.from('course_purchases').select('id').eq('course_id', course.id).eq('email', req.userEmail).maybeSingle();
    if (!purchase) return res.status(403).json({ error: 'Tento kurz nemáš zakúpený.' });

    const { data: lessons } = await supabase.from('course_lessons').select('*').eq('course_id', course.id).order('sort_order');
    const { data: progress } = await supabase.from('course_lesson_progress').select('lesson_id').eq('course_id', course.id).eq('email', req.userEmail);
    const completedIds = new Set((progress || []).map(p => p.lesson_id));

    let unlocked = true;
    const outLessons = [];
    for (const l of (lessons || [])) {
      const isUnlocked = unlocked;
      if (!completedIds.has(l.id)) unlocked = false;
      let quizQuestions = [];
      let quizPassed = false;
      let lastSubmission = null;
      if (isUnlocked && !completedIds.has(l.id)) {
        const { data: qs } = await supabase.from('course_lesson_quiz_questions').select('*').eq('lesson_id', l.id).order('sort_order');
        quizQuestions = (qs || []).map(q => ({ id: q.id, question: q.question, optionA: q.option_a, optionB: q.option_b, optionC: q.option_c, optionD: q.option_d }));
        if (quizQuestions.length) {
          const { data: qp } = await supabase.from('course_lesson_quiz_progress').select('id').eq('course_id', course.id).eq('lesson_id', l.id).eq('email', req.userEmail).maybeSingle();
          quizPassed = !!qp;
        }
        if (l.requires_upload) {
          const { data: sub } = await supabase.from('course_lesson_submissions').select('ai_verdict,ai_feedback')
            .eq('lesson_id', l.id).eq('email', req.userEmail).order('created_at', { ascending: false }).limit(1).maybeSingle();
          if (sub) lastSubmission = { verdict: sub.ai_verdict, feedback: sub.ai_feedback };
        }
      }
      outLessons.push({
        id: l.id, title: l.title, sortOrder: l.sort_order, completed: completedIds.has(l.id), unlocked: isUnlocked,
        videoUrl: isUnlocked ? l.video_url : null,
        docUrl: isUnlocked ? l.doc_url : null,
        quizQuestions,
        quizPassed,
        requiresUpload: isUnlocked ? !!l.requires_upload : false,
        uploadInstructions: isUnlocked ? l.upload_instructions : null,
        lastSubmission
      });
    }
    res.json({ course: { title: course.title, slug: course.slug }, lessons: outLessons });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});`;
if (!src.includes(ACCESS_OLD)) { console.error('Nenasiel som presny /access blok. Nic som nezmenil.'); process.exit(1); }

const ANSWER_OLD = `app.post('/api/courses/:slug/lessons/:lessonId/answer', requireCourseBuyer, async (req, res) => {
  const { option } = req.body || {};
  if (!['a', 'b', 'c', 'd'].includes(option)) return res.status(400).json({ error: 'Neplatná odpoveď.' });
  try {
    const { data: course } = await supabase.from('courses').select('id').eq('slug', req.params.slug).single();
    if (!course) return res.status(404).json({ error: 'Kurz sa nenašiel.' });
    const { data: purchase } = await supabase.from('course_purchases').select('id').eq('course_id', course.id).eq('email', req.userEmail).maybeSingle();
    if (!purchase) return res.status(403).json({ error: 'Tento kurz nemáš zakúpený.' });

    const { data: lesson } = await supabase.from('course_lessons').select('*').eq('id', req.params.lessonId).eq('course_id', course.id).single();
    if (!lesson) return res.status(404).json({ error: 'Lekcia sa nenašla.' });
    if (lesson.requires_upload) return res.status(400).json({ error: 'Táto lekcia vyžaduje nahratie materiálu, nie kvíz.' });

    const { data: allLessons } = await supabase.from('course_lessons').select('id,sort_order').eq('course_id', course.id).order('sort_order');
    const { data: progress } = await supabase.from('course_lesson_progress').select('lesson_id').eq('course_id', course.id).eq('email', req.userEmail);
    const completedIds = new Set((progress || []).map(p => p.lesson_id));
    const priorLessons = (allLessons || []).filter(l => l.sort_order < lesson.sort_order);
    if (priorLessons.some(l => !completedIds.has(l.id))) return res.status(403).json({ error: 'Najprv dokonči predchádzajúce lekcie.' });

    const correct = !lesson.quiz_correct || lesson.quiz_correct === option;
    if (correct) {
      await supabase.from('course_lesson_progress').upsert({
        course_id: course.id, lesson_id: lesson.id, email: req.userEmail
      }, { onConflict: 'course_id,lesson_id,email' });
    }
    const nextLesson = (allLessons || []).find(l => l.sort_order === lesson.sort_order + 1);
    res.json({ correct, nextLessonId: correct ? (nextLesson?.id || null) : null });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});`;
const ANSWER_NEW = `app.post('/api/courses/:slug/lessons/:lessonId/quiz-answer', requireCourseBuyer, async (req, res) => {
  const { answers } = req.body || {};
  if (!answers || typeof answers !== 'object') return res.status(400).json({ error: 'Chýbajú odpovede.' });
  try {
    const { data: course } = await supabase.from('courses').select('id').eq('slug', req.params.slug).single();
    if (!course) return res.status(404).json({ error: 'Kurz sa nenašiel.' });
    const { data: purchase } = await supabase.from('course_purchases').select('id').eq('course_id', course.id).eq('email', req.userEmail).maybeSingle();
    if (!purchase) return res.status(403).json({ error: 'Tento kurz nemáš zakúpený.' });

    const { data: lesson } = await supabase.from('course_lessons').select('*').eq('id', req.params.lessonId).eq('course_id', course.id).single();
    if (!lesson) return res.status(404).json({ error: 'Lekcia sa nenašla.' });

    const { data: allLessons } = await supabase.from('course_lessons').select('id,sort_order').eq('course_id', course.id).order('sort_order');
    const { data: progress } = await supabase.from('course_lesson_progress').select('lesson_id').eq('course_id', course.id).eq('email', req.userEmail);
    const completedIds = new Set((progress || []).map(p => p.lesson_id));
    const priorLessons = (allLessons || []).filter(l => l.sort_order < lesson.sort_order);
    if (priorLessons.some(l => !completedIds.has(l.id))) return res.status(403).json({ error: 'Najprv dokonči predchádzajúce lekcie.' });

    const { data: questions } = await supabase.from('course_lesson_quiz_questions').select('*').eq('lesson_id', lesson.id).order('sort_order');
    if (!questions || !questions.length) return res.status(400).json({ error: 'Táto lekcia nemá kvíz.' });

    const allCorrect = questions.every(q => answers[q.id] === q.correct);
    if (!allCorrect) return res.json({ quizPassed: false });

    await supabase.from('course_lesson_quiz_progress').upsert({
      course_id: course.id, lesson_id: lesson.id, email: req.userEmail
    }, { onConflict: 'course_id,lesson_id,email' });

    const result = await maybeCompleteLesson(course, lesson, req.userEmail, allLessons);
    res.json({ quizPassed: true, completed: result.completed, nextLessonId: result.nextLessonId });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});`;
if (!src.includes(ANSWER_OLD)) { console.error('Nenasiel som presny /answer blok. Nic som nezmenil.'); process.exit(1); }

const SUBMIT_OLD = `      let grade;
      try {
        grade = await callAnthropicGrade(lesson.upload_instructions || lesson.title, req.file.buffer, req.file.mimetype);
      } catch (e) {
        return res.status(502).json({ error: 'Chyba AI vyhodnotenia, skús to znova.' });
      }

      await supabase.from('course_lesson_submissions').insert({
        course_id: course.id, lesson_id: lesson.id, email: req.userEmail,
        file_path: filePath, file_mime: req.file.mimetype,
        ai_verdict: grade.verdict, ai_feedback: grade.feedback
      });

      let nextLessonId = null;
      if (grade.verdict === 'pass') {
        await supabase.from('course_lesson_progress').upsert({
          course_id: course.id, lesson_id: lesson.id, email: req.userEmail
        }, { onConflict: 'course_id,lesson_id,email' });
        const nextLesson = (allLessons || []).find(l => l.sort_order === lesson.sort_order + 1);
        nextLessonId = nextLesson?.id || null;
      }
      res.json({ verdict: grade.verdict, feedback: grade.feedback, nextLessonId });`;
const SUBMIT_NEW = `      let grade;
      try {
        grade = await callAnthropicGrade(lesson.ai_grading_criteria || lesson.upload_instructions || lesson.title, req.file.buffer, req.file.mimetype);
      } catch (e) {
        return res.status(502).json({ error: 'Chyba AI vyhodnotenia, skús to znova.' });
      }

      await supabase.from('course_lesson_submissions').insert({
        course_id: course.id, lesson_id: lesson.id, email: req.userEmail,
        file_path: filePath, file_mime: req.file.mimetype,
        ai_verdict: grade.verdict, ai_feedback: grade.feedback
      });

      let completed = false, nextLessonId = null;
      if (grade.verdict === 'pass') {
        const result = await maybeCompleteLesson(course, lesson, req.userEmail, allLessons);
        completed = result.completed; nextLessonId = result.nextLessonId;
      }
      res.json({ verdict: grade.verdict, feedback: grade.feedback, completed, nextLessonId });`;
if (!src.includes(SUBMIT_OLD)) { console.error('Nenasiel som presny /submit grading blok. Nic som nezmenil.'); process.exit(1); }

const patched = src
  .replace(HELPERS_ANCHOR, HELPERS + HELPERS_ANCHOR)
  .replace(ACCESS_OLD, ACCESS_NEW)
  .replace(ANSWER_OLD, ANSWER_NEW)
  .replace(SUBMIT_OLD, SUBMIT_NEW);

const backup = FILE + '.pre-multi-quiz-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
