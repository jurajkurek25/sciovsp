// Pridáva pätičku do app.html (doteraz appka nemala žiadnu) — rovnaký
// vizuál a rovnaká sada odkazov ako na index.html/legal.html/blogu:
// Aplikácia, Blog, Kontakt, VOP, Súkromie, Partnerský program, Inzercia.
// Vkladá sa ako jediná statická inštancia za posledný .screen div (pred
// #toast a pred hlavným <script>) — keďže .screen.active je min-height:100vh
// flex column, pätička sa prirodzene zobrazí po scrollnutí na koniec
// aktuálnej obrazovky, presne tak ako na ostatných stránkach.
//
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online/public:
//   node /root/ad-service/24-app-footer.js

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'app.html');
const src = fs.readFileSync(FILE_PATH, 'utf8');

const OLD_CSS_ANCHOR = `.toast{position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%) translateY(2rem);background:var(--black2);border:1px solid var(--border2);padding:.65rem 1.25rem;border-radius:10px;font-size:.85rem;font-family:var(--mono);opacity:0;transition:all .25s;z-index:9996;white-space:nowrap}`;

const NEW_CSS_BLOCK = `${OLD_CSS_ANCHOR}
footer{border-top:1px solid var(--border);padding:2.5rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem}
.footer-logo{font-family:var(--mono);font-size:12px;letter-spacing:.15em;color:var(--text3)}
.footer-links{display:flex;gap:1.5rem;flex-wrap:wrap}
.footer-links a{font-size:.78rem;color:var(--text3);text-decoration:none;font-family:var(--mono);letter-spacing:.05em;transition:color .2s}
.footer-links a:hover{color:var(--text2)}`;

const OLD_MARKUP = `<div class="toast" id="toast"></div>`;

const NEW_MARKUP = `<footer>
  <div class="footer-logo">SP TRÉNER © 2026</div>
  <div class="footer-links">
    <a href="/app">Aplikácia</a>
    <a href="/blog">Blog</a>
    <a href="mailto:juraj@jurajkurek.com">Kontakt</a>
    <a href="/legal.html#vop">VOP</a>
    <a href="/legal.html#privacy">Súkromie</a>
    <a href="https://partner.sptrener.online">Partnerský program</a>
    <a href="https://ad.sptrener.online">Inzercia</a>
  </div>
</footer>

<div class="toast" id="toast"></div>`;

if (src.includes('<footer>')) {
  console.error('❌ Vyzerá to, že oprava je už aplikovaná (nájdené <footer>). Nič som nezmenil.');
  process.exit(1);
}
if (!src.includes(OLD_CSS_ANCHOR)) {
  console.error('❌ Nenašiel som očakávané CSS pre .toast. Nič som nezmenil.');
  process.exit(1);
}
if (!src.includes(OLD_MARKUP)) {
  console.error('❌ Nenašiel som očakávaný <div class="toast" id="toast"></div> presne. Nič som nezmenil.');
  process.exit(1);
}

const backupPath = FILE_PATH + '.pre-app-footer-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
let out = src.replace(OLD_CSS_ANCHOR, NEW_CSS_BLOCK);
out = out.replace(OLD_MARKUP, NEW_MARKUP);
fs.writeFileSync(FILE_PATH, out);

console.log('✅ Pätička pridaná do app.html (Aplikácia/Blog/Kontakt/VOP/Súkromie/Partnerský program/Inzercia).');
console.log('   Záloha pôvodného app.html:', backupPath);
