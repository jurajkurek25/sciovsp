// Zmenšuje spodnú plávajúcu lištu (sticky-cta) na mobile — menší padding,
// menší text aj tlačidlo, na základe priamej požiadavky používateľa.
//
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online/public:
//   node /root/ad-service/33-sticky-cta-shrink.js

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'index.html');
const src = fs.readFileSync(FILE_PATH, 'utf8');

const OLD_BAR = `.sticky-cta{position:fixed;left:0;right:0;bottom:0;z-index:998;background:rgba(15,15,24,.92);backdrop-filter:blur(14px);border-top:1px solid var(--border2);padding:.75rem 1rem;display:none;align-items:center;gap:.75rem;transform:translateY(100%);transition:transform .3s ease}`;
const NEW_BAR = `.sticky-cta{position:fixed;left:0;right:0;bottom:0;z-index:998;background:rgba(15,15,24,.92);backdrop-filter:blur(14px);border-top:1px solid var(--border2);padding:.55rem .75rem;display:none;align-items:center;gap:.5rem;transform:translateY(100%);transition:transform .3s ease}`;

const OLD_TEXT = `.sticky-cta-text{flex:1;min-width:0;font-family:var(--mono);font-size:.72rem;color:var(--text2);line-height:1.3}`;
const NEW_TEXT = `.sticky-cta-text{flex:1;min-width:0;font-family:var(--mono);font-size:.66rem;color:var(--text2);line-height:1.25}`;

const OLD_TEXT_B = `.sticky-cta-text b{color:var(--volt);display:block;font-size:.82rem}`;
const NEW_TEXT_B = `.sticky-cta-text b{color:var(--volt);display:block;font-size:.74rem}`;

const OLD_BTN = `.sticky-cta-btn{flex-shrink:0;margin-right:.85rem;padding:.75rem 1.1rem;background:var(--volt);color:var(--black);border:none;border-radius:8px;font-family:var(--mono);font-weight:700;font-size:.8rem;letter-spacing:.03em;cursor:pointer;white-space:nowrap}`;
const NEW_BTN = `.sticky-cta-btn{flex-shrink:0;margin-right:.5rem;padding:.55rem .85rem;background:var(--volt);color:var(--black);border:none;border-radius:7px;font-family:var(--mono);font-weight:700;font-size:.72rem;letter-spacing:.03em;cursor:pointer;white-space:nowrap}`;

if (src.includes(NEW_BAR)) {
  console.error('❌ Vyzerá to, že oprava je už aplikovaná. Nič som nezmenil.');
  process.exit(1);
}
for (const [name, str] of [['.sticky-cta', OLD_BAR], ['.sticky-cta-text', OLD_TEXT], ['.sticky-cta-text b', OLD_TEXT_B], ['.sticky-cta-btn', OLD_BTN]]) {
  if (!src.includes(str)) {
    console.error(`❌ Nenašiel som očakávané CSS pre "${name}" presne. Nič som nezmenil.`);
    process.exit(1);
  }
}

const backupPath = FILE_PATH + '.pre-sticky-shrink-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
let out = src.replace(OLD_BAR, NEW_BAR);
out = out.replace(OLD_TEXT, NEW_TEXT);
out = out.replace(OLD_TEXT_B, NEW_TEXT_B);
out = out.replace(OLD_BTN, NEW_BTN);
fs.writeFileSync(FILE_PATH, out);

console.log('✅ Spodná lišta je teraz menšia (kompaktnejší padding, text aj tlačidlo).');
console.log('   Záloha pôvodného index.html:', backupPath);
