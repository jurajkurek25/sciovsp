const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("app.get('/vanoce'")) {
  console.error('Uz je aplikovane (najdene /vanoce route), nic som nezmenil.');
  process.exit(1);
}

const ANCHOR = `app.get('/vianoce', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'vianoce.html')); });`;

const count = src.split(ANCHOR).length - 1;
if (count !== 1) {
  console.error(`ABORT: anchor occurs ${count} times (expected 1). No changes made.`);
  process.exit(1);
}

const NEW = ANCHOR + `
app.get('/vanoce', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'vianoce.html')); });`;

const backup = FILE + '.pre-vanoce-alias-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src.split(ANCHOR).join(NEW));
console.log('OK - zaloha:', backup);
