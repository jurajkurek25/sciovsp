// Rovnaky hamburger-menu fix ako patche 142-144 na public/index.html, ale
// pre nav v blogLayout() (server.js) — pouziva ho /blog, /kurzy,
// /odporucame. Tento nav ma uz flex-wrap:wrap (nezalamuje sa mimo
// obrazovky ako povodny index nav), ale kvoli konzistencii dostane rovnaky
// vysuvny panel na mobile. Rovno pouzivame z-index:90 pre overlay (pod
// nav-om, ktory ma position:sticky + z-index:100 a teda tiez vytvara
// vlastny stacking context) — poucenie z patchu 144, aby sa ten isty bug
// nezopakoval.
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.145-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK subor (' + LOCK + ') existuje. Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('navHamburger')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, () => newStr);
}

let patched = src;

// -- 1) CSS: hamburger + overlay + nav-right --
patched = replaceOnce(patched,
  ".lang-btn.active{color:var(--volt);border-color:var(--volt)}\n.page{max-width:900px;margin:0 auto;padding:clamp(2rem,6vw,3.5rem) clamp(1rem,4vw,2rem) clamp(3rem,6vw,6rem)}",
  ".lang-btn.active{color:var(--volt);border-color:var(--volt)}\n.nav-right{display:flex;align-items:center;gap:.75rem}\n.nav-hamburger{display:none;width:38px;height:38px;align-items:center;justify-content:center;flex-shrink:0;background:transparent;border:1px solid var(--border2);border-radius:8px;color:var(--text);font-size:1.05rem;cursor:pointer;transition:border-color .2s}\n.nav-hamburger:hover{border-color:var(--volt)}\n.nav-overlay{display:none;position:fixed;inset:0;background:rgba(8,8,13,.6);backdrop-filter:blur(2px);z-index:90}\n.nav-overlay.show{display:block}\n.page{max-width:900px;margin:0 auto;padding:clamp(2rem,6vw,3.5rem) clamp(1rem,4vw,2rem) clamp(3rem,6vw,6rem)}",
  '1: CSS hamburger + overlay + nav-right');

// -- 2) CSS: mobilny vysuvny panel v @media (max-width: 768px) --
patched = replaceOnce(patched,
  "@media (max-width: 768px){\n  .nav-cta{padding:.5rem .9rem;font-size:.75rem}\n}",
  "@media (max-width: 768px){\n  .nav-cta{padding:.5rem .9rem;font-size:.75rem}\n  .nav-hamburger{display:flex}\n  .nav-links-wrap{position:fixed;top:0;right:0;bottom:0;width:min(78vw,300px);background:rgba(15,15,24,.98);backdrop-filter:blur(14px);border-left:1px solid var(--border2);display:flex;flex-direction:column;align-items:stretch;gap:.4rem;padding:5.5rem 1.25rem 2rem;transform:translateX(100%);transition:transform .3s ease;z-index:150;overflow-y:auto}\n  .nav-links-wrap.open{transform:translateX(0)}\n  .nav-links-wrap .nav-link{padding:.85rem 1rem;border:1px solid var(--border);border-radius:10px;text-align:center;color:var(--text)}\n  .nav-links-wrap .lang-switcher{margin-top:.5rem;justify-content:center}\n  .nav-links-wrap .lang-btn{color:var(--text)}\n}",
  '2: CSS mobile nav-links-wrap panel');

// -- 3) HTML: restrukturovat <nav>, pridat hamburger + overlay --
const OLD_NAV = `<nav id="mainNav">
  <a href="/\${l === 'cs' ? '?lang=cs' : ''}" class="nav-logo"><span class="nav-dot"></span>SP TRÉNER</a>
  <div style="display:flex;align-items:center;gap:.75rem">
    <a href="/blog\${l === 'cs' ? '?lang=cs' : ''}" class="nav-link\${navActive === 'blog' ? ' active' : ''}">Blog</a>
    <a href="/kurzy\${l === 'cs' ? '?lang=cs' : ''}" class="nav-link\${navActive === 'kurzy' ? ' active' : ''}">Kurzy</a>
    <a href="/odporucame\${l === 'cs' ? '?lang=cs' : ''}" class="nav-link\${navActive === 'odporucame' ? ' active' : ''}">Odporúčame</a>
    <div class="lang-switcher">
      <button class="lang-btn\${l === 'sk' ? ' active' : ''}" onclick="switchBlogLang('sk')">SK</button>
      <button class="lang-btn\${l === 'cs' ? ' active' : ''}" onclick="switchBlogLang('cs')">CZ</button>
    </div>
    <button class="nav-cta" onclick="location.href='/?openPremium=1'">\${T.navCta}</button>
  </div>
</nav>`;
const NEW_NAV = `<nav id="mainNav">
  <a href="/\${l === 'cs' ? '?lang=cs' : ''}" class="nav-logo"><span class="nav-dot"></span>SP TRÉNER</a>
  <div class="nav-right">
    <div class="nav-links-wrap" id="navLinksWrap">
      <a href="/blog\${l === 'cs' ? '?lang=cs' : ''}" class="nav-link\${navActive === 'blog' ? ' active' : ''}">Blog</a>
      <a href="/kurzy\${l === 'cs' ? '?lang=cs' : ''}" class="nav-link\${navActive === 'kurzy' ? ' active' : ''}">Kurzy</a>
      <a href="/odporucame\${l === 'cs' ? '?lang=cs' : ''}" class="nav-link\${navActive === 'odporucame' ? ' active' : ''}">Odporúčame</a>
      <div class="lang-switcher">
        <button class="lang-btn\${l === 'sk' ? ' active' : ''}" onclick="switchBlogLang('sk')">SK</button>
        <button class="lang-btn\${l === 'cs' ? ' active' : ''}" onclick="switchBlogLang('cs')">CZ</button>
      </div>
    </div>
    <button class="nav-cta" onclick="location.href='/?openPremium=1'">\${T.navCta}</button>
    <button class="nav-hamburger" id="navHamburger" onclick="toggleMobileNav()" aria-label="Menu">☰</button>
  </div>
</nav>
<div class="nav-overlay" id="navOverlay" onclick="closeMobileNav()"></div>`;
patched = replaceOnce(patched, OLD_NAV, NEW_NAV, '3: nav HTML restructure');

// -- 4) JS: toggle/close funkcie pred switchBlogLang --
patched = replaceOnce(patched,
  "<script>\nfunction switchBlogLang(l){",
  "<script>\nfunction toggleMobileNav(){\n  var open = document.getElementById('navLinksWrap').classList.toggle('open');\n  document.getElementById('navOverlay').classList.toggle('show', open);\n  document.getElementById('navHamburger').textContent = open ? '✕' : '☰';\n}\nfunction closeMobileNav(){\n  document.getElementById('navLinksWrap').classList.remove('open');\n  document.getElementById('navOverlay').classList.remove('show');\n  document.getElementById('navHamburger').textContent = '☰';\n}\nfunction switchBlogLang(l){",
  '4: JS toggle/closeMobileNav');

const backup = FILE + '.pre-blog-nav-hamburger-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
