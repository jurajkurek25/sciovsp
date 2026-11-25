// Doplna Cookiebot + Neoworkly + Google gtag (rovnaky blok ako
// main-app-patches/97) do stranok, ktore ho doteraz nemali vobec:
// generalka.html, komunita.html, lfuk.html, lfups.html, odporucame.html,
// recenzia.html — + do zdielanej blogLayout() sablony v server.js
// (pokryva vsetky blog posty). Idempotentne cez 'Cookiebot' marker.
//
// main-app-patches/170 uz predtym doplnil Meta Pixel vsade — toto je
// doplnenie zvysku trackovacej sady, aby mala UPLNE vsetky stranky
// rovnaky standardny sled skriptov.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/171-tracking-scripts-backfill.js

const fs = require('fs');
const path = require('path');

const BLOCK = `<script id="Cookiebot" src="https://consent.cookiebot.com/uc.js" data-cbid="082b4b18-7f50-41b6-b374-be0c015a5fe0" type="text/javascript" async></script>
<!-- Neoworkly Chat Widget -->
<script>
  window.NeoworklyConfig = { widgetId: '3d65a132-78ea-46bb-a237-b02ba54947e7' };
</script>
<script src="https://neoworkly.com/widget.js" async></script>
<!-- Google tag (gtag.js) — deferred to idle time; dataLayer queue preserves gtag() calls made before it loads -->
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-SHRPWTXJP2');
  (function(){
    function loadGtag(){
      var s=document.createElement('script');
      s.async=true;
      s.src='https://www.googletagmanager.com/gtag/js?id=G-SHRPWTXJP2';
      document.head.appendChild(s);
    }
    function scheduleGtag(){
      if('requestIdleCallback' in window){requestIdleCallback(loadGtag,{timeout:3000});}
      else{setTimeout(loadGtag,1);}
    }
    if(document.readyState==='complete'){setTimeout(scheduleGtag,2000);}
    else{window.addEventListener('load',function(){setTimeout(scheduleGtag,2000);});}
  })();
</script>
`;

const FILES = [
  'generalka.html',
  'komunita.html',
  'lfuk.html',
  'lfups.html',
  'odporucame.html',
  'recenzia.html'
];

let anyError = false;

// ═══════════════════════ statické public/*.html ═══════════════════════
for (const name of FILES) {
  const file = path.join('public', name);
  if (!fs.existsSync(file)) {
    console.error(`PRESKOČENÉ (súbor neexistuje): ${file}`);
    anyError = true;
    continue;
  }
  const src = fs.readFileSync(file, 'utf8');
  if (src.includes('Cookiebot')) {
    console.log(`Už je aplikované, preskakujem: ${file}`);
    continue;
  }
  const count = src.split('<head>').length - 1;
  if (count !== 1) {
    console.error(`ABORT pre ${file}: <head> nájdený ${count}x (očakávané 1). Nič som nezmenil v tomto súbore.`);
    anyError = true;
    continue;
  }
  const backup = file + '.pre-tracking-backfill-' + Date.now();
  fs.copyFileSync(file, backup);
  fs.writeFileSync(file, src.replace('<head>', '<head>\n' + BLOCK));
  console.log(`OK: ${file} (záloha: ${backup})`);
}

// ═══════════════════════ server.js — blogLayout() ═══════════════════════
const SERVER_PATH = 'server.js';
if (!fs.existsSync(SERVER_PATH)) {
  console.error('PRESKOČENÉ (server.js nenájdený v aktuálnom priečinku) — over že si v koreni hlavnej appky.');
  anyError = true;
} else {
  const serverSrc = fs.readFileSync(SERVER_PATH, 'utf8');
  if (serverSrc.includes('Cookiebot')) {
    console.log('Už je aplikované v server.js (blogLayout), preskakujem.');
  } else {
    const ANCHOR = 'lang="${l}"><head><meta charset="UTF-8">';
    const count = serverSrc.split(ANCHOR).length - 1;
    if (count !== 1) {
      console.error(`ABORT pre server.js: blogLayout() kotva nájdená ${count}x (očakávané 1). Nič som nezmenil v server.js.`);
      anyError = true;
    } else {
      const backup = SERVER_PATH + '.pre-tracking-backfill-' + Date.now();
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
