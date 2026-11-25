const fs = require('fs');
const FILE = 'public/index.html';
const src = fs.readFileSync(FILE, 'utf8');

const OLD = `.popup-free-link{display:block;width:calc(100% - 4.5rem);margin:0 2.25rem 1.5rem;padding:.6rem;text-align:center;background:transparent;border:1px solid var(--border);border-radius:10px;color:var(--text3);font-size:.76rem;font-family:var(--mono);cursor:pointer;transition:all .2s}
.popup-free-link:hover{border-color:var(--border2);color:var(--text2)}`;
const NEW = `.popup-free-link{display:block;width:calc(100% - 4.5rem);margin:0 2.25rem 1.5rem;padding:.6rem;text-align:center;background:transparent;border:1px solid rgba(124,92,255,.4);border-radius:10px;color:var(--purple2);font-size:.76rem;font-family:var(--mono);cursor:pointer;transition:all .2s}
.popup-free-link:hover{border-color:var(--purple);color:#fff;background:rgba(124,92,255,.08)}`;

if (src.includes(NEW)) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}
if (!src.includes(OLD)) { console.error('Nenasiel som .popup-free-link kotvu. Nic som nezmenil.'); process.exit(1); }

const patched = src.replace(OLD, NEW);

const backup = FILE + '.pre-brighten-free-trial-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
