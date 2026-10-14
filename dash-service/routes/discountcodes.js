// Zľavové kódy pre online kurzy — course_id = null znamená, že kód
// platí na ktorýkoľvek kurz. Admin tu môže vytvoriť/vypnúť/zmazať
// hocijaký kód (aj pre kurzy inštruktorov); inštruktor si cez svoj
// portál vie robiť kódy len na vlastné kurzy (routes/discountcodes.js
// v instructor-service).
const express = require('express');
const router = express.Router();
const { requireDashAuth } = require('../lib/auth');
const { supabase: mainDb } = require('../lib/db-main');

router.get('/api/dash/discount-codes', requireDashAuth, async (req, res) => {
  const { data, error } = await mainDb.from('course_discount_codes').select('*, courses(title)').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ codes: data || [] });
});

router.post('/api/dash/discount-codes', requireDashAuth, async (req, res) => {
  const { code, courseId, percentOff, maxUses, expiresAt } = req.body || {};
  if (!code || !code.trim()) return res.status(400).json({ error: 'Chýba kód.' });
  const percent = Number(percentOff);
  if (!percent || percent <= 0 || percent > 100) return res.status(400).json({ error: 'Zľava musí byť 1-100 %.' });
  const { data, error } = await mainDb.from('course_discount_codes').insert({
    code: code.trim().toUpperCase(),
    course_id: courseId || null,
    percent_off: percent,
    max_uses: maxUses ? Number(maxUses) : null,
    expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    active: true
  }).select().single();
  if (error) {
    if (error.code === '23505') return res.status(400).json({ error: 'Tento kód už existuje.' });
    return res.status(500).json({ error: error.message });
  }
  res.json({ ok: true, code: data });
});

router.put('/api/dash/discount-codes/:id', requireDashAuth, async (req, res) => {
  const { active, percentOff, maxUses, expiresAt } = req.body || {};
  const update = {};
  if (active !== undefined) update.active = !!active;
  if (percentOff !== undefined) update.percent_off = Number(percentOff);
  if (maxUses !== undefined) update.max_uses = maxUses ? Number(maxUses) : null;
  if (expiresAt !== undefined) update.expires_at = expiresAt ? new Date(expiresAt).toISOString() : null;
  const { data, error } = await mainDb.from('course_discount_codes').update(update).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, code: data });
});

router.delete('/api/dash/discount-codes/:id', requireDashAuth, async (req, res) => {
  const { error } = await mainDb.from('course_discount_codes').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;
