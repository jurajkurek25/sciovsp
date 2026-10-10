const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

const OLD = `.course-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.1rem;margin-top:1.6rem}`;
const NEW = `.course-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.1rem;margin-top:1.6rem;justify-content:center}`;

if (src.includes(NEW)) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}
if (!src.includes(OLD)) { console.error('Nenasiel som .course-grid kotvu. Nic som nezmenil.'); process.exit(1); }

const patched = src.replace(OLD, NEW);

const backup = FILE + '.pre-center-kurzy-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
