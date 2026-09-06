// Adds Cookiebot + Neoworkly + Google gtag to every live page NOT already
// covered by the git-synced public/*.html patch (those got it directly via
// commit). These 9 pages are patched directly on the server (same pattern
// as server.js) since they're not git-tracked as public/*.html.
// Idempotent per-file — skips any file that already has Cookiebot.
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
  'darcekova-karta-hotovo.html',
  'darcekova-karta.html',
  'darek.html',
  'kurz-watch.html',
  'ponuka.html',
  'uplatnit-darcek.html',
  'webinar-dakujeme.html',
  'webinar-live.html',
  'webinar.html'
];

let anyError = false;
for (const name of FILES) {
  const file = path.join('public', name);
  if (!fs.existsSync(file)) {
    console.error(`PRESKOCENE (subor neexistuje): ${file}`);
    anyError = true;
    continue;
  }
  const src = fs.readFileSync(file, 'utf8');
  if (src.includes('Cookiebot')) {
    console.log(`Uz je aplikovane, preskakujem: ${file}`);
    continue;
  }
  const count = src.split('<head>').length - 1;
  if (count !== 1) {
    console.error(`ABORT pre ${file}: <head> najdeny ${count}x (ocakavane 1). Nic som nezmenil v tomto subore.`);
    anyError = true;
    continue;
  }
  const backup = file + '.pre-tracking-scripts-' + Date.now();
  fs.copyFileSync(file, backup);
  fs.writeFileSync(file, src.replace('<head>', '<head>\n' + BLOCK));
  console.log(`OK: ${file} (zaloha: ${backup})`);
}

if (anyError) {
  console.error('\nNiektore subory sa nepodarilo spracovat — pozri hlasky vyssie.');
  process.exit(1);
}
console.log('\nVsetko hotovo.');
