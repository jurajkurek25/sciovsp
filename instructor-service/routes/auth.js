const express = require('express');
const router = express.Router();
const { requireInstructorAuth } = require('../lib/auth');
const { supabase: mainDb } = require('../lib/db-main');

function serializeInstructor(i) {
  return {
    id: i.id, email: i.email, name: i.name, bio: i.bio, photoUrl: i.photo_url,
    iban: i.iban, defaultCutPercent: i.default_cut_percent, referralCode: i.referral_code,
    bannerImageUrl: i.banner_image_url, bannerLinkUrl: i.banner_link_url,
    termsAcceptedAt: i.terms_accepted_at, termsAcceptedVersion: i.terms_accepted_version
  };
}

router.get('/api/instructor/me', requireInstructorAuth, (req, res) => {
  res.json({ instructor: serializeInstructor(req.instructor) });
});

router.put('/api/instructor/me', requireInstructorAuth, async (req, res) => {
  const { name, bio, photoUrl, iban, bannerImageUrl, bannerLinkUrl } = req.body || {};
  if (bannerLinkUrl && !/^https?:\/\//i.test(bannerLinkUrl)) {
    return res.status(400).json({ error: 'Odkaz na banner musí začínať http:// alebo https://.' });
  }
  const update = {};
  if (name !== undefined) update.name = name;
  if (bio !== undefined) update.bio = bio;
  if (photoUrl !== undefined) update.photo_url = photoUrl;
  if (iban !== undefined) update.iban = iban;
  if (bannerImageUrl !== undefined) update.banner_image_url = bannerImageUrl;
  if (bannerLinkUrl !== undefined) update.banner_link_url = bannerLinkUrl;
  const { data, error } = await mainDb.from('instructors').update(update).eq('id', req.instructor.id).select().single();
  if (error) { console.error(error); return res.status(500).json({ error: error.message }); }
  res.json({ ok: true, instructor: serializeInstructor(data) });
});

router.get('/api/instructor/banner-stats', requireInstructorAuth, async (req, res) => {
  const { data: clicks, error } = await mainDb.from('instructor_banner_clicks')
    .select('course_id, clicked_at, courses(title)').eq('instructor_id', req.instructor.id);
  if (error) { console.error(error); return res.status(500).json({ error: error.message }); }
  const byCourse = {};
  (clicks || []).forEach(c => {
    const key = c.course_id || 'unknown';
    const label = c.courses?.title || 'iné';
    byCourse[key] = byCourse[key] || { courseTitle: label, count: 0 };
    byCourse[key].count++;
  });
  res.json({ totalClicks: (clicks || []).length, byCourse: Object.values(byCourse) });
});

module.exports = router;
