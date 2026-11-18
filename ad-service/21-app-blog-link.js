// Pridáva malý odkaz "Blog" do app.html — vedľa SK/CZ jazykového
// prepínača (rovnaký fixed pill vpravo hore, na mobile centrovaný),
// keďže appka zámerne nemá plnú marketingovú nav/footer lištu. Otvára sa
// v novom okne (target="_blank"), aby to nepretrhlo rozbehnutý test na čas.
//
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online/public:
//   node /root/ad-service/21-app-blog-link.js

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'app.html');
const src = fs.readFileSync(FILE_PATH, 'utf8');

const OLD_CSS = `.lang-btn{padding:.3rem .75rem;background:transparent;border:none;border-right:1px solid var(--border2);color:var(--text3);cursor:pointer;font-family:var(--mono);font-size:11px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;transition:all .15s}`;

const NEW_CSS = `.lang-btn{padding:.3rem .75rem;background:transparent;border:none;border-right:1px solid var(--border2);color:var(--text3);cursor:pointer;font-family:var(--mono);font-size:11px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;transition:all .15s}
.lang-switcher a.lang-btn{text-decoration:none;display:inline-flex;align-items:center}`;

const OLD_MARKUP = `<div class="lang-switcher">
  <button class="lang-btn active" id="langSK" onclick="setLang('sk')">SK</button>
  <button class="lang-btn" id="langCZ" onclick="setLang('cz')">CZ</button>
</div>`;

const NEW_MARKUP = `<div class="lang-switcher">
  <a class="lang-btn" href="/blog" target="_blank" rel="noopener">Blog</a>
  <button class="lang-btn active" id="langSK" onclick="setLang('sk')">SK</button>
  <button class="lang-btn" id="langCZ" onclick="setLang('cz')">CZ</button>
</div>`;

if (src.includes(NEW_MARKUP)) {
  console.error('❌ Vyzerá to, že oprava je už aplikovaná. Nič som nezmenil.');
  process.exit(1);
}
if (!src.includes(OLD_CSS)) {
  console.error('❌ Nenašiel som očakávané CSS pre .lang-btn. Nič som nezmenil.');
  process.exit(1);
}
if (!src.includes(OLD_MARKUP)) {
  console.error('❌ Nenašiel som očakávaný markup jazykového prepínača presne. Nič som nezmenil.');
  process.exit(1);
}

const backupPath = FILE_PATH + '.pre-blog-link-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
let out = src.replace(OLD_CSS, NEW_CSS);
out = out.replace(OLD_MARKUP, NEW_MARKUP);
fs.writeFileSync(FILE_PATH, out);

console.log('✅ Odkaz na Blog pridaný do app.html (vedľa SK/CZ prepínača, otvára sa v novom okne).');
console.log('   Záloha pôvodného app.html:', backupPath);
