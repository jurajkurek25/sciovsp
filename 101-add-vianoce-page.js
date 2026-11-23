const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("app.get('/vianoce'")) {
  console.error('Uz je aplikovane (najdene /vianoce route), nic som nezmenil.');
  process.exit(1);
}

const ANCHOR = `app.get('/darek', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'darek.html')); });
app.get('/darcek', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'darek.html')); });`;

const count = src.split(ANCHOR).length - 1;
if (count !== 1) {
  console.error(`ABORT: anchor occurs ${count} times (expected 1). No changes made.`);
  process.exit(1);
}

const NEW = ANCHOR + `
app.get('/vianoce', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'vianoce.html')); });`;

const backup = FILE + '.pre-vianoce-route-' + Date.now();
fs.copyFileSync(FILE, backup);
const patched = src.split(ANCHOR).join(NEW);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
