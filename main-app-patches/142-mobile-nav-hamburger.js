// Mobilny nav (public/index.html) mal Blog/Kurzy/Odporucame + SK/CZ prepinac
// + CTA tlacidlo natlacene v jednom riadku pod 768px, takze hlavne CTA
// "Zacat zadarmo" bolo mimo obrazovky / neviditelne. Rieseni: hamburger
// menu — odkazy + lang-switcher sa na mobile presunu do vysuvneho panelu
// s prekryvom, CTA tlacidlo ostava vzdy viditelne v hlavnom riadku.
const fs = require('fs');
const FILE = 'public/index.html';

const LOCK = FILE + '.142-lock';
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

// -- 1) CSS: hamburger tlacidlo + overlay + mobilny vysuvny panel --
patched = replaceOnce(patched,
  '.lang-btn.active{color:var(--volt);border-color:var(--volt)}\n',
  `.lang-btn.active{color:var(--volt);border-color:var(--volt)}

.nav-right{display:flex;align-items:center;gap:.75rem}
.nav-hamburger{display:none;width:38px;height:38px;align-items:center;justify-content:center;flex-shrink:0;background:transparent;border:1px solid var(--border2);border-radius:8px;color:var(--text);font-size:1.05rem;cursor:pointer;transition:border-color .2s}
.nav-hamburger:hover{border-color:var(--volt)}
.nav-overlay{display:none;position:fixed;inset:0;background:rgba(8,8,13,.6);backdrop-filter:blur(2px);z-index:140}
.nav-overlay.show{display:block}
`,
  '1: CSS hamburger + overlay');

patched = replaceOnce(patched,
  '@media(max-width:768px){\n  nav{padding:1rem 1.5rem}\n  .nav-cta{padding:.5rem .9rem;font-size:.75rem}\n',
  `@media(max-width:768px){
  nav{padding:1rem 1.5rem}
  .nav-cta{padding:.5rem .9rem;font-size:.75rem}
  .nav-hamburger{display:flex}
  .nav-links-wrap{position:fixed;top:0;right:0;bottom:0;width:min(78vw,300px);background:rgba(15,15,24,.98);backdrop-filter:blur(14px);border-left:1px solid var(--border2);display:flex;flex-direction:column;align-items:stretch;gap:.4rem;padding:5.5rem 1.25rem 2rem;transform:translateX(100%);transition:transform .3s ease;z-index:150;overflow-y:auto}
  .nav-links-wrap.open{transform:translateX(0)}
  .nav-links-wrap .nav-link{padding:.85rem 1rem;border:1px solid var(--border);border-radius:10px;text-align:center}
  .nav-links-wrap .lang-switcher{margin-top:.5rem;justify-content:center}
`,
  '2: CSS mobile nav-links-wrap panel');

// -- 2) HTML: presunut odkazy+lang-switcher do nav-links-wrap, pridat hamburger + overlay --
const OLD_NAV = `<nav id="mainNav">
  <a href="#" class="nav-logo"><div class="nav-dot"></div>SP TRÉNER</a>
  <div style="display:flex;align-items:center;gap:.75rem">
    <a href="/blog" class="nav-link">Blog</a>
    <a href="/kurzy" class="nav-link">Kurzy</a>
    <a href="/odporucame" class="nav-link">Odporúčame</a>
    <div class="lang-switcher">
      <button class="lang-btn" id="langSkBtn" onclick="setLanguage('sk')">SK</button>
      <button class="lang-btn" id="langCsBtn" onclick="setLanguage('cs')">CZ</button>
    </div>
    <button class="nav-cta" onclick="openComparePopup()">Začať zadarmo →</button>
  </div>
</nav>`;
const NEW_NAV = `<nav id="mainNav">
  <a href="#" class="nav-logo"><div class="nav-dot"></div>SP TRÉNER</a>
  <div class="nav-right">
    <div class="nav-links-wrap" id="navLinksWrap">
      <a href="/blog" class="nav-link">Blog</a>
      <a href="/kurzy" class="nav-link">Kurzy</a>
      <a href="/odporucame" class="nav-link">Odporúčame</a>
      <div class="lang-switcher">
        <button class="lang-btn" id="langSkBtn" onclick="setLanguage('sk')">SK</button>
        <button class="lang-btn" id="langCsBtn" onclick="setLanguage('cs')">CZ</button>
      </div>
    </div>
    <button class="nav-cta" onclick="openComparePopup()">Začať zadarmo →</button>
    <button class="nav-hamburger" id="navHamburger" onclick="toggleMobileNav()" aria-label="Menu">☰</button>
  </div>
</nav>
<div class="nav-overlay" id="navOverlay" onclick="closeMobileNav()"></div>`;
patched = replaceOnce(patched, OLD_NAV, NEW_NAV, '3: nav HTML restructure');

// -- 3) JS: toggle/close funkcie pre mobilny panel --
patched = replaceOnce(patched,
  'function openComparePopup(){',
  `function toggleMobileNav(){
  const open = document.getElementById('navLinksWrap').classList.toggle('open');
  document.getElementById('navOverlay').classList.toggle('show', open);
  document.getElementById('navHamburger').textContent = open ? '✕' : '☰';
}
function closeMobileNav(){
  document.getElementById('navLinksWrap').classList.remove('open');
  document.getElementById('navOverlay').classList.remove('show');
  document.getElementById('navHamburger').textContent = '☰';
}

function openComparePopup(){`,
  '4: JS toggle/closeMobileNav');

const backup = FILE + '.pre-mobile-nav-hamburger-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
