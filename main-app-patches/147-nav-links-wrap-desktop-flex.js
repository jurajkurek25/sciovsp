// Patch 142 presunulo Blog/Kurzy/Odporucame + lang-switcher do noveho
// .nav-links-wrap divu, ale display:flex pre neho bolo nastavene LEN v
// @media(max-width:768px) bloku. Na desktope tak .nav-links-wrap padol na
// vychodzi display:block prehliadaca, .lang-switcher (tiez div) sa preto
// zalomil na novy riadok pod Blog/Kurzy/Odporucame — presne to co pouzivatel
// nahlasil ("na desktope hnusne"). Prida chybajuce zakladne pravidlo.
const fs = require('fs');
const FILE = 'public/index.html';

const LOCK = FILE + '.147-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK subor (' + LOCK + ') existuje. Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('.nav-right{display:flex;align-items:center;gap:.75rem}\n.nav-links-wrap{display:flex')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, () => newStr);
}

const patched = replaceOnce(src,
  '.nav-right{display:flex;align-items:center;gap:.75rem}\n.nav-hamburger{display:none;',
  '.nav-right{display:flex;align-items:center;gap:.75rem}\n.nav-links-wrap{display:flex;align-items:center;gap:.75rem}\n.nav-hamburger{display:none;',
  '1: .nav-links-wrap base flex rule');

const backup = FILE + '.pre-nav-links-wrap-desktop-flex-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
