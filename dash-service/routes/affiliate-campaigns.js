// Automaticke AI affiliate kampane — admin tu zapisuje partnerov a co
// predavaju; samotne generovanie textu (Claude) aj odosielanie robi
// server.js (sendAffiliateCampaignEmails, hlavna appka), tento router len
// spravuje kampane v DB. "Regenerovat" vynuluje cache textu, aby ho
// hlavna appka pri najblizsom behu vygenerovala znova.
const express = require('express');
const router = express.Router();
const { requireDashAuth } = require('../lib/auth');
const { supabase: mainDb } = require('../lib/db-main');

router.get('/api/dash/affiliate-campaigns', requireDashAuth, async (req, res) => {
  const { data, error } = await mainDb.from('affiliate_campaigns').select('*, target_course:target_course_id(title,slug)').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  const ids = (data || []).map(c => c.id);
  let sendCounts = {};
  if (ids.length) {
    const { data: sends } = await mainDb.from('affiliate_campaign_sends').select('campaign_id').in('campaign_id', ids);
    for (const s of sends || []) sendCounts[s.campaign_id] = (sendCounts[s.campaign_id] || 0) + 1;
  }
  const campaigns = (data || []).map(c => ({ ...c, sent_count: sendCounts[c.id] || 0 }));
  res.json({ campaigns });
});

router.get('/api/dash/affiliate-campaigns/courses', requireDashAuth, async (req, res) => {
  const { data, error } = await mainDb.from('courses').select('id,title,slug').eq('published', true).order('title');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ courses: data || [] });
});

router.post('/api/dash/affiliate-campaigns', requireDashAuth, async (req, res) => {
  const { partnerName, productDescription, ctaUrl, targetSignal, targetCourseId, examDaysBefore, lookbackDays, subjectHint } = req.body || {};
  if (!partnerName || !partnerName.trim()) return res.status(400).json({ error: 'Chýba meno partnera.' });
  if (!productDescription || !productDescription.trim()) return res.status(400).json({ error: 'Chýba popis produktu (kontext pre AI).' });
  if (!ctaUrl || !ctaUrl.trim()) return res.status(400).json({ error: 'Chýba affiliate odkaz.' });
  const validSignals = ['all', 'course', 'generalka_buyer', 'exam_soon'];
  if (!validSignals.includes(targetSignal)) return res.status(400).json({ error: 'Neplatný cieľový signál.' });
  if (targetSignal === 'course' && !targetCourseId) return res.status(400).json({ error: 'Pri signáli "kupci kurzu" vyber konkrétny kurz.' });
  if (targetSignal === 'exam_soon' && (examDaysBefore === undefined || examDaysBefore === null || examDaysBefore === '')) return res.status(400).json({ error: 'Pri signáli "blížiaci sa termín" zadaj počet dní vopred.' });
  const { data, error } = await mainDb.from('affiliate_campaigns').insert({
    partner_name: partnerName.trim(),
    product_description: productDescription.trim(),
    cta_url: ctaUrl.trim(),
    target_signal: targetSignal,
    target_course_id: targetSignal === 'course' ? targetCourseId : null,
    exam_days_before: targetSignal === 'exam_soon' ? Number(examDaysBefore) : null,
    lookback_days: lookbackDays ? Number(lookbackDays) : 30,
    subject_hint: (subjectHint || '').trim() || null,
    active: true
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, campaign: data });
});

router.put('/api/dash/affiliate-campaigns/:id', requireDashAuth, async (req, res) => {
  const { active, partnerName, productDescription, ctaUrl, subjectHint } = req.body || {};
  const update = {};
  if (active !== undefined) update.active = !!active;
  if (partnerName !== undefined) update.partner_name = partnerName;
  if (productDescription !== undefined) update.product_description = productDescription;
  if (ctaUrl !== undefined) update.cta_url = ctaUrl;
  if (subjectHint !== undefined) update.subject_hint = subjectHint;
  const { data, error } = await mainDb.from('affiliate_campaigns').update(update).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, campaign: data });
});

router.post('/api/dash/affiliate-campaigns/:id/regenerate', requireDashAuth, async (req, res) => {
  const { error } = await mainDb.from('affiliate_campaigns').update({ generated_subject: null, generated_body_html: null, generated_at: null }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

router.delete('/api/dash/affiliate-campaigns/:id', requireDashAuth, async (req, res) => {
  const { error } = await mainDb.from('affiliate_campaigns').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;
