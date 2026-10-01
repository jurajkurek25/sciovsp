// Doplňuje backend časť SK/CZ rozdelenia affiliate odkazu -- patches/16
// opravil len frontend (public/index.html), ale routes/recommendations.js
// stále očakával jeden spoločný 'url' pole namiesto urlSk/urlCs, ktoré
// frontend po patches/16 už posiela. Výsledok: formulár hlásil "Chýba
// affiliate odkaz" aj keď bol odkaz vyplnený, lebo backend čítal
// neexistujúce req.body.url.
//
// VYŽADUJE: db/migrate_affiliate_products_url_cs.sql už spustený v
// Supabase (stĺpce url_sk/url_cs musia existovať) A patches/16 už
// nasadený (frontend musí posielať urlSk/urlCs).
//
// Kotva je CELÝ súbor routes/recommendations.js (atomická náhrada).
//
// Spusti z koreňa dash-service:
//   node patches/17-recommendations-routes-url-sk-cs.js

const fs = require("fs");
const path = require("path");

const ROUTES_PATH = path.join(process.cwd(), "routes", "recommendations.js");
if (!fs.existsSync(ROUTES_PATH)) {
  console.error("❌ Nenašiel som routes/recommendations.js — spusti z koreňa dash-service.");
  process.exit(1);
}

const LOCK = path.join(process.cwd(), ".17-recommendations-routes-url-sk-cs-lock");
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: "wx" });
} catch (e) {
  console.error("Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (" + LOCK + "). Nič som nezmenil.");
  process.exit(1);
}
process.on("exit", () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const OLD = "// Odporúčame — affiliate produkty na verejnej stránke /odporucame (hlavná\n// appka, server.js). Admin tu spravuje kategórie a odkazy; verejná\n// stránka ich číta priamo z rovnakej tabuľky cez mainDb.\nconst express = require('express');\nconst router = express.Router();\nconst { requireDashAuth } = require('../lib/auth');\nconst { supabase: mainDb } = require('../lib/db-main');\n\nrouter.get('/api/dash/recommendations', requireDashAuth, async (req, res) => {\n  const { data, error } = await mainDb.from('affiliate_products').select('*').order('category_slug').order('sort_order');\n  if (error) return res.status(500).json({ error: error.message });\n  res.json({ products: data || [] });\n});\n\nrouter.post('/api/dash/recommendations', requireDashAuth, async (req, res) => {\n  const { categorySlug, categoryTitleSk, categoryTitleCs, icon, titleSk, titleCs, descriptionSk, descriptionCs, ctaSk, ctaCs, url, sortOrder } = req.body || {};\n  if (!categorySlug || !categorySlug.trim()) return res.status(400).json({ error: 'Chýba kategória.' });\n  if (!titleSk || !titleSk.trim() || !titleCs || !titleCs.trim()) return res.status(400).json({ error: 'Chýba názov produktu (SK aj CZ).' });\n  if (!url || !url.trim()) return res.status(400).json({ error: 'Chýba affiliate odkaz.' });\n  const { data, error } = await mainDb.from('affiliate_products').insert({\n    category_slug: categorySlug.trim(),\n    category_title_sk: (categoryTitleSk || '').trim() || categorySlug.trim(),\n    category_title_cs: (categoryTitleCs || '').trim() || categorySlug.trim(),\n    icon: (icon || '').trim() || '🛍️',\n    title_sk: titleSk.trim(),\n    title_cs: titleCs.trim(),\n    description_sk: (descriptionSk || '').trim(),\n    description_cs: (descriptionCs || '').trim(),\n    cta_sk: (ctaSk || '').trim() || 'Pozrieť ponuku →',\n    cta_cs: (ctaCs || '').trim() || 'Podívat se na nabídku →',\n    url: url.trim(),\n    sort_order: sortOrder ? Number(sortOrder) : 0,\n    active: true\n  }).select().single();\n  if (error) return res.status(500).json({ error: error.message });\n  res.json({ ok: true, product: data });\n});\n\nrouter.put('/api/dash/recommendations/:id', requireDashAuth, async (req, res) => {\n  const { active, sortOrder, titleSk, titleCs, descriptionSk, descriptionCs, ctaSk, ctaCs, url, icon, categoryTitleSk, categoryTitleCs } = req.body || {};\n  const update = {};\n  if (active !== undefined) update.active = !!active;\n  if (sortOrder !== undefined) update.sort_order = Number(sortOrder);\n  if (titleSk !== undefined) update.title_sk = titleSk;\n  if (titleCs !== undefined) update.title_cs = titleCs;\n  if (descriptionSk !== undefined) update.description_sk = descriptionSk;\n  if (descriptionCs !== undefined) update.description_cs = descriptionCs;\n  if (ctaSk !== undefined) update.cta_sk = ctaSk;\n  if (ctaCs !== undefined) update.cta_cs = ctaCs;\n  if (url !== undefined) update.url = url;\n  if (icon !== undefined) update.icon = icon;\n  if (categoryTitleSk !== undefined) update.category_title_sk = categoryTitleSk;\n  if (categoryTitleCs !== undefined) update.category_title_cs = categoryTitleCs;\n  const { data, error } = await mainDb.from('affiliate_products').update(update).eq('id', req.params.id).select().single();\n  if (error) return res.status(500).json({ error: error.message });\n  res.json({ ok: true, product: data });\n});\n\nrouter.delete('/api/dash/recommendations/:id', requireDashAuth, async (req, res) => {\n  const { error } = await mainDb.from('affiliate_products').delete().eq('id', req.params.id);\n  if (error) return res.status(500).json({ error: error.message });\n  res.json({ ok: true });\n});\n\nmodule.exports = router;\n";
const NEW = "// Odporúčame — affiliate produkty na verejnej stránke /odporucame (hlavná\n// appka, server.js). Admin tu spravuje kategórie a odkazy; verejná\n// stránka ich číta priamo z rovnakej tabuľky cez mainDb.\nconst express = require('express');\nconst router = express.Router();\nconst { requireDashAuth } = require('../lib/auth');\nconst { supabase: mainDb } = require('../lib/db-main');\n\nrouter.get('/api/dash/recommendations', requireDashAuth, async (req, res) => {\n  const { data, error } = await mainDb.from('affiliate_products').select('*').order('category_slug').order('sort_order');\n  if (error) return res.status(500).json({ error: error.message });\n  res.json({ products: data || [] });\n});\n\nrouter.post('/api/dash/recommendations', requireDashAuth, async (req, res) => {\n  const { categorySlug, categoryTitleSk, categoryTitleCs, icon, titleSk, titleCs, descriptionSk, descriptionCs, ctaSk, ctaCs, urlSk, urlCs, sortOrder } = req.body || {};\n  if (!categorySlug || !categorySlug.trim()) return res.status(400).json({ error: 'Chýba kategória.' });\n  if (!titleSk || !titleSk.trim() || !titleCs || !titleCs.trim()) return res.status(400).json({ error: 'Chýba názov produktu (SK aj CZ).' });\n  if (!urlSk || !urlSk.trim()) return res.status(400).json({ error: 'Chýba affiliate odkaz (SK).' });\n  const { data, error } = await mainDb.from('affiliate_products').insert({\n    category_slug: categorySlug.trim(),\n    category_title_sk: (categoryTitleSk || '').trim() || categorySlug.trim(),\n    category_title_cs: (categoryTitleCs || '').trim() || categorySlug.trim(),\n    icon: (icon || '').trim() || '🛍️',\n    title_sk: titleSk.trim(),\n    title_cs: titleCs.trim(),\n    description_sk: (descriptionSk || '').trim(),\n    description_cs: (descriptionCs || '').trim(),\n    cta_sk: (ctaSk || '').trim() || 'Pozrieť ponuku →',\n    cta_cs: (ctaCs || '').trim() || 'Podívat se na nabídku →',\n    url_sk: urlSk.trim(),\n    url_cs: (urlCs || '').trim() || urlSk.trim(),\n    sort_order: sortOrder ? Number(sortOrder) : 0,\n    active: true\n  }).select().single();\n  if (error) return res.status(500).json({ error: error.message });\n  res.json({ ok: true, product: data });\n});\n\nrouter.put('/api/dash/recommendations/:id', requireDashAuth, async (req, res) => {\n  const { active, sortOrder, titleSk, titleCs, descriptionSk, descriptionCs, ctaSk, ctaCs, urlSk, urlCs, icon, categoryTitleSk, categoryTitleCs } = req.body || {};\n  const update = {};\n  if (active !== undefined) update.active = !!active;\n  if (sortOrder !== undefined) update.sort_order = Number(sortOrder);\n  if (titleSk !== undefined) update.title_sk = titleSk;\n  if (titleCs !== undefined) update.title_cs = titleCs;\n  if (descriptionSk !== undefined) update.description_sk = descriptionSk;\n  if (descriptionCs !== undefined) update.description_cs = descriptionCs;\n  if (ctaSk !== undefined) update.cta_sk = ctaSk;\n  if (ctaCs !== undefined) update.cta_cs = ctaCs;\n  if (urlSk !== undefined) update.url_sk = urlSk;\n  if (urlCs !== undefined) update.url_cs = urlCs;\n  if (icon !== undefined) update.icon = icon;\n  if (categoryTitleSk !== undefined) update.category_title_sk = categoryTitleSk;\n  if (categoryTitleCs !== undefined) update.category_title_cs = categoryTitleCs;\n  const { data, error } = await mainDb.from('affiliate_products').update(update).eq('id', req.params.id).select().single();\n  if (error) return res.status(500).json({ error: error.message });\n  res.json({ ok: true, product: data });\n});\n\nrouter.delete('/api/dash/recommendations/:id', requireDashAuth, async (req, res) => {\n  const { error } = await mainDb.from('affiliate_products').delete().eq('id', req.params.id);\n  if (error) return res.status(500).json({ error: error.message });\n  res.json({ ok: true });\n});\n\nmodule.exports = router;\n";

let src = fs.readFileSync(ROUTES_PATH, "utf8");
if (src === NEW) {
  console.log("ℹ️  Už je aplikované, preskakujem.");
} else {
  if (src !== OLD) {
    console.error("❌ routes/recommendations.js sa nezhoduje s očakávaným obsahom (možno sa odvtedy zmenil iným spôsobom) — nič som nezmenil. Pošli mi aktuálny obsah, over.");
    process.exit(1);
  }
  const backup = ROUTES_PATH + ".pre-17-recommendations-routes-url-sk-cs-" + Date.now();
  fs.copyFileSync(ROUTES_PATH, backup);
  fs.writeFileSync(ROUTES_PATH, NEW);
  console.log("✅ routes/recommendations.js prepísaný (backend teraz prijíma urlSk/urlCs). Záloha:", backup);
}

console.log("");
console.log("Over: node -c routes/recommendations.js");
console.log("Reštart: pm2 restart sptrener-dash");
