const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('/blog-cover/')) {
  console.error('Uz je aplikovane (najdene /blog-cover/), nic som nezmenil.');
  process.exit(1);
}

const BLOG_ROUTE_ANCHOR = `app.get('/blog', async (req, res) => {`;
if (!src.includes(BLOG_ROUTE_ANCHOR)) { console.error('Nenasiel som /blog route kotvu. Nic som nezmenil.'); process.exit(1); }

const COVER_CODE = `function postCoverUrl(post) {
  return post.image_url || (BASE_URL_BLOG + '/blog-cover/' + post.slug + '.svg');
}

function escapeXml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

function wrapSvgLines(text, maxCharsPerLine, maxLines) {
  const words = String(text || '').split(/\\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const w of words) {
    const candidate = (current + ' ' + w).trim();
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current.trim());
      current = w;
      if (lines.length >= maxLines) break;
    } else {
      current = candidate;
    }
  }
  if (lines.length < maxLines && current) lines.push(current.trim());
  if (lines.length >= maxLines) {
    const usedWords = lines.join(' ').split(/\\s+/).length;
    if (usedWords < words.length) lines[maxLines - 1] = lines[maxLines - 1].replace(/\\s*\\S*$/, '').trim() + '…';
  }
  return lines;
}

// Brandovaný cover obrázok generovaný za behu z názvu + tagu (SVG, žiadny
// externý image-gen API, žiadne nové závislosti) — použitý ako fallback
// všade tam, kde blog_posts.image_url nie je ručne nastavené.
app.get('/blog-cover/:slug.svg', async (req, res) => {
  try {
    const { data: post } = await supabase.from('blog_posts').select('title,tag').eq('slug', req.params.slug).maybeSingle();
    const title = post ? post.title : 'SP Tréner';
    const tag = post ? (post.tag || '') : '';
    const lines = wrapSvgLines(title, 24, 4);
    const lineHeight = 62;
    const titleBlockHeight = lines.length * lineHeight;
    const startY = 315 - titleBlockHeight / 2 + lineHeight * 0.7;
    const tspans = lines.map((line, i) => \`<tspan x="80" y="\${startY + i * lineHeight}">\${escapeXml(line)}</tspan>\`).join('');
    const svg = \`<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f0f18"/>
      <stop offset="100%" stop-color="#08080d"/>
    </linearGradient>
    <radialGradient id="glow" cx="88%" cy="10%" r="60%">
      <stop offset="0%" stop-color="#7c5cff" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#7c5cff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <circle cx="1130" cy="55" r="8" fill="#c8ff00"/>
  <text x="80" y="78" font-family="'DM Mono', monospace" font-size="24" letter-spacing="4" fill="#eeeef5">SP TRÉNER</text>
  \${tag ? \`<text x="80" y="\${Math.max(startY - 55, 130)}" font-family="'DM Mono', monospace" font-size="22" letter-spacing="2" fill="#b09bff">\${escapeXml(tag.toUpperCase())}</text>\` : ''}
  <text font-family="Georgia, serif" font-size="52" fill="#eeeef5">\${tspans}</text>
  <rect x="80" y="565" width="64" height="4" fill="#c8ff00"/>
</svg>\`;
    res.type('image/svg+xml');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(svg);
  } catch (e) {
    res.status(500).send('');
  }
});

`;
const patched1 = src.replace(BLOG_ROUTE_ANCHOR, COVER_CODE + BLOG_ROUTE_ANCHOR);

const CARD_OLD = `function blogPostCard(post, lang) {
  const t = blogLocalized(post, lang);
  const langQS = lang === 'cs' ? '&lang=cs' : '';
  const langQP = lang === 'cs' ? '?lang=cs' : '';
  return \`<div class="post-card-wrap">
          \${post.tag ? \`<a class="post-card-tag" href="/blog?tag=\${encodeURIComponent(post.tag)}\${langQS}">\${escapeHtml(t.tag)}</a>\` : ''}
          <a class="post-card" href="/blog/\${escapeHtml(post.slug)}\${langQP}">
            <div class="post-card-title">\${escapeHtml(t.title)}</div>
            <div class="post-card-excerpt">\${escapeHtml(t.excerpt)}</div>
            \${t.readTime ? \`<div class="post-card-meta">\${escapeHtml(t.readTime)}</div>\` : ''}
          </a>
        </div>\`;
}`;
const CARD_NEW = `function blogPostCard(post, lang) {
  const t = blogLocalized(post, lang);
  const langQS = lang === 'cs' ? '&lang=cs' : '';
  const langQP = lang === 'cs' ? '?lang=cs' : '';
  return \`<div class="post-card-wrap">
          \${post.tag ? \`<a class="post-card-tag" href="/blog?tag=\${encodeURIComponent(post.tag)}\${langQS}">\${escapeHtml(t.tag)}</a>\` : ''}
          <a class="post-card" href="/blog/\${escapeHtml(post.slug)}\${langQP}">
            <img class="post-card-cover" src="\${postCoverUrl(post)}" alt="\${escapeHtml(t.title)}" loading="lazy">
            <div class="post-card-title">\${escapeHtml(t.title)}</div>
            <div class="post-card-excerpt">\${escapeHtml(t.excerpt)}</div>
            \${t.readTime ? \`<div class="post-card-meta">\${escapeHtml(t.readTime)}</div>\` : ''}
          </a>
        </div>\`;
}`;
if (!patched1.includes(CARD_OLD)) { console.error('Nenasiel som blogPostCard. Nic som nezmenil.'); process.exit(1); }
const patched2 = patched1.replace(CARD_OLD, CARD_NEW);

const LAYOUT_SIG_OLD = `function blogLayout({ title, description, body, canonicalPath, ogType, jsonLd, lang }) {
  const l = lang === 'cs' ? 'cs' : 'sk';
  const T = BLOG_I18N[l];
  const canonicalUrl = BASE_URL_BLOG + (canonicalPath || '/blog') + (l === 'cs' ? (canonicalPath && canonicalPath.includes('?') ? '&lang=cs' : '?lang=cs') : '');
  const altSkUrl = BASE_URL_BLOG + (canonicalPath || '/blog');
  const altCsUrl = altSkUrl + (canonicalPath && canonicalPath.includes('?') ? '&lang=cs' : '?lang=cs');
  const jsonLdBlocks = (jsonLd || []).map(jsonLdScript).join('\\n');`;
const LAYOUT_SIG_NEW = `function blogLayout({ title, description, body, canonicalPath, ogType, jsonLd, lang, image }) {
  const l = lang === 'cs' ? 'cs' : 'sk';
  const T = BLOG_I18N[l];
  const canonicalUrl = BASE_URL_BLOG + (canonicalPath || '/blog') + (l === 'cs' ? (canonicalPath && canonicalPath.includes('?') ? '&lang=cs' : '?lang=cs') : '');
  const altSkUrl = BASE_URL_BLOG + (canonicalPath || '/blog');
  const altCsUrl = altSkUrl + (canonicalPath && canonicalPath.includes('?') ? '&lang=cs' : '?lang=cs');
  const jsonLdBlocks = (jsonLd || []).map(jsonLdScript).join('\\n');
  const ogImage = image || (BASE_URL_BLOG + '/assets/og-image.png');`;
if (!patched2.includes(LAYOUT_SIG_OLD)) { console.error('Nenasiel som blogLayout signaturu. Nic som nezmenil.'); process.exit(1); }
const patched3 = patched2.replace(LAYOUT_SIG_OLD, LAYOUT_SIG_NEW);

const META_OLD = `<meta property="og:image" content="\${BASE_URL_BLOG}/assets/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="SP Tréner — príprava na prijímacie testy">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="\${BASE_URL_BLOG}/assets/og-image.png">`;
const META_NEW = `<meta property="og:image" content="\${ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="SP Tréner — príprava na prijímacie testy">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="\${ogImage}">`;
if (!patched3.includes(META_OLD)) { console.error('Nenasiel som og:image meta blok. Nic som nezmenil.'); process.exit(1); }
const patched4 = patched3.replace(META_OLD, META_NEW);

const CSS1_OLD = `.post-card-meta{font-family:var(--mono);font-size:.7rem;color:var(--text3);margin-top:1rem}
.empty-state{color:var(--text3);font-size:.9rem;padding:2rem 0}`;
const CSS1_NEW = `.post-card-cover{width:100%;height:160px;object-fit:cover;border-radius:12px;margin-bottom:1rem;background:var(--black3)}
.post-card-meta{font-family:var(--mono);font-size:.7rem;color:var(--text3);margin-top:1rem}
.empty-state{color:var(--text3);font-size:.9rem;padding:2rem 0}`;
if (!patched4.includes(CSS1_OLD)) { console.error('Nenasiel som .post-card-meta CSS. Nic som nezmenil.'); process.exit(1); }
const patched5 = patched4.replace(CSS1_OLD, CSS1_NEW);

const CSS2_OLD = `.prose blockquote{border-left:3px solid var(--purple2);padding-left:1.2rem;margin:1.5rem 0;color:var(--text2);font-style:italic}
.related-section{max-width:720px;margin:4rem auto 0;padding-top:2.5rem;border-top:1px solid var(--border)}`;
const CSS2_NEW = `.prose blockquote{border-left:3px solid var(--purple2);padding-left:1.2rem;margin:1.5rem 0;color:var(--text2);font-style:italic}
.prose-cover{width:100%;max-height:420px;object-fit:cover;border-radius:16px;margin:1.5rem 0 2rem;background:var(--black3);display:block}
.related-section{max-width:720px;margin:4rem auto 0;padding-top:2.5rem;border-top:1px solid var(--border)}`;
if (!patched5.includes(CSS2_OLD)) { console.error('Nenasiel som .prose blockquote CSS. Nic som nezmenil.'); process.exit(1); }
const patched6 = patched5.replace(CSS2_OLD, CSS2_NEW);

const BODY_OLD = `    const body = \`<main class="page">\${breadcrumb}<article class="prose">
      <h1 class="hero-title">\${escapeHtml(t.title)}</h1>
      <div class="prose-meta">\${post.tag ? \`<a class="tag" href="/blog?tag=\${encodeURIComponent(post.tag)}\${langQS}">\${escapeHtml(t.tag)}</a>\` : ''}\${t.readTime ? \`<span>\${escapeHtml(t.readTime)}</span>\` : ''}\${dateStr ? \`<time datetime="\${post.created_at}">\${dateStr}</time>\` : ''}</div>
      \${t.content}
    </article>\${relatedSection}</main>\`;`;
const BODY_NEW = `    const body = \`<main class="page">\${breadcrumb}<article class="prose">
      <h1 class="hero-title">\${escapeHtml(t.title)}</h1>
      <div class="prose-meta">\${post.tag ? \`<a class="tag" href="/blog?tag=\${encodeURIComponent(post.tag)}\${langQS}">\${escapeHtml(t.tag)}</a>\` : ''}\${t.readTime ? \`<span>\${escapeHtml(t.readTime)}</span>\` : ''}\${dateStr ? \`<time datetime="\${post.created_at}">\${dateStr}</time>\` : ''}</div>
      <img class="prose-cover" src="\${postCoverUrl(post)}" alt="\${escapeHtml(t.title)}">
      \${t.content}
    </article>\${relatedSection}</main>\`;`;
if (!patched6.includes(BODY_OLD)) { console.error('Nenasiel som /blog/:slug body blok. Nic som nezmenil.'); process.exit(1); }
const patched7 = patched6.replace(BODY_OLD, BODY_NEW);

const JSONLD_OLD = `    const articleJsonLd = {
      '@context': 'https://schema.org', '@type': 'Article', headline: t.title, description: t.excerpt,
      image: BASE_URL_BLOG + '/assets/og-image.png',
      datePublished: post.created_at, dateModified: post.created_at,`;
const JSONLD_NEW = `    const articleJsonLd = {
      '@context': 'https://schema.org', '@type': 'Article', headline: t.title, description: t.excerpt,
      image: postCoverUrl(post),
      datePublished: post.created_at, dateModified: post.created_at,`;
if (!patched7.includes(JSONLD_OLD)) { console.error('Nenasiel som articleJsonLd. Nic som nezmenil.'); process.exit(1); }
const patched8 = patched7.replace(JSONLD_OLD, JSONLD_NEW);

const SEND_OLD = `    res.send(blogLayout({
      title: t.title + ' — SP Tréner',
      description: t.excerpt,
      body,
      canonicalPath: '/blog/' + post.slug,
      ogType: 'article',
      jsonLd: [articleJsonLd, breadcrumbJsonLd],
      lang
    }));`;
const SEND_NEW = `    res.send(blogLayout({
      title: t.title + ' — SP Tréner',
      description: t.excerpt,
      body,
      canonicalPath: '/blog/' + post.slug,
      ogType: 'article',
      jsonLd: [articleJsonLd, breadcrumbJsonLd],
      lang,
      image: postCoverUrl(post)
    }));`;
if (!patched8.includes(SEND_OLD)) { console.error('Nenasiel som /blog/:slug blogLayout() volanie. Nic som nezmenil.'); process.exit(1); }
const patched9 = patched8.replace(SEND_OLD, SEND_NEW);

const backup = FILE + '.pre-blog-cover-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched9);
console.log('OK - zaloha:', backup);
