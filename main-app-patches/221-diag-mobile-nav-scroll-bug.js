// DIAGNOSTICKY skript -- NIC NEMENI. Hamburger menu na mobile funguje
// správne v hero sekcii, ale po scrollovaní dole sa otvorí rozbité
// (len čiastočne viditeľné, stmavené pozadie). Potrebujem presný aktuálny
// kód CSS pre .nav-links-wrap/.nav-overlay/nav, HTML štruktúru <nav> a
// akýkoľvek scroll/hero-viazaný JS, aby som vedel diagnostikovať presne
// (napr. transform na predkovi rozbíjajúci position:fixed) -- nehádať.
//
// Spusti z koreňa hlavnej appky a pošli mi CELÝ výpis:
//   node main-app-patches/221-diag-mobile-nav-scroll-bug.js

const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(process.cwd(), 'public', 'index.html');
if (!fs.existsSync(HTML_PATH)) {
  console.error('❌ Nenašiel som public/index.html — spusti z koreňa hlavnej appky.');
  process.exit(1);
}
const src = fs.readFileSync(HTML_PATH, 'utf8');

// 1) Celý <nav id="mainNav">...</nav> + nasledujúci .nav-overlay div
const navIdx = src.indexOf('<nav id="mainNav">');
console.log('════════════ <nav id="mainNav"> HTML ════════════');
if (navIdx === -1) {
  console.log('❌ Nenašiel som <nav id="mainNav">.');
} else {
  const navEndMarker = '</nav>';
  const navEnd = src.indexOf(navEndMarker, navIdx) + navEndMarker.length;
  let afterNav = src.slice(navEnd, navEnd + 300);
  console.log(JSON.stringify(src.slice(navIdx, navEnd)));
  console.log('--- 300 znakov po </nav> ---');
  console.log(JSON.stringify(afterNav));
}
console.log('');

// 2) CSS pravidlá obsahujúce "nav-" alebo "hero" (všetky výskyty so 150 znakmi kontextu)
console.log('════════════ CSS pravidlá s "nav-" alebo "hero" ════════════');
const cssPatterns = ['.nav-links-wrap', '.nav-overlay', '.nav-hamburger', '.nav-right', 'nav{', '#mainNav', '.hero', 'body{', 'html{'];
cssPatterns.forEach(pat => {
  let searchFrom = 0;
  let occ = 0;
  while (true) {
    const idx = src.indexOf(pat, searchFrom);
    if (idx === -1) break;
    occ++;
    const start = Math.max(0, idx - 20);
    const end = Math.min(src.length, idx + 250);
    console.log('--- "' + pat + '" výskyt #' + occ + ' (znak ' + idx + ') ---');
    console.log(JSON.stringify(src.slice(start, end)));
    searchFrom = idx + pat.length;
    if (occ >= 5) { console.log('(ďalšie výskyty orezané)'); break; }
  }
});
console.log('');

// 3) Hľadaj scroll event listenery / transform / IntersectionObserver globálne
console.log('════════════ Scroll/transform/IntersectionObserver výskyty ════════════');
['addEventListener(\'scroll\'', 'addEventListener("scroll"', 'onscroll', 'IntersectionObserver', 'window.scrollY', 'transform:', 'will-change'].forEach(pat => {
  const count = (src.match(new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  console.log(pat + ': ' + count + ' výskytov');
});

console.log('');
console.log('Skopíruj CELÝ výpis vyššie a pošli mi ho.');
