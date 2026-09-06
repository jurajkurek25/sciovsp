// Kompletne prerába blog sekciu (blogLayout + /blog + /blog/:slug) na:
// - lepšie čítanie: väčší riadkovanie, blockquote štýl, dátum článku,
//   breadcrumb navigácia, "Ďalšie články" na konci (bez nutnosti appky)
// - SEO: canonical URL, Open Graph, Twitter Card meta tagy
// - "AI SEO": JSON-LD štruktúrované dáta (Article, BreadcrumbList, Blog +
//   ItemList) — presne to, čo čítajú AI crawlery (GPTBot, ClaudeBot,
//   PerplexityBot) aj Google rich results
// - nový /sitemap.xml (dynamicky zo všetkých publikovaných článkov)
//
// Nahrádza celú blog sekciu naraz podľa kotiev (nie presný textový match) —
// bezpečnejšie po viacerých predošlých patchoch, kde by sa mohol text mierne
// líšiť. Predpoklad: 12-fix-blog-design.js a 13-add-blog-tag-filter.js už
// boli aplikované.
//
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online:
//   node /root/ad-service/14-blog-seo-and-reading-experience.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
const src = fs.readFileSync(SERVER_PATH, 'utf8');

if (src.includes('BASE_URL_BLOG')) {
  console.error('❌ Vyzerá to, že oprava je už aplikovaná (nájdené "BASE_URL_BLOG"). Nič som nezmenil.');
  process.exit(1);
}

const startAnchor = 'function blogLayout({ title, description, body }) {';
const endAnchor = "app.get('/:customCode(";

const startIdx = src.indexOf(startAnchor);
if (startIdx === -1) {
  console.error('❌ Nenašiel som začiatočnú kotvu ("function blogLayout..."). Nič som nezmenil. Over, či sú aplikované patche 12 a 13.');
  process.exit(1);
}
const endIdx = src.indexOf(endAnchor, startIdx);
if (endIdx === -1) {
  console.error('❌ Nenašiel som koncovú kotvu ("app.get(\'/:customCode("). Nič som nezmenil.');
  process.exit(1);
}

const NEW_SECTION = `const BASE_URL_BLOG = 'https://sptrener.online';

function jsonLdScript(obj) {
  return \`<script type="application/ld+json">\${JSON.stringify(obj).replace(/</g, '\\\\u003c')}</script>\`;
}

function blogLayout({ title, description, body, canonicalPath, ogType, jsonLd }) {
  const canonicalUrl = BASE_URL_BLOG + (canonicalPath || '/blog');
  const jsonLdBlocks = (jsonLd || []).map(jsonLdScript).join('\\n');
  return \`<!DOCTYPE html><html lang="sk"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>\${escapeHtml(title)}</title>
<meta name="description" content="\${escapeHtml(description)}">
<link rel="canonical" href="\${canonicalUrl}">
<meta property="og:type" content="\${ogType || 'website'}">
<meta property="og:title" content="\${escapeHtml(title)}">
<meta property="og:description" content="\${escapeHtml(description)}">
<meta property="og:url" content="\${canonicalUrl}">
<meta property="og:site_name" content="SP Tréner">
<meta property="og:locale" content="sk_SK">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="\${escapeHtml(title)}">
<meta name="twitter:description" content="\${escapeHtml(description)}">
<meta name="theme-color" content="#08080d">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Mono:wght@300;400;500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700&display=swap" rel="stylesheet">
\${jsonLdBlocks}
<style>
:root{--black:#08080d;--black2:#0f0f18;--border:rgba(255,255,255,.07);--border2:rgba(255,255,255,.13);--text:#eeeef5;--text2:#a1a1bc;--text3:#5c5c7a;--volt:#c8ff00;--purple:#7c5cff;--purple2:#b09bff;--serif:'Instrument Serif',Georgia,serif;--mono:'DM Mono',monospace;--sans:'DM Sans',sans-serif}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{background:var(--black);color:var(--text);font-family:var(--sans);line-height:1.65;overflow-x:hidden}
a{color:inherit}
nav{position:sticky;top:0;z-index:100;padding:1rem clamp(1rem,4vw,2rem);padding-top:calc(1rem + env(safe-area-inset-top));display:flex;justify-content:space-between;align-items:center;gap:.75rem;flex-wrap:wrap;background:rgba(8,8,13,.9);backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}
.nav-logo{font-family:var(--mono);font-size:13px;letter-spacing:.15em;color:var(--text);text-decoration:none;white-space:nowrap}
.nav-cta{padding:.6rem 1rem;background:var(--volt);color:var(--black);border-radius:8px;font-weight:700;font-family:var(--mono);font-size:.78rem;text-decoration:none;white-space:nowrap}
.page{max-width:900px;margin:0 auto;padding:clamp(2rem,6vw,3.5rem) clamp(1rem,4vw,2rem) clamp(3rem,6vw,6rem)}
.breadcrumb{font-family:var(--mono);font-size:.72rem;color:var(--text3);margin-bottom:1.5rem;display:flex;gap:.4rem;flex-wrap:wrap}
.breadcrumb a{color:var(--text3);text-decoration:none}
.breadcrumb a:hover{color:var(--purple2)}
.back-link{display:inline-block;font-family:var(--mono);font-size:.78rem;color:var(--text3);text-decoration:none;margin-bottom:1.5rem}
.back-link:hover{color:var(--purple2)}
.hero-title{font-family:var(--serif);font-size:clamp(2rem,6vw,3.6rem);line-height:1.1;margin-bottom:1rem}
.hero-title em{font-style:italic;color:var(--purple2)}
.hero-sub{color:var(--text2);max-width:640px;margin-bottom:1rem}
.post-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.25rem;margin-top:2rem}
.post-card-wrap{display:flex;flex-direction:column}
.post-card{background:rgba(15,15,24,.82);border:1px solid var(--border);border-radius:16px;padding:1.5rem;text-decoration:none;color:inherit;display:flex;flex-direction:column;flex:1;transition:border-color .15s,transform .15s}
.post-card:hover{border-color:var(--border2);transform:translateY(-2px)}
.post-card-tag{align-self:flex-start;font-family:var(--mono);font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;color:var(--purple2);margin-bottom:.5rem;text-decoration:none}
.post-card-tag:hover{color:var(--volt)}
.post-card-title{font-family:var(--serif);font-size:1.35rem;color:var(--text);margin-bottom:.5rem;line-height:1.25}
.post-card-excerpt{color:var(--text2);font-size:.88rem;flex:1}
.post-card-meta{font-family:var(--mono);font-size:.7rem;color:var(--text3);margin-top:1rem}
.empty-state{color:var(--text3);font-size:.9rem;padding:2rem 0}
.prose{max-width:720px;margin:0 auto;line-height:1.8}
.prose-meta{display:flex;gap:.75rem;align-items:center;margin-bottom:2rem;font-family:var(--mono);font-size:.72rem;color:var(--text3);flex-wrap:wrap}
.prose-meta .tag{color:var(--purple2);text-decoration:none}
.prose-meta .tag:hover{color:var(--volt)}
.prose h2{font-family:var(--serif);font-size:clamp(1.5rem,3vw,1.9rem);margin:2.4rem 0 1.1rem}
.prose h3{font-family:var(--sans);font-weight:700;font-size:1.05rem;margin:1.8rem 0 .8rem}
.prose p{color:var(--text2);margin-bottom:1.25rem;font-size:1.02rem}
.prose ul,.prose ol{color:var(--text2);margin:0 0 1.25rem 1.2rem}
.prose li{margin-bottom:.5rem}
.prose strong{color:var(--text)}
.prose img{max-width:100%;height:auto;border-radius:12px;margin:1.5rem 0}
.prose a{color:var(--purple2)}
.prose blockquote{border-left:3px solid var(--purple2);padding-left:1.2rem;margin:1.5rem 0;color:var(--text2);font-style:italic}
.related-section{max-width:720px;margin:4rem auto 0;padding-top:2.5rem;border-top:1px solid var(--border)}
.related-heading{font-family:var(--serif);font-size:1.4rem;margin-bottom:1.5rem}
footer{border-top:1px solid var(--border);padding:2rem clamp(1rem,4vw,2rem);padding-bottom:calc(2rem + env(safe-area-inset-bottom));display:flex;justify-content:space-between;flex-wrap:wrap;gap:1rem;max-width:900px;margin:0 auto}
.footer-logo{font-family:var(--mono);font-size:12px;color:var(--text3)}
.footer-link{font-family:var(--mono);font-size:12px;color:var(--text3);text-decoration:none}
</style></head><body>
<nav><a href="/" class="nav-logo">SP TRÉNER</a><a href="/app" class="nav-cta">Prejsť do aplikácie →</a></nav>
\${body}
<footer><div class="footer-logo">SP TRÉNER © 2026</div><a href="/app" class="footer-link">Aplikácia</a></footer>
</body></html>\`;
}

app.get('/sitemap.xml', async (req, res) => {
  try {
    const { data: posts } = await supabase.from('blog_posts').select('slug,created_at').eq('published', true);
    const urls = [
      { loc: BASE_URL_BLOG + '/', changefreq: 'weekly', priority: '1.0' },
      { loc: BASE_URL_BLOG + '/blog', changefreq: 'daily', priority: '0.8' },
      ...(posts || []).map(p => ({ loc: BASE_URL_BLOG + '/blog/' + p.slug, lastmod: p.created_at, changefreq: 'monthly', priority: '0.6' }))
    ];
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\\n'
      + urls.map(u => '  <url><loc>' + u.loc + '</loc>' + (u.lastmod ? '<lastmod>' + new Date(u.lastmod).toISOString().slice(0, 10) + '</lastmod>' : '') + '<changefreq>' + u.changefreq + '</changefreq><priority>' + u.priority + '</priority></url>').join('\\n')
      + '\\n</urlset>';
    res.type('application/xml').send(xml);
  } catch (e) {
    res.status(500).send('');
  }
});

app.get('/blog', async (req, res) => {
  try {
    const tagFilter = req.query.tag ? String(req.query.tag).slice(0, 100) : null;
    let query = supabase.from('blog_posts').select('slug,title,excerpt,tag,read_time,created_at').eq('published', true);
    if (tagFilter) query = query.eq('tag', tagFilter);
    const { data: posts } = await query.order('created_at', { ascending: false });
    const list = posts || [];
    const grid = list.length
      ? \`<div class="post-grid">\${list.map(p => \`
        <div class="post-card-wrap">
          \${p.tag ? \`<a class="post-card-tag" href="/blog?tag=\${encodeURIComponent(p.tag)}">\${escapeHtml(p.tag)}</a>\` : ''}
          <a class="post-card" href="/blog/\${escapeHtml(p.slug)}">
            <div class="post-card-title">\${escapeHtml(p.title)}</div>
            <div class="post-card-excerpt">\${escapeHtml(p.excerpt)}</div>
            \${p.read_time ? \`<div class="post-card-meta">\${escapeHtml(p.read_time)}</div>\` : ''}
          </a>
        </div>\`).join('')}</div>\`
      : \`<div class="empty-state">\${tagFilter ? 'V tejto kategórii zatiaľ nie sú žiadne články.' : 'Zatiaľ tu nie sú žiadne články — čoskoro pridáme prvé.'}</div>\`;
    const subLine = tagFilter
      ? \`<p class="hero-sub">Kategória: <strong>\${escapeHtml(tagFilter)}</strong> · <a href="/blog" style="color:var(--purple2)">zobraziť všetky →</a></p>\`
      : \`<p class="hero-sub">Postupy, stratégie a časté chyby priamo od tímu SP Tréner.</p>\`;
    const breadcrumb = \`<nav class="breadcrumb"><a href="/">SP Tréner</a><span>/</span><span>Blog\${tagFilter ? ' / ' + escapeHtml(tagFilter) : ''}</span></nav>\`;
    const body = \`<main class="page">
      \${breadcrumb}
      <h1 class="hero-title">Ako sa <em>naozaj</em> pripraviť na prijímacie testy.</h1>
      \${subLine}
      \${grid}
    </main>\`;
    const blogJsonLd = {
      '@context': 'https://schema.org', '@type': 'Blog', name: 'SP Tréner Blog', url: BASE_URL_BLOG + '/blog',
      blogPost: list.map(p => ({ '@type': 'BlogPosting', headline: p.title, url: BASE_URL_BLOG + '/blog/' + p.slug, datePublished: p.created_at }))
    };
    res.send(blogLayout({
      title: (tagFilter ? tagFilter + ' — ' : '') + 'Blog — SP Tréner',
      description: 'Postupy a stratégie príprav na prijímacie testy na vysokú školu — VŠP, psychológia, analytická aj verbálna časť.',
      body,
      canonicalPath: tagFilter ? '/blog?tag=' + encodeURIComponent(tagFilter) : '/blog',
      jsonLd: [blogJsonLd]
    }));
  } catch (e) {
    res.status(500).send('Chyba servera.');
  }
});

app.get('/blog/:slug', async (req, res) => {
  try {
    const { data: post } = await supabase.from('blog_posts').select('*').eq('slug', req.params.slug).eq('published', true).single();
    if (!post) return res.status(404).send(blogLayout({ title: 'Nenájdené', description: '', canonicalPath: '/blog/' + req.params.slug, body: '<main class="page"><a href="/blog" class="back-link">← Späť na blog</a><div class="prose"><h2>Článok sa nenašiel</h2></div></main>' }));

    const { data: related } = await supabase.from('blog_posts').select('slug,title,excerpt,tag,read_time').eq('published', true).neq('slug', req.params.slug).order('created_at', { ascending: false }).limit(3);
    const relatedList = related || [];
    const relatedSection = relatedList.length ? \`<section class="related-section">
      <h2 class="related-heading">Ďalšie články</h2>
      <div class="post-grid">\${relatedList.map(p => \`
        <div class="post-card-wrap">
          \${p.tag ? \`<a class="post-card-tag" href="/blog?tag=\${encodeURIComponent(p.tag)}">\${escapeHtml(p.tag)}</a>\` : ''}
          <a class="post-card" href="/blog/\${escapeHtml(p.slug)}">
            <div class="post-card-title">\${escapeHtml(p.title)}</div>
            <div class="post-card-excerpt">\${escapeHtml(p.excerpt)}</div>
            \${p.read_time ? \`<div class="post-card-meta">\${escapeHtml(p.read_time)}</div>\` : ''}
          </a>
        </div>\`).join('')}</div>
    </section>\` : '';

    const dateStr = post.created_at ? new Date(post.created_at).toLocaleDateString('sk-SK', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
    const breadcrumb = \`<nav class="breadcrumb"><a href="/">SP Tréner</a><span>/</span><a href="/blog">Blog</a><span>/</span><span>\${escapeHtml(post.title)}</span></nav>\`;
    const body = \`<main class="page">\${breadcrumb}<article class="prose">
      <h1 class="hero-title">\${escapeHtml(post.title)}</h1>
      <div class="prose-meta">\${post.tag ? \`<a class="tag" href="/blog?tag=\${encodeURIComponent(post.tag)}">\${escapeHtml(post.tag)}</a>\` : ''}\${post.read_time ? \`<span>\${escapeHtml(post.read_time)}</span>\` : ''}\${dateStr ? \`<time datetime="\${post.created_at}">\${dateStr}</time>\` : ''}</div>
      \${post.content}
    </article>\${relatedSection}</main>\`;

    const articleJsonLd = {
      '@context': 'https://schema.org', '@type': 'Article', headline: post.title, description: post.excerpt,
      datePublished: post.created_at, dateModified: post.created_at,
      author: { '@type': 'Organization', name: 'SP Tréner' },
      publisher: { '@type': 'Organization', name: 'SP Tréner' },
      mainEntityOfPage: { '@type': 'WebPage', '@id': BASE_URL_BLOG + '/blog/' + post.slug },
      inLanguage: 'sk',
      ...(post.tag ? { keywords: post.tag } : {})
    };
    const breadcrumbJsonLd = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'SP Tréner', item: BASE_URL_BLOG + '/' },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: BASE_URL_BLOG + '/blog' },
        { '@type': 'ListItem', position: 3, name: post.title, item: BASE_URL_BLOG + '/blog/' + post.slug }
      ]
    };
    res.send(blogLayout({
      title: post.title + ' — SP Tréner',
      description: post.excerpt,
      body,
      canonicalPath: '/blog/' + post.slug,
      ogType: 'article',
      jsonLd: [articleJsonLd, breadcrumbJsonLd]
    }));
  } catch (e) {
    res.status(500).send('Chyba servera.');
  }
});

`;

const backupPath = SERVER_PATH + '.pre-blog-seo-' + Date.now();
fs.copyFileSync(SERVER_PATH, backupPath);
const out = src.slice(0, startIdx) + NEW_SECTION + src.slice(endIdx);
fs.writeFileSync(SERVER_PATH, out);

console.log('✅ Blog prerobený — SEO meta tagy, JSON-LD structured data, sitemap.xml, súvisiace články.');
console.log('   Záloha pôvodného server.js:', backupPath);
console.log('   Teraz over syntax: node -c server.js');
