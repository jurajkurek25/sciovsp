// Bezpečnostná oprava: v produkcii NEEXISTOVAL žiadny globálny error
// handler (err, req, res, next) -- git verzia ho mala, ale nikdy sa to
// nedostalo do produkcie. Bez neho Express pri neošetrenej výnimke padá
// na svoj VLASTNÝ default error handler, ktorý pri NODE_ENV !=
// 'production' vypíše CELÝ stack trace (cesty k súborom, mená funkcií,
// verziu knižníc) priamo do HTML odpovede -- presne to scanner nahlásil
// ako "Default server error pages detected".
//
// Musí byť registrovaný AKO POSLEDNÝ middleware (Express pozná error
// handler podľa presne 4 parametrov (err, req, res, next)) -- preto ide
// hneď pred app.listen, po už nasadenom 404 catch-all (main-app-patches/
// 238).
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/239-global-error-handler.js
// Potom: pm2 restart <meno procesu hlavnej appky>

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som server.js — spusti z koreňa hlavnej appky.');
  process.exit(1);
}
let src = fs.readFileSync(SERVER_PATH, 'utf8');

if (src.includes('err, req, res, next')) {
  console.log('ℹ️  Už je aplikované, preskakujem.');
  process.exit(0);
}

const OLD = `app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

app.listen(PORT, () => {`;

const NEW = `app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

// Bez tohto Express padá pri neošetrenej výnimke na svoj vlastný default
// error handler, ktorý vie vypísať celý stack trace do odpovede. Musí
// byť POSLEDNÝ middleware -- presne 4 parametre (err, ...) je pre
// Express signál, že ide o error handler.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Interná chyba servera.' });
});

app.listen(PORT, () => {`;

const count = src.split(OLD).length - 1;
if (count !== 1) { console.error('❌ Kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil. Over, že main-app-patches/238 je už nasadený, a pošli mi aktuálny obsah.'); process.exit(1); }

src = src.replace(OLD, () => NEW);

const backup = SERVER_PATH + '.pre-239-global-error-handler-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, src);
console.log('✅ server.js prepísaný (globálny error handler pridaný, žiadne stack traces navyše). Záloha:', backup);
console.log('');
console.log('Over: node -c server.js');
console.log('Reštart: pm2 restart <meno procesu hlavnej appky>');
