// Prida Meta (Facebook) Pixel do <head> KAZDEJ statickej public/*.html
// stranky (22 suborov, cely zoznam z 'ls public/*.html' na produkcii) +
// do zdielanej blogLayout() sablony v server.js (pokryva VSETKY blog
// posty jednym miestom). ads.html sa neriesi — ad.sptrener.online je
// odteraz samostatna appka (ad-service), nie subor v tomto public/.
//
// Idempotentne — kazdy subor/miesto sa kontroluje zvlast (fbq('init',
// '2853708664993045') marker), takze sa da bezpecne spustit viackrat.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/170-meta-pixel-all-pages.js

const fs = require('fs');
const path = require('path');

const PIXEL_ID = '2853708664993045';
const MARKER = "fbq('init', '" + PIXEL_ID + "')";

const BLOCK = `<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${PIXEL_ID}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1"
/></noscript>
<!-- End Meta Pixel Code -->
`;

const FILES = [
  'app.html', 'darcekova-karta-hotovo.html', 'darcekova-karta.html', 'darek.html',
  'generalka.html', 'ig.html', 'index.html', 'kam-na-vysoku.html', 'komunita.html',
  'kurz-watch.html', 'legal.html', 'lfuk.html', 'lfups.html', 'odporucame.html',
  'ponuka.html', 'recenzia.html', 'tricko.html', 'uplatnit-darcek.html', 'vianoce.html',
  'webinar-dakujeme.html', 'webinar.html', 'webinar-live.html'
];

let anyError = false;

// ═══════════════════════ statické public/*.html ═══════════════════════
for (const name of FILES) {
  const file = path.join('public', name);
  if (!fs.existsSync(file)) {
    console.error(`PRESKOCENE (súbor neexistuje): ${file}`);
    anyError = true;
    continue;
  }
  const src = fs.readFileSync(file, 'utf8');
  if (src.includes(MARKER)) {
    console.log(`Už je aplikované, preskakujem: ${file}`);
    continue;
  }
  const count = src.split('<head>').length - 1;
  if (count !== 1) {
    console.error(`ABORT pre ${file}: <head> nájdený ${count}x (očakávané 1). Nič som nezmenil v tomto súbore.`);
    anyError = true;
    continue;
  }
  const backup = file + '.pre-meta-pixel-' + Date.now();
  fs.copyFileSync(file, backup);
  fs.writeFileSync(file, src.replace('<head>', '<head>\n' + BLOCK));
  console.log(`OK: ${file} (záloha: ${backup})`);
}

// ═══════════════════════ server.js — blogLayout() (pokrýva všetky blog posty) ═══════════════════════
const SERVER_PATH = 'server.js';
if (!fs.existsSync(SERVER_PATH)) {
  console.error('PRESKOČENÉ (server.js nenájdený v aktuálnom priečinku) — over že si v koreni hlavnej appky.');
  anyError = true;
} else {
  const serverSrc = fs.readFileSync(SERVER_PATH, 'utf8');
  if (serverSrc.includes(MARKER)) {
    console.log('Už je aplikované v server.js (blogLayout), preskakujem.');
  } else {
    const ANCHOR = 'lang="${l}"><head><meta charset="UTF-8">';
    const count = serverSrc.split(ANCHOR).length - 1;
    if (count !== 1) {
      console.error(`ABORT pre server.js: blogLayout() kotva nájdená ${count}x (očakávané 1). Nič som nezmenil v server.js.`);
      anyError = true;
    } else {
      // BLOCK ide do JS template literal stringu — zdvojené spätné apostrofy
      // v ňom nie sú, takže je bezpečné vložiť ho priamo bez escapovania.
      const backup = SERVER_PATH + '.pre-meta-pixel-' + Date.now();
      fs.copyFileSync(SERVER_PATH, backup);
      const newServerSrc = serverSrc.replace(ANCHOR, 'lang="${l}"><head><meta charset="UTF-8">\n' + BLOCK);
      fs.writeFileSync(SERVER_PATH, newServerSrc);
      console.log(`OK: server.js blogLayout() (záloha: ${backup})`);
    }
  }
}

if (anyError) {
  console.error('\nNiektoré súbory sa nepodarilo spracovať — pozri hlášky vyššie.');
  process.exit(1);
}
console.log('\nVšetko hotovo. Ak niečo zmenilo server.js, over syntax pred reštartom: node -c server.js');
