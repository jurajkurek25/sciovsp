// Opravuje widget v public/app.html, ktorý má bannery zobrazovať v #adSlot.
// Pôvodná verzia volala /api/ads/... na TEJTO doméne (sptrener.online) a
// neexistujúci endpoint /api/ads/file/:id — ale ads platforma beží na
// samostatnej doméne ad.sptrener.online (ad-service), preto sa nič
// nezobrazovalo. Táto oprava smeruje všetky volania na správnu doménu a
// používa priamo pole "url", ktoré /api/ads/serve reálne vracia.
//
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online:
//   node /root/ad-service/07-fix-ad-slot-widget.js

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'public', 'app.html');
const src = fs.readFileSync(FILE_PATH, 'utf8');

const OLD_BLOCK = `// ─── AD SLOT — rotujúci reklamný banner (SP Tréner Ads) ───
(function(){
  const slot = document.getElementById('adSlot');
  if (!slot) return;
  let banners = [];
  let idx = 0;

  function render(){
    if (!banners.length) {
      slot.innerHTML = '<a href="https://ad.sptrener.online" target="_blank" rel="noopener" class="ad-slot-cta">+ Chceš tu inzerovať? → ad.sptrener.online</a>';
      return;
    }
    const b = banners[idx % banners.length];
    const src = '/api/ads/file/' + b.id;
    const media = b.mimeType === 'video/mp4'
      ? \`<video src="\${src}" muted loop autoplay playsinline></video>\`
      : \`<img src="\${src}" alt="Reklama" loading="lazy">\`;
    slot.innerHTML = \`<a class="ad-slot-banner" href="/api/ads/go/\${b.id}" target="_blank" rel="noopener sponsored">\${media}</a><div class="ad-slot-label">Reklama</div>\`;
    if (navigator.sendBeacon) navigator.sendBeacon('/api/ads/impression/' + b.id);
    else fetch('/api/ads/impression/' + b.id, { method: 'POST' }).catch(()=>{});
  }

  fetch('/api/ads/serve').then(r => r.json()).then(data => {
    banners = data.banners || [];
    render();
    if (banners.length > 1) setInterval(() => { idx++; render(); }, 8000);
  }).catch(() => {});
})();`;

const NEW_BLOCK = `// ─── AD SLOT — rotujúci reklamný banner (SP Tréner Ads) ───
(function(){
  const slot = document.getElementById('adSlot');
  if (!slot) return;
  const AD_ORIGIN = 'https://ad.sptrener.online';
  let banners = [];
  let idx = 0;

  function render(){
    if (!banners.length) {
      slot.innerHTML = '<a href="' + AD_ORIGIN + '" target="_blank" rel="noopener" class="ad-slot-cta">+ Chceš tu inzerovať? → ad.sptrener.online</a>';
      return;
    }
    const b = banners[idx % banners.length];
    const src = AD_ORIGIN + b.url;
    const media = b.mimeType === 'video/mp4'
      ? \`<video src="\${src}" muted loop autoplay playsinline></video>\`
      : \`<img src="\${src}" alt="Reklama" loading="lazy">\`;
    slot.innerHTML = \`<a class="ad-slot-banner" href="\${AD_ORIGIN}/api/ads/go/\${b.id}" target="_blank" rel="noopener sponsored">\${media}</a><div class="ad-slot-label">Reklama</div>\`;
    if (navigator.sendBeacon) navigator.sendBeacon(AD_ORIGIN + '/api/ads/impression/' + b.id);
    else fetch(AD_ORIGIN + '/api/ads/impression/' + b.id, { method: 'POST' }).catch(()=>{});
  }

  fetch(AD_ORIGIN + '/api/ads/serve').then(r => r.json()).then(data => {
    banners = data.banners || [];
    render();
    if (banners.length > 1) setInterval(() => { idx++; render(); }, 8000);
  }).catch(() => {});
})();`;

if (!src.includes(OLD_BLOCK)) {
  if (src.includes("AD_ORIGIN = 'https://ad.sptrener.online'")) {
    console.error('❌ Vyzerá to, že oprava je už aplikovaná (AD_ORIGIN sa už v súbore nachádza). Nič som nezmenil.');
  } else {
    console.error('❌ Nenašiel som očakávaný pôvodný blok presne — nič som nezmenil. Over ručne (možno bol medzičasom upravený).');
  }
  process.exit(1);
}

const backupPath = FILE_PATH + '.pre-ad-slot-fix-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
fs.writeFileSync(FILE_PATH, src.replace(OLD_BLOCK, NEW_BLOCK));

console.log('✅ AD SLOT widget opravený — teraz smeruje na https://ad.sptrener.online.');
console.log('   Záloha pôvodného app.html:', backupPath);
