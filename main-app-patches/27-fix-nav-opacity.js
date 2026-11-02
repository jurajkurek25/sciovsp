const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

const OLD = `nav{position:sticky;top:0;z-index:100;padding:1rem clamp(1rem,4vw,2rem);padding-top:calc(1rem + env(safe-area-inset-top));display:flex;justify-content:space-between;align-items:center;gap:.75rem;flex-wrap:wrap;background:rgba(8,8,13,.9);backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}`;
const NEW = `nav{position:sticky;top:0;z-index:100;padding:1rem clamp(1rem,4vw,2rem);padding-top:calc(1rem + env(safe-area-inset-top));display:flex;justify-content:space-between;align-items:center;gap:.75rem;flex-wrap:wrap;background:var(--black);border-bottom:1px solid var(--border)}`;

if (src.includes(NEW)) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}
if (!src.includes(OLD)) { console.error('Nenasiel som nav kotvu. Nic som nezmenil.'); process.exit(1); }

const patched = src.replace(OLD, NEW);

const backup = FILE + '.pre-fix-nav-opacity-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
