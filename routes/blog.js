const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');

const SITE_NAME = 'SP TRÉNER';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function layout({ title, description, canonical, body }) {
  return `<!DOCTYPE html>
<html lang="sk">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(canonical)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Mono:wght@300;400;500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700&display=swap" rel="stylesheet">
<style>
:root{
  --black:#08080d;--black2:#0f0f18;--black3:#171724;
  --border:rgba(255,255,255,.07);--border2:rgba(255,255,255,.13);
  --text:#eeeef5;--text2:#a1a1bc;--text3:#5c5c7a;
  --volt:#c8ff00;--purple:#7c5cff;--purple2:#b09bff;
  --red:#ff3f5e;--green:#36e896;--yellow:#ffc94d;
  --serif:'Instrument Serif',Georgia,serif;
  --mono:'DM Mono',monospace;
  --sans:'DM Sans',sans-serif;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--black);color:var(--text);font-family:var(--sans);overflow-x:hidden;line-height:1.65}
body::after{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");pointer-events:none;z-index:0}

nav{position:sticky;top:0;z-index:100;padding:1.1rem 2rem;display:flex;align-items:center;justify-content:space-between;background:rgba(8,8,13,.88);backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}
.nav-logo{font-family:var(--mono);font-size:13px;letter-spacing:.15em;color:var(--text);text-decoration:none;display:inline-flex;align-items:center;gap:.55rem}
.nav-dot{width:7px;height:7px;background:var(--volt);border-radius:50%;animation:pulse-dot 2s infinite}
@keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.7)}}
.nav-links{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap}
.nav-link,.nav-cta{text-decoration:none;font-family:var(--mono);font-size:.78rem;letter-spacing:.05em;border-radius:8px;transition:all .2s}
.nav-link{color:var(--text2);padding:.65rem .85rem;border:1px solid transparent}
.nav-link:hover{color:var(--text);border-color:var(--border2)}
.nav-cta{padding:.75rem 1.1rem;background:var(--volt);color:var(--black);font-weight:700}
.nav-cta:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(200,255,0,.25)}

.hero{position:relative;padding:5rem 2rem 3rem;text-align:center;overflow:hidden;z-index:1}
.hero-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(124,92,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(124,92,255,.04) 1px,transparent 1px);background-size:60px 60px;mask-image:radial-gradient(ellipse 75% 75% at 50% 45%,black,transparent);pointer-events:none}
.hero-orb{position:absolute;border-radius:50%;filter:blur(80px);pointer-events:none;animation:orb-float 9s ease-in-out infinite}
.hero-orb-1{width:420px;height:420px;background:rgba(124,92,255,.12);top:-120px;left:-120px}
.hero-orb-2{width:360px;height:360px;background:rgba(200,255,0,.06);right:-80px;top:20px;animation-delay:-4s}
@keyframes orb-float{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(28px,-24px) scale(1.05)}66%{transform:translate(-18px,20px) scale(.95)}}
.hero-eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--volt);margin-bottom:1.4rem;position:relative;z-index:1}
.hero-title{font-family:var(--serif);font-size:clamp(2.4rem,5.5vw,4.6rem);line-height:1.06;letter-spacing:-.02em;margin:0 auto 1.2rem;max-width:900px;position:relative;z-index:1}
.hero-title em{font-style:italic;color:var(--purple2)}
.hero-title .volt-text{color:var(--volt);font-style:normal}
.hero-sub{max-width:680px;margin:0 auto;color:var(--text2);font-size:1.02rem;position:relative;z-index:1}

.page{position:relative;z-index:1;max-width:1000px;margin:0 auto;padding:3rem 2rem 6rem}

/* ── Article list ── */
.post-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1.25rem;margin-top:2rem}
.post-card{display:flex;flex-direction:column;background:rgba(15,15,24,.82);border:1px solid var(--border);border-radius:18px;padding:1.6rem;text-decoration:none;transition:all .2s;backdrop-filter:blur(10px)}
.post-card:hover{border-color:var(--purple);transform:translateY(-3px)}
.post-card-meta{display:flex;align-items:center;gap:.6rem;font-family:var(--mono);font-size:.72rem;letter-spacing:.05em;color:var(--text3);margin-bottom:.9rem}
.post-card-tag{color:var(--volt)}
.post-card-title{font-family:var(--serif);font-size:1.5rem;line-height:1.2;color:var(--text);margin-bottom:.7rem}
.post-card-excerpt{color:var(--text2);font-size:.92rem;flex:1}
.post-card-arrow{margin-top:1rem;font-family:var(--mono);font-size:.78rem;color:var(--purple2)}
.empty-state{color:var(--text2);font-family:var(--mono);font-size:.85rem;padding:2rem 0}

/* ── Article detail ── */
.post-meta{display:flex;align-items:center;justify-content:center;gap:.75rem;font-family:var(--mono);font-size:.75rem;letter-spacing:.05em;color:var(--text3);margin-bottom:1.2rem}
.post-meta .post-card-tag{color:var(--volt)}
.back-link{display:inline-flex;align-items:center;gap:.5rem;color:var(--text2);text-decoration:none;font-family:var(--mono);font-size:.78rem;letter-spacing:.05em;margin-bottom:2rem;transition:color .2s}
.back-link:hover{color:var(--text)}
.prose{max-width:760px;margin:0 auto}
.prose h2{font-family:var(--serif);font-size:clamp(1.5rem,3vw,2.1rem);line-height:1.15;margin:2.4rem 0 1rem;color:var(--text)}
.prose h3{font-family:var(--mono);font-size:.95rem;letter-spacing:.03em;color:var(--purple2);margin:1.8rem 0 .8rem}
.prose p{color:var(--text2);margin-bottom:1.1rem;font-size:1.02rem}
.prose ul,.prose ol{color:var(--text2);margin:0 0 1.1rem 1.2rem}
.prose li{margin-bottom:.5rem}
.prose strong{color:var(--text)}
.prose em{color:var(--purple2);font-style:italic}

.footer-cta{margin-top:4rem;padding:2rem;border-radius:22px;background:linear-gradient(135deg,rgba(124,92,255,.08),rgba(200,255,0,.04));border:1px solid var(--border);text-align:center;max-width:760px;margin-left:auto;margin-right:auto}
.footer-cta h3{font-family:var(--serif);font-size:clamp(1.6rem,3vw,2.2rem);line-height:1.1;margin-bottom:.8rem}
.footer-cta h3 em{font-style:italic;color:var(--purple2)}
.footer-cta p{color:var(--text2);max-width:520px;margin:0 auto 1.5rem}
.btn-primary{display:inline-flex;align-items:center;gap:.55rem;padding:1rem 1.5rem;background:var(--volt);color:var(--black);border-radius:10px;font-weight:700;font-size:.92rem;text-decoration:none;font-family:var(--mono);letter-spacing:.03em;transition:all .2s}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(200,255,0,.28)}

footer{border-top:1px solid var(--border);padding:2rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;position:relative;z-index:1}
.footer-logo{font-family:var(--mono);font-size:12px;letter-spacing:.15em;color:var(--text3)}
.footer-links{display:flex;gap:1.4rem;flex-wrap:wrap}
.footer-links a{text-decoration:none;color:var(--text3);font-family:var(--mono);font-size:.78rem;letter-spacing:.05em;transition:color .2s}
.footer-links a:hover{color:var(--text2)}

@media (max-width:768px){
  nav{padding:1rem 1.25rem}
  .page,.hero{padding-left:1.25rem;padding-right:1.25rem}
  .footer-cta{padding:1.4rem}
  footer{flex-direction:column;text-align:center}
}
</style>
</head>
<body>

<nav>
  <a href="/" class="nav-logo"><span class="nav-dot"></span>${SITE_NAME}</a>
  <div class="nav-links">
    <a href="/blog" class="nav-link">Blog</a>
    <a href="/app" class="nav-cta">Prejsť do aplikácie →</a>
  </div>
</nav>

${body}

<footer>
  <div class="footer-logo">${SITE_NAME} © 2026</div>
  <div class="footer-links">
    <a href="/app">Aplikácia</a>
    <a href="/blog">Blog</a>
    <a href="mailto:juraj@jurajkurek.com">Kontakt</a>
    <a href="/legal.html">Obchodné podmienky a ochrana osobných údajov</a>
  </div>
</footer>

</body>
</html>`;
}

function postCardHtml(post) {
  const date = new Date(post.created_at).toLocaleDateString('sk-SK', { year: 'numeric', month: 'long', day: 'numeric' });
  return `<a href="/blog/${escapeHtml(post.slug)}" class="post-card">
    <div class="post-card-meta">
      ${post.tag ? `<span class="post-card-tag">${escapeHtml(post.tag)}</span><span>·</span>` : ''}
      <span>${escapeHtml(date)}</span>
      ${post.read_time ? `<span>·</span><span>${escapeHtml(post.read_time)}</span>` : ''}
    </div>
    <div class="post-card-title">${escapeHtml(post.title)}</div>
    <div class="post-card-excerpt">${escapeHtml(post.excerpt)}</div>
    <div class="post-card-arrow">Čítať viac →</div>
  </a>`;
}

// GET /blog — zoznam publikovaných článkov
router.get('/blog', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT slug, title, excerpt, tag, read_time, created_at
       FROM blog_posts WHERE published = TRUE ORDER BY created_at DESC`
    );

    const body = `
<section class="hero">
  <div class="hero-grid"></div>
  <div class="hero-orb hero-orb-1"></div>
  <div class="hero-orb hero-orb-2"></div>
  <div class="hero-eyebrow">Blog · SP Tréner</div>
  <h1 class="hero-title">Ako sa <em>naozaj</em> pripraviť<br>na <span class="volt-text">prijímacie testy.</span></h1>
  <p class="hero-sub">Postupy, typické chyby a stratégie príprav na VŠP/OSP a odborové prijímacie testy — písané na základe reálnych dát z tisícok cvičných testov.</p>
</section>
<main class="page">
  <div class="post-grid">
    ${rows.length ? rows.map(postCardHtml).join('\n') : '<div class="empty-state">Zatiaľ tu nie sú žiadne články.</div>'}
  </div>
</main>`;

    res.send(layout({
      title: `Blog — ${SITE_NAME}`,
      description: 'Postupy, typické chyby a stratégie príprav na VŠP/OSP a odborové prijímacie testy.',
      canonical: '/blog',
      body
    }));
  } catch (e) {
    console.error('blog list error:', e);
    res.status(500).send('Interná chyba servera.');
  }
});

// GET /blog/:slug — detail článku
router.get('/blog/:slug', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT slug, title, excerpt, content, tag, read_time, created_at
       FROM blog_posts WHERE slug = $1 AND published = TRUE LIMIT 1`,
      [req.params.slug]
    );
    const post = rows[0];
    if (!post) {
      return res.status(404).send(layout({
        title: `Článok nenájdený — ${SITE_NAME}`,
        description: 'Tento článok neexistuje alebo bol odstránený.',
        canonical: `/blog/${escapeHtml(req.params.slug)}`,
        body: `<main class="page"><div class="prose"><h2>Článok sa nenašiel</h2><p>Skús sa vrátiť na <a href="/blog" style="color:var(--purple2)">zoznam článkov</a>.</p></div></main>`
      }));
    }

    const date = new Date(post.created_at).toLocaleDateString('sk-SK', { year: 'numeric', month: 'long', day: 'numeric' });
    const body = `
<main class="page">
  <a href="/blog" class="back-link">← Späť na blog</a>
  <article class="prose">
    <div class="post-meta">
      ${post.tag ? `<span class="post-card-tag">${escapeHtml(post.tag)}</span><span>·</span>` : ''}
      <span>${escapeHtml(date)}</span>
      ${post.read_time ? `<span>·</span><span>${escapeHtml(post.read_time)}</span>` : ''}
    </div>
    <h1 style="font-family:var(--serif);font-size:clamp(2rem,4.5vw,3rem);line-height:1.1;text-align:center;margin-bottom:2rem">${escapeHtml(post.title)}</h1>
    ${post.content}
  </article>
  <div class="footer-cta">
    <h3>Otestuj si to <em>naostro.</em></h3>
    <p>Neobmedzené cvičné testy, AI generátor úloh na mieru a analýza toho, kde presne strácaš body.</p>
    <a href="/app" class="btn-primary">Začať zadarmo →</a>
  </div>
</main>`;

    res.send(layout({
      title: `${post.title} — ${SITE_NAME}`,
      description: post.excerpt,
      canonical: `/blog/${escapeHtml(post.slug)}`,
      body
    }));
  } catch (e) {
    console.error('blog detail error:', e);
    res.status(500).send('Interná chyba servera.');
  }
});

module.exports = router;
