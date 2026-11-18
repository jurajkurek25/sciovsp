// Bezpečnostná oprava: scanner nahlásil X-Powered-By (odhaľuje Express) a
// default error pages (odhaľujú framework). Riešenie:
// 1) app.disable('x-powered-by') -- helmet to síce skúša odstrániť, ale
//    Express si ho vie znova nastaviť pri res.send()/res.json() PO tom,
//    čo helmet už doběhol -- disable() je jediný spoľahlivý spôsob.
// 2) Univerzálny 404 na konci pre VŠETKY metódy -- doteraz existujúci
//    app.get('/{*splat}', ...) chytá len GET; POST/PUT/DELETE na
//    nezhodnú cestu by inak dostalo Express-ovu vlastnú "Cannot POST
//    /xyz" stránku, ktorá priamo odhaľuje framework.
//
// Spusti z koreňa dash-service:
//   node patches/24-hide-framework-fingerprint.js
// Potom: pm2 restart dash-service

const fs = require('fs');
const FILE = require('path').join(process.cwd(), 'server.js');
if (!fs.existsSync(FILE)) { console.error('❌ Nenašiel som server.js — spusti z koreňa dash-service.'); process.exit(1); }
let src = fs.readFileSync(FILE, 'utf8');

if (src.includes("x-powered-by")) {
  console.log('ℹ️  Už je aplikované, preskakujem.');
  process.exit(0);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error('❌ ' + label + ' kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, () => newStr);
}

const TOP_OLD = `const app = express();
// Jediná služba so superadmin session (dash_session cookie) nemala VÔBEC`;
const TOP_NEW = `const app = express();
// Express by defaultu posiela X-Powered-By: Express pri res.send()/
// res.json() AJ KEĎ helmet beží skôr -- disable() je jediný spoľahlivý
// spôsob, ako to úplne vypnúť (helmet.hidePoweredBy sa s tým nestíha
// pretekať).
app.disable('x-powered-by');
// Jediná služba so superadmin session (dash_session cookie) nemala VÔBEC`;
src = replaceOnce(src, TOP_OLD, TOP_NEW, 'x-powered-by disable');

const TAIL_OLD = `app.use(express.static(path.join(__dirname, 'public')));
app.get('/{*splat}', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found.' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});`;
const TAIL_NEW = `app.use(express.static(path.join(__dirname, 'public')));
app.get('/{*splat}', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found.' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
// Čokoľvek, čo sem dorazí (iná HTTP metóda než GET na neexistujúcu
// cestu), by inak dostalo Express-ovu vlastnú default 404 stránku
// ("Cannot POST /xyz"), ktorá odhaľuje použitý framework.
app.use((req, res) => res.status(404).json({ error: 'Not found.' }));`;
src = replaceOnce(src, TAIL_OLD, TAIL_NEW, 'catch-all 404');

const backup = FILE + '.pre-24-hide-framework-fingerprint-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);
console.log('✅ server.js prepísaný (X-Powered-By vypnutý, univerzálny 404 handler pridaný). Záloha:', backup);
console.log('');
console.log('Over: node -c server.js');
console.log('Reštart: pm2 restart dash-service');
