// Prepína CSP z Report-Only na vynucujúcu -- Juraj sa rozhodol prepnúť rovno,
// bez čakania na click-through overenie. Zoznam domén (len fonts.googleapis.com/
// gstatic.com, žiadne CDN skripty) bol overený proti VŠETKÝM externým zdrojom
// v public/*.html pred nasadením 50-security-headers.js. Rýchly rollback: vráť
// 'Content-Security-Policy' späť na 'Content-Security-Policy-Report-Only'
// (viď git história tohto súboru / zálohy z 50-security-headers.js).
//
// Vyžaduje, aby bol už aplikovaný 50-security-headers.js (musí existovať
// 'Content-Security-Policy-Report-Only' v server.js).
//
// Spusti z koreňa tejto appky:
//   node 51-csp-enforce.js
// Potom: pm2 restart sptrener-ads

const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.51-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK zo zlyhaneho behu (' + LOCK + ' existuje). Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

let src = fs.readFileSync(FILE, 'utf8');

if (!src.includes("'Content-Security-Policy-Report-Only'")) {
  console.error('Nenajdena Content-Security-Policy-Report-Only hlavicka -- bud uz je prepnuta na vynucujucu, alebo 50-security-headers.js este nebol aplikovany. Nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error('❌ ' + label + ' kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, () => newStr);
}

src = replaceOnce(
  src,
  "res.setHeader('Content-Security-Policy-Report-Only', [",
  "res.setHeader('Content-Security-Policy', [",
  '1: CSP Report-Only -> enforcing'
);

const backup = FILE + '.pre-51-csp-enforce-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);
console.log('✅ CSP prepnutá na vynucujúcu. Záloha:', backup);
console.log('');
console.log('Over: node -c server.js');
console.log('Reštart: pm2 restart sptrener-ads');
