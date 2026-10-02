// Prida pole "min. vek uctu v dnoch" do formulara kampane (patch 07) — novy
// pouzivatel nema hned po registracii dostat affiliate kampan. Vyzaduje uz
// nahraty routes/affiliate-campaigns.js s podporou minAccountAgeDays.
const fs = require('fs');
const FILE = 'public/index.html';

const LOCK = FILE + '.08-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK zo zlyhaneho behu (' + LOCK + ' existuje). Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('ac-min-age')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, () => newStr);
}

let patched = src;

// -- 1) HTML: nove pole vo formulari --
patched = replaceOnce(patched,
  `<input class="ac-lookback" type="number" placeholder="Lookback dní (predvolené 30)" style="width:180px">`,
  `<input class="ac-lookback" type="number" placeholder="Lookback dní (predvolené 30)" style="width:180px">\n        <input class="ac-min-age" type="number" placeholder="Min. vek účtu v dňoch (predvolené 14)" style="width:220px">`,
  '1: min-age input field');

// -- 2) JS: pridat do POST body pri vytvarani kampane --
patched = replaceOnce(patched,
  `lookbackDays: $('.ac-lookback').value,\n        subjectHint: $('.ac-hint').value`,
  `lookbackDays: $('.ac-lookback').value,\n        minAccountAgeDays: $('.ac-min-age').value,\n        subjectHint: $('.ac-hint').value`,
  '2: minAccountAgeDays in create payload');

const backup = FILE + '.pre-affiliate-campaigns-min-age-ui-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
