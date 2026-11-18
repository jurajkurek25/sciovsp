const fs = require('fs');
const FILE = 'public/app.html';
const src = fs.readFileSync(FILE, 'utf8');

const OLD = `<div style="font-family:var(--serif);font-size:1.4rem;color:var(--text);margin:1.8rem 0 .9rem;">🎓 Moje kurzy</div>`;
const NEW = `<h2 style="font-family:var(--serif);font-size:1.4rem;font-weight:400;color:var(--text);margin:1.8rem 0 .9rem;">🎓 Moje kurzy</h2>`;

const count = src.split(OLD).length - 1;
if (count === 0) {
  if (src.includes(NEW)) { console.error('Uz je aplikovane, nic som nezmenil.'); process.exit(1); }
  console.error('Nenasiel som kotvu. Nic som nezmenil.');
  process.exit(1);
}

const patched = src.split(OLD).join(NEW);

const backup = FILE + '.pre-my-courses-h2-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup, '- nahradenych:', count);
