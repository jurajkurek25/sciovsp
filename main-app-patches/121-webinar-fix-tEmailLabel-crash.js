// main-app-patches/115 replaced the email <input> with Google-login
// buttons but left one leftover line in setLang() that still tries to
// set textContent on #tEmailLabel — an element that no longer exists in
// the HTML (only its label counterpart #tNameLabel remains). That throws
// a TypeError the moment setLang() runs, which silently kills every
// statement after it in the same function — including the one that
// renders the next session date into #nextSessionDate. Confirmed live:
// the date stayed stuck at its "—" placeholder.
const fs = require('fs');
const FILE = 'public/webinar.html';

const LOCK = FILE + '.121-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK zo zlyhaneho behu (' + LOCK + ' existuje). Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const OLD = `  document.getElementById('tNameLabel').textContent = t('nameLabel');
  document.getElementById('tEmailLabel').textContent = t('emailLabel');
`;
const NEW = `  document.getElementById('tNameLabel').textContent = t('nameLabel');
`;

const patched = replaceOnce(src, OLD, NEW, '1: odstranit crash na neexistujucom tEmailLabel');

const backup = FILE + '.pre-tEmailLabel-crash-fix-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
