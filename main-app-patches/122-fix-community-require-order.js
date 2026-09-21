// KRITICKÁ OPRAVA: main-app-patches/118 zapojilo routes/community.js hneď
// na začiatku server.js (require('./routes/community')(app) — rovnaká
// pozícia ako maintenanceMode/autoseoWebhook), ĎALEKO PRED
// app.use(express.json(...)), ktoré sa registruje až na konci konfigurácie
// (za Stripe webhookom, ktorý potrebuje surové telo). Express spracováva
// middleware/routy v poradí registrácie — takže KAŽDÝ JSON-body request na
// ktorýkoľvek endpoint v routes/community.js (PUT profil, POST komentár,
// POST DM správa, POST nahlásenie) narazil na svoj handler ešte predtým,
// než sa telo requestu vôbec naparsovalo. req.body bolo vždy prázdne —
// preto sa zmeny profilu nikdy neuložili, hoci endpoint vrátil 200 OK.
// Endpointy cez multipart/form-data (nahrávanie obrázkov cez multer) tým
// postihnuté neboli, lebo multer parsuje telo samostatne, nie cez tento
// globálny middleware — preto sa javili ako funkčné.
//
// Táto oprava presúva require('./routes/community')(app) AŽ ZA
// app.use(express.json(...)), aby JSON telá boli naparsované skôr, než
// community routy dostanú request.
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.122-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK zo zlyhaneho behu (' + LOCK + ' existuje). Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const OLD_TOP = `const app = express();
require('./routes/maintenanceMode')(app);
require('./routes/autoseoWebhook')(app);
require('./routes/community')(app);`;
const NEW_TOP = `const app = express();
require('./routes/maintenanceMode')(app);
require('./routes/autoseoWebhook')(app);`;

const OLD_JSON = `app.use(express.json({ limit: '20kb' }));`;
const NEW_JSON = `app.use(express.json({ limit: '20kb' }));
require('./routes/community')(app);`;

if (!src.includes(OLD_TOP)) {
  console.error('Uz je aplikovane (require community uz nie je na povodnom mieste), nic som nezmenil.');
  process.exit(1);
}

let patched = src;
patched = replaceOnce(patched, OLD_TOP, NEW_TOP, '1: odstranit require community z vrchu');
patched = replaceOnce(patched, OLD_JSON, NEW_JSON, '2: pridat require community za express.json()');

const backup = FILE + '.pre-fix-community-require-order-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
