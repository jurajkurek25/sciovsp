const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('/kurzy-cover/')) {
  console.error('Uz je aplikovane (najdene /kurzy-cover/), nic som nezmenil.');
  process.exit(1);
}

const ANCHOR = `function courseCardHtml(c) {`;
if (!src.includes(ANCHOR)) { console.error('Nenasiel som courseCardHtml kotvu. Nic som nezmenil.'); process.exit(1); }

const COVER_CODE = `function courseCoverUrl(course) {
  return course.cover_image_url || (BASE_URL_BLOG + '/kurzy-cover/' + course.slug + '.svg');
}

// Brandovaný cover kurzu generovaný za behu z názvu (rovnaký princíp ako
// /blog-cover/, iný label "KURZ" namiesto tagu).
app.get('/kurzy-cover/:slug.svg', async (req, res) => {
  try {
    const { data: course } = await supabase.from('courses').select('title').eq('slug', req.params.slug).maybeSingle();
    const title = course ? course.title : 'SP Tréner';
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
      <stop offset="0%" stop-color="#c8ff00" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#c8ff00" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <circle cx="1130" cy="55" r="8" fill="#7c5cff"/>
  <text x="80" y="78" font-family="'DM Mono', monospace" font-size="24" letter-spacing="4" fill="#eeeef5">SP TRÉNER</text>
  <text x="80" y="\${Math.max(startY - 55, 130)}" font-family="'DM Mono', monospace" font-size="22" letter-spacing="2" fill="#c8ff00">KURZ</text>
  <text font-family="Georgia, serif" font-size="52" fill="#eeeef5">\${tspans}</text>
  <rect x="80" y="565" width="64" height="4" fill="#7c5cff"/>
</svg>\`;
    res.type('image/svg+xml');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(svg);
  } catch (e) {
    res.status(500).send('');
  }
});

function courseCardHtml(c) {`;
const patched1 = src.replace(ANCHOR, COVER_CODE);

const CARD_OLD = `function courseCardHtml(c) {
  const priceStr = (c.price_cents / 100).toFixed(2).replace('.', ',');
  const cover = c.cover_image_url ? \`<img class="course-cover" src="\${escapeHtml(c.cover_image_url)}" alt="\${escapeHtml(c.title)}" loading="lazy">\` : '';
  return \`<a class="course-card" href="/kurzy/\${c.slug}">
    \${cover}
    <h3>\${escapeHtml(c.title)}</h3>
    <p>\${escapeHtml((c.description || '').slice(0, 140))}</p>
    <span class="course-price-tag">\${priceStr} €</span>
  </a>\`;
}`;
const CARD_NEW = `function courseCardHtml(c) {
  const priceStr = (c.price_cents / 100).toFixed(2).replace('.', ',');
  const cover = \`<img class="course-cover" src="\${escapeHtml(courseCoverUrl(c))}" alt="\${escapeHtml(c.title)}" loading="lazy">\`;
  return \`<a class="course-card" href="/kurzy/\${c.slug}">
    \${cover}
    <h3>\${escapeHtml(c.title)}</h3>
    <p>\${escapeHtml((c.description || '').slice(0, 140))}</p>
    <span class="course-price-tag">\${priceStr} €</span>
  </a>\`;
}`;
if (!patched1.includes(CARD_OLD)) { console.error('Nenasiel som courseCardHtml telo. Nic som nezmenil.'); process.exit(1); }
const patched2 = patched1.replace(CARD_OLD, CARD_NEW);

const HERO_OLD = `const coverHtml = course.cover_image_url ? \`<img class="course-hero-cover" src="\${escapeHtml(course.cover_image_url)}" alt="\${escapeHtml(course.title)}" loading="lazy">\` : '';`;
const HERO_NEW = `const coverHtml = \`<img class="course-hero-cover" src="\${escapeHtml(courseCoverUrl(course))}" alt="\${escapeHtml(course.title)}" loading="lazy">\`;`;
if (!patched2.includes(HERO_OLD)) { console.error('Nenasiel som coverHtml riadok. Nic som nezmenil.'); process.exit(1); }
const patched3 = patched2.replace(HERO_OLD, HERO_NEW);

const JSONLD_OLD = `      offers: { '@type': 'Offer', price: priceStr.replace(',', '.'), priceCurrency: 'EUR', url: BASE_URL_BLOG + '/kurzy/' + course.slug, availability: 'https://schema.org/InStock' },
      ...(course.cover_image_url ? { image: course.cover_image_url } : {})
    };`;
const JSONLD_NEW = `      offers: { '@type': 'Offer', price: priceStr.replace(',', '.'), priceCurrency: 'EUR', url: BASE_URL_BLOG + '/kurzy/' + course.slug, availability: 'https://schema.org/InStock' },
      image: courseCoverUrl(course)
    };`;
if (!patched3.includes(JSONLD_OLD)) { console.error('Nenasiel som course JSON-LD blok. Nic som nezmenil.'); process.exit(1); }
const patched4 = patched3.replace(JSONLD_OLD, JSONLD_NEW);

const backup = FILE + '.pre-kurzy-cover-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched4);
console.log('OK - zaloha:', backup);
