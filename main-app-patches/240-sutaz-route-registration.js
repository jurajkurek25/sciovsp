// Registruje stránku /sutaz (súťaž o darčekové poukážky Martinus) a jej
// API (routes/sutaz.js). Rovnaký vzor ako main-app-patches/119-komunita-route.js
// (statická stránka cez app.get pred SPA fallbackom) + main-app-patches/
// 123-generalka-checkout-webhook.js (require('./routes/X')(app) AŽ ZA
// express.json(), inak by sa POST telá neparsovali -- presne tento bug
// postihol routes/community.js, pozri patch 122).
//
// Vyžaduje najprv:
//   - db/migrate_sutaz_applications.sql (vytvorí tabuľku + privátny
//     storage bucket "sutaz-admission-docs")
//   - verejné súbory: public/sutaz.html, routes/sutaz.js,
//     config/sutazConfig.js, emails/sutaz-prihlaska-prijata.html
//     (git pull/deploy ich musí mať na disku skôr, než tento patch
//     pridá ich require())
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/240-sutaz-route-registration.js
// Potom: pm2 restart <meno procesu hlavnej appky>

const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.240-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK zo zlyhaneho behu (' + LOCK + ' existuje). Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

let src = fs.readFileSync(FILE, 'utf8');

if (src.includes("app.get('/sutaz'")) {
  console.error('Uz je aplikovane (najdene /sutaz route), nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error('❌ ' + label + ' kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil. Pošli mi aktuálny obsah, over.'); process.exit(1); }
  return s.replace(oldStr, () => newStr);
}

// ── 1) Statická stránka /sutaz, pred SPA fallbackom ──────────────────────
const SPA_MARKER = `// ── SPA fallback (všetky ostatné routes → index) ─────────────
app.get('*', (req, res) => {`;
src = replaceOnce(src, SPA_MARKER,
  `app.get('/sutaz', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'sutaz.html')); });

` + SPA_MARKER,
  'SPA fallback (/sutaz route)');

// ── 2) API router, AŽ ZA express.json() ──────────────────────────────────
const JSON_MARKER = `app.use(express.json({ limit: '20kb' }));
require('./routes/community')(app);
require('./routes/generalka')(app);`;
src = replaceOnce(src, JSON_MARKER,
  JSON_MARKER + `
require('./routes/sutaz')(app);`,
  'express.json require block (routes/sutaz.js wiring)');

const backup = FILE + '.pre-240-sutaz-route-registration-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);
console.log('✅ server.js prepísaný (/sutaz stránka + API zaregistrované). Záloha:', backup);
console.log('');
console.log('Over: node -c server.js');
console.log('Reštart: pm2 restart <meno procesu hlavnej appky>');
