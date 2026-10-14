// Buduje chýbajúcu /vsp-test/ index stránku -- na ňu odkazujú breadcrumby
// aj BreadcrumbList JSON-LD na všetkých 4 /vsp-test/* fakultných
// stránkach (lfuk.html, lfups.html, main-app-patches/195, 196), ale
// samotná stránka dosiaľ neexistovala (rozbitý odkaz).
//
// Jednoduchý hub/index so 4 kartami na existujúce fakultné landing pages.
// Rovnaká šablóna/CSS ako ostatné /vsp-test/* stránky (zjednodušená --
// bez pricing/FAQ sekcií, tie sú fakulta-špecifické).
//
// VYŽADUJE: main-app-patches/195, main-app-patches/196 a
// main-app-patches/197 už aplikované (odkazuje na všetky 4 landing pages).
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/198-vsp-test-index-page.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const TARGET = path.join(PUBLIC_DIR, 'vsp-test-index.html');

if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.198-vsp-test-index-page-lock');
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

// Routa + sitemap sú idempotentné SAMOSTATNE od kroku 3 (HTML obsah) --
// ak už boli aplikované skôr (napr. pri prvom behu tohto patchu pred
// opravou dlhých meta title/description), tento skript ich len preskočí
// namiesto toho, aby úplne odmietol pokračovať aj ku kroku 3.
if (server.includes("app.get('/vsp-test',")) {
  console.log('ℹ️  server.js: routa + sitemap už sú aplikované, tento krok preskakujem.');
} else {
  if (!server.includes("app.get('/vsp-test/uvlf-kosice'")) {
    console.error('❌ Nenašiel som routu /vsp-test/uvlf-kosice — over, že main-app-patches/197 už je aplikovaný. Nič som nezmenil.');
    process.exit(1);
  }
  if (!server.includes("BASE_URL_BLOG + '/vsp-test/uvlf-kosice'")) {
    console.error('❌ Nenašiel som lf-szu-bratislava/uvlf-kosice v sitemape — over main-app-patches/197. Nič som nezmenil.');
    process.exit(1);
  }

  // 1) routa
  server = replaceOnce(server,
    `app.get('/vsp-test/uvlf-kosice', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'uvlf-kosice.html')); });`,
    `app.get('/vsp-test/uvlf-kosice', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'uvlf-kosice.html')); });
app.get('/vsp-test', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'vsp-test-index.html')); });`,
    '1: pridanie /vsp-test routy');

  // 2) sitemap.xml
  server = replaceOnce(server,
    `      { loc: BASE_URL_BLOG + '/vsp-test/uvlf-kosice', changefreq: 'monthly', priority: '0.7' }
    ];`,
    `      { loc: BASE_URL_BLOG + '/vsp-test/uvlf-kosice', changefreq: 'monthly', priority: '0.7' },
      { loc: BASE_URL_BLOG + '/vsp-test', changefreq: 'monthly', priority: '0.6' }
    ];`,
    '2: sitemap.xml -> pridanie /vsp-test');

  const serverBackup = SERVER_PATH + '.pre-vsp-test-index-page-' + Date.now();
  fs.copyFileSync(SERVER_PATH, serverBackup);
  fs.writeFileSync(SERVER_PATH, server);
  console.log('   Záloha server.js:', serverBackup);
}

// 3) public/vsp-test-index.html
const NEW_HTML = "<!DOCTYPE html>\n<html lang=\"sk\">\n<head>\n<script id=\"Cookiebot\" src=\"https://consent.cookiebot.com/uc.js\" data-cbid=\"082b4b18-7f50-41b6-b374-be0c015a5fe0\" type=\"text/javascript\" async></script>\n<!-- Neoworkly Chat Widget -->\n<script>\n  window.NeoworklyConfig = { widgetId: '3d65a132-78ea-46bb-a237-b02ba54947e7' };\n</script>\n<script src=\"https://neoworkly.com/widget.js\" async></script>\n<!-- Google tag (gtag.js) — deferred to idle time; dataLayer queue preserves gtag() calls made before it loads -->\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag('js', new Date());\n\n  gtag('config', 'G-SHRPWTXJP2');\n  (function(){\n    function loadGtag(){\n      var s=document.createElement('script');\n      s.async=true;\n      s.src='https://www.googletagmanager.com/gtag/js?id=G-SHRPWTXJP2';\n      document.head.appendChild(s);\n    }\n    function scheduleGtag(){\n      if('requestIdleCallback' in window){requestIdleCallback(loadGtag,{timeout:3000});}\n      else{setTimeout(loadGtag,1);}\n    }\n    if(document.readyState==='complete'){setTimeout(scheduleGtag,2000);}\n    else{window.addEventListener('load',function(){setTimeout(scheduleGtag,2000);});}\n  })();\n</script>\n\n<!-- Meta Pixel Code -->\n<script>\n!function(f,b,e,v,n,t,s)\n{if(f.fbq)return;n=f.fbq=function(){n.callMethod?\nn.callMethod.apply(n,arguments):n.queue.push(arguments)};\nif(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';\nn.queue=[];t=b.createElement(e);t.async=!0;\nt.src=v;s=b.getElementsByTagName(e)[0];\ns.parentNode.insertBefore(t,s)}(window, document,'script',\n'https://connect.facebook.net/en_US/fbevents.js');\nfbq('init', '2853708664993045');\nfbq('track', 'PageView');\n</script>\n<noscript><img height=\"1\" width=\"1\" style=\"display:none\"\nsrc=\"https://www.facebook.com/tr?id=2853708664993045&ev=PageView&noscript=1\"\n/></noscript>\n<!-- End Meta Pixel Code -->\n\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n<title>Prijímacie testy podľa fakulty | SP Tréner</title>\n<meta name=\"description\" content=\"Niektoré fakulty majú vlastný prijímací test, nie klasický VŠP/SCIO. Prehľad 4 fakúlt a AI príprava presne na formát každej skúšky.\">\n<meta name=\"robots\" content=\"index, follow, max-image-preview:large, max-snippet:-1\">\n<meta name=\"keywords\" content=\"prijímačky podľa fakulty, vlastný prijímací test vysoká škola, LF UK, LF UPJŠ, SZU, UVLF\">\n<meta name=\"theme-color\" content=\"#08080d\">\n<link rel=\"canonical\" href=\"https://sptrener.online/vsp-test/\">\n<meta property=\"og:type\" content=\"website\">\n<meta property=\"og:site_name\" content=\"SP Tréner\">\n<meta property=\"og:title\" content=\"Prijímacie testy podľa fakulty | SP Tréner\">\n<meta property=\"og:description\" content=\"Niektoré fakulty majú vlastný prijímací test, nie klasický VŠP/SCIO. Prehľad 4 fakúlt a AI príprava presne na formát každej skúšky.\">\n<meta property=\"og:url\" content=\"https://sptrener.online/vsp-test/\">\n<meta property=\"og:locale\" content=\"sk_SK\">\n<meta name=\"twitter:card\" content=\"summary_large_image\">\n<meta name=\"twitter:title\" content=\"Prijímacie testy podľa fakulty | SP Tréner\">\n<meta name=\"twitter:description\" content=\"Niektoré fakulty majú vlastný prijímací test, nie klasický VŠP/SCIO. Prehľad 4 fakúlt a AI príprava presne na formát každej skúšky.\">\n<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n<link href=\"https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Mono:wght@300;400;500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700&display=swap\" rel=\"stylesheet\">\n<style>\n:root{\n  --black:#08080d;--black2:#0f0f18;--black3:#171724;\n  --border:rgba(255,255,255,.07);--border2:rgba(255,255,255,.13);\n  --text:#eeeef5;--text2:#7777a0;--text3:#3d3d5c;\n  --volt:#c8ff00;--purple:#7c5cff;--purple2:#b09bff;\n  --red:#ff3f5e;--green:#36e896;\n  --serif:'Instrument Serif',Georgia,serif;--mono:'DM Mono',monospace;--sans:'DM Sans',sans-serif;\n}\n*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}\nhtml{scroll-behavior:smooth}\nbody{background:var(--black);color:var(--text);font-family:var(--sans);overflow-x:hidden}\nbody::after{content:'';position:fixed;inset:0;background-image:url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E\");pointer-events:none;z-index:1}\nnav{position:fixed;top:0;left:0;right:0;z-index:100;padding:1.1rem 2rem;display:flex;align-items:center;justify-content:space-between;background:rgba(8,8,13,.85);backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}\n.nav-logo{font-family:var(--mono);font-size:13px;letter-spacing:.15em;color:var(--text);text-decoration:none;display:flex;align-items:center;gap:.5rem}\n.nav-dot{width:7px;height:7px;background:var(--volt);border-radius:50%;animation:pulse 2s infinite}\n@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.7)}}\n.nav-cta{padding:.55rem 1.2rem;background:var(--volt);color:var(--black);border-radius:6px;font-size:.8rem;font-weight:700;text-decoration:none;font-family:var(--mono);letter-spacing:.03em;transition:transform .2s}\n.nav-cta:hover{transform:translateY(-1px)}\n.breadcrumb{padding:5.5rem 2rem 0;max-width:1000px;margin:0 auto;font-family:var(--mono);font-size:11px;color:var(--text3);letter-spacing:.05em}\n.breadcrumb a{color:var(--text3);text-decoration:none}\n.breadcrumb a:hover{color:var(--purple2)}\n.hero{padding:2.5rem 2rem 3.5rem;max-width:1000px;margin:0 auto;position:relative}\n.hero-eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.25em;color:var(--volt);text-transform:uppercase;margin-bottom:1.25rem}\n.hero-headline{font-family:var(--serif);font-size:clamp(2.3rem,5.5vw,4.2rem);line-height:1.08;letter-spacing:-.02em;max-width:820px;margin-bottom:1.25rem}\n.hero-headline em{font-style:italic;color:var(--purple2)}\n.hero-sub{font-size:1.05rem;color:var(--text2);font-weight:300;max-width:640px;line-height:1.7;margin-bottom:2rem}\n.section{padding:2rem 2rem 4.5rem;max-width:1000px;margin:0 auto}\n.section-label{font-family:var(--mono);font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:var(--text3);margin-bottom:1rem;display:flex;align-items:center;gap:.75rem}\n.section-label::after{content:'';flex:1;height:1px;background:var(--border)}\n.section-title{font-family:var(--serif);font-size:clamp(1.7rem,3.5vw,2.4rem);line-height:1.12;letter-spacing:-.02em;margin-bottom:1.25rem}\n.section-title em{font-style:italic;color:var(--purple2)}\n.related-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem;margin-top:1.75rem}\n.related-card{display:block;background:var(--black2);border:1px solid var(--border);border-radius:12px;padding:1.5rem 1.6rem;text-decoration:none;transition:border-color .2s}\n.related-card:hover{border-color:var(--purple)}\n.related-card-eyebrow{font-family:var(--mono);font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text3);margin-bottom:.5rem}\n.related-card-title{font-size:1.05rem;font-weight:700;color:var(--text)}\n.related-card-desc{font-size:.82rem;color:var(--text2);margin-top:.5rem;line-height:1.5}\n.related-card-arrow{color:var(--purple2);font-size:.8rem;margin-top:.75rem;display:block}\n.prose p{font-size:.95rem;color:var(--text2);line-height:1.8;max-width:760px;margin-bottom:1.1rem}\n.prose strong{color:var(--text);font-weight:600}\n.btn-primary{display:inline-flex;align-items:center;gap:.6rem;padding:1rem 2rem;background:var(--volt);color:var(--black);border-radius:8px;font-weight:700;font-size:.92rem;text-decoration:none;font-family:var(--mono);letter-spacing:.03em;transition:all .2s}\n.btn-primary:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(200,255,0,.3)}\nfooter{border-top:1px solid var(--border);padding:2rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;max-width:1000px;margin:0 auto}\n.footer-logo{font-family:var(--mono);font-size:11px;letter-spacing:.15em;color:var(--text3)}\n.footer-links{display:flex;gap:1.25rem}\n.footer-links a{font-size:.75rem;color:var(--text3);text-decoration:none;font-family:var(--mono)}\n.footer-links a:hover{color:var(--text2)}\n</style>\n<script type=\"application/ld+json\">{\"@context\": \"https://schema.org\", \"@type\": \"BreadcrumbList\", \"itemListElement\": [{\"@type\": \"ListItem\", \"position\": 1, \"name\": \"SP Tréner\", \"item\": \"https://sptrener.online/\"}, {\"@type\": \"ListItem\", \"position\": 2, \"name\": \"Prijímacie testy podľa fakulty\", \"item\": \"https://sptrener.online/vsp-test/\"}]}</script>\n<script type=\"application/ld+json\">{\"@context\": \"https://schema.org\", \"@type\": \"ItemList\", \"itemListElement\": [{\"@type\": \"ListItem\", \"position\": 1, \"name\": \"LF UK Bratislava\", \"url\": \"https://sptrener.online/vsp-test/lf-uk-bratislava\"}, {\"@type\": \"ListItem\", \"position\": 2, \"name\": \"LF UPJŠ Košice\", \"url\": \"https://sptrener.online/vsp-test/lf-upjs-kosice\"}, {\"@type\": \"ListItem\", \"position\": 3, \"name\": \"SZU Bratislava\", \"url\": \"https://sptrener.online/vsp-test/lf-szu-bratislava\"}, {\"@type\": \"ListItem\", \"position\": 4, \"name\": \"UVLF Košice\", \"url\": \"https://sptrener.online/vsp-test/uvlf-kosice\"}]}</script>\n</head>\n<body>\n\n<nav>\n  <a href=\"https://sptrener.online/\" class=\"nav-logo\"><div class=\"nav-dot\"></div>SP TRÉNER</a>\n  <a href=\"https://sptrener.online/app?utm_source=landing&amp;utm_campaign=vsp-test-index\" class=\"nav-cta\">Začať zadarmo →</a>\n</nav>\n\n<div class=\"breadcrumb\"><a href=\"https://sptrener.online/\">SP Tréner</a> / Prijímacie testy podľa fakulty</div>\n\n<section class=\"hero\">\n  <div class=\"hero-eyebrow\">Vlastné prijímacie testy fakúlt</div>\n  <h1 class=\"hero-headline\">Niektoré fakulty <em>nepoužívajú</em> klasický VŠP test.</h1>\n  <p class=\"hero-sub\">Pár fakúlt (najmä medicína a veterina) má vlastný, špecifický formát prijímacej skúšky — iný počet otázok, iné predmety, iné bodovanie ako bežný VŠP/SCIO test. Nižšie nájdeš presný formát pre každú z nich a AI prípravu, ktorá ho kopíruje.</p>\n</section>\n\n<div class=\"section\" style=\"padding-top:0\">\n  <div class=\"section-label\">Fakulty s vlastným testom</div>\n  <div class=\"related-grid\">\n    <a class=\"related-card\" href=\"https://sptrener.online/vsp-test/lf-uk-bratislava\"><div class=\"related-card-eyebrow\">Medicína · Bratislava</div><div class=\"related-card-title\">LF UK Bratislava</div><div class=\"related-card-desc\">84 % biológia + chémia, 16 % SCIO VŠP, −4 až +4 bodovanie.</div><span class=\"related-card-arrow\">Zobraziť formát testu →</span></a>\n    <a class=\"related-card\" href=\"https://sptrener.online/vsp-test/lf-upjs-kosice\"><div class=\"related-card-eyebrow\">Medicína · Košice</div><div class=\"related-card-title\">LF UPJŠ Košice</div><div class=\"related-card-desc\">100 otázok biológia + 100 chémia, bez záporných bodov.</div><span class=\"related-card-arrow\">Zobraziť formát testu →</span></a>\n    <a class=\"related-card\" href=\"https://sptrener.online/vsp-test/lf-szu-bratislava\"><div class=\"related-card-eyebrow\">Medicína · Bratislava</div><div class=\"related-card-title\">SZU Bratislava</div><div class=\"related-card-desc\">160 otázok (80+80), 150 minút, max. 640 bodov + bonus za olympiády.</div><span class=\"related-card-arrow\">Zobraziť formát testu →</span></a>\n    <a class=\"related-card\" href=\"https://sptrener.online/vsp-test/uvlf-kosice\"><div class=\"related-card-eyebrow\">Veterinárstvo a farmácia · Košice</div><div class=\"related-card-title\">UVLF Košice</div><div class=\"related-card-desc\">Biológia + chémia, skúška povinná bez výnimky na priemer.</div><span class=\"related-card-arrow\">Zobraziť formát testu →</span></a>\n  </div>\n</div>\n\n<div class=\"section prose\" style=\"padding-top:0\">\n  <div class=\"section-label\">Prečo je toto dôležité</div>\n  <h2 class=\"section-title\">Nepripravuj sa <em>na test, ktorý neskladáš</em></h2>\n  <p>Bežná príprava na prijímačky na Slovensku a v Česku sa väčšinou zameriava na klasický VŠP alebo SCIO test — logika, jazyk, všeobecné testovanie. Fakulty vyššie však majú <strong>vlastný, interný formát</strong>, ktorý sa štruktúrou aj obsahom líši. Kto sa pripravuje len všeobecne, riskuje, že v deň skúšky narazí na neznámy formát otázok.</p>\n  <p>SP Tréner má pre každú z týchto fakúlt AI generátor nastavený presne na jej formát — rovnaký pomer predmetov, rovnaké bodovanie, rovnaký typ otázok, aký ťa čaká na skutočnej skúške.</p>\n  <a href=\"https://sptrener.online/app?utm_source=landing&amp;utm_campaign=vsp-test-index\" class=\"btn-primary\" style=\"margin-top:1rem\">Vyskúšať zadarmo →</a>\n</div>\n\n<footer>\n  <div class=\"footer-logo\">SP TRÉNER © 2026</div>\n  <div class=\"footer-links\">\n    <a href=\"https://sptrener.online/\">Domov</a>\n    <a href=\"https://sptrener.online/app\">Aplikácia</a>\n    <a href=\"mailto:juraj@jurajkurek.com\">Kontakt</a>\n    <a href=\"https://sptrener.online/legal\">Obchodné podmienky</a>\n  </div>\n</footer>\n\n</body>\n</html>\n";
if (fs.existsSync(TARGET)) {
  const current = fs.readFileSync(TARGET, 'utf8');
  if (current !== NEW_HTML) {
    const backup = TARGET + '.pre-vsp-test-index-page-' + Date.now();
    fs.copyFileSync(TARGET, backup);
    console.log('Záloha existujúceho súboru:', backup);
    fs.writeFileSync(TARGET, NEW_HTML);
  }
} else {
  fs.writeFileSync(TARGET, NEW_HTML);
}

console.log('✅ /vsp-test je funkčná routa (v sitemap.xml), public/vsp-test-index.html je aktuálny.');
console.log('   Over syntax pred reštartom: node -c server.js && pm2 restart sptrener');
