// Badge v účtovom paneli (vedľa "Odhlásiť") rozlišoval iba PREMIUM/FREE —
// isPremium() je true aj pre Elite účty (Elite je nadstavba Premium), takže
// Elite používatelia videli zelený "PREMIUM" badge namiesto Elite. Teraz je
// to 3-stavovy badge: biely FREE, zelený (--volt) PREMIUM, fialový
// (--purple) ELITE.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/168-app-account-badge-elite.js

const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(process.cwd(), 'public', 'app.html');

if (!fs.existsSync(HTML_PATH)) {
  console.error('❌ Nenašiel som súbor:', HTML_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.168-app-account-badge-elite-lock');
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (' + LOCK + '). Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

function replaceOnce(src, oldStr, newStr, label) {
  const count = src.split(oldStr).length - 1;
  if (count !== 1) {
    console.error('❌ ' + label + ' — kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil.');
    process.exit(1);
  }
  return src.replace(oldStr, () => newStr);
}

let html = fs.readFileSync(HTML_PATH, 'utf8');

if (html.includes("isElite()?`<span style=\"background:var(--purple)")) {
  console.error('❌ app.html: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

const OLD = "const pb=isPremium()?`<span style=\"background:var(--volt);color:var(--black);font-size:9px;padding:2px 8px;border-radius:10px;font-family:var(--mono);font-weight:700;\">PREMIUM</span>`:`<span style=\"background:var(--black3);color:var(--text3);font-size:9px;padding:2px 8px;border-radius:10px;font-family:var(--mono);\">FREE</span>`;";

const NEW = "const pb=isElite()?`<span style=\"background:var(--purple);color:#fff;font-size:9px;padding:2px 8px;border-radius:10px;font-family:var(--mono);font-weight:700;\">ELITE</span>`:isPremium()?`<span style=\"background:var(--volt);color:var(--black);font-size:9px;padding:2px 8px;border-radius:10px;font-family:var(--mono);font-weight:700;\">PREMIUM</span>`:`<span style=\"background:#fff;color:var(--black);font-size:9px;padding:2px 8px;border-radius:10px;font-family:var(--mono);font-weight:700;\">FREE</span>`;";

html = replaceOnce(html, OLD, NEW, 'renderAuthButton() pb badge -> 3-stavovy (FREE/PREMIUM/ELITE)');

const backup = HTML_PATH + '.pre-account-badge-elite-' + Date.now();
fs.copyFileSync(HTML_PATH, backup);
fs.writeFileSync(HTML_PATH, html);

console.log('✅ Badge v účtovom paneli teraz rozlišuje FREE (biely) / PREMIUM (zelený) / ELITE (fialový).');
console.log('   Záloha:', backup);
