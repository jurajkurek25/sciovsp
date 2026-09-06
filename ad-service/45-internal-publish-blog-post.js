// Nový interný endpoint pre cross-app publikovanie: samostatná appka
// ad.sptrener.online (iný server, iná DB — MySQL) potrebuje vedieť vložiť
// článok do blog_posts (Supabase/Postgres) tejto appky, keď AI automaticky
// vygeneruje a schváli PR článok po zaplatení. Chránené zdieľaným tajomstvom
// (hlavička X-Internal-Secret), nie je to verejné API.
//
// Vyžaduje najprv spustiť db/add_sponsored_columns.sql (pridáva stĺpce
// sponsored/sponsor_name do blog_posts) a nastaviť INTERNAL_API_SECRET
// v .env tejto appky (rovnaká hodnota musí byť aj v .env appky
// ad.sptrener.online).
//
// Presný textový match proti overenému živému kódu (server.js okolo
// riadku 3109 — kotva "app.get('/blog/:slug'").
//
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online:
//   node /root/ad-service/45-internal-publish-blog-post.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
const src = fs.readFileSync(SERVER_PATH, 'utf8');

if (src.includes('/api/internal/publish-blog-post')) {
  console.error('❌ Vyzerá to, že tento endpoint už existuje. Nič som nezmenil.');
  process.exit(1);
}

const ANCHOR = `app.get('/blog/:slug', async (req, res) => {`;

if (!src.includes(ANCHOR)) {
  console.error('❌ Nenašiel som kotvu ("app.get(\'/blog/:slug\'"). Nič som nezmenil.');
  process.exit(1);
}

const NEW_ROUTE = `const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;

// Volané VÝHRADNE zo samostatnej appky ad.sptrener.online po tom, čo AI
// automaticky vygeneruje a schváli PR (sponzorovaný) článok po zaplatení.
app.post('/api/internal/publish-blog-post', async (req, res) => {
  if (!INTERNAL_API_SECRET || req.headers['x-internal-secret'] !== INTERNAL_API_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const { slug, title, excerpt, content, tag, read_time, title_cs, excerpt_cs, content_cs, tag_cs, read_time_cs, sponsor_name } = req.body || {};
  if (!slug || !title || !excerpt || !content) {
    return res.status(400).json({ error: 'missing required fields' });
  }

  try {
    let finalSlug = String(slug).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 200);
    if (!finalSlug) finalSlug = 'pr-clanok-' + Date.now();
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await supabase.from('blog_posts').select('slug').eq('slug', finalSlug).maybeSingle();
      if (!existing) break;
      finalSlug = finalSlug + '-' + Math.random().toString(36).slice(2, 6);
    }

    const { data, error } = await supabase.from('blog_posts').insert({
      slug: finalSlug, title, excerpt, content, tag: tag || 'Partnerský obsah', read_time: read_time || null,
      title_cs: title_cs || null, excerpt_cs: excerpt_cs || null, content_cs: content_cs || null,
      tag_cs: tag_cs || null, read_time_cs: read_time_cs || null,
      sponsored: true, sponsor_name: sponsor_name || null, published: true
    }).select('slug').single();

    if (error) {
      console.error('internal publish-blog-post error:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json({ slug: data.slug, url: BASE_URL_BLOG + '/blog/' + data.slug });
  } catch (e) {
    console.error('internal publish-blog-post exception:', e);
    res.status(500).json({ error: 'server error' });
  }
});

${ANCHOR}`;

const backupPath = SERVER_PATH + '.pre-internal-publish-' + Date.now();
fs.copyFileSync(SERVER_PATH, backupPath);
const out = src.replace(ANCHOR, NEW_ROUTE);
fs.writeFileSync(SERVER_PATH, out);

console.log('✅ POST /api/internal/publish-blog-post pridaný.');
console.log('   Záloha pôvodného server.js:', backupPath);
console.log('   DÔLEŽITÉ: pridaj INTERNAL_API_SECRET do .env tejto appky (a rovnakú hodnotu do .env appky ad.sptrener.online).');
console.log('   Over syntax: node -c server.js');
