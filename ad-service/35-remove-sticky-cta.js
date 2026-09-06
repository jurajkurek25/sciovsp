// Odstraňuje spodný plávajúci CTA panel (sticky-cta) úplne — markup aj CSS.
// JS (initStickyCta) sa netreba dotýkať — už má "if(!bar) return;" poistku,
// takže po odstránení elementu jednoducho nič nerobí.
//
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online/public:
//   node /root/ad-service/35-remove-sticky-cta.js

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'index.html');
const src = fs.readFileSync(FILE_PATH, 'utf8');

const OLD_MARKUP = `<div class="sticky-cta" id="stickyCta">
  <div class="sticky-cta-text"><b>Prvé 3 testy zadarmo</b>Bez karty, bez záväzku</div>
  <button class="sticky-cta-btn" onclick="openPremiumPopup()">Začať →</button>
</div>`;

const OLD_CSS = `.sticky-cta{position:fixed;left:0;right:0;bottom:0;z-index:998;background:rgba(15,15,24,.92);backdrop-filter:blur(14px);border-top:1px solid var(--border2);padding:.55rem .75rem;display:none;align-items:center;gap:.5rem;transform:translateY(100%);transition:transform .3s ease}
.sticky-cta.show{transform:translateY(0)}
.sticky-cta-text{flex:1;min-width:0;font-family:var(--mono);font-size:.66rem;color:var(--text2);line-height:1.25}
.sticky-cta-text b{color:var(--volt);display:block;font-size:.74rem}
.sticky-cta-btn{flex-shrink:0;margin-right:.5rem;padding:.55rem .85rem;background:var(--volt);color:var(--black);border:none;border-radius:7px;font-family:var(--mono);font-weight:700;font-size:.72rem;letter-spacing:.03em;cursor:pointer;white-space:nowrap}
@media(max-width:768px){.sticky-cta{display:flex}}`;

if (!src.includes(OLD_MARKUP) && !src.includes(OLD_CSS)) {
  console.error('❌ Vyzerá to, že oprava je už aplikovaná (nič z pôvodného sticky-cta markupu/CSS sa nenašlo). Nič som nezmenil.');
  process.exit(1);
}

const backupPath = FILE_PATH + '.pre-remove-sticky-cta-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
let out = src;
let removed = [];

if (out.includes(OLD_MARKUP)) {
  out = out.replace(OLD_MARKUP, '');
  removed.push('markup');
} else {
  console.error('⚠️  Nenašiel som presný markup sticky-cta — preskakujem markup, skúšam aspoň CSS.');
}

if (out.includes(OLD_CSS)) {
  out = out.replace(OLD_CSS, '');
  removed.push('CSS');
} else {
  console.error('⚠️  Nenašiel som presné CSS sticky-cta — preskakujem CSS.');
}

if (removed.length === 0) {
  console.error('❌ Nepodarilo sa odstrániť ani markup ani CSS. Nič som nezmenil.');
  process.exit(1);
}

fs.writeFileSync(FILE_PATH, out);

console.log('✅ Spodný panel (sticky-cta) odstránený: ' + removed.join(' + ') + '.');
console.log('   Záloha pôvodného index.html:', backupPath);
