// Rovnaky bug ako patch 147, ale v blogLayout() (server.js) — pouziva ho
// /blog, /kurzy, /odporucame. Patch 145 dalo display:flex pre
// .nav-links-wrap len do @media(max-width:768px), na desktope tak padlo
// na vychodzi display:block a .lang-switcher (div) sa zalomil na novy
// riadok. Prida chybajuce zakladne pravidlo.
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.148-lock';
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

const backup = FILE + '.pre-blog-nav-links-wrap-desktop-flex-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
