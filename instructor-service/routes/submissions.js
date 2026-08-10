// Zobrazenie súborov, ktoré študenti nahrali k lekciám tohto inštruktora,
// spolu s AI verdiktom/feedbackom. Súbor sa neposkytuje priamo (bucket
// 'submissions' je súkromný) — vygeneruje sa krátkodobý podpísaný odkaz.
const express = require('express');
const router = express.Router();
const { requireInstructorAuth } = require('../lib/auth');
const { supabase: mainDb } = require('../lib/db-main');

router.get('/api/instructor/courses/:id/submissions', requireInstructorAuth, async (req, res) => {
  const { data: course, error: courseErr } = await mainDb.from('courses').select('id, instructor_id').eq('id', req.params.id).maybeSingle();
  if (courseErr) return res.status(500).json({ error: courseErr.message });
  if (!course || course.instructor_id !== req.instructor.id) return res.status(404).json({ error: 'Kurz sa nenašiel.' });

  const { data: lessons } = await mainDb.from('course_lessons').select('id, title').eq('course_id', req.params.id);
  const lessonIds = (lessons || []).map(l => l.id);
  const titleById = Object.fromEntries((lessons || []).map(l => [l.id, l.title]));
  if (!lessonIds.length) return res.json({ submissions: [] });

  const { data: subs, error } = await mainDb.from('course_lesson_submissions')
    .select('*').in('lesson_id', lessonIds).order('created_at', { ascending: false }).limit(200);
  if (error) return res.status(500).json({ error: error.message });

  const withUrls = await Promise.all((subs || []).map(async s => {
    const { data: signed } = await mainDb.storage.from('submissions').createSignedUrl(s.file_path, 3600);
    return {
      id: s.id, lessonId: s.lesson_id, lessonTitle: titleById[s.lesson_id] || '',
      email: s.email, fileMime: s.file_mime, aiVerdict: s.ai_verdict, aiFeedback: s.ai_feedback,
      createdAt: s.created_at, fileUrl: signed?.signedUrl || null
    };
  }));
  res.json({ submissions: withUrls });
});

module.exports = router;
