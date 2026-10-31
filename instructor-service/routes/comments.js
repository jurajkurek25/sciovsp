// Otázky od študentov ku kurzom tohto inštruktora + odpovede naň ako lektor.
const express = require('express');
const router = express.Router();
const { requireInstructorAuth } = require('../lib/auth');
const { supabase: mainDb } = require('../lib/db-main');

async function ownCourseOr404(req, res) {
  const { data: course, error } = await mainDb.from('courses').select('*').eq('id', req.params.id).maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return null; }
  if (!course || course.instructor_id !== req.instructor.id) { res.status(404).json({ error: 'Kurz sa nenašiel.' }); return null; }
  return course;
}

router.get('/api/instructor/courses/:id/comments', requireInstructorAuth, async (req, res) => {
  const course = await ownCourseOr404(req, res);
  if (!course) return;
  const { data: comments, error } = await mainDb.from('course_lesson_comments')
    .select('*, course_lessons(title)').eq('course_id', course.id).order('created_at');
  if (error) { console.error(error); return res.status(500).json({ error: error.message }); }
  res.json({
    comments: (comments || []).map(c => ({
      id: c.id, lessonId: c.lesson_id, lessonTitle: c.course_lessons?.title || '',
      parentId: c.parent_id, email: c.email, isInstructor: c.is_instructor,
      body: c.body, createdAt: c.created_at
    }))
  });
});

router.post('/api/instructor/courses/:id/comments', requireInstructorAuth, async (req, res) => {
  const course = await ownCourseOr404(req, res);
  if (!course) return;
  const { lessonId, body, parentId } = req.body || {};
  if (!lessonId || !body || !body.trim()) return res.status(400).json({ error: 'Chýba lekcia alebo text.' });
  const { data, error } = await mainDb.from('course_lesson_comments').insert({
    course_id: course.id, lesson_id: lessonId, parent_id: parentId || null,
    email: req.instructor.email, is_instructor: true, body: body.trim()
  }).select().single();
  if (error) { console.error(error); return res.status(500).json({ error: error.message }); }
  res.json({ ok: true, comment: data });
});

module.exports = router;
