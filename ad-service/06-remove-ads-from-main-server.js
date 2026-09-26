// Odstráni z produkčného server.js časti, ktoré presúvame do samostatnej
// appky ad-service (inzerentská auth, banner/video CRUD, Stripe checkout,
// verejné serve/go/impression, AD_HOSTS hostname routing).
//
// PONECHÁVA nedotknuté: blog (/blog, /blog/:slug) a rewards
// (/api/rewards/video-status|start|complete) — tie zostávajú v hlavnej
// appke, lebo pracujú s users.trial_count z hlavnej appky.
//
// Vychádza z PRESNE toho istého /root/deploy-patch/02-server-routes.js,
// z ktorého bol pôvodný patch postavený (rovnaké slice indexy ako
// apply-patch.js) — takže vie presne, čo má odstrániť.
//
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online:
//   node /root/ad-service/06-remove-ads-from-main-server.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
const PATCH_PATH = '/root/deploy-patch/02-server-routes.js';

const serverSrc = fs.readFileSync(SERVER_PATH, 'utf8');
const patchLines = fs.readFileSync(PATCH_PATH, 'utf8').split('\n');

// Presne tie isté rezy ako apply-patch.js použil na VLOŽENIE:
const block1 = patchLines.slice(19, 24).join('\n');   // AD_HOSTS hostname catch
const block2 = patchLines.slice(36, 541).join('\n');  // celý veľký blok (ads + rewards + blog)

// Z block2 chceme PONECHAŤ len: escapeHtml, DAILY_REWARD_LIMIT, REWARD_GRACE_MS, rewards, blog
const keptConsts = [patchLines[46], patchLines[47]].join('\n');        // DAILY_REWARD_LIMIT, REWARD_GRACE_MS
const keptEscapeHtml = patchLines.slice(49, 52).join('\n');            // function escapeHtml(...) {...}
const keptRewardsAndBlog = patchLines.slice(381, 541).join('\n');      // Rewards + Blog sekcie
const replacement = [keptConsts, '', keptEscapeHtml, '', keptRewardsAndBlog].join('\n');

let out = serverSrc;
let changed = false;

const removeStr1 = '\n\n' + block1 + '\n';
if (out.includes(removeStr1)) {
  out = out.replace(removeStr1, '');
  changed = true;
  console.log('✅ AD_HOSTS hostname routing odstránený (presúva sa do ad-service + nginx).');
} else {
  console.log('ℹ️  AD_HOSTS blok sa v server.js nenašiel (možno už bol odstránený) — preskakujem.');
}

const removeStr2 = block2 + '\n\n';
if (out.includes(removeStr2)) {
  out = out.replace(removeStr2, replacement + '\n\n');
  changed = true;
  console.log('✅ Ads management (auth/banner/video CRUD/checkout/portal/serve/go/impression) odstránený.');
  console.log('   Ponechané: escapeHtml, DAILY_REWARD_LIMIT, REWARD_GRACE_MS, rewards routes, blog routes.');
} else {
  console.log('ℹ️  Veľký ads blok sa v server.js nenašiel v očakávanej podobe — preskakujem (over ručne).');
}

if (!changed) {
  console.error('❌ Nič som nezmenil — ani jeden z blokov sa nenašiel v očakávanej podobe. server.js je nedotknutý.');
  process.exit(1);
}

const backupPath = SERVER_PATH + '.pre-ads-service-split-' + Date.now();
fs.copyFileSync(SERVER_PATH, backupPath);
fs.writeFileSync(SERVER_PATH, out);

console.log('   Záloha pôvodného server.js:', backupPath);
console.log('   Teraz over syntax: node -c server.js');
