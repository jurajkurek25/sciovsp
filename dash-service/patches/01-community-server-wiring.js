// Zapojí dash-service/routes/community.js (moderácia komunity — mazanie
// príspevkov/komentárov, blokovanie, manuálne udelenie/odobratie prístupu)
// rovnakým vzorom ako ostatné routes/*.js moduly. Spúšťať z koreňa
// dash-service (rovnaký adresár ako server.js).
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.01-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK zo zlyhaneho behu (' + LOCK + ' existuje). Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("require('./routes/community')")) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const OLD = `app.use(require('./routes/reviews'));`;
const NEW = `app.use(require('./routes/reviews'));
app.use(require('./routes/community'));`;

const patched = replaceOnce(src, OLD, NEW, '1: require routes/community');

const backup = FILE + '.pre-community-wiring-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
