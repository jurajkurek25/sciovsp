// Zapojí dash-service/routes/recommendations.js (Odporúčame — affiliate
// odkazy na verejnej /odporucame) rovnakým vzorom ako ostatné routes/*.js
// moduly. Spúšťať z koreňa dash-service (rovnaký adresár ako server.js).
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.03-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK zo zlyhaneho behu (' + LOCK + ' existuje). Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("require('./routes/recommendations')")) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const OLD = `app.use(require('./routes/community'));`;
const NEW = `app.use(require('./routes/community'));
app.use(require('./routes/recommendations'));`;

const patched = replaceOnce(src, OLD, NEW, '1: require routes/recommendations');

const backup = FILE + '.pre-recommendations-wiring-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
