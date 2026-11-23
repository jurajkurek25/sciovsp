const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('course-hero-cover')) {
  console.error('Uz je aplikovane (najdene course-hero-cover), nic som nezmenil.');
  process.exit(1);
}

const CARD_OLD = `function courseCardHtml(c) {
  const priceStr = (c.price_cents / 100).toFixed(2).replace('.', ',');
  return \`<a class="course-card" href="/kurzy/\${c.slug}">
    <h3>\${escapeHtml(c.title)}</h3>
    <p>\${escapeHtml((c.description || '').slice(0, 140))}</p>
    <span class="course-price-tag">\${priceStr} €</span>
  </a>\`;
}`;
const CARD_NEW = `function courseCardHtml(c) {
  const priceStr = (c.price_cents / 100).toFixed(2).replace('.', ',');
  const cover = c.cover_image_url ? \`<img class="course-cover" src="\${escapeHtml(c.cover_image_url)}" alt="\${escapeHtml(c.title)}" loading="lazy">\` : '';
  return \`<a class="course-card" href="/kurzy/\${c.slug}">
    \${cover}
    <h3>\${escapeHtml(c.title)}</h3>
    <p>\${escapeHtml((c.description || '').slice(0, 140))}</p>
    <span class="course-price-tag">\${priceStr} €</span>
  </a>\`;
}`;
if (!src.includes(CARD_OLD)) { console.error('Nenasiel som courseCardHtml. Nic som nezmenil.'); process.exit(1); }

const STYLE_OLD = `.course-buy-btn:disabled{opacity:.6;cursor:not-allowed}
</style>\`;`;
const STYLE_NEW = `.course-buy-btn:disabled{opacity:.6;cursor:not-allowed}
.course-cover{width:100%;height:150px;object-fit:cover;border-radius:10px;margin-bottom:.9rem;background:var(--black3);display:block}
.course-hero-cover{width:100%;max-height:420px;object-fit:cover;border-radius:16px;margin:1.5rem 0;background:var(--black3);display:block}
.course-tagline{color:var(--text2);font-size:1.05rem;margin-bottom:.5rem}
.course-outline-heading{font-family:var(--serif);font-size:1.5rem;margin:2rem 0 1rem}
.course-sales{margin:2rem 0}
</style>\`;`;
if (!src.includes(STYLE_OLD)) { console.error('Nenasiel som KURZY_STYLE koniec. Nic som nezmenil.'); process.exit(1); }

const LIST_OLD = `const { data: courses } = await supabase.from('courses').select('slug,title,description,price_cents').eq('published', true).order('created_at', { ascending: false });`;
const LIST_NEW = `const { data: courses } = await supabase.from('courses').select('slug,title,description,price_cents,cover_image_url').eq('published', true).order('created_at', { ascending: false });`;
if (!src.includes(LIST_OLD)) { console.error('Nenasiel som /kurzy listing query. Nic som nezmenil.'); process.exit(1); }

const DETAIL_OLD = `    const priceStr = (course.price_cents / 100).toFixed(2).replace('.', ',');
    const body = \`\${KURZY_STYLE}<main class="page">
      <nav class="breadcrumb"><a href="/">SP Tréner</a><span>/</span><a href="/kurzy">Kurzy</a><span>/</span><span>\${escapeHtml(course.title)}</span></nav>
      <h1 class="hero-title">\${escapeHtml(course.title)}</h1>
      <p class="hero-sub">\${escapeHtml(course.description || '')}</p>
      <ol class="course-lesson-outline">\${(lessons || []).map(l => \`<li>\${escapeHtml(l.title)}</li>\`).join('')}</ol>
      <div class="course-buy-box">
        <span class="course-price-tag">\${priceStr} €</span>
        <div id="courseAuthSlot"><span style="color:var(--text3);font-size:.85rem">Načítavam…</span></div>
      </div>
    </main>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="/kurz-detail.js" data-slug="\${course.slug}"></script>\`;
    const jsonLd = {
      '@context': 'https://schema.org', '@type': 'Course', name: course.title, description: course.description || course.title,
      provider: { '@type': 'Organization', name: 'SP Tréner', sameAs: BASE_URL_BLOG },
      offers: { '@type': 'Offer', price: priceStr.replace(',', '.'), priceCurrency: 'EUR', url: BASE_URL_BLOG + '/kurzy/' + course.slug, availability: 'https://schema.org/InStock' }
    };`;
const DETAIL_NEW = `    const priceStr = (course.price_cents / 100).toFixed(2).replace('.', ',');
    const coverHtml = course.cover_image_url ? \`<img class="course-hero-cover" src="\${escapeHtml(course.cover_image_url)}" alt="\${escapeHtml(course.title)}" loading="lazy">\` : '';
    const buyBoxHtml = \`<div class="course-buy-box">
        <span class="course-price-tag">\${priceStr} €</span>
        <div class="courseAuthSlot"><span style="color:var(--text3);font-size:.85rem">Načítavam…</span></div>
      </div>\`;
    const salesHtml = course.sales_content ? \`<article class="prose course-sales">\${course.sales_content}</article>\` : '';
    const body = \`\${KURZY_STYLE}<main class="page">
      <nav class="breadcrumb"><a href="/">SP Tréner</a><span>/</span><a href="/kurzy">Kurzy</a><span>/</span><span>\${escapeHtml(course.title)}</span></nav>
      <h1 class="hero-title">\${escapeHtml(course.title)}</h1>
      <p class="course-tagline">\${escapeHtml(course.description || '')}</p>
      \${coverHtml}
      \${buyBoxHtml}
      \${salesHtml}
      <h2 class="course-outline-heading">Obsah kurzu</h2>
      <ol class="course-lesson-outline">\${(lessons || []).map(l => \`<li>\${escapeHtml(l.title)}</li>\`).join('')}</ol>
      \${buyBoxHtml}
    </main>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="/kurz-detail.js" data-slug="\${course.slug}"></script>\`;
    const jsonLd = {
      '@context': 'https://schema.org', '@type': 'Course', name: course.title, description: course.description || course.title,
      provider: { '@type': 'Organization', name: 'SP Tréner', sameAs: BASE_URL_BLOG },
      offers: { '@type': 'Offer', price: priceStr.replace(',', '.'), priceCurrency: 'EUR', url: BASE_URL_BLOG + '/kurzy/' + course.slug, availability: 'https://schema.org/InStock' },
      ...(course.cover_image_url ? { image: course.cover_image_url } : {})
    };`;
if (!src.includes(DETAIL_OLD)) { console.error('Nenasiel som /kurzy/:slug detail blok. Nic som nezmenil.'); process.exit(1); }

const CHECKOUT_OLD = `          product_data: { name: course.title, description: (course.description || '').slice(0, 300) }`;
const CHECKOUT_NEW = `          product_data: { name: course.title, description: (course.description || '').slice(0, 300), ...(course.cover_image_url ? { images: [course.cover_image_url] } : {}) }`;
if (!src.includes(CHECKOUT_OLD)) { console.error('Nenasiel som checkout product_data. Nic som nezmenil.'); process.exit(1); }

const patched = src
  .replace(CARD_OLD, CARD_NEW)
  .replace(STYLE_OLD, STYLE_NEW)
  .replace(LIST_OLD, LIST_NEW)
  .replace(DETAIL_OLD, DETAIL_NEW)
  .replace(CHECKOUT_OLD, CHECKOUT_NEW);

const backup = FILE + '.pre-kurzy-sales-letter-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
