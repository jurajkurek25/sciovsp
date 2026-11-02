// WebGazer v3 (SP Generálka, public/generalka.html) používa MediaPipe
// FaceMesh ako jediný podporovaný face-tracker. Ten si interne dotahuje
// ďalšie WASM/JS súbory (napr. face_mesh_solution_packed_assets_loader.js,
// face_mesh_solution_simd_wasm_bin.js/.wasm) z RELATÍVNEJ cesty na vlastnej
// doméne (/mediapipe/face_mesh/...), nie z CDN, kde je nahraný samotný
// webgazer.min.js. Tie súbory u nás neexistujú, takže padli na SPA fallback
// (index.html) -> prehliadač ich odmietol pre nesprávny MIME typ ->
// webgazer.begin() sa nikdy nedokončil. Riešenie: presmerovať tieto
// konkrétne requesty na jsdelivr, ktorý je aj tak už v CSP script-src
// whiteliste (odtiaľ sa načítava aj samotný webgazer.min.js).
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.124-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK zo zlyhaneho behu (' + LOCK + ' existuje). Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("/mediapipe/face_mesh/")) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const OLD = `app.get('/generalka', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'generalka.html')); });`;
const NEW = `app.get('/generalka', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'generalka.html')); });

app.get('/mediapipe/face_mesh/*', (req, res) => {
  res.redirect(302, 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/' + req.params[0]);
});`;

const patched = replaceOnce(src, OLD, NEW, '1: /mediapipe/face_mesh presmerovanie na jsdelivr');

const backup = FILE + '.pre-mediapipe-redirect-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
