const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

const L = (...lines) => lines.join('\n');

if (src.includes("const lang = blogLang(req);\n    const T = lang === 'cs' ? {\n      pageTitle:")) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

let patched = src;

// ── courseCardHtml: accept lang, translate 'Zadarmo' ──────────────────────
patched = replaceOnce(patched,
  L(
    "function courseCardHtml(c) {",
    "  const priceStr = c.price_cents === 0 ? 'Zadarmo' : (c.price_cents / 100).toFixed(2).replace('.', ',') + ' €';"
  ),
  L(
    "function courseCardHtml(c, lang) {",
    "  const priceStr = c.price_cents === 0 ? (lang === 'cs' ? 'Zdarma' : 'Zadarmo') : (c.price_cents / 100).toFixed(2).replace('.', ',') + ' €';"
  ),
  'courseCardHtml signature');

// ── /kurzy listing route ───────────────────────────────────────────────
patched = replaceOnce(patched,
  L(
    "app.get('/kurzy', async (req, res) => {",
    "  try {",
    "    const { data: courses } = await supabase.from('courses').select('slug,title,description,price_cents,cover_image_url').eq('published', true).order('created_at', { ascending: false });"
  ),
  L(
    "app.get('/kurzy', async (req, res) => {",
    "  try {",
    "    const lang = blogLang(req);",
    "    const T = lang === 'cs' ? {",
    "      pageTitle: 'Video kurzy — SP Tréner', description: 'Video kurzy na přípravu k přijímacím testům — lekce s videem, materiály ke stažení a kvízem po každé lekci.',",
    "      heading: 'Video kurzy', sub: 'Teoretický doplněk k praktickým testům — video lekce, materiály ke stažení a kvíz v každé lekci.',",
    "      empty: 'Zatím tu nejsou žádné kurzy.', breadcrumb: 'Kurzy'",
    "    } : {",
    "      pageTitle: 'Video kurzy — SP Tréner', description: 'Video kurzy na prípravu k prijímacím testom — lekcie s videom, materiálmi na stiahnutie a kvízom po každej lekcii.',",
    "      heading: 'Video kurzy', sub: 'Teoretický doplnok k praktickým testom — video lekcie, materiály na stiahnutie a kvíz v každej lekcii.',",
    "      empty: 'Zatiaľ tu nie sú žiadne kurzy.', breadcrumb: 'Kurzy'",
    "    };",
    "    const { data: courses } = await supabase.from('courses').select('slug,title,description,price_cents,cover_image_url').eq('published', true).order('created_at', { ascending: false });"
  ),
  'kurzy route start');

patched = replaceOnce(patched,
  L(
    "      ? `${KURZY_STYLE}<div class=\"course-grid\">${list.map(courseCardHtml).join('')}</div>`",
    "      : `${KURZY_STYLE}<div class=\"empty-state\">Zatiaľ tu nie sú žiadne kurzy.</div>`;"
  ),
  L(
    "      ? `${KURZY_STYLE}<div class=\"course-grid\">${list.map(c => courseCardHtml(c, lang)).join('')}</div>`",
    "      : `${KURZY_STYLE}<div class=\"empty-state\">${T.empty}</div>`;"
  ),
  'kurzy grid/empty-state');

patched = replaceOnce(patched,
  L(
    "    const body = `<main class=\"page\">",
    "      <nav class=\"breadcrumb\"><a href=\"/\">SP Tréner</a><span>/</span><span>Kurzy</span></nav>",
    "      <h1 class=\"hero-title\">Video kurzy</h1>",
    "      <p class=\"hero-sub\">Teoretický doplnok k praktickým testom — video lekcie, materiály na stiahnutie a kvíz v každej lekcii.</p>",
    "      ${grid}",
    "    </main>`;"
  ),
  L(
    "    const body = `<main class=\"page\">",
    "      <nav class=\"breadcrumb\"><a href=\"/${lang === 'cs' ? '?lang=cs' : ''}\">SP Tréner</a><span>/</span><span>${T.breadcrumb}</span></nav>",
    "      <h1 class=\"hero-title\">${T.heading}</h1>",
    "      <p class=\"hero-sub\">${T.sub}</p>",
    "      ${grid}",
    "    </main>`;"
  ),
  'kurzy body block');

patched = replaceOnce(patched,
  L(
    "    res.send(blogLayout({",
    "      title: 'Video kurzy — SP Tréner',",
    "      description: 'Video kurzy na prípravu k prijímacím testom — lekcie s videom, materiálmi na stiahnutie a kvízom po každej lekcii.',",
    "      body, canonicalPath: '/kurzy', jsonLd: [jsonLd], lang: 'sk'",
    "    }));"
  ),
  L(
    "    res.send(blogLayout({",
    "      title: T.pageTitle,",
    "      description: T.description,",
    "      body, canonicalPath: '/kurzy', jsonLd: [jsonLd], lang",
    "    }));"
  ),
  'kurzy blogLayout call');

// ── /kurzy/:slug detail route ─────────────────────────────────────────
patched = replaceOnce(patched,
  L(
    "app.get('/kurzy/:slug', async (req, res) => {",
    "  try {",
    "    const { data: course } = await supabase.from('courses').select('*').eq('slug', req.params.slug).eq('published', true).single();"
  ),
  L(
    "app.get('/kurzy/:slug', async (req, res) => {",
    "  try {",
    "    const lang = blogLang(req);",
    "    const T = lang === 'cs' ? { loading: 'Načítám…', free: 'Zdarma', kurzyLabel: 'Kurzy', outlineHeading: 'Obsah kurzu' }",
    "      : { loading: 'Načítavam…', free: 'Zadarmo', kurzyLabel: 'Kurzy', outlineHeading: 'Obsah kurzu' };",
    "    const { data: course } = await supabase.from('courses').select('*').eq('slug', req.params.slug).eq('published', true).single();"
  ),
  'kurzy detail route start');

patched = replaceOnce(patched,
  "    const priceStr = course.price_cents === 0 ? 'Zadarmo' : priceNum.replace('.', ',') + ' €';",
  "    const priceStr = course.price_cents === 0 ? T.free : priceNum.replace('.', ',') + ' €';",
  'detail priceStr');

patched = replaceOnce(patched,
  "        <div class=\"courseAuthSlot\" data-free=\"${course.price_cents === 0 ? '1' : '0'}\"><span style=\"color:var(--text3);font-size:.85rem\">Načítavam…</span></div>",
  "        <div class=\"courseAuthSlot\" data-free=\"${course.price_cents === 0 ? '1' : '0'}\"><span style=\"color:var(--text3);font-size:.85rem\">${T.loading}</span></div>",
  'detail loading text');

patched = replaceOnce(patched,
  "      <nav class=\"breadcrumb\"><a href=\"/\">SP Tréner</a><span>/</span><a href=\"/kurzy\">Kurzy</a><span>/</span><span>${escapeHtml(course.title)}</span></nav>",
  "      <nav class=\"breadcrumb\"><a href=\"/${lang === 'cs' ? '?lang=cs' : ''}\">SP Tréner</a><span>/</span><a href=\"/kurzy${lang === 'cs' ? '?lang=cs' : ''}\">${T.kurzyLabel}</a><span>/</span><span>${escapeHtml(course.title)}</span></nav>",
  'detail breadcrumb');

patched = replaceOnce(patched,
  "      <h2 class=\"course-outline-heading\">Obsah kurzu</h2>",
  "      <h2 class=\"course-outline-heading\">${T.outlineHeading}</h2>",
  'detail outline heading');

patched = replaceOnce(patched,
  L(
    "    res.send(blogLayout({",
    "      title: course.title + ' — SP Tréner',",
    "      description: (course.description || course.title).slice(0, 160),",
    "      body, canonicalPath: '/kurzy/' + course.slug, jsonLd: [jsonLd], lang: 'sk'",
    "    }));"
  ),
  L(
    "    res.send(blogLayout({",
    "      title: course.title + ' — SP Tréner',",
    "      description: (course.description || course.title).slice(0, 160),",
    "      body, canonicalPath: '/kurzy/' + course.slug, jsonLd: [jsonLd], lang",
    "    }));"
  ),
  'detail blogLayout call');

const backup = FILE + '.pre-kurzy-czech-lang-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
