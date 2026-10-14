// Ručná správa blogových článkov (sptrener.online/blog) cez dash — CRUD nad
// blog_posts v hlavnej appke. Existuje popri autonómnom AI publisherovi
// (aiops.js) — obe cesty zapisujú do tej istej tabuľky.
const express = require('express');
const router = express.Router();
const { requireDashAuth } = require('../lib/auth');
const { supabase: mainDb } = require('../lib/db-main');

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

router.get('/api/dash/blog', requireDashAuth, async (req, res) => {
  const { data, error } = await mainDb.from('blog_posts').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ posts: data || [] });
});

router.post('/api/dash/blog', requireDashAuth, async (req, res) => {
  const { title, excerpt, content, tag, readTime, imageUrl, targetLang } = req.body || {};
  if (!title || !content) return res.status(400).json({ error: 'Chýba title alebo content.' });
  let slug = slugify(title);
  if (!slug) return res.status(400).json({ error: 'Z názvu sa nedá vytvoriť slug.' });
  const { data: existing } = await mainDb.from('blog_posts').select('id').eq('slug', slug);
  if ((existing || []).length) slug = `${slug}-${Date.now().toString(36)}`;
  const { data, error } = await mainDb.from('blog_posts').insert({
    slug, title, excerpt: excerpt || '', content,
    tag: tag || null, read_time: readTime || null, image_url: imageUrl || null,
    target_lang: ['sk', 'cz', 'both'].includes(targetLang) ? targetLang : 'sk',
    published: false
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, post: data });
});

router.put('/api/dash/blog/:id', requireDashAuth, async (req, res) => {
  const { title, excerpt, content, tag, readTime, imageUrl, targetLang, published } = req.body || {};
  const update = {};
  if (title !== undefined) update.title = title;
  if (excerpt !== undefined) update.excerpt = excerpt;
  if (content !== undefined) update.content = content;
  if (tag !== undefined) update.tag = tag;
  if (readTime !== undefined) update.read_time = readTime;
  if (imageUrl !== undefined) update.image_url = imageUrl;
  if (targetLang !== undefined && ['sk', 'cz', 'both'].includes(targetLang)) update.target_lang = targetLang;
  if (published !== undefined) update.published = !!published;
  const { data, error } = await mainDb.from('blog_posts').update(update).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, post: data });
});

router.delete('/api/dash/blog/:id', requireDashAuth, async (req, res) => {
  const { error } = await mainDb.from('blog_posts').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;
