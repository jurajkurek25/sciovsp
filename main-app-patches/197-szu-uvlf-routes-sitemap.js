// Registruje routy pre 2 nové SEO landing pages (main-app-patches/195 a
// main-app-patches/196, MUSIA byť aplikované ako prvé) a pridáva ich do
// sitemap.xml — presne rovnaký vzor ako main-app-patches/189 pre
// lfuk.html/lfups.html.
//
// URL zámerne zodpovedajú tomu, na čo už odkazuje related-section v
// lfuk.html (main-app-patches/187 kontext) — /vsp-test/lf-szu-bratislava
// a /vsp-test/uvlf-kosice boli doteraz rozbité odkazy, teraz budú funkčné.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/197-szu-uvlf-routes-sitemap.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');

if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}
if (!fs.existsSync(path.join(process.cwd(), 'public', 'lf-szu-bratislava.html')) || !fs.existsSync(path.join(process.cwd(), 'public', 'uvlf-kosice.html'))) {
  console.error('❌ Nenašiel som public/lf-szu-bratislava.html alebo public/uvlf-kosice.html. Over, že main-app-patches/195 a main-app-patches/196 už bežali.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.197-szu-uvlf-routes-sitemap-lock');
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

if (server.includes('/vsp-test/lf-szu-bratislava')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}
if (!server.includes("app.get('/vsp-test/lf-upjs-kosice'")) {
  console.error('❌ Nenašiel som routu /vsp-test/lf-upjs-kosice — over, že main-app-patches/189 už je aplikovaný. Nič som nezmenil.');
  process.exit(1);
}

// 1) routy — hneď vedľa lf-upjs-kosice
server = replaceOnce(server,
  `app.get('/vsp-test/lf-upjs-kosice', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'lfups.html')); });`,
  `app.get('/vsp-test/lf-upjs-kosice', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'lfups.html')); });
app.get('/vsp-test/lf-szu-bratislava', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'lf-szu-bratislava.html')); });
app.get('/vsp-test/uvlf-kosice', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'uvlf-kosice.html')); });`,
  'pridanie /vsp-test/lf-szu-bratislava a /vsp-test/uvlf-kosice rout');

// 2) sitemap.xml
if (!server.includes("BASE_URL_BLOG + '/uplatnit-darcek'")) {
  console.error('❌ Nenašiel som /uplatnit-darcek v sitemape — over, že main-app-patches/190 už je aplikovaný. Nič som nezmenil.');
  process.exit(1);
}
server = replaceOnce(server,
  `      { loc: BASE_URL_BLOG + '/uplatnit-darcek', changefreq: 'yearly', priority: '0.2' }
    ];`,
  `      { loc: BASE_URL_BLOG + '/uplatnit-darcek', changefreq: 'yearly', priority: '0.2' },
      { loc: BASE_URL_BLOG + '/vsp-test/lf-szu-bratislava', changefreq: 'monthly', priority: '0.7' },
      { loc: BASE_URL_BLOG + '/vsp-test/uvlf-kosice', changefreq: 'monthly', priority: '0.7' }
    ];`,
  'sitemap.xml -> pridanie lf-szu-bratislava/uvlf-kosice URL');

const backup = SERVER_PATH + '.pre-szu-uvlf-routes-sitemap-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, server);

console.log('✅ /vsp-test/lf-szu-bratislava a /vsp-test/uvlf-kosice sú teraz skutočné, funkčné routy a sú v sitemap.xml.');
console.log('   Záloha:', backup);
console.log('   Over syntax pred reštartom: node -c server.js');
