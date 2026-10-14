// Patch 142 pridal mobilny vysuvny panel (.nav-links-wrap) s tmavym pozadim
// (takmer totozne s --black2), ale .nav-link a .lang-btn v nom dedia
// var(--text2) (#7777a0) — tlmena farba urcena pre priesvitny horny nav,
// vo vnutri solidneho tmaveho panela je to zle citatelne. Zvysi kontrast
// len pre polozky vnutri panela, mimo neho (horny nav na desktope) sa nic
// nemeni.
const fs = require('fs');
const FILE = 'public/index.html';

const LOCK = FILE + '.143-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK subor (' + LOCK + ') existuje. Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('.nav-links-wrap .nav-link{padding:.85rem 1rem;border:1px solid var(--border);border-radius:10px;text-align:center;color:var(--text)}')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, () => newStr);
}

let patched = src;

patched = replaceOnce(patched,
  '.nav-links-wrap .nav-link{padding:.85rem 1rem;border:1px solid var(--border);border-radius:10px;text-align:center}\n  .nav-links-wrap .lang-switcher{margin-top:.5rem;justify-content:center}',
  '.nav-links-wrap .nav-link{padding:.85rem 1rem;border:1px solid var(--border);border-radius:10px;text-align:center;color:var(--text)}\n  .nav-links-wrap .lang-switcher{margin-top:.5rem;justify-content:center}\n  .nav-links-wrap .lang-btn{color:var(--text)}',
  '1: nav-links-wrap contrast');

const backup = FILE + '.pre-mobile-nav-panel-contrast-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
