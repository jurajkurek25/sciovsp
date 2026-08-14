// AutoSEO (getautoseo.com) webhook receiver.
//
// Deliberately zero-dependency: talks to Supabase via its REST API
// (PostgREST) using Node's built-in global fetch() instead of the
// @supabase/supabase-js SDK — that package isn't a dependency of the main
// app (only dash-service/instructor-service have it), and a missing
// module here must never crash server.js at require-time again.
//
// module.exports is a function you call as require('./routes/autoseoWebhook')(app)
// as EARLY as possible (right after `const app = express()`), before the
// app-wide express.json() body parser is mounted. That ordering matters for
// two independent reasons:
//   1. The webhook route needs the RAW request body bytes (not re-parsed
//      JSON) to verify the HMAC signature, so it must own its own
//      express.raw() middleware and get first crack at the request.
//   2. The GET /blog/:slug route below is registered before whatever
//      /blog/:slug handler already exists elsewhere in server.js, so it
//      can try AutoSEO's table first and call next() to fall through to
//      the existing handler when there's no match — without needing to
//      know anything about that handler's internals.
'use strict';

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const BASE_URL = (process.env.BASE_URL || 'https://sptrener.online').replace(/\/$/, '');
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads', 'autoseo');
const UPLOAD_URL_PREFIX = '/uploads/autoseo/';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function supabaseHeaders(extra) {
  return Object.assign(
    {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: 'Bearer ' + SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
    },
    extra || {}
  );
}

async function supabaseUpsert(table, row, conflictColumn) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${encodeURIComponent(conflictColumn)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: supabaseHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase upsert failed (${res.status}): ${text}`);
  }
}

async function supabaseSelectBySlug(table, slug) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`;
  const res = await fetch(url, { headers: supabaseHeaders() });
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifySignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return true; // signature verification is optional per AutoSEO's spec
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return timingSafeEqualStr(expected, signatureHeader);
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
};

function guessExt(contentType, url) {
  const ct = (contentType || '').split(';')[0].trim();
  if (EXT_BY_MIME[ct]) return EXT_BY_MIME[ct];
  const m = String(url || '').match(/\.(jpe?g|png|webp|gif|svg)(\?|#|$)/i);
  return m ? '.' + m[1].toLowerCase().replace('jpeg', 'jpg') : '.jpg';
}

// Best-effort download: on any failure, resolves null so the caller falls
// back to hotlinking the original remote URL rather than failing the whole
// webhook delivery over a flaky image CDN.
function downloadImage(url, basename) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    let parsed;
    try { parsed = new URL(url); } catch { return resolve(null); }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return resolve(null);

    const lib = parsed.protocol === 'https:' ? https : http;
    const MAX_BYTES = 8 * 1024 * 1024; // 8MB cap
    const req = lib.get(url, { timeout: 10000 }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }
      const contentType = res.headers['content-type'] || '';
      if (!contentType.startsWith('image/')) { res.resume(); return resolve(null); }

      const chunks = [];
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_BYTES) { req.destroy(); resolve(null); }
        else chunks.push(chunk);
      });
      res.on('end', () => {
        try {
          fs.mkdirSync(UPLOAD_DIR, { recursive: true });
          const filename = basename + guessExt(contentType, url);
          fs.writeFileSync(path.join(UPLOAD_DIR, filename), Buffer.concat(chunks));
          resolve(UPLOAD_URL_PREFIX + filename);
        } catch (err) {
          console.error('[AutoSEO webhook] image write failed:', err.message);
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// Matches public/blog's own visual system exactly (nav, CSS classes, footer)
// as defined in ad-service/20-blog-czech.js's blogLayout() — kept as a
// self-contained copy here since that function lives inline in server.js
// and can't be imported from a separate route file.
const SITE_CSS = `:root{--black:#08080d;--black2:#0f0f18;--border:rgba(255,255,255,.07);--border2:rgba(255,255,255,.13);--text:#eeeef5;--text2:#a1a1bc;--text3:#5c5c7a;--volt:#c8ff00;--purple:#7c5cff;--purple2:#b09bff;--serif:'Instrument Serif',Georgia,serif;--mono:'DM Mono',monospace;--sans:'DM Sans',sans-serif}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{background:var(--black);color:var(--text);font-family:var(--sans);line-height:1.65;overflow-x:hidden}
a{color:inherit}
nav{position:sticky;top:0;z-index:100;padding:1rem clamp(1rem,4vw,2rem);padding-top:calc(1rem + env(safe-area-inset-top));display:flex;justify-content:space-between;align-items:center;gap:.75rem;flex-wrap:wrap;background:rgba(8,8,13,.9);backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}
.nav-logo{font-family:var(--mono);font-size:13px;letter-spacing:.15em;color:var(--text);text-decoration:none;white-space:nowrap;display:inline-flex;align-items:center;gap:.55rem}
.nav-dot{width:7px;height:7px;background:var(--volt);border-radius:50%;animation:pulse-dot 2s infinite;display:inline-block}
@keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.7)}}
.nav-link{text-decoration:none;font-family:var(--mono);font-size:.78rem;letter-spacing:.05em;border-radius:8px;transition:all .2s;color:var(--text2);padding:.65rem .85rem;border:1px solid transparent}
.nav-link:hover{color:var(--text);border-color:var(--border2)}
.nav-cta{padding:.6rem 1rem;background:var(--volt);color:var(--black);border-radius:8px;font-weight:700;font-family:var(--mono);font-size:.78rem;text-decoration:none;white-space:nowrap;border:none;cursor:pointer}
.page{max-width:900px;margin:0 auto;padding:clamp(2rem,6vw,3.5rem) clamp(1rem,4vw,2rem) clamp(3rem,6vw,6rem)}
.breadcrumb{font-family:var(--mono);font-size:.72rem;color:var(--text3);margin-bottom:1.5rem;display:flex;gap:.4rem;flex-wrap:wrap}
.breadcrumb a{color:var(--text3);text-decoration:none}
.breadcrumb a:hover{color:var(--purple2)}
.hero-title{font-family:var(--serif);font-size:clamp(2rem,6vw,3.6rem);line-height:1.1;margin-bottom:1rem}
.prose{max-width:720px;margin:0 auto;line-height:1.8}
.prose-meta{display:flex;gap:.75rem;align-items:center;margin-bottom:2rem;font-family:var(--mono);font-size:.72rem;color:var(--text3);flex-wrap:wrap}
.prose-meta .tag{color:var(--purple2);text-decoration:none}
.prose h2{font-family:var(--serif);font-size:clamp(1.5rem,3vw,1.9rem);margin:2.4rem 0 1.1rem}
.prose h3{font-family:var(--sans);font-weight:700;font-size:1.05rem;margin:1.8rem 0 .8rem}
.prose p{color:var(--text2);margin-bottom:1.25rem;font-size:1.02rem}
.prose ul,.prose ol{color:var(--text2);margin:0 0 1.25rem 1.2rem}
.prose li{margin-bottom:.5rem}
.prose strong{color:var(--text)}
.prose img{max-width:100%;height:auto;border-radius:12px;margin:1.5rem 0}
.prose a{color:var(--purple2)}
.prose blockquote{border-left:3px solid var(--purple2);padding-left:1.2rem;margin:1.5rem 0;color:var(--text2);font-style:italic}
footer{border-top:1px solid var(--border);padding:2rem clamp(1rem,4vw,2rem);padding-bottom:calc(2rem + env(safe-area-inset-bottom));display:flex;justify-content:space-between;flex-wrap:wrap;gap:1rem;max-width:900px;margin:0 auto}
.footer-logo{font-family:var(--mono);font-size:12px;color:var(--text3)}
.footer-links{display:flex;gap:1.4rem;flex-wrap:wrap}
.footer-links a{font-family:var(--mono);font-size:12px;color:var(--text3);text-decoration:none}
.footer-links a:hover{color:var(--text2)}`;

function siteNav() {
  return `<nav id="mainNav">
  <a href="/" class="nav-logo"><span class="nav-dot"></span>SP TRÉNER</a>
  <div style="display:flex;align-items:center;gap:.75rem">
    <a href="/blog" class="nav-link">Blog</a>
    <button class="nav-cta" onclick="location.href='/?openPremium=1'">Začať zadarmo →</button>
  </div>
</nav>`;
}

function siteFooter() {
  return `<footer>
  <div class="footer-logo">SP TRÉNER © 2026</div>
  <div class="footer-links">
    <a href="/app">Aplikácia</a>
    <a href="/blog">Blog</a>
    <a href="mailto:juraj@jurajkurek.com">Kontakt</a>
    <a href="/legal.html#vop">Obchodné podmienky</a>
    <a href="/legal.html#privacy">Ochrana súkromia</a>
  </div>
</footer>`;
}

function renderArticlePage(row) {
  const title = escapeHtml(row.title);
  const desc = escapeHtml(row.meta_description);
  const canonical = escapeHtml(row.published_url || (BASE_URL + '/blog/' + row.slug));

  let faqLd = '';
  if (Array.isArray(row.faq_schema) && row.faq_schema.length) {
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: row.faq_schema
        .filter(f => f && f.question && f.answer)
        .map(f => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
    };
    faqLd = `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`;
  }

  const articleLd = `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: row.title,
    description: row.meta_description,
    datePublished: row.published_at || row.created_at,
    dateModified: row.updated_at || row.published_at || row.created_at,
    author: { '@type': 'Organization', name: 'SP Tréner' },
    publisher: { '@type': 'Organization', name: 'SP Tréner' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    inLanguage: row.language_code || 'en',
    ...(row.hero_image_url ? { image: BASE_URL + row.hero_image_url } : {}),
  }).replace(/</g, '\\u003c')}</script>`;

  const hero = row.hero_image_url
    ? `<img src="${escapeHtml(row.hero_image_url)}" alt="${escapeHtml(row.hero_image_alt)}" style="width:100%;border-radius:12px;margin:0 0 1.5rem;display:block">`
    : '';
  const infographic = row.infographic_image_url
    ? `<img src="${escapeHtml(row.infographic_image_url)}" alt="" style="border-radius:12px;margin:1.5rem 0;display:block">`
    : '';

  const dateStr = row.published_at
    ? new Date(row.published_at).toLocaleDateString(row.language_code === 'sk' ? 'sk-SK' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';
  const proseMeta = dateStr ? `<div class="prose-meta"><time datetime="${escapeHtml(row.published_at)}">${escapeHtml(dateStr)}</time></div>` : '';

  const breadcrumb = `<nav class="breadcrumb"><a href="/">SP Tréner</a><span>/</span><a href="/blog">Blog</a><span>/</span><span>${title}</span></nav>`;

  return `<!DOCTYPE html>
<html lang="${escapeHtml(row.language_code || 'en')}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${title} — SP Tréner</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:site_name" content="SP Tréner">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
<meta name="theme-color" content="#08080d">
${row.hero_image_url ? `<meta property="og:image" content="${escapeHtml(BASE_URL + row.hero_image_url)}">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Mono:wght@300;400;500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700&display=swap" rel="stylesheet">
${faqLd}
${articleLd}
<style>${SITE_CSS}</style>
</head>
<body>
${siteNav()}
<main class="page">${breadcrumb}<article class="prose">
<h1 class="hero-title">${title}</h1>
${proseMeta}
${hero}
${row.content_html || ''}
${infographic}
</article></main>
${siteFooter()}
</body>
</html>`;
}

module.exports = function registerAutoseoRoutes(app) {
  const express = require('express');

  const TOKEN = process.env.AUTOSEO_WEBHOOK_TOKEN;
  if (!TOKEN) {
    console.warn('[AutoSEO webhook] AUTOSEO_WEBHOOK_TOKEN not set — /api/webhooks/autoseo will reject every request with 401 until it is configured in .env.');
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.warn('[AutoSEO webhook] SUPABASE_URL / SUPABASE_SERVICE_KEY not set — /api/webhooks/autoseo will fail on every non-test event until they are configured in .env.');
  }

  app.post(
    '/api/webhooks/autoseo',
    express.raw({ type: 'application/json', limit: '5mb' }),
    async (req, res) => {
      try {
        const rawBody = req.body; // Buffer — express.raw() does not parse it
        const authHeader = req.get('Authorization') || '';
        const providedToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

        if (!TOKEN || !timingSafeEqualStr(providedToken, TOKEN)) {
          return res.status(401).json({ error: 'Invalid or missing bearer token.' });
        }

        const signature = req.get('X-AutoSEO-Signature');
        if (!verifySignature(rawBody, signature, TOKEN)) {
          return res.status(401).json({ error: 'Invalid signature.' });
        }

        let payload;
        try { payload = JSON.parse(rawBody.toString('utf8')); }
        catch { return res.status(400).json({ error: 'Invalid JSON body.' }); }

        if (payload.event === 'test') {
          return res.status(200).json({ url: BASE_URL + '/test' });
        }

        if (payload.event !== 'article.published' && payload.event !== 'article.updated') {
          return res.status(400).json({ error: 'Unknown event type: ' + payload.event });
        }
        if (!payload.id || !payload.title) {
          return res.status(400).json({ error: 'Missing required fields (id, title).' });
        }
        if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
          return res.status(500).json({ error: 'Server misconfigured: SUPABASE_URL/SUPABASE_SERVICE_KEY missing.' });
        }

        const slug = payload.slug ? slugify(payload.slug) : slugify(payload.title);
        const basename = 'article-' + payload.id + '-' + Date.now();

        const [heroLocal, infographicLocal] = await Promise.all([
          downloadImage(payload.heroImageUrl, basename + '-hero'),
          downloadImage(payload.infographicImageUrl, basename + '-infographic'),
        ]);

        const publicUrl = BASE_URL + '/blog/' + slug;

        const row = {
          id: payload.id,
          event: payload.event,
          title: payload.title,
          slug,
          published_url: publicUrl,
          meta_description: payload.metaDescription || '',
          content_html: payload.content_html || '',
          content_markdown: payload.content_markdown || '',
          hero_image_url: heroLocal || payload.heroImageUrl || null,
          hero_image_alt: payload.heroImageAlt || null,
          infographic_image_url: infographicLocal || payload.infographicImageUrl || null,
          keywords: payload.keywords || [],
          meta_keywords: payload.metaKeywords || null,
          faq_schema: payload.faqSchema || null,
          language_code: payload.languageCode || 'en',
          source_article_id: payload.sourceArticleId || null,
          status: payload.status || 'published',
          published_at: payload.publishedAt || null,
          updated_at: payload.updatedAt || new Date().toISOString(),
          created_at: payload.createdAt || new Date().toISOString(),
        };

        await supabaseUpsert('autoseo_posts', row, 'id');

        return res.status(200).json({ url: publicUrl });
      } catch (err) {
        console.error('[AutoSEO webhook] error:', err);
        return res.status(500).json({ error: 'Internal error, please retry.' });
      }
    }
  );

  // Try an AutoSEO-sourced article first; fall through to whatever
  // /blog/:slug handler is registered later in server.js when there's no
  // match, so existing blog posts keep working exactly as before.
  app.get('/blog/:slug', async (req, res, next) => {
    try {
      if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return next();
      const row = await supabaseSelectBySlug('autoseo_posts', req.params.slug);
      if (!row) return next();
      res.set({
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'same-origin',
      });
      return res.status(200).send(renderArticlePage(row));
    } catch (err) {
      console.error('[AutoSEO blog route] error:', err);
      return next();
    }
  });
};
