// Programaticky vloží blok1 a blok2 z 02-server-routes.js do server.js na
// správne miesta — bezpečnejšie ako ručný copy-paste do 147KB súboru.
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online:
//   node /root/deploy-patch/apply-patch.js
const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
const PATCH_PATH = '/root/deploy-patch/02-server-routes.js';

const serverSrc = fs.readFileSync(SERVER_PATH, 'utf8');
const patchLines = fs.readFileSync(PATCH_PATH, 'utf8').split('\n');

// Blok1 = riadky 20–24 (1-indexed) z 02-server-routes.js, blok2 = 37–541
const block1 = patchLines.slice(19, 24).join('\n');
const block2 = patchLines.slice(36, 541).join('\n');

if (serverSrc.includes('AD_HOSTS')) {
  console.error('❌ Patch sa už zdá byť aplikovaný (nájdené "AD_HOSTS" v server.js). Nič som nezmenil.');
  process.exit(1);
}

const anchor1 = 'const app = express();';
const anchor1Idx = serverSrc.indexOf(anchor1);
if (anchor1Idx === -1) {
  console.error('❌ Nenašiel som kotvu #1 ("const app = express();"). Nič som nezmenil.');
  process.exit(1);
}
const afterAnchor1 = anchor1Idx + anchor1.length;
let out = serverSrc.slice(0, afterAnchor1) + '\n\n' + block1 + '\n' + serverSrc.slice(afterAnchor1);

const anchor2 = "app.get('/:customCode(";
const anchor2Idx = out.indexOf(anchor2);
if (anchor2Idx === -1) {
  console.error('❌ Nenašiel som kotvu #2 ("app.get(\'/:customCode("). Nič som nezmenil (blok1 ešte nebol zapísaný).');
  process.exit(1);
}
out = out.slice(0, anchor2Idx) + block2 + '\n\n' + out.slice(anchor2Idx);

const backupPath = SERVER_PATH + '.pre-ads-patch-' + Date.now();
fs.copyFileSync(SERVER_PATH, backupPath);
fs.writeFileSync(SERVER_PATH, out);

console.log('✅ Patch aplikovaný.');
console.log('   Záloha pôvodného server.js:', backupPath);
console.log('   Teraz over syntax: node -c server.js');
