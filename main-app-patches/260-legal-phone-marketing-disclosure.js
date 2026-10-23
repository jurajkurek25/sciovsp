// legal.html (Spracúvanie osobných údajov, časť "Aké údaje spracúvame" a
// "Účely spracúvania") este nezmieňuje telefónne číslo (anti-abuse
// overenie, main-app-patches/187+253) ani marketingový súhlas/odber
// ponúk partnerov -- hoci sa oba reálne zbierajú. Dopĺňa transparentné
// zverejnenie v oboch jazykových verziách (SK statický HTML blok + SK a
// CZ JS i18n šablóny -- legal.html má privacy obsah 3x duplikovaný).
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/260-legal-phone-marketing-disclosure.js

const fs = require('fs');
const path = require('path');

const FILE = path.join(process.cwd(), 'public', 'legal.html');

if (!fs.existsSync(FILE)) {
  console.error('❌ Nenašiel som súbor:', FILE, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.260-legal-phone-marketing-disclosure-lock');
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

if (html.includes('zneužívania bezplatných testov')) {
  console.error('❌ legal.html: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// ── SK: "Aké údaje spracúvame" -- výskyt 2x (statický blok + priv2 i18n) ──
const SK_DATA_OLD = `            <li>obsah komunikácie s AI chatbotom zobrazeným na stránke,</li>
            <li>technické údaje, napríklad IP adresu, cookies a základné údaje o zariadení.</li>`;
const SK_DATA_NEW = `            <li>obsah komunikácie s AI chatbotom zobrazeným na stránke,</li>
            <li>telefónne číslo, ak si ho overil/a kvôli zamedzeniu zneužívania bezplatných testov cez viacero účtov,</li>
            <li>údaj o tvojom súhlase (alebo nesúhlase) s odberom odporúčaní a ponúk partnerov na email,</li>
            <li>technické údaje, napríklad IP adresu, cookies a základné údaje o zariadení.</li>`;
html = replaceExactCount(html, SK_DATA_OLD, SK_DATA_NEW, 2, 'SK "Aké údaje spracúvame"');

// ── SK: "Účely spracúvania" -- výskyt 2x ──
const SK_PURPOSE_OLD = `            <li>zlepšovanie funkčnosti, bezpečnosti a kvality služby,</li>
            <li>plnenie zákonných povinností.</li>`;
const SK_PURPOSE_NEW = `            <li>zlepšovanie funkčnosti, bezpečnosti a kvality služby,</li>
            <li>overenie telefónnym číslom na zamedzenie zneužívania bezplatných testov cez viacero účtov,</li>
            <li>zasielanie odporúčaní a ponúk partnerov tým, ktorí na to udelili súhlas,</li>
            <li>plnenie zákonných povinností.</li>`;
html = replaceExactCount(html, SK_PURPOSE_OLD, SK_PURPOSE_NEW, 2, 'SK "Účely spracúvania"');

// ── CZ: "Jaké údaje zpracováváme" -- výskyt 1x ──
const CZ_DATA_OLD = `            <li>obsah komunikace s AI chatbotem zobrazeným na stránce,</li>
            <li>technické údaje, například IP adresu, cookies a základní údaje o zařízení.</li>`;
const CZ_DATA_NEW = `            <li>obsah komunikace s AI chatbotem zobrazeným na stránce,</li>
            <li>telefonní číslo, pokud jsi ho ověřil/a kvůli zamezení zneužívání bezplatných testů přes více účtů,</li>
            <li>údaj o tvém souhlasu (nebo nesouhlasu) s odběrem doporučení a nabídek partnerů na e-mail,</li>
            <li>technické údaje, například IP adresu, cookies a základní údaje o zařízení.</li>`;
html = replaceExactCount(html, CZ_DATA_OLD, CZ_DATA_NEW, 1, 'CZ "Jaké údaje zpracováváme"');

// ── CZ: "Účely zpracování" -- výskyt 1x ──
const CZ_PURPOSE_OLD = `            <li>zlepšování funkčnosti, bezpečnosti a kvality služby,</li>
            <li>plnění zákonných povinností.</li>`;
const CZ_PURPOSE_NEW = `            <li>zlepšování funkčnosti, bezpečnosti a kvality služby,</li>
            <li>ověření telefonním číslem za účelem zamezení zneužívání bezplatných testů přes více účtů,</li>
            <li>zasílání doporučení a nabídek partnerů těm, kdo k tomu udělili souhlas,</li>
            <li>plnění zákonných povinností.</li>`;
html = replaceExactCount(html, CZ_PURPOSE_OLD, CZ_PURPOSE_NEW, 1, 'CZ "Účely zpracování"');

const backup = FILE + '.pre-260-legal-phone-marketing-disclosure-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, html);

console.log('✅ legal.html doplnený o telefónne číslo a marketingový súhlas (SK + CZ, 3 bloky).');
console.log('   Záloha:', backup);
console.log('   Statický súbor -- žiadny pm2 restart netreba.');
