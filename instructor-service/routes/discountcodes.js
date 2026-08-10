// Zľavové kódy pre vlastné kurzy inštruktora — na rozdiel od dashu tu
// course_id nie je voliteľný, kód platí vždy len na jeden (vlastný) kurz.
const express = require('express');
const router = express.Router();
const { requireInstructorAuth } = require('../lib/auth');
const { supabase: mainDb } = require('../lib/db-main');

async function ownCourseOr404(req, res) {
  const { data: course, error } = await mainDb.from('courses').select('id, instructor_id').eq('id', req.params.id).maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return null; }
  if (!course || course.instructor_id !== req.instructor.id) { res.status(404).json({ error: 'Kurz sa nenašiel.' }); return null; }
  return course;
}

router.get('/api/instructor/courses/:id/discount-codes', requireInstructorAuth, async (req, res) => {
  const course = await ownCourseOr404(req, res);
  if (!course) return;
  const { data, error } = await mainDb.from('course_discount_codes').select('*').eq('course_id', course.id).order('created_at', { ascending: false });
  if (error) { console.error(error); return res.status(500).json({ error: error.message }); }
  res.json({ codes: data || [] });
});

router.post('/api/instructor/courses/:id/discount-codes', requireInstructorAuth, async (req, res) => {
  const course = await ownCourseOr404(req, res);
  if (!course) return;
  const { code, percentOff, maxUses, expiresAt } = req.body || {};
  if (!code || !code.trim()) return res.status(400).json({ error: 'Chýba kód.' });
  const percent = Number(percentOff);
  if (!percent || percent <= 0 || percent > 100) return res.status(400).json({ error: 'Zľava musí byť 1-100 %.' });
  const { data, error } = await mainDb.from('course_discount_codes').insert({
    code: code.trim().toUpperCase(),
    course_id: course.id,
    percent_off: percent,
    max_uses: maxUses ? Number(maxUses) : null,
    expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    active: true
  }).select().single();
  if (error) {
    if (error.code === '23505') return res.status(400).json({ error: 'Tento kód už existuje.' });
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
  res.json({ ok: true, code: data });
});

router.put('/api/instructor/courses/:id/discount-codes/:codeId', requireInstructorAuth, async (req, res) => {
  const course = await ownCourseOr404(req, res);
  if (!course) return;
  const { active } = req.body || {};
  const update = {};
  if (active !== undefined) update.active = !!active;
  const { data, error } = await mainDb.from('course_discount_codes').update(update).eq('id', req.params.codeId).eq('course_id', course.id).select().single();
  if (error) { console.error(error); return res.status(500).json({ error: error.message }); }
  res.json({ ok: true, code: data });
});

router.delete('/api/instructor/courses/:id/discount-codes/:codeId', requireInstructorAuth, async (req, res) => {
  const course = await ownCourseOr404(req, res);
  if (!course) return;
  const { error } = await mainDb.from('course_discount_codes').delete().eq('id', req.params.codeId).eq('course_id', course.id);
  if (error) { console.error(error); return res.status(500).json({ error: error.message }); }
  res.json({ ok: true });
});

module.exports = router;
