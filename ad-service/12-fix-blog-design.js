// Redesignuje blog (blogLayout + /blog + /blog/:slug) v produkčnom server.js —
// zosúlaďuje vizuál s novšími stránkami (landing/dashboard/terms): fluid
// typografia cez clamp(), safe-area padding, pätička, "späť na blog" odkaz,
// tag/read_time na kartách aj v článku, a čitateľný prázdny stav namiesto
// tichej prázdnej mriežky, keď nie sú žiadne články.
//
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online:
//   node /root/ad-service/12-fix-blog-design.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
const src = fs.readFileSync(SERVER_PATH, 'utf8');

const OLD_BLOCK = `function blogLayout({ title, description, body }) {
  return \`<!DOCTYPE html><html lang="sk"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>\${escapeHtml(title)}</title>
<meta name="description" content="\${escapeHtml(description)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Mono:wght@300;400;500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700&display=swap" rel="stylesheet">
<style>
:root{--black:#08080d;--black2:#0f0f18;--border:rgba(255,255,255,.07);--border2:rgba(255,255,255,.13);--text:#eeeef5;--text2:#a1a1bc;--text3:#5c5c7a;--volt:#c8ff00;--purple:#7c5cff;--purple2:#b09bff;--serif:'Instrument Serif',Georgia,serif;--mono:'DM Mono',monospace;--sans:'DM Sans',sans-serif}
*{box-sizing:border-box;margin:0;padding:0}body{background:var(--black);color:var(--text);font-family:var(--sans);line-height:1.65}
nav{position:sticky;top:0;padding:1.1rem 2rem;display:flex;justify-content:space-between;align-items:center;background:rgba(8,8,13,.88);backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}
.nav-logo{font-family:var(--mono);font-size:13px;letter-spacing:.15em;color:var(--text);text-decoration:none}
.nav-cta{padding:.65rem 1.1rem;background:var(--volt);color:var(--black);border-radius:8px;font-weight:700;font-family:var(--mono);font-size:.78rem;text-decoration:none}
.page{max-width:900px;margin:0 auto;padding:3rem 2rem 6rem}
.hero-title{font-family:var(--serif);font-size:clamp(2.2rem,5vw,3.6rem);line-height:1.08;margin-bottom:1rem}
.hero-title em{font-style:italic;color:var(--purple2)}
.post-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.25rem;margin-top:2rem}
.post-card{background:rgba(15,15,24,.82);border:1px solid var(--border);border-radius:16px;padding:1.5rem;text-decoration:none;color:inherit}
.post-card-title{font-family:var(--serif);font-size:1.4rem;color:var(--text);margin:.6rem 0}
.post-card-excerpt{color:var(--text2);font-size:.9rem}
.prose{max-width:720px;margin:0 auto}
.prose h2{font-family:var(--serif);font-size:1.9rem;margin:2.2rem 0 1rem}
.prose p{color:var(--text2);margin-bottom:1.1rem}
.prose ul{color:var(--text2);margin:0 0 1.1rem 1.2rem}
</style></head><body>
<nav><a href="/" class="nav-logo">SP TRÉNER</a><a href="/app" class="nav-cta">Prejsť do aplikácie →</a></nav>
\${body}
</body></html>\`;
}

app.get('/blog', async (req, res) => {
  try {
    const { data: posts } = await supabase.from('blog_posts').select('slug,title,excerpt,tag,read_time,created_at').eq('published', true).order('created_at', { ascending: false });
    const body = \`<main class="page">
      <h1 class="hero-title">Ako sa <em>naozaj</em> pripraviť na prijímacie testy.</h1>
      <div class="post-grid">\${(posts || []).map(p => \`
        <a class="post-card" href="/blog/\${escapeHtml(p.slug)}">
          <div class="post-card-title">\${escapeHtml(p.title)}</div>
          <div class="post-card-excerpt">\${escapeHtml(p.excerpt)}</div>
        </a>\`).join('')}</div>
    </main>\`;
    res.send(blogLayout({ title: 'Blog — SP Tréner', description: 'Postupy a stratégie príprav na prijímacie testy.', body }));
  } catch (e) {
    res.status(500).send('Chyba servera.');
  }
});

app.get('/blog/:slug', async (req, res) => {
  try {
    const { data: post } = await supabase.from('blog_posts').select('*').eq('slug', req.params.slug).eq('published', true).single();
    if (!post) return res.status(404).send(blogLayout({ title: 'Nenájdené', description: '', body: '<main class="page"><div class="prose"><h2>Článok sa nenašiel</h2></div></main>' }));
    const body = \`<main class="page"><article class="prose">
      <h1 class="hero-title">\${escapeHtml(post.title)}</h1>
      \${post.content}
    </article></main>\`;
    res.send(blogLayout({ title: post.title + ' — SP Tréner', description: post.excerpt, body }));
  } catch (e) {
    res.status(500).send('Chyba servera.');
  }
});`;

const NEW_BLOCK = `function blogLayout({ title, description, body }) {
  return \`<!DOCTYPE html><html lang="sk"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>\${escapeHtml(title)}</title>
<meta name="description" content="\${escapeHtml(description)}">
<meta name="theme-color" content="#08080d">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Mono:wght@300;400;500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700&display=swap" rel="stylesheet">
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
.back-link{display:inline-block;font-family:var(--mono);font-size:.78rem;color:var(--text3);text-decoration:none;margin-bottom:1.5rem}
.back-link:hover{color:var(--purple2)}
.hero-title{font-family:var(--serif);font-size:clamp(2rem,6vw,3.6rem);line-height:1.1;margin-bottom:1rem}
.hero-title em{font-style:italic;color:var(--purple2)}
.hero-sub{color:var(--text2);max-width:640px;margin-bottom:1rem}
.post-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.25rem;margin-top:2rem}
.post-card{background:rgba(15,15,24,.82);border:1px solid var(--border);border-radius:16px;padding:1.5rem;text-decoration:none;color:inherit;display:flex;flex-direction:column;transition:border-color .15s,transform .15s}
.post-card:hover{border-color:var(--border2);transform:translateY(-2px)}
.post-card-tag{font-family:var(--mono);font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;color:var(--purple2);margin-bottom:.6rem}
.post-card-title{font-family:var(--serif);font-size:1.35rem;color:var(--text);margin-bottom:.5rem;line-height:1.25}
.post-card-excerpt{color:var(--text2);font-size:.88rem;flex:1}
.post-card-meta{font-family:var(--mono);font-size:.7rem;color:var(--text3);margin-top:1rem}
.empty-state{color:var(--text3);font-size:.9rem;padding:2rem 0}
.prose{max-width:720px;margin:0 auto}
.prose-meta{display:flex;gap:.75rem;align-items:center;margin-bottom:1rem;font-family:var(--mono);font-size:.72rem;color:var(--text3);flex-wrap:wrap}
.prose-meta .tag{color:var(--purple2)}
.prose h2{font-family:var(--serif);font-size:clamp(1.5rem,3vw,1.9rem);margin:2.2rem 0 1rem}
.prose h3{font-family:var(--sans);font-weight:700;font-size:1.05rem;margin:1.6rem 0 .7rem}
.prose p{color:var(--text2);margin-bottom:1.1rem}
.prose ul,.prose ol{color:var(--text2);margin:0 0 1.1rem 1.2rem}
.prose li{margin-bottom:.4rem}
.prose strong{color:var(--text)}
.prose img{max-width:100%;height:auto;border-radius:12px;margin:1.5rem 0}
.prose a{color:var(--purple2)}
footer{border-top:1px solid var(--border);padding:2rem clamp(1rem,4vw,2rem);padding-bottom:calc(2rem + env(safe-area-inset-bottom));display:flex;justify-content:space-between;flex-wrap:wrap;gap:1rem;max-width:900px;margin:0 auto}
.footer-logo{font-family:var(--mono);font-size:12px;color:var(--text3)}
.footer-link{font-family:var(--mono);font-size:12px;color:var(--text3);text-decoration:none}
</style></head><body>
<nav><a href="/" class="nav-logo">SP TRÉNER</a><a href="/app" class="nav-cta">Prejsť do aplikácie →</a></nav>
\${body}
<footer><div class="footer-logo">SP TRÉNER © 2026</div><a href="/app" class="footer-link">Aplikácia</a></footer>
</body></html>\`;
}

app.get('/blog', async (req, res) => {
  try {
    const { data: posts } = await supabase.from('blog_posts').select('slug,title,excerpt,tag,read_time,created_at').eq('published', true).order('created_at', { ascending: false });
    const list = posts || [];
    const grid = list.length
      ? \`<div class="post-grid">\${list.map(p => \`
        <a class="post-card" href="/blog/\${escapeHtml(p.slug)}">
          \${p.tag ? \`<div class="post-card-tag">\${escapeHtml(p.tag)}</div>\` : ''}
          <div class="post-card-title">\${escapeHtml(p.title)}</div>
          <div class="post-card-excerpt">\${escapeHtml(p.excerpt)}</div>
          \${p.read_time ? \`<div class="post-card-meta">\${escapeHtml(p.read_time)}</div>\` : ''}
        </a>\`).join('')}</div>\`
      : \`<div class="empty-state">Zatiaľ tu nie sú žiadne články — čoskoro pridáme prvé.</div>\`;
    const body = \`<main class="page">
      <h1 class="hero-title">Ako sa <em>naozaj</em> pripraviť na prijímacie testy.</h1>
      <p class="hero-sub">Postupy, stratégie a časté chyby priamo od tímu SP Tréner.</p>
      \${grid}
    </main>\`;
    res.send(blogLayout({ title: 'Blog — SP Tréner', description: 'Postupy a stratégie príprav na prijímacie testy.', body }));
  } catch (e) {
    res.status(500).send('Chyba servera.');
  }
});

app.get('/blog/:slug', async (req, res) => {
  try {
    const { data: post } = await supabase.from('blog_posts').select('*').eq('slug', req.params.slug).eq('published', true).single();
    if (!post) return res.status(404).send(blogLayout({ title: 'Nenájdené', description: '', body: '<main class="page"><a href="/blog" class="back-link">← Späť na blog</a><div class="prose"><h2>Článok sa nenašiel</h2></div></main>' }));
    const body = \`<main class="page"><a href="/blog" class="back-link">← Späť na blog</a><article class="prose">
      <h1 class="hero-title">\${escapeHtml(post.title)}</h1>
      <div class="prose-meta">\${post.tag ? \`<span class="tag">\${escapeHtml(post.tag)}</span>\` : ''}\${post.read_time ? \`<span>\${escapeHtml(post.read_time)}</span>\` : ''}</div>
      \${post.content}
    </article></main>\`;
    res.send(blogLayout({ title: post.title + ' — SP Tréner', description: post.excerpt, body }));
  } catch (e) {
    res.status(500).send('Chyba servera.');
  }
});`;

if (!src.includes(OLD_BLOCK)) {
  if (src.includes('empty-state')) {
    console.error('❌ Vyzerá to, že oprava je už aplikovaná (nájdené "empty-state" v server.js). Nič som nezmenil.');
  } else {
    console.error('❌ Nenašiel som očakávaný pôvodný blog blok presne — nič som nezmenil. Over ručne.');
  }
  process.exit(1);
}

const backupPath = SERVER_PATH + '.pre-blog-redesign-' + Date.now();
fs.copyFileSync(SERVER_PATH, backupPath);
fs.writeFileSync(SERVER_PATH, src.replace(OLD_BLOCK, NEW_BLOCK));

console.log('✅ Blog redesignovaný (responzívny layout, tag/read_time, prázdny stav, pätička, späť-odkaz).');
console.log('   Záloha pôvodného server.js:', backupPath);
console.log('   Teraz over syntax: node -c server.js');
