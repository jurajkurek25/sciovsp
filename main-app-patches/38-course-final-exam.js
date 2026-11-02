const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("app.get('/api/courses/:slug/final-test'")) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

const OLD = `function callAnthropicGrade(instructions, fileBuffer, mimeType) {`;
const NEW = `app.get('/api/courses/:slug/final-test', requireCourseBuyer, async (req, res) => {
  try {
    const { data: course } = await supabase.from('courses').select('id,final_test_time_limit_minutes').eq('slug', req.params.slug).single();
    if (!course) return res.status(404).json({ error: 'Kurz sa nenašiel.' });
    if (!course.final_test_time_limit_minutes) return res.json({ hasFinalTest: false });

    const { data: purchase } = await supabase.from('course_purchases').select('id').eq('course_id', course.id).eq('email', req.userEmail).maybeSingle();
    if (!purchase) return res.status(403).json({ error: 'Tento kurz nemáš zakúpený.' });

    const { data: lessons } = await supabase.from('course_lessons').select('id').eq('course_id', course.id);
    const { data: progress } = await supabase.from('course_lesson_progress').select('lesson_id').eq('course_id', course.id).eq('email', req.userEmail);
    const totalLessons = (lessons || []).length;
    const completedCount = (progress || []).length;
    if (totalLessons === 0 || completedCount < totalLessons) {
      return res.json({ hasFinalTest: true, unlocked: false });
    }

    const { data: questions } = await supabase.from('course_final_test_questions').select('id,question,option_a,option_b,option_c,option_d').eq('course_id', course.id).order('sort_order');
    const { data: lastResult } = await supabase.from('course_final_test_results').select('score_percent,passed,completed_at').eq('course_id', course.id).eq('email', req.userEmail).order('completed_at', { ascending: false }).limit(1).maybeSingle();

    res.json({
      hasFinalTest: true, unlocked: true,
      timeLimitMinutes: course.final_test_time_limit_minutes,
      questions: (questions || []).map(q => ({ id: q.id, question: q.question, optionA: q.option_a, optionB: q.option_b, optionC: q.option_c, optionD: q.option_d })),
      lastResult: lastResult || null
    });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.post('/api/courses/:slug/final-test/submit', requireCourseBuyer, async (req, res) => {
  const { answers, elapsedSeconds } = req.body || {};
  if (!answers || typeof answers !== 'object') return res.status(400).json({ error: 'Chýbajú odpovede.' });
  try {
    const { data: course } = await supabase.from('courses').select('id,final_test_time_limit_minutes').eq('slug', req.params.slug).single();
    if (!course || !course.final_test_time_limit_minutes) return res.status(404).json({ error: 'Kurz nemá záverečný test.' });

    const { data: purchase } = await supabase.from('course_purchases').select('id').eq('course_id', course.id).eq('email', req.userEmail).maybeSingle();
    if (!purchase) return res.status(403).json({ error: 'Tento kurz nemáš zakúpený.' });

    const { data: lessons } = await supabase.from('course_lessons').select('id').eq('course_id', course.id);
    const { data: progress } = await supabase.from('course_lesson_progress').select('lesson_id').eq('course_id', course.id).eq('email', req.userEmail);
    if (!lessons?.length || (progress || []).length < lessons.length) return res.status(403).json({ error: 'Najprv dokonči všetky lekcie.' });

    const maxSeconds = course.final_test_time_limit_minutes * 60 + 15;
    if (typeof elapsedSeconds === 'number' && elapsedSeconds > maxSeconds) {
      return res.status(400).json({ error: 'Časový limit vypršal.' });
    }

    const { data: questions } = await supabase.from('course_final_test_questions').select('id,correct').eq('course_id', course.id);
    if (!questions || !questions.length) return res.status(400).json({ error: 'Tento kurz nemá otázky záverečného testu.' });

    const correctCount = questions.filter(q => answers[q.id] === q.correct).length;
    const scorePercent = Math.round((correctCount / questions.length) * 100);
    const passed = scorePercent >= 70;

    await supabase.from('course_final_test_results').insert({
      course_id: course.id, email: req.userEmail, score_percent: scorePercent, passed
    });

    res.json({ scorePercent, passed, correctCount, totalQuestions: questions.length });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

function callAnthropicGrade(instructions, fileBuffer, mimeType) {`;

const count = src.split(OLD).length - 1;
if (count !== 1) { console.error('Kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }

const patched = src.replace(OLD, NEW);

const backup = FILE + '.pre-course-final-exam-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
