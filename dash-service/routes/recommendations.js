// Odporúčame — affiliate produkty na verejnej stránke /odporucame (hlavná
// appka, server.js). Admin tu spravuje kategórie a odkazy; verejná
// stránka ich číta priamo z rovnakej tabuľky cez mainDb.
const express = require('express');
const router = express.Router();
const { requireDashAuth } = require('../lib/auth');
const { supabase: mainDb } = require('../lib/db-main');

router.get('/api/dash/recommendations', requireDashAuth, async (req, res) => {
  const { data, error } = await mainDb.from('affiliate_products').select('*').order('category_slug').order('sort_order');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ products: data || [] });
});

router.post('/api/dash/recommendations', requireDashAuth, async (req, res) => {
  const { categorySlug, categoryTitleSk, categoryTitleCs, icon, titleSk, titleCs, descriptionSk, descriptionCs, ctaSk, ctaCs, url, sortOrder } = req.body || {};
  if (!categorySlug || !categorySlug.trim()) return res.status(400).json({ error: 'Chýba kategória.' });
  if (!titleSk || !titleSk.trim() || !titleCs || !titleCs.trim()) return res.status(400).json({ error: 'Chýba názov produktu (SK aj CZ).' });
  if (!url || !url.trim()) return res.status(400).json({ error: 'Chýba affiliate odkaz.' });
  const { data, error } = await mainDb.from('affiliate_products').insert({
    category_slug: categorySlug.trim(),
    category_title_sk: (categoryTitleSk || '').trim() || categorySlug.trim(),
    category_title_cs: (categoryTitleCs || '').trim() || categorySlug.trim(),
    icon: (icon || '').trim() || '🛍️',
    title_sk: titleSk.trim(),
    title_cs: titleCs.trim(),
    description_sk: (descriptionSk || '').trim(),
    description_cs: (descriptionCs || '').trim(),
    cta_sk: (ctaSk || '').trim() || 'Pozrieť ponuku →',
    cta_cs: (ctaCs || '').trim() || 'Podívat se na nabídku →',
    url: url.trim(),
    sort_order: sortOrder ? Number(sortOrder) : 0,
    active: true
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, product: data });
});

router.put('/api/dash/recommendations/:id', requireDashAuth, async (req, res) => {
  const { active, sortOrder, titleSk, titleCs, descriptionSk, descriptionCs, ctaSk, ctaCs, url, icon, categoryTitleSk, categoryTitleCs } = req.body || {};
  const update = {};
  if (active !== undefined) update.active = !!active;
  if (sortOrder !== undefined) update.sort_order = Number(sortOrder);
  if (titleSk !== undefined) update.title_sk = titleSk;
  if (titleCs !== undefined) update.title_cs = titleCs;
  if (descriptionSk !== undefined) update.description_sk = descriptionSk;
  if (descriptionCs !== undefined) update.description_cs = descriptionCs;
  if (ctaSk !== undefined) update.cta_sk = ctaSk;
  if (ctaCs !== undefined) update.cta_cs = ctaCs;
  if (url !== undefined) update.url = url;
  if (icon !== undefined) update.icon = icon;
  if (categoryTitleSk !== undefined) update.category_title_sk = categoryTitleSk;
  if (categoryTitleCs !== undefined) update.category_title_cs = categoryTitleCs;
  const { data, error } = await mainDb.from('affiliate_products').update(update).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, product: data });
});

router.delete('/api/dash/recommendations/:id', requireDashAuth, async (req, res) => {
  const { error } = await mainDb.from('affiliate_products').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;
