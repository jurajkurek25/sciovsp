// Registruje GET /webinar/dakujeme (ďakovná stránka + potvrdenie opt-inu
// po registrácii na webinár, medzikrok pred /webinar/live).
const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("app.get('/webinar/dakujeme'")) {
  console.error('Uz je aplikovane (najdene /webinar/dakujeme route), nic som nezmenil.');
  process.exit(1);
}

const ANCHOR = `app.get('/webinar/live', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'webinar-live.html')); });`;
const anchorCount = src.split(ANCHOR).length - 1;
if (anchorCount !== 1) { console.error('Kotva /webinar/live nie je jednoznacna (najdenych: ' + anchorCount + '). Nic som nezmenil.'); process.exit(1); }

const NEW = ANCHOR + `
app.get('/webinar/dakujeme', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'webinar-dakujeme.html')); });`;

const patched = src.replace(ANCHOR, NEW);

const backup = FILE + '.pre-webinar-dakujeme-route-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
