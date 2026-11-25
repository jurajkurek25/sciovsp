// Odstráni injectnutý <script src="https://91.99.188.203:8443/..."> tag zo server.js.
// Tento tag NIE JE súčasťou žiadneho môjho patchu (jsonLdScript() je v git histórii
// vždy čistá — pozri main-app-patches/58-fix-gtag-script-domain.js a ad-service/14,20).
// Spusti na serveri z /home/jurajkurek-vsp/htdocs/sptrener.online:
//   node main-app-patches/101-remove-injected-script-server.js
const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

// Zachytí <script ...src="https://91.99.188.203:8443/TOKEN"...></script> v jednoduchých
// aj dvojitých úvodzovkách, nech je presný token akýkoľvek.
const RE = /<script[^>]*\ssrc=(['"])https:\/\/91\.99\.188\.203:8443\/[^'"]*\1[^>]*><\/script>/g;

const matches = src.match(RE);
if (!matches || matches.length === 0) {
  console.error('Nenašiel som žiadny injectnutý <script src="https://91.99.188.203:8443/...">. Nič som nezmenil.');
  process.exit(1);
}

console.log(`Nájdených ${matches.length} výskyt(ov) injectnutého scriptu. Odstraňujem.`);
const patched = src.replace(RE, '');

const backup = FILE + '.pre-remove-injected-script-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK — zálohované do', backup, '— server.js vyčistený, reštartni proces (napr. pm2 restart).');
