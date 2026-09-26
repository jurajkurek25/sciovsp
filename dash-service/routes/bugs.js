// Nahlasovanie a prehľad chýb naprieč appkami. Nahlásenie je verejné (bez
// auth) — hociktorá appka doň môže poslať report cez jednoduchý POST;
// zoznam a správa (zmena statusu) je len pre Juraja.
const express = require('express');
const router = express.Router();
const { requireDashAuth } = require('../lib/auth');
const { supabase } = require('../lib/db-partner');

const ALLOWED_SOURCES = ['main', 'partner', 'ads'];
const ALLOWED_STATUSES = ['open', 'in_progress', 'resolved', 'wont_fix'];

router.post('/api/dash/bugs/report', async (req, res) => {
  const { source, reporterEmail, pageUrl, description } = req.body || {};
  if (!ALLOWED_SOURCES.includes(source)) return res.status(400).json({ error: 'Neplatný zdroj.' });
  if (!description || String(description).trim().length < 5) return res.status(400).json({ error: 'Chýba popis chyby.' });

  const { error } = await supabase.from('dash_bug_reports').insert({
    source,
    reporter_email: reporterEmail ? String(reporterEmail).slice(0, 200) : null,
    page_url: pageUrl ? String(pageUrl).slice(0, 500) : null,
    description: String(description).slice(0, 5000)
  });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

router.get('/api/dash/bugs', requireDashAuth, async (req, res) => {
  const statusFilter = req.query.status;
  let query = supabase.from('dash_bug_reports').select('*').order('created_at', { ascending: false });
  if (statusFilter && ALLOWED_STATUSES.includes(statusFilter)) query = query.eq('status', statusFilter);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ bugs: data || [] });
});

router.put('/api/dash/bugs/:id', requireDashAuth, async (req, res) => {
  const { status } = req.body || {};
  if (!ALLOWED_STATUSES.includes(status)) return res.status(400).json({ error: 'Neplatný status.' });
  const update = { status };
  if (status === 'resolved') update.resolved_at = new Date().toISOString();
  const { error } = await supabase.from('dash_bug_reports').update(update).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;
