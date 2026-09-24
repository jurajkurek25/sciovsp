// Doplna do public/legal.html (sekcia "3. Ucely spracuvania" / "Purposes
// of processing") novu polozku: ze budeme posielat e-maily s
// odporucaniami/ponukami affiliate partnerov. Na 3 miesta (rovnaky text
// je na stranke duplikovany): staticke SK HTML (data-i18n="priv3"), JS
// objekt so SK prekladom (priv3 kluc) a JS objekt s CZ prekladom (priv3
// kluc), pouzite pri klientskom prepinani jazyka.
//
// Pouziva regex namiesto obycajneho string-matchu, lebo presne biele
// znaky/zalomenia medzi <li> polozkami v zive verzii suboru nie su
// stopercentne isté (skreslenie pri kopirovani cez terminal) — regex s
// \s* medzi znamymi presnymi kotvami (napr. "<li>plnenie zakonnych
// povinnosti.</li>" a nasledujucim data-i18n="priv4") je voci tomu
// odolny.
const fs = require('fs');
const FILE = 'public/legal.html';

const LOCK = FILE + '.155-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK subor (' + LOCK + ') existuje. Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('ponukami partnerov (affiliate)') || src.includes('nabídkami partnerů (affiliate)')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnceRegex(s, regex, buildNew, label) {
  const matches = s.match(new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g'));
  const count = matches ? matches.length : 0;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(regex, buildNew);
}

let patched = src;

// -- 1) staticke SK HTML (data-i18n="priv3") --
patched = replaceOnceRegex(patched,
  /<li>plnenie zákonných povinností\.<\/li>(\s*<\/ul>\s*<\/div>\s*<div class="legal-item" data-i18n="priv4">)/,
  (m, tail) => '<li>zasielanie e-mailov s odporúčaniami a ponukami partnerov (affiliate), vyberaných na základe tvojho používania služby,</li>\n            <li>plnenie zákonných povinností.</li>' + tail,
  '1: staticke SK HTML priv3');

// -- 2) JS objekt, SK preklad (priv3 kluc) --
patched = replaceOnceRegex(patched,
  /<li>plnenie zákonných povinností\.<\/li>(\s*<\/ul>`,\s*priv4:\s*`<h3>4\. Právny základ spracúvania<\/h3>)/,
  (m, tail) => '<li>zasielanie e-mailov s odporúčaniami a ponukami partnerov (affiliate), vyberaných na základe tvojho používania služby,</li><li>plnenie zákonných povinností.</li>' + tail,
  '2: JS objekt SK priv3');

// -- 3) JS objekt, CZ preklad (priv3 kluc) --
patched = replaceOnceRegex(patched,
  /<li>plnění zákonných povinností\.<\/li>(\s*<\/ul>`,\s*priv4:\s*`<h3>4\. Právní základ zpracování<\/h3>)/,
  (m, tail) => '<li>zasílání e-mailů s doporučeními a nabídkami partnerů (affiliate), vybíranými na základě tvého používání služby,</li><li>plnění zákonných povinností.</li>' + tail,
  '3: JS objekt CZ priv3');

const backup = FILE + '.pre-legal-affiliate-emails-disclosure-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
