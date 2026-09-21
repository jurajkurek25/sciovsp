// Point 8 z konverzácie: texty v UI musia zodpovedať skutočnosti. Po
// main-app-patches/114/116 už akciová cena NIE JE viazaná na
// zariadenie/prehliadač (cookie/localStorage) — je viazaná na prihlásený
// Google účet a funguje z ktoréhokoľvek zariadenia. Tieto dva emaily ešte
// tvrdia opak — opravuje sa na presnejšiu (a užitočnejšiu) informáciu.
const fs = require('fs');

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const OLD_LINE = '      Otvor to na rovnakom zariadení/prehliadači, kde si sa registroval/a na webinár — akciová cena je naň naviazaná.';
const NEW_LINE = '      Otvor to prihlásený/á rovnakým Google účtom, cez ktorý si sa registroval/a na webinár — akciová cena je naň naviazaná (funguje z akéhokoľvek zariadenia).';

for (const FILE of ['emails/4-po-webinari-ponuka.html', 'emails/5-ponuka-pripomienka.html']) {
  const src = fs.readFileSync(FILE, 'utf8');
  if (!src.includes(OLD_LINE)) {
    console.error(FILE + ': povodny riadok nenajdeny (uz aplikovane alebo iny text). Nic som pre tento subor nezmenil.');
    continue;
  }
  const patched = replaceOnce(src, OLD_LINE, NEW_LINE, FILE);
  const backup = FILE + '.pre-device-copy-fix-' + Date.now();
  fs.copyFileSync(FILE, backup);
  fs.writeFileSync(FILE, patched);
  console.log('OK -', FILE, '- zaloha:', backup);
}
