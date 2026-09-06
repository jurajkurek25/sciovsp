const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("app.get('/darek'")) {
  console.error('Uz je aplikovane (najdene /darek route), nic som nezmenil.');
  process.exit(1);
}

const SPA_MARKER = `// ── SPA fallback (všetky ostatné routes → index) ─────────────
app.get('*', (req, res) => {`;
const markerCount = src.split(SPA_MARKER).length - 1;
if (markerCount !== 1) { console.error('SPA fallback kotva nie je jednoznacna (najdenych: ' + markerCount + '). Nic som nezmenil.'); process.exit(1); }

const NEW_ROUTES = `app.get('/darek', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'darek.html')); });
app.get('/darcek', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'darek.html')); });

` + SPA_MARKER;

const patched = src.replace(SPA_MARKER, NEW_ROUTES);

const backup = FILE + '.pre-darek-landing-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
