const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

const L = (...lines) => lines.join('\n');

if (src.includes("app.get('/blog/rss.xml'")) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const RSS_ROUTE = L(
  "app.get('/blog/rss.xml', async (req, res) => {",
  "  try {",
  "    const lang = blogLang(req);",
  "    const audienceLangs = lang === 'cs' ? ['cz', 'both'] : ['sk', 'both'];",
  "    const { data: posts } = await supabase.from('blog_posts').select('slug,title,excerpt,title_cs,excerpt_cs,created_at,target_lang').eq('published', true).in('target_lang', audienceLangs).order('created_at', { ascending: false }).limit(30);",
  "    const list = posts || [];",
  "    const escXml = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');",
  "    const items = list.map(p => {",
  "      const title = lang === 'cs' && p.title_cs ? p.title_cs : p.title;",
  "      const excerpt = lang === 'cs' && p.excerpt_cs ? p.excerpt_cs : p.excerpt;",
  "      const url = BASE_URL_BLOG + '/blog/' + p.slug + (lang === 'cs' ? '?lang=cs' : '');",
  "      const pubDate = new Date(p.created_at).toUTCString();",
  "      return '<item><title>' + escXml(title) + '</title><link>' + escXml(url) + '</link><guid>' + escXml(url) + '</guid><pubDate>' + pubDate + '</pubDate><description>' + escXml(excerpt || '') + '</description></item>';",
  "    }).join('');",
  "    const feedUrl = BASE_URL_BLOG + '/blog' + (lang === 'cs' ? '?lang=cs' : '');",
  "    const feedDesc = lang === 'cs' ? 'Novinky a rady k přijímačkám a VŠP testům' : 'Novinky a rady k prijímačkám a VŠP testom';",
  "    const xml = '<?xml version=\"1.0\" encoding=\"UTF-8\"?><rss version=\"2.0\"><channel>'",
  "      + '<title>SP Tréner Blog</title><link>' + escXml(feedUrl) + '</link><description>' + escXml(feedDesc) + '</description>'",
  "      + '<language>' + (lang === 'cs' ? 'cs' : 'sk') + '</language>' + items + '</channel></rss>';",
  "    res.set('Content-Type', 'application/rss+xml; charset=utf-8');",
  "    res.send(xml);",
  "  } catch (e) {",
  "    res.status(500).send('Chyba servera.');",
  "  }",
  "});",
  "",
  "app.get('/blog', async (req, res) => {"
);

const patched = replaceOnce(src, "app.get('/blog', async (req, res) => {", RSS_ROUTE, 'blog route anchor');

const backup = FILE + '.pre-blog-rss-feed-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
