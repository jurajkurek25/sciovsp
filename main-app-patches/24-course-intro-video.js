const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('course-intro-video')) {
  console.error('Uz je aplikovane (najdene course-intro-video), nic som nezmenil.');
  process.exit(1);
}

const OLD = `    const coverHtml = \`<img class="course-hero-cover" src="\${escapeHtml(courseCoverUrl(course))}" alt="\${escapeHtml(course.title)}" loading="lazy">\`;
    const buyBoxHtml = \`<div class="course-buy-box">
        <span class="course-price-tag">\${priceStr}</span>
        <div class="courseAuthSlot" data-free="\${course.price_cents === 0 ? '1' : '0'}"><span style="color:var(--text3);font-size:.85rem">Načítavam…</span></div>
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
    <script src="/kurz-detail.js" data-slug="\${course.slug}"></script>\`;`;

const NEW = `    const coverHtml = \`<img class="course-hero-cover" src="\${escapeHtml(courseCoverUrl(course))}" alt="\${escapeHtml(course.title)}" loading="lazy">\`;
    const introVideoHtml = course.intro_video_url ? \`<div class="bp-mount" id="course-intro-video" data-src="\${escapeHtml(course.intro_video_url)}" style="margin-bottom:1.4rem;max-width:720px"></div>\` : '';
    const heroMediaHtml = course.intro_video_url ? introVideoHtml : coverHtml;
    const buyBoxHtml = \`<div class="course-buy-box">
        <span class="course-price-tag">\${priceStr}</span>
        <div class="courseAuthSlot" data-free="\${course.price_cents === 0 ? '1' : '0'}"><span style="color:var(--text3);font-size:.85rem">Načítavam…</span></div>
      </div>\`;
    const salesHtml = course.sales_content ? \`<article class="prose course-sales">\${course.sales_content}</article>\` : '';
    const body = \`\${KURZY_STYLE}<main class="page">
      <nav class="breadcrumb"><a href="/">SP Tréner</a><span>/</span><a href="/kurzy">Kurzy</a><span>/</span><span>\${escapeHtml(course.title)}</span></nav>
      <h1 class="hero-title">\${escapeHtml(course.title)}</h1>
      <p class="course-tagline">\${escapeHtml(course.description || '')}</p>
      \${heroMediaHtml}
      \${buyBoxHtml}
      \${salesHtml}
      <h2 class="course-outline-heading">Obsah kurzu</h2>
      <ol class="course-lesson-outline">\${(lessons || []).map(l => \`<li>\${escapeHtml(l.title)}</li>\`).join('')}</ol>
      \${buyBoxHtml}
    </main>
    <script src="/branded-player.js"></script>
    \${course.intro_video_url ? \`<script>mountBrandedPlayer(document.getElementById('course-intro-video'), \${JSON.stringify(course.intro_video_url)});</script>\` : ''}
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="/kurz-detail.js" data-slug="\${course.slug}"></script>\`;`;

if (!src.includes(OLD)) { console.error('Nenasiel som presnu kotvu pre kurz-detail sablonu. Nic som nezmenil.'); process.exit(1); }

const patched = src.replace(OLD, NEW);

const backup = FILE + '.pre-course-intro-video-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
