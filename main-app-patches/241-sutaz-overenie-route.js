// Registruje stránku /sutaz-overenie (verejné overenie žrebovania súťaže,
// commit-reveal). Rovnaký vzor ako main-app-patches/240-sutaz-route-registration.js
// -- statická stránka cez app.get PRED SPA fallbackom. Žiadne nové API
// netreba registrovať (GET /api/sutaz/draw-proof pribudlo priamo do
// routes/sutaz.js, ktorý je už zaregistrovaný od patchu 240).
//
// Vyžaduje najprv:
//   - db/migrate_sutaz_draw_commitment.sql (vytvorí tabuľku sutaz_draw_commitment)
//   - verejný súbor public/sutaz-overenie.html na disku
//   - aktuálny routes/sutaz.js (s GET /api/sutaz/draw-proof)
//   - patch 240 už musí byť aplikovaný (anchor nižšie na jeho výstup)
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/241-sutaz-overenie-route.js
// Potom: pm2 restart <meno procesu hlavnej appky>

const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.241-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK zo zlyhaneho behu (' + LOCK + ' existuje). Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

let src = fs.readFileSync(FILE, 'utf8');

if (src.includes("app.get('/sutaz-overenie'")) {
  console.error('Uz je aplikovane (najdene /sutaz-overenie route), nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error('❌ ' + label + ' kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil. Pošli mi aktuálny obsah, over.'); process.exit(1); }
  return s.replace(oldStr, () => newStr);
}

const ANCHOR = `app.get('/sutaz', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'sutaz.html')); });`;
src = replaceOnce(src, ANCHOR,
  ANCHOR + `
app.get('/sutaz-overenie', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'sutaz-overenie.html')); });`,
  '/sutaz route (anchor pre /sutaz-overenie)');

const backup = FILE + '.pre-241-sutaz-overenie-route-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);
console.log('✅ server.js prepísaný (/sutaz-overenie stránka zaregistrovaná). Záloha:', backup);
console.log('');
console.log('Over: node -c server.js');
console.log('Reštart: pm2 restart <meno procesu hlavnej appky>');
