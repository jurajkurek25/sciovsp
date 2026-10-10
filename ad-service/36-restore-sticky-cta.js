// Vracia späť spodný plávajúci CTA panel (sticky-cta), odstránený skriptom
// 35-remove-sticky-cta.js — ukázalo sa, že skutočný bug bol v pätičke
// (footer), nie v sticky-cta. Vkladá presne ten istý markup a CSS, aké boli
// predtým (vrátane zmenšenia z 33-sticky-cta-shrink.js a posunu tlačidla
// z 31-sticky-cta-btn-left.js).
//
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online/public:
//   node /root/ad-service/36-restore-sticky-cta.js

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'index.html');
const src = fs.readFileSync(FILE_PATH, 'utf8');

if (src.includes('id="stickyCta"')) {
  console.error('❌ Vyzerá to, že sticky-cta je už prítomný. Nič som nezmenil.');
  process.exit(1);
}

const CSS_ANCHOR = `/* ── EXIT INTENT POPUP ── */`;
const CSS_TO_INSERT = `.sticky-cta{position:fixed;left:0;right:0;bottom:0;z-index:998;background:rgba(15,15,24,.92);backdrop-filter:blur(14px);border-top:1px solid var(--border2);padding:.55rem .75rem;display:none;align-items:center;gap:.5rem;transform:translateY(100%);transition:transform .3s ease}
.sticky-cta.show{transform:translateY(0)}
.sticky-cta-text{flex:1;min-width:0;font-family:var(--mono);font-size:.66rem;color:var(--text2);line-height:1.25}
.sticky-cta-text b{color:var(--volt);display:block;font-size:.74rem}
.sticky-cta-btn{flex-shrink:0;margin-right:.5rem;padding:.55rem .85rem;background:var(--volt);color:var(--black);border:none;border-radius:7px;font-family:var(--mono);font-weight:700;font-size:.72rem;letter-spacing:.03em;cursor:pointer;white-space:nowrap}
@media(max-width:768px){.sticky-cta{display:flex}}

${CSS_ANCHOR}`;

const MARKUP_ANCHOR = `<!-- NAV -->`;
const MARKUP_TO_INSERT = `<div class="sticky-cta" id="stickyCta">
  <div class="sticky-cta-text"><b>Prvé 3 testy zadarmo</b>Bez karty, bez záväzku</div>
  <button class="sticky-cta-btn" onclick="openPremiumPopup()">Začať →</button>
</div>

${MARKUP_ANCHOR}`;

if (!src.includes(CSS_ANCHOR)) {
  console.error('❌ Nenašiel som CSS kotvu ("/* ── EXIT INTENT POPUP ── */"). Nič som nezmenil.');
  process.exit(1);
}
if (!src.includes(MARKUP_ANCHOR)) {
  console.error('❌ Nenašiel som markup kotvu ("<!-- NAV -->"). Nič som nezmenil.');
  process.exit(1);
}

const backupPath = FILE_PATH + '.pre-restore-sticky-cta-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
let out = src.replace(CSS_ANCHOR, CSS_TO_INSERT);
out = out.replace(MARKUP_ANCHOR, MARKUP_TO_INSERT);
fs.writeFileSync(FILE_PATH, out);

console.log('✅ Sticky-cta panel obnovený (markup aj CSS).');
console.log('   Záloha pôvodného index.html:', backupPath);
