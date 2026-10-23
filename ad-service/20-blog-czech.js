// Pridáva český preklad blogu (?lang=cs) — UI text (nadpisy, popisky,
// prázdny stav, breadcrumb, pätička, nav) aj obsah článkov (title_cs/
// excerpt_cs/content_cs/tag_cs/read_time_cs stĺpce, s fallbackom na SK, ak
// článok ešte nemá preklad). Jazykový prepínač v nav prestane presmerovávať
// na homepage a namiesto toho prepne jazyk priamo na aktuálnej blog stránke
// (zachová aj ?tag= filter). Všetky interné odkazy na stránke (karty
// článkov, tag filter, späť-odkaz, breadcrumb, súvisiace články) nesú
// ?lang=cs ďalej, keď je aktívna čeština.
//
// Nahrádza celú blog sekciu (blogLayout + /sitemap.xml + /blog + /blog/:slug)
// podľa kotiev — bezpečnejšie po viacerých predošlých patchoch (12,13,14,17)
// než presný textový match. Nová sekcia už v sebe má zjednotený nav/footer
// z patchu 17, takže to funguje aj keby sa medzitým mierne líšil formát.
//
// Predpoklad: 12,13,14 a 17 už boli aplikované (očakáva funkčný lang-switcher
// v nav a footer-links pätičku). DB migrácia db/migrate_blog_cs.sql musí byť
// spustená pred (alebo po) tomto skripte — bez nej sa stránka jednoducho
// zobrazí v slovenčine aj pri ?lang=cs (fallback), nič sa nezlomí.
//
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online:
//   node /root/ad-service/20-blog-czech.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
const src = fs.readFileSync(SERVER_PATH, 'utf8');

if (src.includes('switchBlogLang')) {
  console.error('❌ Vyzerá to, že český preklad blogu je už aplikovaný. Nič som nezmenil.');
  process.exit(1);
}

const startAnchor = "const BASE_URL_BLOG = 'https://sptrener.online';";
const endAnchor = "app.get('/:customCode(";

const startIdx = src.indexOf(startAnchor);
if (startIdx === -1) {
  console.error('❌ Nenašiel som začiatočnú kotvu blogLayout(). Nič som nezmenil. Over, či sú aplikované patche 12/13/14.');
  process.exit(1);
}
const endIdx = src.indexOf(endAnchor, startIdx);
if (endIdx === -1) {
  console.error('❌ Nenašiel som koncovú kotvu ("app.get(\'/:customCode("). Nič som nezmenil.');
  process.exit(1);
}
const between = src.slice(startIdx, endIdx);
if (!between.includes('lang-switcher') || !between.includes('footer-links')) {
  console.error('❌ Nenašiel som očakávaný zjednotený nav/footer (lang-switcher / footer-links) medzi kotvami.');
  console.error('   Over, či je aplikovaný 17-blog-nav-footer-unify.js. Ak áno a napriek tomu to zlyhalo, pošli mi aktuálny obsah tejto časti server.js.');
  process.exit(1);
}

const NEW_SECTION = `const BASE_URL_BLOG = 'https://sptrener.online';

function jsonLdScript(obj) {
  return \`<script type="application/ld+json">\${JSON.stringify(obj).replace(/</g, '\\\\u003c')}</script>\`;
}

const BLOG_I18N = {
  sk: {
    heroTitle: 'Ako sa <em>naozaj</em> pripraviť na prijímacie testy.',
    heroSub: 'Postupy, stratégie a časté chyby priamo od tímu SP Tréner.',
    metaDescList: 'Postupy a stratégie príprav na prijímacie testy na vysokú školu — VŠP, psychológia, analytická aj verbálna časť.',
    emptyStateAll: 'Zatiaľ tu nie sú žiadne články — čoskoro pridáme prvé.',
    emptyStateTag: 'V tejto kategórii zatiaľ nie sú žiadne články.',
    categoryLabel: 'Kategória',
    showAll: 'zobraziť všetky →',
    notFoundTitle: 'Nenájdené',
    notFoundBody: 'Článok sa nenašiel',
    backLink: '← Späť na blog',
    relatedHeading: 'Ďalšie články',
    navCta: 'Začať zadarmo →',
    footerApp: 'Aplikácia', footerBlog: 'Blog', footerContact: 'Kontakt', footerTerms: 'VOP', footerPrivacy: 'Súkromie',
    ogLocale: 'sk_SK'
  },
  cs: {
    heroTitle: 'Jak se <em>opravdu</em> připravit na přijímací testy.',
    heroSub: 'Postupy, strategie a časté chyby přímo od týmu SP Tréner.',
    metaDescList: 'Postupy a strategie přípravy na přijímací testy na vysokou školu — VŠP, psychologie, analytická i verbální část.',
    emptyStateAll: 'Zatím tu nejsou žádné články — brzy přidáme první.',
    emptyStateTag: 'V této kategorii zatím nejsou žádné články.',
    categoryLabel: 'Kategorie',
    showAll: 'zobrazit vše →',
    notFoundTitle: 'Nenalezeno',
    notFoundBody: 'Článek nenalezen',
    backLink: '← Zpět na blog',
    relatedHeading: 'Další články',
    navCta: 'Začít zdarma →',
    footerApp: 'Aplikace', footerBlog: 'Blog', footerContact: 'Kontakt', footerTerms: 'VOP', footerPrivacy: 'Soukromí',
    ogLocale: 'cs_CZ'
  }
};

function blogLang(req) {
  return req.query.lang === 'cs' ? 'cs' : 'sk';
}

function blogLocalized(post, lang) {
  if (lang !== 'cs') {
    return { title: post.title, excerpt: post.excerpt, content: post.content, tag: post.tag, readTime: post.read_time };
  }
  return {
    title: post.title_cs || post.title,
    excerpt: post.excerpt_cs || post.excerpt,
    content: post.content_cs || post.content,
    tag: post.tag_cs || post.tag,
    readTime: post.read_time_cs || post.read_time
  };
}

function blogPostCard(post, lang) {
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
}

function blogLayout({ title, description, body, canonicalPath, ogType, jsonLd, lang }) {
  const l = lang === 'cs' ? 'cs' : 'sk';
  const T = BLOG_I18N[l];
  const canonicalUrl = BASE_URL_BLOG + (canonicalPath || '/blog') + (l === 'cs' ? (canonicalPath && canonicalPath.includes('?') ? '&lang=cs' : '?lang=cs') : '');
  const altSkUrl = BASE_URL_BLOG + (canonicalPath || '/blog');
  const altCsUrl = altSkUrl + (canonicalPath && canonicalPath.includes('?') ? '&lang=cs' : '?lang=cs');
  const jsonLdBlocks = (jsonLd || []).map(jsonLdScript).join('\\n');
  return \`<!DOCTYPE html><html lang="\${l}"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>\${escapeHtml(title)}</title>
<meta name="description" content="\${escapeHtml(description)}">
<link rel="canonical" href="\${canonicalUrl}">
<link rel="alternate" hreflang="sk" href="\${altSkUrl}">
<link rel="alternate" hreflang="cs" href="\${altCsUrl}">
<meta property="og:type" content="\${ogType || 'website'}">
<meta property="og:title" content="\${escapeHtml(title)}">
<meta property="og:description" content="\${escapeHtml(description)}">
<meta property="og:url" content="\${canonicalUrl}">
<meta property="og:site_name" content="SP Tréner">
<meta property="og:locale" content="\${T.ogLocale}">
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
.nav-logo{font-family:var(--mono);font-size:13px;letter-spacing:.15em;color:var(--text);text-decoration:none;white-space:nowrap;display:inline-flex;align-items:center;gap:.55rem}
.nav-dot{width:7px;height:7px;background:var(--volt);border-radius:50%;animation:pulse-dot 2s infinite;display:inline-block}
@keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.7)}}
.nav-link{text-decoration:none;font-family:var(--mono);font-size:.78rem;letter-spacing:.05em;border-radius:8px;transition:all .2s;color:var(--text2);padding:.65rem .85rem;border:1px solid transparent}
.nav-link:hover{color:var(--text);border-color:var(--border2)}
.nav-cta{padding:.6rem 1rem;background:var(--volt);color:var(--black);border-radius:8px;font-weight:700;font-family:var(--mono);font-size:.78rem;text-decoration:none;white-space:nowrap;border:none;cursor:pointer}
.lang-switcher{display:flex;align-items:center;gap:.35rem}
.lang-btn{padding:.45rem .7rem;border:1px solid var(--border2);background:transparent;color:var(--text2);border-radius:6px;font-family:var(--mono);font-size:.72rem;letter-spacing:.06em;cursor:pointer;transition:all .2s}
.lang-btn:hover{color:var(--text);border-color:var(--purple)}
.lang-btn.active{color:var(--volt);border-color:var(--volt)}
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
.footer-links{display:flex;gap:1.4rem;flex-wrap:wrap}
.footer-links a{font-family:var(--mono);font-size:12px;color:var(--text3);text-decoration:none}
.footer-links a:hover{color:var(--text2)}
</style></head><body>
<nav id="mainNav">
  <a href="/\${l === 'cs' ? '?lang=cs' : ''}" class="nav-logo"><span class="nav-dot"></span>SP TRÉNER</a>
  <div style="display:flex;align-items:center;gap:.75rem">
    <a href="/blog\${l === 'cs' ? '?lang=cs' : ''}" class="nav-link">Blog</a>
    <div class="lang-switcher">
      <button class="lang-btn\${l === 'sk' ? ' active' : ''}" onclick="switchBlogLang('sk')">SK</button>
      <button class="lang-btn\${l === 'cs' ? ' active' : ''}" onclick="switchBlogLang('cs')">CZ</button>
    </div>
    <button class="nav-cta" onclick="location.href='/?openPremium=1'">\${T.navCta}</button>
  </div>
</nav>
\${body}
<footer>
  <div class="footer-logo">SP TRÉNER © 2026</div>
  <div class="footer-links">
    <a href="/app">\${T.footerApp}</a>
    <a href="/blog\${l === 'cs' ? '?lang=cs' : ''}">\${T.footerBlog}</a>
    <a href="mailto:juraj@jurajkurek.com">\${T.footerContact}</a>
    <a href="/legal.html#vop">\${T.footerTerms}</a>
    <a href="/legal.html#privacy">\${T.footerPrivacy}</a>
  </div>
</footer>
<script>
function switchBlogLang(l){
  var u = new URL(window.location.href);
  if (l === 'cs') { u.searchParams.set('lang', 'cs'); } else { u.searchParams.delete('lang'); }
  window.location.href = u.toString();
}
</script>
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
    const lang = blogLang(req);
    const T = BLOG_I18N[lang];
    const tagFilter = req.query.tag ? String(req.query.tag).slice(0, 100) : null;
    let query = supabase.from('blog_posts').select('slug,title,excerpt,tag,read_time,title_cs,excerpt_cs,tag_cs,read_time_cs,created_at').eq('published', true);
    if (tagFilter) query = query.eq('tag', tagFilter);
    const { data: posts } = await query.order('created_at', { ascending: false });
    const list = posts || [];
    const grid = list.length
      ? \`<div class="post-grid">\${list.map(p => blogPostCard(p, lang)).join('')}</div>\`
      : \`<div class="empty-state">\${tagFilter ? T.emptyStateTag : T.emptyStateAll}</div>\`;
    const langQS = lang === 'cs' ? '&lang=cs' : '';
    const tagLabel = tagFilter ? (lang === 'cs' ? ((list.find(p => p.tag_cs) || {}).tag_cs || tagFilter) : tagFilter) : '';
    const subLine = tagFilter
      ? \`<p class="hero-sub">\${T.categoryLabel}: <strong>\${escapeHtml(tagLabel || tagFilter)}</strong> · <a href="/blog\${lang === 'cs' ? '?lang=cs' : ''}" style="color:var(--purple2)">\${T.showAll}</a></p>\`
      : \`<p class="hero-sub">\${T.heroSub}</p>\`;
    const breadcrumb = \`<nav class="breadcrumb"><a href="/\${lang === 'cs' ? '?lang=cs' : ''}">SP Tréner</a><span>/</span><span>Blog\${tagFilter ? ' / ' + escapeHtml(tagLabel || tagFilter) : ''}</span></nav>\`;
    const body = \`<main class="page">
      \${breadcrumb}
      <h1 class="hero-title">\${T.heroTitle}</h1>
      \${subLine}
      \${grid}
    </main>\`;
    const blogJsonLd = {
      '@context': 'https://schema.org', '@type': 'Blog', name: 'SP Tréner Blog', url: BASE_URL_BLOG + '/blog',
      blogPost: list.map(p => { const t = blogLocalized(p, lang); return { '@type': 'BlogPosting', headline: t.title, url: BASE_URL_BLOG + '/blog/' + p.slug, datePublished: p.created_at }; })
    };
    res.send(blogLayout({
      title: (tagFilter ? (tagLabel || tagFilter) + ' — ' : '') + 'Blog — SP Tréner',
      description: T.metaDescList,
      body,
      canonicalPath: tagFilter ? '/blog?tag=' + encodeURIComponent(tagFilter) : '/blog',
      jsonLd: [blogJsonLd],
      lang
    }));
  } catch (e) {
    res.status(500).send('Chyba servera.');
  }
});

app.get('/blog/:slug', async (req, res) => {
  try {
    const lang = blogLang(req);
    const T = BLOG_I18N[lang];
    const { data: post } = await supabase.from('blog_posts').select('*').eq('slug', req.params.slug).eq('published', true).single();
    if (!post) return res.status(404).send(blogLayout({
      title: T.notFoundTitle, description: '', canonicalPath: '/blog/' + req.params.slug, lang,
      body: \`<main class="page"><a href="/blog\${lang === 'cs' ? '?lang=cs' : ''}" class="back-link">\${T.backLink}</a><div class="prose"><h2>\${T.notFoundBody}</h2></div></main>\`
    }));

    const t = blogLocalized(post, lang);
    const { data: related } = await supabase.from('blog_posts').select('slug,title,excerpt,tag,read_time,title_cs,excerpt_cs,tag_cs,read_time_cs').eq('published', true).neq('slug', req.params.slug).order('created_at', { ascending: false }).limit(3);
    const relatedList = related || [];
    const relatedSection = relatedList.length ? \`<section class="related-section">
      <h2 class="related-heading">\${T.relatedHeading}</h2>
      <div class="post-grid">\${relatedList.map(p => blogPostCard(p, lang)).join('')}</div>
    </section>\` : '';

    const localeMap = { sk: 'sk-SK', cs: 'cs-CZ' };
    const dateStr = post.created_at ? new Date(post.created_at).toLocaleDateString(localeMap[lang], { year: 'numeric', month: 'long', day: 'numeric' }) : '';
    const langQS = lang === 'cs' ? '&lang=cs' : '';
    const breadcrumb = \`<nav class="breadcrumb"><a href="/\${lang === 'cs' ? '?lang=cs' : ''}">SP Tréner</a><span>/</span><a href="/blog\${lang === 'cs' ? '?lang=cs' : ''}">Blog</a><span>/</span><span>\${escapeHtml(t.title)}</span></nav>\`;
    const body = \`<main class="page">\${breadcrumb}<article class="prose">
      <h1 class="hero-title">\${escapeHtml(t.title)}</h1>
      <div class="prose-meta">\${post.tag ? \`<a class="tag" href="/blog?tag=\${encodeURIComponent(post.tag)}\${langQS}">\${escapeHtml(t.tag)}</a>\` : ''}\${t.readTime ? \`<span>\${escapeHtml(t.readTime)}</span>\` : ''}\${dateStr ? \`<time datetime="\${post.created_at}">\${dateStr}</time>\` : ''}</div>
      \${t.content}
    </article>\${relatedSection}</main>\`;

    const articleJsonLd = {
      '@context': 'https://schema.org', '@type': 'Article', headline: t.title, description: t.excerpt,
      datePublished: post.created_at, dateModified: post.created_at,
      author: { '@type': 'Organization', name: 'SP Tréner' },
      publisher: { '@type': 'Organization', name: 'SP Tréner' },
      mainEntityOfPage: { '@type': 'WebPage', '@id': BASE_URL_BLOG + '/blog/' + post.slug },
      inLanguage: lang,
      ...(t.tag ? { keywords: t.tag } : {})
    };
    const breadcrumbJsonLd = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'SP Tréner', item: BASE_URL_BLOG + '/' },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: BASE_URL_BLOG + '/blog' },
        { '@type': 'ListItem', position: 3, name: t.title, item: BASE_URL_BLOG + '/blog/' + post.slug }
      ]
    };
    res.send(blogLayout({
      title: t.title + ' — SP Tréner',
      description: t.excerpt,
      body,
      canonicalPath: '/blog/' + post.slug,
      ogType: 'article',
      jsonLd: [articleJsonLd, breadcrumbJsonLd],
      lang
    }));
  } catch (e) {
    res.status(500).send('Chyba servera.');
  }
});

`;

const backupPath = SERVER_PATH + '.pre-blog-czech-' + Date.now();
fs.copyFileSync(SERVER_PATH, backupPath);
const out = src.slice(0, startIdx) + NEW_SECTION + src.slice(endIdx);
fs.writeFileSync(SERVER_PATH, out);

console.log('✅ Blog má teraz český preklad (?lang=cs) a jazykový prepínač prepína priamo na blogu, nie na homepage.');
console.log('   Záloha pôvodného server.js:', backupPath);
console.log('   Teraz over syntax: node -c server.js');
console.log('   DÔLEŽITÉ: ak si ešte nespustil(a) db/migrate_blog_cs.sql, spusti ho — inak sa CZ obsah článkov zobrazí ako SK (bezpečný fallback, nič sa nezlomí, len chýba preklad).');
