const fs = require('fs');
const FILE = 'public/index.html';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('href="https://neoworkly.com"')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

const OLD = `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`;
const NEW = `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="preconnect" href="https://neoworkly.com">`;

const count = src.split(OLD).length - 1;
if (count !== 1) {
  console.error(`Kotva nie je jednoznacna (najdenych: ${count}). Nic som nezmenil.`);
  process.exit(1);
}

const patched = src.replace(OLD, NEW);

const backup = FILE + '.pre-preconnect-neoworkly-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('Preconnect na neoworkly.com pridany.');
