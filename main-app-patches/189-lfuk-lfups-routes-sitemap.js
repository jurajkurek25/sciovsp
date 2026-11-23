// SEO audit (zvyšok stránky, po dokončení /skola auditu): lfuk.html
// (341 riadkov) a lfups.html (189 riadkov) sú hotové, obsahovo bohaté
// SEO stránky mierené na konkrétne vysoko-hodnotné vyhľadávania
// ("LF UK Bratislava 2026/2027", "LF UPJŠ 100+100 otázok"), ale nemali
// ŽIADNU registrovanú routu — express.static nemá extensions:['html'],
// takže boli dostupné len na doslovnej /lfuk.html URL, ktorú nikto
// nepozná, nikde na ňu nič neodkazuje a nie je v sitemape.
//
// Obe stránky UŽ MAJÚ vlastný <link rel="canonical"> tag mierený na
// /vsp-test/lf-uk-bratislava a /vsp-test/lf-upjs-kosice — niekto tieto
// URL zámerne naplánoval, len routu nikdy nedokončil. Tento patch
// registruje presne TIETO URL (rešpektuje existujúci canonical, nie
// vymyslená nová schéma) a pridáva ich do sitemap.xml.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/189-lfuk-lfups-routes-sitemap.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');

if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}
if (!fs.existsSync(path.join(process.cwd(), 'public', 'lfuk.html')) || !fs.existsSync(path.join(process.cwd(), 'public', 'lfups.html'))) {
  console.error('❌ Nenašiel som public/lfuk.html alebo public/lfups.html.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.189-lfuk-lfups-routes-sitemap-lock');
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

if (server.includes('/vsp-test/lf-uk-bratislava')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// 1) routy — hneď vedľa /legal
server = replaceOnce(server,
  `app.get('/legal', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'legal.html')); });`,
  `app.get('/legal', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'legal.html')); });
app.get('/vsp-test/lf-uk-bratislava', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'lfuk.html')); });
app.get('/vsp-test/lf-upjs-kosice', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'lfups.html')); });`,
  'pridanie /vsp-test/lf-uk-bratislava a /vsp-test/lf-upjs-kosice rout');

// 2) sitemap.xml
server = replaceOnce(server,
  `      { loc: BASE_URL_BLOG + '/skola', changefreq: 'monthly', priority: '0.6' },
      ...FACULTY_LIST.map(f => ({ loc: BASE_URL_BLOG + '/skola/' + f.uSlug + '/' + f.fSlug, changefreq: 'monthly', priority: '0.5' }))
    ];`,
  `      { loc: BASE_URL_BLOG + '/skola', changefreq: 'monthly', priority: '0.6' },
      ...FACULTY_LIST.map(f => ({ loc: BASE_URL_BLOG + '/skola/' + f.uSlug + '/' + f.fSlug, changefreq: 'monthly', priority: '0.5' })),
      { loc: BASE_URL_BLOG + '/vsp-test/lf-uk-bratislava', changefreq: 'monthly', priority: '0.7' },
      { loc: BASE_URL_BLOG + '/vsp-test/lf-upjs-kosice', changefreq: 'monthly', priority: '0.7' }
    ];`,
  'sitemap.xml -> pridanie lfuk/lfups URL');

const backup = SERVER_PATH + '.pre-lfuk-lfups-routes-sitemap-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, server);

console.log('✅ /vsp-test/lf-uk-bratislava a /vsp-test/lf-upjs-kosice sú teraz skutočné, funkčné routy (sedia s existujúcim canonical tagom v tých súboroch) a sú v sitemap.xml.');
console.log('   Záloha:', backup);
console.log('   Over syntax pred reštartom: node -c server.js');
