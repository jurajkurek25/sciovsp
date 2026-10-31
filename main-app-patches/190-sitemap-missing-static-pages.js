// SEO audit: sitemap.xml obsahoval len /, /blog(+posty), /kurzy(+kurzy),
// /skola(+fakulty) a (po patchi 189) lfuk/lfups — chýbalo mu 7 reálnych,
// obsahovo hotových statických stránok. Pridáva ich.
//
// Zámerne VYNECHÁVA /darcek, /darek, /vianoce, /vanoce a /kam-na-vysokou —
// to su duplicitné URL na ten istý súbor (riešené v nasledujúcom patchi
// spolu s canonical tagmi), nemá zmysel sitemapovať duplicitu skôr, než
// sa rozhodne, ktorá URL je tá "správna".
//
// Predpoklad: main-app-patches/189 uz je aplikovany.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/190-sitemap-missing-static-pages.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');

if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.190-sitemap-missing-static-pages-lock');
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (' + LOCK + '). Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

function replaceOnce(src, oldStr, newStr, label) {
  const count = src.split(oldStr).length - 1;
  if (count !== 1) {
    console.error('❌ ' + label + ' — kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil.');
    process.exit(1);
  }
  return src.replace(oldStr, () => newStr);
}

let server = fs.readFileSync(SERVER_PATH, 'utf8');

if (server.includes("BASE_URL_BLOG + '/kam-na-vysoku'")) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}
if (!server.includes("BASE_URL_BLOG + '/vsp-test/lf-upjs-kosice'")) {
  console.error('❌ Nenašiel som lf-upjs-kosice v sitemape — over, či je main-app-patches/189 už aplikovaný. Nič som nezmenil.');
  process.exit(1);
}

server = replaceOnce(server,
  `      { loc: BASE_URL_BLOG + '/vsp-test/lf-uk-bratislava', changefreq: 'monthly', priority: '0.7' },
      { loc: BASE_URL_BLOG + '/vsp-test/lf-upjs-kosice', changefreq: 'monthly', priority: '0.7' }
    ];`,
  `      { loc: BASE_URL_BLOG + '/vsp-test/lf-uk-bratislava', changefreq: 'monthly', priority: '0.7' },
      { loc: BASE_URL_BLOG + '/vsp-test/lf-upjs-kosice', changefreq: 'monthly', priority: '0.7' },
      { loc: BASE_URL_BLOG + '/kam-na-vysoku', changefreq: 'monthly', priority: '0.8' },
      { loc: BASE_URL_BLOG + '/generalka', changefreq: 'monthly', priority: '0.6' },
      { loc: BASE_URL_BLOG + '/legal', changefreq: 'yearly', priority: '0.3' },
      { loc: BASE_URL_BLOG + '/odporucame', changefreq: 'monthly', priority: '0.5' },
      { loc: BASE_URL_BLOG + '/webinar', changefreq: 'weekly', priority: '0.6' },
      { loc: BASE_URL_BLOG + '/darcekova-karta', changefreq: 'monthly', priority: '0.5' },
      { loc: BASE_URL_BLOG + '/uplatnit-darcek', changefreq: 'yearly', priority: '0.2' }
    ];`,
  'sitemap.xml -> pridanie 7 chýbajúcich statických stránok');

const backup = SERVER_PATH + '.pre-sitemap-missing-static-pages-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, server);

console.log('✅ sitemap.xml doplnený o /kam-na-vysoku, /generalka, /legal, /odporucame, /webinar, /darcekova-karta, /uplatnit-darcek.');
console.log('   Záloha:', backup);
console.log('   Over syntax pred reštartom: node -c server.js');
