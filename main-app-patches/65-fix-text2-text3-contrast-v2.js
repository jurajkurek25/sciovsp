const fs = require('fs');
const FILE = 'public/index.html';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('--text2:#7c7ca6')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const patched = replaceOnce(src,
  '--text:#eeeef5;--text2:#7777a0;--text3:#7474af;',
  '--text:#eeeef5;--text2:#7c7ca6;--text3:#7979b6;',
  '--text2/--text3 variable definitions');

const backup = FILE + '.pre-fix-text2-text3-contrast-v2-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
