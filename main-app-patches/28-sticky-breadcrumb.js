const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

const OLD = `.breadcrumb{font-family:var(--mono);font-size:.72rem;color:var(--text3);margin-bottom:1.5rem;display:flex;gap:.4rem;flex-wrap:wrap}`;
const NEW = `.breadcrumb{font-family:var(--mono);font-size:.72rem;color:var(--text3);margin-bottom:1.5rem;display:flex;gap:.4rem;flex-wrap:wrap;position:sticky;top:64px;z-index:99;background:var(--black);padding:.6rem 0}`;

if (src.includes(NEW)) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}
if (!src.includes(OLD)) { console.error('Nenasiel som .breadcrumb kotvu. Nic som nezmenil.'); process.exit(1); }

const patched = src.replace(OLD, NEW);

const backup = FILE + '.pre-sticky-breadcrumb-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
