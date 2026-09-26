// Opravný patch: predchádzajúca (staršia, jednostránková) verzia 79 sa už
// na live serveri stihla spustiť a pridala len app.get('/webinar', ...).
// Keď som neskôr 79 rozšíril o app.get('/webinar/live', ...), jej
// idempotentná kontrola (src.includes("app.get('/webinar'")) sa spustila
// skôr, než stihla pridať tú druhú routu — takže /webinar/live nikdy
// nevzniklo a padalo na SPA fallback (index.html). Tento patch pridá
// LEN tú chýbajúcu routu, bez ohľadu na to, čo už tam je.
const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("app.get('/webinar/live'")) {
  console.error('Uz je aplikovane (najdene /webinar/live route), nic som nezmenil.');
  process.exit(1);
}

const ANCHOR = `app.get('/webinar', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'webinar.html')); });`;
const anchorCount = src.split(ANCHOR).length - 1;
if (anchorCount !== 1) { console.error('Kotva /webinar nie je jednoznacna (najdenych: ' + anchorCount + '). Nic som nezmenil.'); process.exit(1); }

const NEW = ANCHOR + `
app.get('/webinar/live', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'webinar-live.html')); });`;

const patched = src.replace(ANCHOR, NEW);

const backup = FILE + '.pre-webinar-live-route-fix-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
