// Patch 142 dalo .nav-links-wrap (z-index:150) DOVNUTRA <nav> a .nav-overlay
// (z-index:140) AKO SUROSDENCA <nav> mimo neho. Kedze <nav> ma
// position:fixed + vlastny z-index:100, vytvara si vlastny stacking
// context — .nav-links-wrap svoj z-index:150 uplatnuje len oproti
// súrodencom vnutri <nav>, navonok sa cely <nav> pocita ako z=100. Takze
// .nav-overlay (140 > 100) prekryva panel s odkazmi, hoci v CSS ma nizsi
// z-index — bloknute kliky aj stmavene odkazy presne ako hlasil pouzivatel.
// Oprava: znizit .nav-overlay pod 100 (nav), aby stale prekryval obsah
// stranky (hero/ticker/... nemaju vlastny z-index), ale nie samotny <nav>
// (a teda ani .nav-links-wrap v jeho vnutri).
const fs = require('fs');
const FILE = 'public/index.html';

const LOCK = FILE + '.144-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK subor (' + LOCK + ') existuje. Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('.nav-overlay{display:none;position:fixed;inset:0;background:rgba(8,8,13,.6);backdrop-filter:blur(2px);z-index:90}')) {
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
  '.nav-overlay{display:none;position:fixed;inset:0;background:rgba(8,8,13,.6);backdrop-filter:blur(2px);z-index:140}',
  '.nav-overlay{display:none;position:fixed;inset:0;background:rgba(8,8,13,.6);backdrop-filter:blur(2px);z-index:90}',
  '1: nav-overlay z-index under <nav> stacking context');

const backup = FILE + '.pre-mobile-nav-overlay-stacking-fix-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
