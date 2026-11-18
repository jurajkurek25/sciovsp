// Zjednocuje vizuál pätičky blogu s ostatnými stránkami (index.html/legal.html/
// app.html) — doteraz mala pätička blogu iný padding, bola zúžená na
// max-width:900px (zdedené z .page), a chýbal jej letter-spacing na logu aj
// na odkazoch. Mení len CSS, žiadny markup ani i18n logiku (tie už fungujú
// z 20-blog-czech.js / 23-blog-footer-partner-ads.js).
//
// Predpoklad: 20-blog-czech.js už bol aplikovaný.
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online:
//   node /root/ad-service/27-blog-footer-css-unify.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
const src = fs.readFileSync(SERVER_PATH, 'utf8');

const OLD_CSS = `footer{border-top:1px solid var(--border);padding:2rem clamp(1rem,4vw,2rem);padding-bottom:calc(2rem + env(safe-area-inset-bottom));display:flex;justify-content:space-between;flex-wrap:wrap;gap:1rem;max-width:900px;margin:0 auto}
.footer-logo{font-family:var(--mono);font-size:12px;color:var(--text3)}
.footer-links{display:flex;gap:1.4rem;flex-wrap:wrap}
.footer-links a{font-family:var(--mono);font-size:12px;color:var(--text3);text-decoration:none}
.footer-links a:hover{color:var(--text2)}`;

const NEW_CSS = `footer{border-top:1px solid var(--border);padding:2.5rem;padding-bottom:calc(2.5rem + env(safe-area-inset-bottom));display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem}
.footer-logo{font-family:var(--mono);font-size:12px;letter-spacing:.15em;color:var(--text3)}
.footer-links{display:flex;gap:1.5rem;flex-wrap:wrap}
.footer-links a{font-size:.78rem;color:var(--text3);text-decoration:none;font-family:var(--mono);letter-spacing:.05em;transition:color .2s}
.footer-links a:hover{color:var(--text2)}`;

if (src.includes(NEW_CSS)) {
  console.error('❌ Vyzerá to, že oprava je už aplikovaná. Nič som nezmenil.');
  process.exit(1);
}
if (!src.includes(OLD_CSS)) {
  console.error('❌ Nenašiel som očakávané CSS pätičky presne. Nič som nezmenil. Over, či je aplikovaný 20-blog-czech.js.');
  process.exit(1);
}

const backupPath = SERVER_PATH + '.pre-blog-footer-css-' + Date.now();
fs.copyFileSync(SERVER_PATH, backupPath);
fs.writeFileSync(SERVER_PATH, src.replace(OLD_CSS, NEW_CSS));

console.log('✅ Pätička blogu má teraz rovnaký vizuál ako index.html/legal.html/app.html (plná šírka, rovnaký padding a typografia).');
console.log('   Záloha pôvodného server.js:', backupPath);
console.log('   Teraz over syntax: node -c server.js');
