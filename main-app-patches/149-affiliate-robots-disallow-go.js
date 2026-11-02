// Zabrani indexovaniu/crawlovaniu vlastnej /go/ redirect cesty (pridava ju
// patch 150) — Google nema dovod ju navstevovat, presmerovava rovno na
// externy affiliate odkaz.
const fs = require('fs');
const FILE = 'public/robots.txt';

const LOCK = FILE + '.149-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK subor (' + LOCK + ') existuje. Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('Disallow: /go/')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, () => newStr);
}

const patched = replaceOnce(src,
  'Disallow: /app?\n',
  'Disallow: /app?\nDisallow: /go/\n',
  '1: Disallow /go/');

const backup = FILE + '.pre-robots-disallow-go-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
