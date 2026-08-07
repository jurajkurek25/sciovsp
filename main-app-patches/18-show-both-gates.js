const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('uploadPassed,')) {
  console.error('Uz je aplikovane (najdene uploadPassed,), nic som nezmenil.');
  process.exit(1);
}

const OLD = `      let quizQuestions = [];
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
      });`;
const NEW = `      let quizQuestions = [];
      let quizPassed = false;
      let uploadPassed = false;
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
          uploadPassed = !!sub && sub.ai_verdict === 'pass';
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
        uploadPassed,
        lastSubmission
      });`;
if (!src.includes(OLD)) { console.error('Nenasiel som presny access-loop blok. Nic som nezmenil.'); process.exit(1); }

const patched = src.replace(OLD, NEW);
const backup = FILE + '.pre-show-both-gates-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
