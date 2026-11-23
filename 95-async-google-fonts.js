const fs = require('fs');
const FILE = 'public/index.html';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("media=\"print\" onload=\"this.media='all'\"")) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

const FONT_URL = 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Mono:wght@300;400;500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700&display=swap';

const OLD = `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link href="${FONT_URL}" rel="stylesheet">`;
const NEW = `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="${FONT_URL}" media="print" onload="this.media='all'">\n<noscript><link rel="stylesheet" href="${FONT_URL}"></noscript>`;

const count = src.split(OLD).length - 1;
if (count !== 1) {
  console.error(`Kotva Google Fonts nie je jednoznacna (najdenych: ${count}). Nic som nezmenil.`);
  process.exit(1);
}

const patched = src.replace(OLD, NEW);

const backup = FILE + '.pre-async-fonts-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('Google Fonts CSS uz neblokuje vykreslenie (media=print + onload swap).');
