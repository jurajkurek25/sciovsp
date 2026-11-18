// Predaj darčekových kariet (sptrener.online/darcekova-karta) — CRUD nad
// gift_card_options (cenník) + read-only prehľad predaných gift_cards.
// POZOR: toto je INÁ vec ako routes/giftcards.js (partner affil obchod,
// partner_gift_cards tabuľka) — zámerne iný názov endpointov, aby sa
// nekrížili.
const express = require('express');
const router = express.Router();
const { requireDashAuth } = require('../lib/auth');
const { supabase: mainDb } = require('../lib/db-main');

router.get('/api/dash/gift-card-options', requireDashAuth, async (req, res) => {
  const { data, error } = await mainDb.from('gift_card_options').select('*').order('sort_order');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ options: data || [] });
});

router.post('/api/dash/gift-card-options', requireDashAuth, async (req, res) => {
  const { kind, label, durationDays, priceCents, sortOrder } = req.body || {};
  if (!kind || !['premium', 'course'].includes(kind)) return res.status(400).json({ error: 'kind musí byť premium alebo course.' });
  if (!label) return res.status(400).json({ error: 'Chýba label.' });
  if (kind === 'premium' && !durationDays) return res.status(400).json({ error: 'Premium možnosť potrebuje dĺžku v dňoch.' });
  const { data, error } = await mainDb.from('gift_card_options').insert({
    kind, label, duration_days: kind === 'premium' ? Number(durationDays) : null,
    price_cents: Math.max(0, Number(priceCents) || 0), sort_order: Number(sortOrder) || 0, active: true
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, option: data });
});

router.put('/api/dash/gift-card-options/:id', requireDashAuth, async (req, res) => {
  const { label, durationDays, priceCents, sortOrder, active } = req.body || {};
  const update = {};
  if (label !== undefined) update.label = label;
  if (durationDays !== undefined) update.duration_days = durationDays === null ? null : Number(durationDays);
  if (priceCents !== undefined) update.price_cents = Math.max(0, Number(priceCents) || 0);
  if (sortOrder !== undefined) update.sort_order = Number(sortOrder) || 0;
  if (active !== undefined) update.active = !!active;
  const { data, error } = await mainDb.from('gift_card_options').update(update).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, option: data });
});

router.delete('/api/dash/gift-card-options/:id', requireDashAuth, async (req, res) => {
  const { error } = await mainDb.from('gift_card_options').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

router.get('/api/dash/gift-cards-sold', requireDashAuth, async (req, res) => {
  const { data, error } = await mainDb.from('gift_cards').select('*').order('created_at', { ascending: false }).limit(200);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ cards: data || [] });
});

module.exports = router;
