// Pridáva klikateľný odkaz na inzerenta pod video v reward-overlay (video
// za +1 test) — doteraz tam žiadny nebol, appka len prehrala video a
// automaticky zatvorila overlay po skončení. Odkaz sa otvára v novom okne
// (neprerušuje prehrávanie/vyhodnotenie) a smeruje cez existujúci
// click-tracking endpoint v ad-service (/api/video-ads/go/:id?session=...).
//
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online:
//   node /root/ad-service/10-fix-reward-video-link.js

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'public', 'app.html');
const src = fs.readFileSync(FILE_PATH, 'utf8');

const OLD_BLOCK = `  overlay.innerHTML = \`
    <div class="reward-overlay">
      <div style="display:flex;flex-direction:column;align-items:center">
        <div class="reward-video-wrap">
          <video id="rewardVideo" src="\${session.fileUrl}" autoplay playsinline controlsList="nodownload noremoteplayback"></video>
          <div class="reward-progress-bg"><div class="reward-progress-fill" id="rewardProgressFill"></div></div>
        </div>
        <div class="reward-video-label" id="rewardVideoLabel">Sleduj celé video pre získanie testu…</div>
      </div>
    </div>\`;`;

const NEW_BLOCK = `  const rewardAdLink = 'https://ad.sptrener.online/api/video-ads/go/' + session.videoAdId + '?session=' + encodeURIComponent(session.sessionToken);
  overlay.innerHTML = \`
    <div class="reward-overlay">
      <div style="display:flex;flex-direction:column;align-items:center">
        <div class="reward-video-wrap">
          <video id="rewardVideo" src="\${session.fileUrl}" autoplay playsinline controlsList="nodownload noremoteplayback"></video>
          <div class="reward-progress-bg"><div class="reward-progress-fill" id="rewardProgressFill"></div></div>
        </div>
        <div class="reward-video-label" id="rewardVideoLabel">Sleduj celé video pre získanie testu…</div>
        <a class="reward-btn ghost" href="\${rewardAdLink}" target="_blank" rel="noopener sponsored" style="margin-top:.75rem;text-decoration:none;display:inline-block;text-align:center">Navštíviť inzerenta →</a>
      </div>
    </div>\`;`;

if (!src.includes(OLD_BLOCK)) {
  if (src.includes('rewardAdLink')) {
    console.error('❌ Vyzerá to, že oprava je už aplikovaná (rewardAdLink sa už v súbore nachádza). Nič som nezmenil.');
  } else {
    console.error('❌ Nenašiel som očakávaný pôvodný blok presne — nič som nezmenil. Over ručne.');
  }
  process.exit(1);
}

const backupPath = FILE_PATH + '.pre-reward-link-fix-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
fs.writeFileSync(FILE_PATH, src.replace(OLD_BLOCK, NEW_BLOCK));

console.log('✅ Odkaz na inzerenta pridaný do reward video overlaya.');
console.log('   Záloha pôvodného app.html:', backupPath);
