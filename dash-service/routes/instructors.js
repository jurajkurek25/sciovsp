// Správa inštruktorov: zoznam + ich default cut, štandardné zmluvné
// podmienky (verzované — nová verzia núti všetkých inštruktorov znova
// potvrdiť), a individuálne dohody na mieru pre konkrétny účet (napr.
// špeciálne copyright podmienky). Vytvorenie novej individuálnej dohody
// archivuje (superseded_at) predchádzajúcu namiesto jej zmazania —
// história zostáva kvôli prípadnému sporu.
const express = require('express');
const router = express.Router();
const { requireDashAuth } = require('../lib/auth');
const { supabase: mainDb } = require('../lib/db-main');

router.get('/api/dash/instructors', requireDashAuth, async (req, res) => {
  const { data: instructors, error } = await mainDb.from('instructors').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  const { data: latestTerms } = await mainDb.from('instructor_standard_terms').select('version').order('version', { ascending: false }).limit(1).maybeSingle();
  const withAgreements = await Promise.all((instructors || []).map(async i => {
    const { data: agreement } = await mainDb.from('instructor_custom_agreements')
      .select('id, title, accepted_at, created_by_admin_at').eq('instructor_id', i.id).is('superseded_at', null)
      .order('created_by_admin_at', { ascending: false }).limit(1).maybeSingle();
    return {
      id: i.id, name: i.name, email: i.email, defaultCutPercent: i.default_cut_percent,
      termsAcceptedVersion: i.terms_accepted_version, termsAcceptedAt: i.terms_accepted_at,
      termsCurrent: latestTerms ? i.terms_accepted_version === latestTerms.version : true,
      customAgreement: agreement || null
    };
  }));
  res.json({ instructors: withAgreements, latestTermsVersion: latestTerms?.version || null });
});

router.put('/api/dash/instructors/:id', requireDashAuth, async (req, res) => {
  const { defaultCutPercent } = req.body || {};
  const update = {};
  if (defaultCutPercent !== undefined) update.default_cut_percent = Math.min(100, Math.max(0, Number(defaultCutPercent) || 0));
  const { data, error } = await mainDb.from('instructors').update(update).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, instructor: data });
});

router.get('/api/dash/instructor-terms', requireDashAuth, async (req, res) => {
  const { data, error } = await mainDb.from('instructor_standard_terms').select('*').order('version', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ versions: data || [] });
});

router.post('/api/dash/instructor-terms', requireDashAuth, async (req, res) => {
  const { content } = req.body || {};
  if (!content || !content.trim()) return res.status(400).json({ error: 'Chýba text podmienok.' });
  const { data: latest } = await mainDb.from('instructor_standard_terms').select('version').order('version', { ascending: false }).limit(1).maybeSingle();
  const nextVersion = (latest?.version || 0) + 1;
  const { data, error } = await mainDb.from('instructor_standard_terms').insert({ version: nextVersion, content }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, terms: data });
});

router.get('/api/dash/instructors/:id/terms-history', requireDashAuth, async (req, res) => {
  const { data, error } = await mainDb.from('instructor_terms_acceptances')
    .select('*').eq('instructor_id', req.params.id).order('accepted_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ history: data || [] });
});

router.get('/api/dash/instructors/:id/custom-agreement', requireDashAuth, async (req, res) => {
  const { data, error } = await mainDb.from('instructor_custom_agreements')
    .select('*').eq('instructor_id', req.params.id).is('superseded_at', null)
    .order('created_by_admin_at', { ascending: false }).limit(1).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ agreement: data || null });
});

router.post('/api/dash/instructors/:id/custom-agreement', requireDashAuth, async (req, res) => {
  const { title, content } = req.body || {};
  if (!title || !title.trim() || !content || !content.trim()) return res.status(400).json({ error: 'Chýba názov alebo text dohody.' });
  await mainDb.from('instructor_custom_agreements')
    .update({ superseded_at: new Date().toISOString() })
    .eq('instructor_id', req.params.id).is('superseded_at', null);
  const { data, error } = await mainDb.from('instructor_custom_agreements').insert({
    instructor_id: req.params.id, title: title.trim(), content
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, agreement: data });
});

module.exports = router;
