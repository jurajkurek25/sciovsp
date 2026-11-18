// Sprístupní public/odporucame.html na /odporucame — affiliate stránka
// s kategóriami produktov relevantných pre uchádzačov o VŠ (zatiaľ len
// školské batohy, BatohyZavazadla.cz cez ehub.cz). Vkladá routu PRIAMO
// pred SPA fallback (rovnaká zásada ako patch 91/120/126/128 — inak by
// ju Express nikdy nedosiahol).
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.135-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK subor (' + LOCK + ') existuje. Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("app.get('/odporucame'")) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

const ODPORUCAME_ROUTE = `app.get('/odporucame', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'odporucame.html'));
});

`;

const SPA_MARKER = `// ── SPA fallback (všetky ostatné routes → index) ─────────────
app.get('*', (req, res) => {`;

const spaCount = src.split(SPA_MARKER).length - 1;
if (spaCount !== 1) { console.error('SPA fallback kotva nie je jednoznacna (najdenych: ' + spaCount + '). Nic som nezmenil.'); process.exit(1); }
const patched = src.replace(SPA_MARKER, ODPORUCAME_ROUTE + SPA_MARKER);

const backup = FILE + '.pre-odporucame-route-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('Over, ze public/odporucame.html existuje.');
