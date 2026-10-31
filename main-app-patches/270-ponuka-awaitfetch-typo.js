// Preklep v ponuka.html — "awaitfetch" (chýbajúca medzera) namiesto
// "await fetch". Spôsobuje ReferenceError ("awaitfetch is not defined")
// všade, kde sa táto funkcia spustí — tichy pád bez viditeľnej chyby pre
// usera, len /api/webinar/offer-status sa nikdy nezavolá.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/270-ponuka-awaitfetch-typo.js
const fs = require('fs');
const path = require('path');

const FILE = path.join(process.cwd(), 'public', 'ponuka.html');

if (!fs.existsSync(FILE)) {
  console.error('❌ Nenašiel som súbor:', FILE, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.270-ponuka-awaitfetch-typo-lock');
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (' + LOCK + '). Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

function replaceExactCount(src, oldStr, newStr, expectedCount, label) {
  const count = src.split(oldStr).length - 1;
  if (count !== expectedCount) {
    console.error('❌ ' + label + ' — očakávaných ' + expectedCount + ' výskytov, nájdených ' + count + '. Nič som nezmenil.');
    process.exit(1);
  }
  return src.split(oldStr).join(newStr);
}

let html = fs.readFileSync(FILE, 'utf8');

const OLD = `  const res = awaitfetch('/api/webinar/offer-status', { headers });`;
const NEW = `  const res = await fetch('/api/webinar/offer-status', { headers });`;
html = replaceExactCount(html, OLD, NEW, 1, 'awaitfetch typo');

const backup = FILE + '.pre-270-ponuka-awaitfetch-typo-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, html);

console.log('✅ ponuka.html: "awaitfetch" opravené na "await fetch".');
console.log('   Záloha:', backup);
console.log('   Statický súbor — žiadny pm2 restart netreba.');
