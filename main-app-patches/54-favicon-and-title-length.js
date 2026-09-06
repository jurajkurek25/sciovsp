const fs = require('fs');
const FILE = 'public/index.html';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('rel="icon" href="/icons/icon-192.png"')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

let patched = src;

patched = replaceOnce(patched,
  '<title>SP Tréner – AI príprava na VŠP testy a prijímačky na VŠ | Percentil 85</title>',
  '<title>SP Tréner – AI príprava na VŠP testy a prijímačky na VŠ</title>',
  'title tag');

patched = replaceOnce(patched,
  '<link rel="canonical" href="https://sptrener.online/">',
  '<link rel="icon" href="/icons/icon-192.png" type="image/png">\n<link rel="apple-touch-icon" href="/icons/icon-192.png">\n<link rel="canonical" href="https://sptrener.online/">',
  'favicon link');

const backup = FILE + '.pre-favicon-title-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
