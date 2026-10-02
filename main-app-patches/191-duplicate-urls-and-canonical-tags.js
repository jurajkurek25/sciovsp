// SEO audit, pokračovanie: rieši duplicitné URL (rovnaký súbor na 2
// adresách bez canonical) a chýbajúce canonical tagy na 13 statických
// stránkach.
//
// Duplicitné URL -> menej agresívne "typo-catching" aliasy sa menia na
// 301 presmerovania (zachováva UX pre preklep, eliminuje duplicitu
// úplne, na rozdiel od len canonical tagu):
//   /darek         -> 301 -> /darcek         (spisovne "darček")
//   /vanoce        -> 301 -> /vianoce        (slovenský pravopis, nie český)
//   /kam-na-vysokou -> 301 -> /kam-na-vysoku (gramaticky správny tvar, aj
//                                              jediný, čo sa reálne používa
//                                              interne)
// Rozhodnuté podľa toho, ktorý tvar je jazykovo správny — ani jeden pár
// nemal interné odkazy, ktoré by naznačovali iný zámer.
//
// Canonical tagy -> pridané do 12 z 13 chýbajúcich stránok (kotva
// <meta charset="UTF-8">, overená main-app-patches/170). kurz-watch.html
// VYNECHANÁ ZÁMERNE — je to šablóna pre viacero kurzov naraz
// (/kurzy/:slug/watch), jeden pevný canonical v statickom súbore by bol
// nesprávny pre všetky kurzy okrem jedného.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/191-duplicate-urls-and-canonical-tags.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
const PUBLIC_DIR = path.join(process.cwd(), 'public');

if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.191-duplicate-urls-and-canonical-tags-lock');
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

// ═══════════════════════════════════ SERVER.JS — 301 presmerovania ═══════════════════════════════════

let server = fs.readFileSync(SERVER_PATH, 'utf8');

if (server.includes("res.redirect(301, '/darcek')")) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

server = replaceOnce(server,
  `app.get('/darek', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'darek.html')); });`,
  `app.get('/darek', (req, res) => { res.redirect(301, '/darcek'); });`,
  '/darek -> 301 presmerovanie na /darcek');

server = replaceOnce(server,
  `app.get('/vanoce', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'vianoce.html')); });`,
  `app.get('/vanoce', (req, res) => { res.redirect(301, '/vianoce'); });`,
  '/vanoce -> 301 presmerovanie na /vianoce');

server = replaceOnce(server,
  `app.get('/kam-na-vysokou', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'kam-na-vysoku.html')); });`,
  `app.get('/kam-na-vysokou', (req, res) => { res.redirect(301, '/kam-na-vysoku'); });`,
  '/kam-na-vysokou -> 301 presmerovanie na /kam-na-vysoku');

const serverBackup = SERVER_PATH + '.pre-duplicate-urls-and-canonical-' + Date.now();
fs.copyFileSync(SERVER_PATH, serverBackup);
fs.writeFileSync(SERVER_PATH, server);

// ═══════════════════════════════════ CANONICAL TAGY ═══════════════════════════════════

const BASE_URL = 'https://sptrener.online';

const CANONICAL_TARGETS = [
  { file: 'app.html', urlPath: '/app' },
  { file: 'darcekova-karta-hotovo.html', urlPath: '/darcekova-karta/hotovo' },
  { file: 'darcekova-karta.html', urlPath: '/darcekova-karta' },
  { file: 'darek.html', urlPath: '/darcek' },
  { file: 'komunita.html', urlPath: '/komunita' },
  { file: 'legal.html', urlPath: '/legal' },
  { file: 'odporucame.html', urlPath: '/odporucame' },
  { file: 'ponuka.html', urlPath: '/ponuka' },
  { file: 'uplatnit-darcek.html', urlPath: '/uplatnit-darcek' },
  { file: 'webinar-dakujeme.html', urlPath: '/webinar/dakujeme' },
  { file: 'webinar.html', urlPath: '/webinar' },
  { file: 'webinar-live.html', urlPath: '/webinar/live' }
];

const results = [];

for (const { file, urlPath } of CANONICAL_TARGETS) {
  const filePath = path.join(PUBLIC_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.error('❌ Nenašiel som public/' + file + '. Nič som pri ňom nezmenil.');
    process.exitCode = 1;
    continue;
  }
  let html = fs.readFileSync(filePath, 'utf8');
  if (html.includes('rel="canonical"')) {
    results.push(file + ': už má canonical, preskočené');
    continue;
  }
  const tag = '<link rel="canonical" href="' + BASE_URL + urlPath + '">';
  const newHtml = replaceOnce(html, '<meta charset="UTF-8">', '<meta charset="UTF-8">\n' + tag, file + ' -> canonical tag');
  const backup = filePath + '.pre-canonical-' + Date.now();
  fs.copyFileSync(filePath, backup);
  fs.writeFileSync(filePath, newHtml);
  results.push(file + ': pridaný canonical -> ' + BASE_URL + urlPath);
}

// recenzia.html -> iná kotva, nemá <meta charset>
const recenziaPath = path.join(PUBLIC_DIR, 'recenzia.html');
if (fs.existsSync(recenziaPath)) {
  let html = fs.readFileSync(recenziaPath, 'utf8');
  if (html.includes('rel="canonical"')) {
    results.push('recenzia.html: už má canonical, preskočené');
  } else {
    const tag = '<link rel="canonical" href="' + BASE_URL + '/recenzia">';
    const newHtml = replaceOnce(html,
      `<head>\n<script id="Cookiebot"`,
      `<head>\n${tag}\n<script id="Cookiebot"`,
      'recenzia.html -> canonical tag (špeciálna kotva)');
    const backup = recenziaPath + '.pre-canonical-' + Date.now();
    fs.copyFileSync(recenziaPath, backup);
    fs.writeFileSync(recenziaPath, newHtml);
    results.push('recenzia.html: pridaný canonical -> ' + BASE_URL + '/recenzia');
  }
} else {
  console.error('❌ Nenašiel som public/recenzia.html.');
  process.exitCode = 1;
}

console.log('✅ 3 duplicitné URL teraz 301 presmerúvajú na kanonickú verziu.');
console.log('   Záloha server.js:', serverBackup);
console.log('');
console.log('✅ Canonical tagy:');
results.forEach(r => console.log('   - ' + r));
console.log('');
console.log('   Over syntax pred reštartom: node -c server.js');
