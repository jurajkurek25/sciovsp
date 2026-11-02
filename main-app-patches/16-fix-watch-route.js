const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("app.get('/kurzy/:slug/watch'")) {
  console.error('Uz existuje /kurzy/:slug/watch route, nic som nezmenil.');
  process.exit(1);
}

const OLD = `const SUBMISSION_MIME = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];`;
const NEW = `app.get('/kurzy/:slug/watch', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'kurz-watch.html'));
});

const SUBMISSION_MIME = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];`;
if (!src.includes(OLD)) { console.error('Nenasiel som SUBMISSION_MIME kotvu. Nic som nezmenil.'); process.exit(1); }

const patched = src.replace(OLD, NEW);
const backup = FILE + '.pre-fix-watch-route-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
