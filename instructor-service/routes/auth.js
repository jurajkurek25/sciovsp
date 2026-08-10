const express = require('express');
const router = express.Router();
const { requireInstructorAuth } = require('../lib/auth');
const { supabase: mainDb } = require('../lib/db-main');

router.get('/api/instructor/me', requireInstructorAuth, (req, res) => {
  const i = req.instructor;
  res.json({
    instructor: {
      id: i.id, email: i.email, name: i.name, bio: i.bio, photoUrl: i.photo_url,
      iban: i.iban, defaultCutPercent: i.default_cut_percent, referralCode: i.referral_code
    }
  });
});

router.put('/api/instructor/me', requireInstructorAuth, async (req, res) => {
  const { name, bio, photoUrl, iban } = req.body || {};
  const update = {};
  if (name !== undefined) update.name = name;
  if (bio !== undefined) update.bio = bio;
  if (photoUrl !== undefined) update.photo_url = photoUrl;
  if (iban !== undefined) update.iban = iban;
  const { data, error } = await mainDb.from('instructors').update(update).eq('id', req.instructor.id).select().single();
  if (error) { console.error(error); return res.status(500).json({ error: error.message }); }
  res.json({
    ok: true,
    instructor: {
      id: data.id, email: data.email, name: data.name, bio: data.bio, photoUrl: data.photo_url,
      iban: data.iban, defaultCutPercent: data.default_cut_percent, referralCode: data.referral_code
    }
  });
});

module.exports = router;
