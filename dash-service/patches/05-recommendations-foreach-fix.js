// Opravuje bug z patchu 04: String.replace() interpretoval "$$" v
// nahrádzanom retazci ako specialny escape pre literal "$", takze
// $$('.rc-toggle').forEach a $$('.rc-delete').forEach skoncili v live
// subore ako $('.rc-toggle').forEach / $('.rc-delete').forEach -- $(...)
// vrati jeden DOM element, nie pole, takze .forEach zlyhava s chybou
// "$(...).forEach is not a function". Tento patch to doplna spat na $$.
const fs = require('fs');
const FILE = 'public/index.html';

const LOCK = FILE + '.05-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK zo zlyhaneho behu (' + LOCK + ' existuje). Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (!src.includes('renderRecommendations')) {
  console.error('renderRecommendations sa v subore nenasiel -- patch 04 este nebezal? Nic som nezmenil.');
  process.exit(1);
}

if (src.includes("$$('.rc-toggle').forEach") && src.includes("$$('.rc-delete').forEach")) {
  console.error('Uz je opravene, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, () => newStr);
}

let patched = src;
patched = replaceOnce(patched, "$('.rc-toggle').forEach(btn => btn.onclick = async () => {", "$$('.rc-toggle').forEach(btn => btn.onclick = async () => {", '1: rc-toggle forEach');
patched = replaceOnce(patched, "$('.rc-delete').forEach(btn => btn.onclick = async () => {", "$$('.rc-delete').forEach(btn => btn.onclick = async () => {", '2: rc-delete forEach');

const backup = FILE + '.pre-recommendations-foreach-fix-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
