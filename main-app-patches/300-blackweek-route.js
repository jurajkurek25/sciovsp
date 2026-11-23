// Pridáva len pekné URL /blackweek -> public/blackweek.html. Appka už
// podporuje všetko ostatné potrebné pre túto kampaň (allow_promotion_codes
// na /api/stripe/checkout, deep-link /app?upgrade=premium|elite, ktorý po
// prihlásení rovno spustí checkout) -- žiadna ďalšia zmena v server.js
// nie je potrebná. Samotný popust rieši Stripe promo kód (main-app-patches/
// 301-blackweek2026-send.js), nie táto routa.
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/300-blackweek-route.js
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE.replace(/[\\/]/g, '-') + '.300-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (' + LOCK + '). Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

function replaceExactCount(s, oldStr, newStr, expectedCount, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== expectedCount) {
    console.error('❌ ' + label + ' — očakávaných ' + expectedCount + ' výskytov, nájdených ' + count + '. Nič som nezmenil.');
    process.exit(1);
  }
  return s.split(oldStr).join(newStr);
}

if (!fs.existsSync(FILE)) {
  console.error('❌ Nenašiel som súbor:', FILE, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

let src = fs.readFileSync(FILE, 'utf8');

if (src.includes("app.get('/blackweek'")) {
  console.error('❌ server.js: /blackweek routa už existuje, nič som nezmenil.');
  process.exit(1);
}

const OLD = `app.get('/ponuka', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'ponuka.html')); });`;
const NEW = `app.get('/ponuka', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'ponuka.html')); });
app.get('/blackweek', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'blackweek.html')); });`;

src = replaceExactCount(src, OLD, NEW, 1, '/blackweek routa');

const backup = FILE.replace(/[\\/]/g, '-') + '.pre-300-blackweek-route-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);

console.log('✅ server.js: /blackweek routa pridaná.');
console.log('   Záloha:', backup);
console.log('   pm2 restart sptrener-main');
