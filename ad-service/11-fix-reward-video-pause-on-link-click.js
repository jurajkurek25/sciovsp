// Opravuje vedľajší efekt anti-cheat pauzovania: klik na "Navštíviť
// inzerenta" (target="_blank") spôsobí, že karta stratí fokus, čo spustí
// visibilitychange listener a video sa automaticky pozastaví — presne
// ten istý mechanizmus, ktorý má zabrániť podvádzaniu prepnutím preč.
// Rieši sa zaznamenaním času kliku na odkaz a krátkou výnimkou v listeneri.
//
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online:
//   node /root/ad-service/11-fix-reward-video-pause-on-link-click.js

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'public', 'app.html');
const src = fs.readFileSync(FILE_PATH, 'utf8');

const OLD_LINK = `        <a class="reward-btn ghost" href="\${rewardAdLink}" target="_blank" rel="noopener sponsored" style="margin-top:.75rem;text-decoration:none;display:inline-block;text-align:center">Navštíviť inzerenta →</a>`;
const NEW_LINK = `        <a class="reward-btn ghost" href="\${rewardAdLink}" target="_blank" rel="noopener sponsored" onclick="window.__rewardLinkClickedAt=Date.now()" style="margin-top:.75rem;text-decoration:none;display:inline-block;text-align:center">Navštíviť inzerenta →</a>`;

const OLD_VISIBILITY = `  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !video.paused) video.pause();
  });`;
const NEW_VISIBILITY = `  document.addEventListener('visibilitychange', () => {
    const recentAdLinkClick = window.__rewardLinkClickedAt && (Date.now() - window.__rewardLinkClickedAt < 4000);
    if (document.hidden && !video.paused && !recentAdLinkClick) video.pause();
  });`;

if (!src.includes(OLD_LINK) || !src.includes(OLD_VISIBILITY)) {
  if (src.includes('__rewardLinkClickedAt')) {
    console.error('❌ Vyzerá to, že oprava je už aplikovaná. Nič som nezmenil.');
  } else {
    console.error('❌ Nenašiel som očakávané pôvodné bloky presne — nič som nezmenil. Over ručne (najprv musí byť aplikovaný 10-fix-reward-video-link.js).');
  }
  process.exit(1);
}

const backupPath = FILE_PATH + '.pre-reward-pause-fix-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
let out = src.replace(OLD_LINK, NEW_LINK);
out = out.replace(OLD_VISIBILITY, NEW_VISIBILITY);
fs.writeFileSync(FILE_PATH, out);

console.log('✅ Video sa už nepozastaví pri kliknutí na odkaz na inzerenta.');
console.log('   Záloha pôvodného app.html:', backupPath);
