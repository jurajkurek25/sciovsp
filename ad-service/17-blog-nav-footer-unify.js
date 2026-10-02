// Zjednocuje hlavičku/pätičku blogu (blogLayout v server.js) s
// index.html/legal.html: rovnaké logo s pulzujúcou bodkou, Blog odkaz,
// jazykový prepínač SK/CZ a CTA "Začať zadarmo →" (obe presmerujú na
// homepage — /?lang=..., /?openPremium=1 — rovnako ako na legal.html),
// a rovnaká pätička (Aplikácia, Blog, Kontakt, VOP, Súkromie).
//
// Predpoklad: 12/13/14-fix-blog-*.js už boli aplikované.
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online:
//   node /root/ad-service/17-blog-nav-footer-unify.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
const src = fs.readFileSync(SERVER_PATH, 'utf8');

const OLD_CSS = `.footer-link{font-family:var(--mono);font-size:12px;color:var(--text3);text-decoration:none}`;
const NEW_CSS = `.footer-links a{font-family:var(--mono);font-size:12px;color:var(--text3);text-decoration:none}
.lang-switcher{display:flex;align-items:center;gap:.35rem}
.lang-btn{padding:.45rem .7rem;border:1px solid var(--border2);background:transparent;color:var(--text2);border-radius:6px;font-family:var(--mono);font-size:.72rem;letter-spacing:.06em;cursor:pointer;transition:all .2s}
.lang-btn:hover{color:var(--text);border-color:var(--purple)}
.nav-dot{width:7px;height:7px;background:var(--volt);border-radius:50%;animation:pulse-dot 2s infinite;display:inline-block}
@keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.7)}}`;

const OLD_MARKUP = `<nav><a href="/" class="nav-logo">SP TRÉNER</a><a href="/app" class="nav-cta">Prejsť do aplikácie →</a></nav>
\${body}
<footer><div class="footer-logo">SP TRÉNER © 2026</div><a href="/app" class="footer-link">Aplikácia</a></footer>`;

const NEW_MARKUP = `<nav id="mainNav">
  <a href="/" class="nav-logo"><span class="nav-dot"></span>SP TRÉNER</a>
  <div style="display:flex;align-items:center;gap:.75rem">
    <a href="/blog" class="nav-link">Blog</a>
    <div class="lang-switcher">
      <button class="lang-btn" onclick="location.href='/?lang=sk'">SK</button>
      <button class="lang-btn" onclick="location.href='/?lang=cs'">CZ</button>
    </div>
    <button class="nav-cta" onclick="location.href='/?openPremium=1'">Začať zadarmo →</button>
  </div>
</nav>
\${body}
<footer>
  <div class="footer-logo">SP TRÉNER © 2026</div>
  <div class="footer-links">
    <a href="/app">Aplikácia</a>
    <a href="/blog">Blog</a>
    <a href="mailto:juraj@jurajkurek.com">Kontakt</a>
    <a href="/legal.html#vop">VOP</a>
    <a href="/legal.html#privacy">Súkromie</a>
  </div>
</footer>`;

if (src.includes(NEW_CSS) && src.includes(NEW_MARKUP)) {
  console.error('❌ Vyzerá to, že oprava je už aplikovaná. Nič som nezmenil.');
  process.exit(1);
}
if (!src.includes(OLD_CSS)) {
  console.error('❌ Nenašiel som očakávané CSS ("' + OLD_CSS.slice(0, 40) + '..."). Nič som nezmenil. Over, či sú aplikované patche 12/13/14.');
  process.exit(1);
}
if (!src.includes(OLD_MARKUP)) {
  console.error('❌ Nenašiel som očakávaný nav/footer markup presne. Nič som nezmenil.');
  process.exit(1);
}

const backupPath = SERVER_PATH + '.pre-blog-navfooter-unify-' + Date.now();
fs.copyFileSync(SERVER_PATH, backupPath);
let out = src.replace(OLD_CSS, NEW_CSS);
out = out.replace(OLD_MARKUP, NEW_MARKUP);
fs.writeFileSync(SERVER_PATH, out);

console.log('✅ Hlavička/pätička blogu zjednotená s index.html/legal.html.');
console.log('   Záloha pôvodného server.js:', backupPath);
console.log('   Teraz over syntax: node -c server.js');
