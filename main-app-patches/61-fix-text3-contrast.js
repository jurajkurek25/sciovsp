const fs = require('fs');
const FILE = 'public/index.html';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('--text3:#7474af')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const patched = replaceOnce(src,
  '--text:#eeeef5;--text2:#7777a0;--text3:#3d3d5c;',
  '--text:#eeeef5;--text2:#7777a0;--text3:#7474af;',
  '--text3 variable definition');

const backup = FILE + '.pre-fix-text3-contrast-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
