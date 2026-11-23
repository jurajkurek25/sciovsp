// AutoSEO (getautoseo.com) webhook receiver.
//
// Self-contained on purpose: creates its own pg Pool from DATABASE_URL
// instead of requiring ../db/pool, so it has zero dependency on the
// exact internal file layout of whatever server.js is running this —
// a missing/renamed shared module here must never crash app startup.
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
const { Pool } = require('pg');

const BASE_URL = (process.env.BASE_URL || 'https://sptrener.online').replace(/\/$/, '');
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads', 'autoseo');
const UPLOAD_URL_PREFIX = '/uploads/autoseo/';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on('error', (err) => console.error('[AutoSEO webhook] pg pool error:', err));

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

  const hero = row.hero_image_url
    ? `<img src="${escapeHtml(row.hero_image_url)}" alt="${escapeHtml(row.hero_image_alt)}" style="width:100%;max-width:900px;border-radius:12px;margin:0 0 1.5rem;display:block">`
    : '';
  const infographic = row.infographic_image_url
    ? `<img src="${escapeHtml(row.infographic_image_url)}" alt="" style="width:100%;max-width:900px;border-radius:12px;margin:1.5rem 0;display:block">`
    : '';

  return `<!DOCTYPE html>
<html lang="${escapeHtml(row.language_code || 'en')}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
${row.hero_image_url ? `<meta property="og:image" content="${escapeHtml(BASE_URL + row.hero_image_url)}">` : ''}
${faqLd}
</head>
<body style="max-width:760px;margin:0 auto;padding:2.5rem 1.5rem;font-family:system-ui,-apple-system,sans-serif;line-height:1.7;color:#1a1a1a">
<article>
<h1 style="font-size:2rem;line-height:1.25;margin-bottom:1.25rem">${title}</h1>
${hero}
${row.content_html || ''}
${infographic}
</article>
</body>
</html>`;
}

module.exports = function registerAutoseoRoutes(app) {
  const express = require('express');

  const TOKEN = process.env.AUTOSEO_WEBHOOK_TOKEN;
  if (!TOKEN) {
    console.warn('[AutoSEO webhook] AUTOSEO_WEBHOOK_TOKEN not set — /api/webhooks/autoseo will reject every request with 401 until it is configured in .env.');
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
          keywords: JSON.stringify(payload.keywords || []),
          meta_keywords: payload.metaKeywords || null,
          faq_schema: payload.faqSchema ? JSON.stringify(payload.faqSchema) : null,
          language_code: payload.languageCode || 'en',
          source_article_id: payload.sourceArticleId || null,
          status: payload.status || 'published',
          published_at: payload.publishedAt || null,
          updated_at: payload.updatedAt || new Date().toISOString(),
          created_at: payload.createdAt || new Date().toISOString(),
        };

        await pool.query(
          `INSERT INTO autoseo_posts (
             id, event, title, slug, published_url, meta_description,
             content_html, content_markdown, hero_image_url, hero_image_alt,
             infographic_image_url, keywords, meta_keywords, faq_schema,
             language_code, source_article_id, status, published_at, updated_at, created_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
           ON CONFLICT (id) DO UPDATE SET
             event = EXCLUDED.event,
             title = EXCLUDED.title,
             slug = EXCLUDED.slug,
             published_url = EXCLUDED.published_url,
             meta_description = EXCLUDED.meta_description,
             content_html = EXCLUDED.content_html,
             content_markdown = EXCLUDED.content_markdown,
             hero_image_url = EXCLUDED.hero_image_url,
             hero_image_alt = EXCLUDED.hero_image_alt,
             infographic_image_url = EXCLUDED.infographic_image_url,
             keywords = EXCLUDED.keywords,
             meta_keywords = EXCLUDED.meta_keywords,
             faq_schema = EXCLUDED.faq_schema,
             language_code = EXCLUDED.language_code,
             source_article_id = EXCLUDED.source_article_id,
             status = EXCLUDED.status,
             published_at = EXCLUDED.published_at,
             updated_at = EXCLUDED.updated_at`,
          [
            row.id, row.event, row.title, row.slug, row.published_url, row.meta_description,
            row.content_html, row.content_markdown, row.hero_image_url, row.hero_image_alt,
            row.infographic_image_url, row.keywords, row.meta_keywords, row.faq_schema,
            row.language_code, row.source_article_id, row.status, row.published_at,
            row.updated_at, row.created_at,
          ]
        );

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
      const { rows } = await pool.query('SELECT * FROM autoseo_posts WHERE slug = $1 LIMIT 1', [req.params.slug]);
      if (!rows.length) return next();
      res.set({
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'same-origin',
      });
      return res.status(200).send(renderArticlePage(rows[0]));
    } catch (err) {
      console.error('[AutoSEO blog route] error:', err);
      return next();
    }
  });
};
