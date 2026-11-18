const fs = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) { console.error('USAGE: node 20-fix-route-order.js <path-to-server.js>'); process.exit(1); }

let src = fs.readFileSync(file, 'utf8');

const startMarker = "app.get('/darcekova-karta', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'darcekova-karta.html')); });";
const listenMarker = "app.listen(PORT, () => {";
const spaMarker = "// ── SPA fallback (všetky ostatné routes → index) ─────────────\napp.get('*', (req, res) => {";

const startIdx = src.indexOf(startMarker);
const spaIdx = src.indexOf(spaMarker);
const listenIdx = src.indexOf(listenMarker);

if (startIdx === -1 || spaIdx === -1 || listenIdx === -1) {
  console.error('MARKER_NOT_FOUND', { startIdx, spaIdx, listenIdx });
  process.exit(1);
}

if (startIdx < spaIdx) {
  console.log('ALREADY_FIXED');
  process.exit(0);
}

if (listenIdx <= startIdx) {
  console.error('BAD_ORDER: listen before start');
  process.exit(1);
}

let block = src.slice(startIdx, listenIdx).replace(/\s+$/, '');

let withoutBlock = src.slice(0, startIdx) + src.slice(listenIdx);

const newSpaIdx = withoutBlock.indexOf(spaMarker);
if (newSpaIdx === -1) { console.error('SPA_MARKER_LOST'); process.exit(1); }

const result = withoutBlock.slice(0, newSpaIdx) + block + '\n\n' + withoutBlock.slice(newSpaIdx);

fs.writeFileSync(file, result);
console.log('MOVED_OK');
