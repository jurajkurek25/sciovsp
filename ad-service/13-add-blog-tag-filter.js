// Robí kategórie (tag) na blogu preklikateľné — na karte v zozname aj v
// samotnom článku, s filtrovaním cez /blog?tag=... a odkazom "zobraziť
// všetky". Keďže celá karta článku je odkaz <a>, tag sa nedá vnoriť dovnútra
// (neplatné HTML, <a> v <a>) — vyťahuje ho ako samostatný odkaz nad kartu.
//
// Predpoklad: 12-fix-blog-design.js už bol aplikovaný.
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online:
//   node /root/ad-service/13-add-blog-tag-filter.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
const src = fs.readFileSync(SERVER_PATH, 'utf8');

const OLD_CSS = `.post-card{background:rgba(15,15,24,.82);border:1px solid var(--border);border-radius:16px;padding:1.5rem;text-decoration:none;color:inherit;display:flex;flex-direction:column;transition:border-color .15s,transform .15s}
.post-card:hover{border-color:var(--border2);transform:translateY(-2px)}
.post-card-tag{font-family:var(--mono);font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;color:var(--purple2);margin-bottom:.6rem}
.post-card-title{font-family:var(--serif);font-size:1.35rem;color:var(--text);margin-bottom:.5rem;line-height:1.25}
.post-card-excerpt{color:var(--text2);font-size:.88rem;flex:1}
.post-card-meta{font-family:var(--mono);font-size:.7rem;color:var(--text3);margin-top:1rem}
.empty-state{color:var(--text3);font-size:.9rem;padding:2rem 0}
.prose{max-width:720px;margin:0 auto}
.prose-meta{display:flex;gap:.75rem;align-items:center;margin-bottom:1rem;font-family:var(--mono);font-size:.72rem;color:var(--text3);flex-wrap:wrap}
.prose-meta .tag{color:var(--purple2)}`;

const NEW_CSS = `.post-card-wrap{display:flex;flex-direction:column}
.post-card{background:rgba(15,15,24,.82);border:1px solid var(--border);border-radius:16px;padding:1.5rem;text-decoration:none;color:inherit;display:flex;flex-direction:column;flex:1;transition:border-color .15s,transform .15s}
.post-card:hover{border-color:var(--border2);transform:translateY(-2px)}
.post-card-tag{align-self:flex-start;font-family:var(--mono);font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;color:var(--purple2);margin-bottom:.5rem;text-decoration:none}
.post-card-tag:hover{color:var(--volt)}
.post-card-title{font-family:var(--serif);font-size:1.35rem;color:var(--text);margin-bottom:.5rem;line-height:1.25}
.post-card-excerpt{color:var(--text2);font-size:.88rem;flex:1}
.post-card-meta{font-family:var(--mono);font-size:.7rem;color:var(--text3);margin-top:1rem}
.empty-state{color:var(--text3);font-size:.9rem;padding:2rem 0}
.prose{max-width:720px;margin:0 auto}
.prose-meta{display:flex;gap:.75rem;align-items:center;margin-bottom:1rem;font-family:var(--mono);font-size:.72rem;color:var(--text3);flex-wrap:wrap}
.prose-meta .tag{color:var(--purple2);text-decoration:none}
.prose-meta .tag:hover{color:var(--volt)}`;

const OLD_ROUTES = `app.get('/blog', async (req, res) => {
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

const NEW_ROUTES = `app.get('/blog', async (req, res) => {
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
    const body = \`<main class="page">
      <h1 class="hero-title">Ako sa <em>naozaj</em> pripraviť na prijímacie testy.</h1>
      \${subLine}
      \${grid}
    </main>\`;
    res.send(blogLayout({ title: (tagFilter ? escapeHtml(tagFilter) + ' — ' : '') + 'Blog — SP Tréner', description: 'Postupy a stratégie príprav na prijímacie testy.', body }));
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
      <div class="prose-meta">\${post.tag ? \`<a class="tag" href="/blog?tag=\${encodeURIComponent(post.tag)}">\${escapeHtml(post.tag)}</a>\` : ''}\${post.read_time ? \`<span>\${escapeHtml(post.read_time)}</span>\` : ''}</div>
      \${post.content}
    </article></main>\`;
    res.send(blogLayout({ title: post.title + ' — SP Tréner', description: post.excerpt, body }));
  } catch (e) {
    res.status(500).send('Chyba servera.');
  }
});`;

if (!src.includes(OLD_CSS) || !src.includes(OLD_ROUTES)) {
  if (src.includes('post-card-wrap')) {
    console.error('❌ Vyzerá to, že oprava je už aplikovaná. Nič som nezmenil.');
  } else {
    console.error('❌ Nenašiel som očakávané pôvodné bloky presne — nič som nezmenil. Over, či bol najprv aplikovaný 12-fix-blog-design.js.');
  }
  process.exit(1);
}

const backupPath = SERVER_PATH + '.pre-blog-tag-filter-' + Date.now();
fs.copyFileSync(SERVER_PATH, backupPath);
let out = src.replace(OLD_CSS, NEW_CSS);
out = out.replace(OLD_ROUTES, NEW_ROUTES);
fs.writeFileSync(SERVER_PATH, out);

console.log('✅ Kategórie na blogu sú teraz preklikateľné (/blog?tag=...).');
console.log('   Záloha pôvodného server.js:', backupPath);
console.log('   Teraz over syntax: node -c server.js');
