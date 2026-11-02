// Pridáva kategórie (pills, z reálnych distinct tagov) a textové
// vyhľadávanie na /blog -- bez reloadu, rovnaký princíp ako
// main-app-patches/208 na /odporucame.
//
// ZMENA SPRÁVANIA: predtým sa /blog?tag=X filtrovalo na serveri (SQL
// eq(\tag, tagFilter)) a malo vlastný canonical/title per tag -- teraz
// sa vždy načítajú VŠETKY publikované články danej jazykovej audience a
// filtrovanie je čisto klientské (JS), takže obsah stránky je rovnaký
// bez ohľadu na ?tag=. Preto teraz má /blog jediný canonical (/blog)
// namiesto per-tag variantov -- to je správne, lebo predtým by inak
// vznikalo veľa URL s identickým (nefiltrovaným) obsahom.
// Existujúce odkazy /blog?tag=X (z main-app-patches/146, tlačidlo tagu
// na detaile článku) naďalej fungujú -- tagFilter sa použije len na
// predvýber pillu a spustenie filtra hneď po načítaní, nie na SQL dotaz.
//
// Kotvy sú CELÁ /blog routa a CELÁ blogPostCard() funkcia ako atomické
// bloky (overené byte-presne z main-app-patches/206 a main-app-patches/210
// diagnostík), rovnaká disciplína ako main-app-patches/208.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/211-blog-search-filter.js

const fs = require("fs");
const path = require("path");

const SERVER_PATH = path.join(process.cwd(), "server.js");

if (!fs.existsSync(SERVER_PATH)) {
  console.error("❌ Nenašiel som súbor:", SERVER_PATH, "— spusti tento skript z koreňa hlavnej appky.");
  process.exit(1);
}

const LOCK = path.join(process.cwd(), ".211-blog-search-filter-lock");
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: "wx" });
} catch (e) {
  console.error("Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (" + LOCK + "). Nič som nezmenil.");
  process.exit(1);
}
process.on("exit", () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

function replaceOnce(src, oldStr, newStr, label) {
  const count = src.split(oldStr).length - 1;
  if (count !== 1) {
    console.error("❌ " + label + " — kotva nie je jednoznačná (nájdených: " + count + "). Nič som nezmenil.");
    process.exit(1);
  }
  return src.replace(oldStr, () => newStr);
}

let server = fs.readFileSync(SERVER_PATH, "utf8");

if (server.includes("blogSetTag")) {
  console.error("❌ server.js: už je aplikované, nič som nezmenil.");
  process.exit(1);
}

const BLOG_ROUTE_OLD = "app.get('/blog', async (req, res) => {\n  try {\n    const lang = blogLang(req);\n    const T = BLOG_I18N[lang];\n    const tagFilter = req.query.tag ? String(req.query.tag).slice(0, 100) : null;\n    const audienceLangs = lang === 'cs' ? ['cz', 'both'] : ['sk', 'both'];\n    let query = supabase.from('blog_posts').select('slug,title,excerpt,tag,read_time,title_cs,excerpt_cs,tag_cs,read_time_cs,created_at,target_lang').eq('published', true).in('target_lang', audienceLangs);\n    if (tagFilter) query = query.eq('tag', tagFilter);\n    const { data: posts } = await query.order('created_at', { ascending: false });\n    const list = posts || [];\n    const grid = list.length\n      ? `<div class=\"post-grid\">${list.map(p => blogPostCard(p, lang)).join('')}</div>`\n      : `<div class=\"empty-state\">${tagFilter ? T.emptyStateTag : T.emptyStateAll}</div>`;\n    const langQS = lang === 'cs' ? '&lang=cs' : '';\n    const tagLabel = tagFilter ? (lang === 'cs' ? ((list.find(p => p.tag_cs) || {}).tag_cs || tagFilter) : tagFilter) : '';\n    const subLine = tagFilter\n      ? `<p class=\"hero-sub\">${T.categoryLabel}: <strong>${escapeHtml(tagLabel || tagFilter)}</strong> · <a href=\"/blog${lang === 'cs' ? '?lang=cs' : ''}\" style=\"color:var(--purple2)\">${T.showAll}</a></p>`\n      : `<p class=\"hero-sub\">${T.heroSub}</p>`;\n    const breadcrumb = `<nav class=\"breadcrumb\"><a href=\"/${lang === 'cs' ? '?lang=cs' : ''}\">SP Tréner</a><span>/</span><span>Blog${tagFilter ? ' / ' + escapeHtml(tagLabel || tagFilter) : ''}</span></nav>`;\n    const body = `<main class=\"page\">\n      ${breadcrumb}\n      <h1 class=\"hero-title\" style=\"text-align:center\">${T.heroTitle}</h1>\n      ${subLine}\n      ${grid}\n    </main>`;\n    const blogJsonLd = {\n      '@context': 'https://schema.org', '@type': 'Blog', name: 'SP Tréner Blog', url: BASE_URL_BLOG + '/blog',\n      blogPost: list.map(p => { const t = blogLocalized(p, lang); return { '@type': 'BlogPosting', headline: t.title, url: BASE_URL_BLOG + '/blog/' + p.slug, datePublished: p.created_at }; })\n    };\n    res.send(blogLayout({\n      title: (tagFilter ? (tagLabel || tagFilter) + ' — ' : '') + 'Blog — SP Tréner',\n      description: T.metaDescList,\n      body,\n      canonicalPath: tagFilter ? '/blog?tag=' + encodeURIComponent(tagFilter) : '/blog',\n      jsonLd: [blogJsonLd],\n      lang\n    }));\n  } catch (e) {\n    res.status(500).send('Chyba servera.');\n  }\n});\n";
const BLOG_ROUTE_NEW = "app.get('/blog', async (req, res) => {\n  try {\n    const lang = blogLang(req);\n    const T = BLOG_I18N[lang];\n    const tagFilter = req.query.tag ? String(req.query.tag).slice(0, 100) : null;\n    const audienceLangs = lang === 'cs' ? ['cz', 'both'] : ['sk', 'both'];\n    const { data: posts } = await supabase.from('blog_posts').select('slug,title,excerpt,tag,read_time,title_cs,excerpt_cs,tag_cs,read_time_cs,created_at,target_lang').eq('published', true).in('target_lang', audienceLangs).order('created_at', { ascending: false });\n    const list = posts || [];\n    const tagList = [];\n    const tagSeen = {};\n    list.forEach(p => { const t = blogLocalized(p, lang); if (t.tag && !tagSeen[t.tag]) { tagSeen[t.tag] = true; tagList.push(t.tag); } });\n    const grid = list.length\n      ? `<div class=\"post-grid\">${list.map(p => blogPostCard(p, lang)).join('')}</div>`\n      : `<div class=\"empty-state\">${T.emptyStateAll}</div>`;\n    const breadcrumb = `<nav class=\"breadcrumb\"><a href=\"/${lang === 'cs' ? '?lang=cs' : ''}\">SP Tréner</a><span>/</span><span>Blog</span></nav>`;\n    const filterLabels = lang === 'cs' ? { all: 'Vše', searchPlaceholder: 'Hledat…', noResults: 'Nic jsme nenašli. Zkus jiné hledání nebo kategorii.' } : { all: 'Všetko', searchPlaceholder: 'Hľadať…', noResults: 'Nič sme nenašli. Skús iné hľadanie alebo kategóriu.' };\n    const FILTER_STYLE = `<style>\n.filter-bar{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;margin:1.4rem 0}\n.filter-search{flex:1 1 220px;padding:.65rem .9rem;background:var(--black2);border:1px solid var(--border2);border-radius:10px;color:var(--text);font-size:.9rem}\n.filter-search::placeholder{color:var(--text3)}\n.filter-pills{display:flex;flex-wrap:wrap;gap:.5rem}\n.filter-pill{padding:.5rem .9rem;background:var(--black2);border:1px solid var(--border2);border-radius:99px;color:var(--text2);font-size:.8rem;font-family:var(--mono);cursor:pointer;white-space:nowrap;user-select:none}\n.filter-pill:hover{border-color:var(--purple)}\n.filter-pill.active{background:var(--volt);color:var(--black);border-color:var(--volt);font-weight:700}\n.filter-empty{display:none;color:var(--text3);font-size:.9rem;padding:2rem 0;text-align:center}\n  </style>`;\n    const filterBar = tagList.length ? `\n  <div class=\"filter-bar\">\n    <input type=\"text\" class=\"filter-search\" id=\"blogSearch\" placeholder=\"${escapeHtml(filterLabels.searchPlaceholder)}\" oninput=\"blogFilter()\">\n    <div class=\"filter-pills\" id=\"blogPills\">\n      <span class=\"filter-pill${tagFilter ? '' : ' active'}\" data-tag=\"\" onclick=\"blogSetTag(this)\">${escapeHtml(filterLabels.all)}</span>\n      ${tagList.map(tag => `<span class=\"filter-pill${tagFilter === tag ? ' active' : ''}\" data-tag=\"${escapeHtml(tag)}\" onclick=\"blogSetTag(this)\">${escapeHtml(tag)}</span>`).join('')}\n    </div>\n  </div>` : '';\n    const filterScript = tagList.length ? `\n  <script>\n  var blogActiveTag = ${JSON.stringify(tagFilter || '')};\n  function blogSetTag(el){\n    document.querySelectorAll('#blogPills .filter-pill').forEach(function(p){ p.classList.remove('active'); });\n    el.classList.add('active');\n    blogActiveTag = el.getAttribute('data-tag') || '';\n    blogFilter();\n  }\n  function blogFilter(){\n    var q = (document.getElementById('blogSearch').value || '').trim().toLowerCase();\n    var anyVisible = false;\n    document.querySelectorAll('.post-card-wrap').forEach(function(card){\n      var matchesTag = !blogActiveTag || card.getAttribute('data-tag') === blogActiveTag;\n      var matchesSearch = !q || (card.getAttribute('data-search') || '').indexOf(q) !== -1;\n      var visible = matchesTag && matchesSearch;\n      card.style.display = visible ? '' : 'none';\n      if (visible) anyVisible = true;\n    });\n    document.getElementById('blogEmpty').style.display = anyVisible ? 'none' : 'block';\n  }\n  if (blogActiveTag) { blogFilter(); }\n  </script>` : '';\n    const body = `<main class=\"page\">\n      ${breadcrumb}\n      <h1 class=\"hero-title\" style=\"text-align:center\">${T.heroTitle}</h1>\n      <p class=\"hero-sub\">${T.heroSub}</p>\n      ${FILTER_STYLE}\n      ${filterBar}\n      ${grid}\n      <p class=\"filter-empty\" id=\"blogEmpty\">${escapeHtml(filterLabels.noResults)}</p>\n      ${filterScript}\n    </main>`;\n    const blogJsonLd = {\n      '@context': 'https://schema.org', '@type': 'Blog', name: 'SP Tréner Blog', url: BASE_URL_BLOG + '/blog',\n      blogPost: list.map(p => { const t = blogLocalized(p, lang); return { '@type': 'BlogPosting', headline: t.title, url: BASE_URL_BLOG + '/blog/' + p.slug, datePublished: p.created_at }; })\n    };\n    res.send(blogLayout({\n      title: 'Blog — SP Tréner',\n      description: T.metaDescList,\n      body,\n      canonicalPath: '/blog',\n      jsonLd: [blogJsonLd],\n      lang\n    }));\n  } catch (e) {\n    res.status(500).send('Chyba servera.');\n  }\n});\n";
server = replaceOnce(server, BLOG_ROUTE_OLD, BLOG_ROUTE_NEW, "1: /blog routa -> filter a vyhľadávanie");

const CARD_OLD = "function blogPostCard(post, lang) {\n  const t = blogLocalized(post, lang);\n  const langQS = lang === 'cs' ? '&lang=cs' : '';\n  const langQP = lang === 'cs' ? '?lang=cs' : '';\n  return `<div class=\"post-card-wrap\">\n          ${post.tag ? `<a class=\"post-card-tag\" href=\"/blog?tag=${encodeURIComponent(post.tag)}${langQS}\">${escapeHtml(t.tag)}</a>` : ''}\n          <a class=\"post-card\" href=\"/blog/${escapeHtml(post.slug)}${langQP}\">\n            <img class=\"post-card-cover\" src=\"${postCoverUrl(post)}\" alt=\"${escapeHtml(t.title)}\" loading=\"lazy\">\n            <div class=\"post-card-title\">${escapeHtml(t.title)}</div>\n            <div class=\"post-card-excerpt\">${escapeHtml(t.excerpt)}</div>\n            ${t.readTime ? `<div class=\"post-card-meta\">${escapeHtml(t.readTime)}</div>` : ''}\n          </a>\n        </div>`;\n}";
const CARD_NEW = "function blogPostCard(post, lang) {\n  const t = blogLocalized(post, lang);\n  const langQS = lang === 'cs' ? '&lang=cs' : '';\n  const langQP = lang === 'cs' ? '?lang=cs' : '';\n  return `<div class=\"post-card-wrap\" data-tag=\"${escapeHtml(t.tag || '')}\" data-search=\"${escapeHtml(((t.title || '') + ' ' + (t.excerpt || '')).toLowerCase())}\">\n          ${post.tag ? `<a class=\"post-card-tag\" href=\"/blog?tag=${encodeURIComponent(post.tag)}${langQS}\">${escapeHtml(t.tag)}</a>` : ''}\n          <a class=\"post-card\" href=\"/blog/${escapeHtml(post.slug)}${langQP}\">\n            <img class=\"post-card-cover\" src=\"${postCoverUrl(post)}\" alt=\"${escapeHtml(t.title)}\" loading=\"lazy\">\n            <div class=\"post-card-title\">${escapeHtml(t.title)}</div>\n            <div class=\"post-card-excerpt\">${escapeHtml(t.excerpt)}</div>\n            ${t.readTime ? `<div class=\"post-card-meta\">${escapeHtml(t.readTime)}</div>` : ''}\n          </a>\n        </div>`;\n}";
server = replaceOnce(server, CARD_OLD, CARD_NEW, "2: blogPostCard() -> data-tag/data-search atribúty");

const backup = SERVER_PATH + ".pre-blog-search-filter-" + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, server);

console.log("✅ /blog má teraz kategórie (pills, z reálnych tagov) a textové vyhľadávanie, bez reloadu.");
console.log("   Existujúce /blog?tag=X odkazy naďalej fungujú (predvyberú pill).");
console.log("   Záloha:", backup);
console.log("   Over syntax pred reštartom: node -c server.js && pm2 restart sptrener");
