// Bezpečnostná oprava: dash-service nemal žiadny globálny error handler
// (err, req, res, next) -- bez neho Express pri neošetrenej výnimke padá
// na svoj vlastný default error handler, ktorý vie vypísať celý stack
// trace (cesty k súborom, mená funkcií) priamo do HTTP odpovede.
//
// Musí byť registrovaný AKO POSLEDNÝ middleware -- preto ide hneď po už
// nasadenom 404 catch-all (dash-service/patches/24).
//
// Spusti z koreňa dash-service:
//   node patches/25-global-error-handler.js
// Potom: pm2 restart dash-service

const fs = require('fs');
const FILE = require('path').join(process.cwd(), 'server.js');
if (!fs.existsSync(FILE)) { console.error('❌ Nenašiel som server.js — spusti z koreňa dash-service.'); process.exit(1); }
let src = fs.readFileSync(FILE, 'utf8');

if (src.includes('err, req, res, next')) {
  console.log('ℹ️  Už je aplikované, preskakujem.');
  process.exit(0);
}

const OLD = `app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

const PORT = process.env.DASH_PORT || 4000;`;

const NEW = `app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

// Bez tohto Express padá pri neošetrenej výnimke na svoj vlastný default
// error handler, ktorý vie vypísať celý stack trace do odpovede. Musí
// byť POSLEDNÝ middleware -- presne 4 parametre (err, ...) je pre
// Express signál, že ide o error handler.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Interná chyba servera.' });
});

const PORT = process.env.DASH_PORT || 4000;`;

const count = src.split(OLD).length - 1;
if (count !== 1) { console.error('❌ Kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil. Over, že patches/24 je už nasadený, a pošli mi aktuálny obsah.'); process.exit(1); }

src = src.replace(OLD, () => NEW);

const backup = FILE + '.pre-25-global-error-handler-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);
console.log('✅ server.js prepísaný (globálny error handler pridaný, žiadne stack traces navyše). Záloha:', backup);
console.log('');
console.log('Over: node -c server.js');
console.log('Reštart: pm2 restart dash-service');
