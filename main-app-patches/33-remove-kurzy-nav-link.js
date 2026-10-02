const fs = require('fs');
const FILE = 'public/index.html';
const src = fs.readFileSync(FILE, 'utf8');

const OLD = `    <a href="/blog" class="nav-link">Blog</a>
    <a href="/kurzy" class="nav-link">Kurzy</a>
    <div class="lang-switcher">`;
const NEW = `    <a href="/blog" class="nav-link">Blog</a>
    <div class="lang-switcher">`;

if (!src.includes(OLD)) {
  if (src.includes(NEW) && !src.includes('href="/kurzy" class="nav-link"')) {
    console.error('Uz je aplikovane, nic som nezmenil.');
    process.exit(1);
  }
  console.error('Nenasiel som presnu kotvu pre Kurzy nav-link. Nic som nezmenil.');
  process.exit(1);
}

const patched = src.replace(OLD, NEW);

const backup = FILE + '.pre-remove-kurzy-nav-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
