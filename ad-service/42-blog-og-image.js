// Blog stránky doteraz nemali ŽIADNY og:image — pri zdieľaní na
// sociálnych sieťach (Facebook, WhatsApp, LinkedIn, Slack...) sa
// nezobrazoval žiadny náhľadový obrázok, čo znižuje CTR z takýchto
// zdieľaní aj z niektorých vyhľadávacích výsledkov.
//
// Pridáva branded og:image (1200×630, public/assets/og-image.png — treba
// nahrať samostatne, viď nižšie) + og:image:width/height/alt a mení
// twitter:card z "summary" na "summary_large_image" (veľký náhľad namiesto
// malej ikonky).
//
// Presný textový match proti overenému živému kódu (server.js:2933-2960).
//
// PRED spustením tohto skriptu musí existovať public/assets/og-image.png:
//   mkdir -p public/assets
//   wget -O public/assets/og-image.png https://raw.githubusercontent.com/jurajkurek25/sciovsp/claude/psychologia-ucm-testy-k30asg/public/assets/og-image.png
//
// Potom spusti z /home/jurajkurek-vsp/htdocs/sptrener.online:
//   node /root/ad-service/42-blog-og-image.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
const src = fs.readFileSync(SERVER_PATH, 'utf8');

if (src.includes('og:image')) {
  console.error('❌ Vyzerá to, že og:image je už pridaný. Nič som nezmenil.');
  process.exit(1);
}

const OLD = `<meta property="og:site_name" content="SP Tréner">
<meta property="og:locale" content="\${T.ogLocale}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="\${escapeHtml(title)}">
<meta name="twitter:description" content="\${escapeHtml(description)}">
<meta name="theme-color" content="#08080d">`;

const NEW = `<meta property="og:site_name" content="SP Tréner">
<meta property="og:locale" content="\${T.ogLocale}">
<meta property="og:image" content="\${BASE_URL_BLOG}/assets/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="SP Tréner — príprava na prijímacie testy">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="\${BASE_URL_BLOG}/assets/og-image.png">
<meta name="twitter:title" content="\${escapeHtml(title)}">
<meta name="twitter:description" content="\${escapeHtml(description)}">
<meta name="theme-color" content="#08080d">`;

if (!src.includes(OLD)) {
  console.error('❌ Nenašiel som presný očakávaný blok meta tagov v blogLayout(). Nič som nezmenil.');
  console.error('   Pošli mi aktuálny výstup: sed -n "2940,2957p" server.js');
  process.exit(1);
}

const backupPath = SERVER_PATH + '.pre-blog-og-image-' + Date.now();
fs.copyFileSync(SERVER_PATH, backupPath);
const out = src.replace(OLD, NEW);
fs.writeFileSync(SERVER_PATH, out);

console.log('✅ og:image pridaný na všetky blog stránky (aj homepage/app cez rovnaký blogLayout, ak ho zdieľajú).');
console.log('   Záloha pôvodného server.js:', backupPath);
console.log('   Over syntax: node -c server.js');
console.log('   Po reštarte servera otestuj napr. cez https://developers.facebook.com/tools/debug/?q=https://sptrener.online/blog');
