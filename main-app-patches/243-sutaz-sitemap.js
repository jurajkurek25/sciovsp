// Sitemap.xml sa generuje dynamicky priamo v server.js (pole BASE_URL_BLOG
// + '/...' entries, main-app-patches/190, 197) -- /sutaz (súťažná landing
// stránka) a /sutaz-overenie (verejné overenie žrebovania) tam doteraz
// vôbec neboli, hoci obe routy už bežia (main-app-patches/241). Kotva
// (koniec poľa) overená priamo cez živú diagnostiku zo servera.
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/243-sutaz-sitemap.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');

if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.243-sutaz-sitemap-lock');
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

if (server.includes("BASE_URL_BLOG + '/sutaz'")) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

server = replaceOnce(server,
  `      { loc: BASE_URL_BLOG + '/vsp-test/uvlf-kosice', changefreq: 'monthly', priority: '0.7' },
      { loc: BASE_URL_BLOG + '/vsp-test', changefreq: 'monthly', priority: '0.6' }
    ];`,
  `      { loc: BASE_URL_BLOG + '/vsp-test/uvlf-kosice', changefreq: 'monthly', priority: '0.7' },
      { loc: BASE_URL_BLOG + '/vsp-test', changefreq: 'monthly', priority: '0.6' },
      { loc: BASE_URL_BLOG + '/sutaz', changefreq: 'weekly', priority: '0.7' },
      { loc: BASE_URL_BLOG + '/sutaz-overenie', changefreq: 'monthly', priority: '0.3' }
    ];`,
  'sitemap.xml -> pridanie /sutaz a /sutaz-overenie');

const backup = SERVER_PATH + '.pre-sutaz-sitemap-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, server);

console.log('✅ sitemap.xml doplnený o /sutaz a /sutaz-overenie.');
console.log('   Záloha:', backup);
console.log('   Over syntax pred reštartom: node -c server.js');
