const fs = require('fs');
const FILE = 'public/app.html';
const src = fs.readFileSync(FILE, 'utf8');

const OLD = `.mode-card{background:var(--black2);padding:1.75rem;cursor:pointer;transition:background .2s;position:relative;overflow:hidden}`;
const NEW = `.mode-card{background:var(--black2);padding:1.75rem;cursor:pointer;transition:background .2s;position:relative;overflow:hidden;display:block;text-decoration:none;color:inherit}`;

if (src.includes(NEW)) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}
if (!src.includes(OLD)) { console.error('Nenasiel som .mode-card kotvu. Nic som nezmenil.'); process.exit(1); }

const patched = src.replace(OLD, NEW);

const backup = FILE + '.pre-fix-mode-card-link-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
