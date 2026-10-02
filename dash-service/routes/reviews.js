// Recenzie zozbierané cez /recenzia formulár (odkaz v emaili deň po teste,
// viď main-app-patches/107-exam-goodluck-review-emails.js). Číta z rovnakého
// Supabase projektu ako hlavná appka (app_reviews).
const express = require('express');
const router = express.Router();
const { requireDashAuth } = require('../lib/auth');
const { supabase: mainDb } = require('../lib/db-main');

router.get('/api/dash/reviews', requireDashAuth, async (req, res) => {
  const { data, error } = await mainDb.from('app_reviews')
    .select('id, email, rating, message, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ reviews: data || [] });
});

module.exports = router;
