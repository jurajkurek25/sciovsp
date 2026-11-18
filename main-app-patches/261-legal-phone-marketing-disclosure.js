// Nahrádza zlyhaný main-app-patches/260 (zlá kotva -- live legal.html už
// medzitým obsahovalo vetu o marketingových ponukách partnerov, inú než
// som čakal, takže kotva s "plnenie zákonných povinností" hneď za
// "zlepšovanie funkčnosti..." nesedela).
//
// Dopĺňa:
//  1) "Aké údaje spracúvame" / "Jaké údaje zpracováváme" -- telefónne
//     číslo (zatiaľ vôbec nespomenuté, overené naživo).
//  2) Existujúcu vetu o marketingových ponukách partnerov -- doplnená o
//     zmienku, že súhlas môže priniesť bonusový test (main-app-patches/259).
//  3) Novú vetu o účele telefónneho overenia (anti multi-account).
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/261-legal-phone-marketing-disclosure.js

const fs = require('fs');
const path = require('path');

const FILE = path.join(process.cwd(), 'public', 'legal.html');

if (!fs.existsSync(FILE)) {
  console.error('❌ Nenašiel som súbor:', FILE, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.261-legal-phone-marketing-disclosure-lock');
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
            <li>technické údaje, napríklad IP adresu, cookies a základné údaje o zariadení.</li>`;
html = replaceExactCount(html, SK_DATA_OLD, SK_DATA_NEW, 2, 'SK "Aké údaje spracúvame"');

// ── CZ: "Jaké údaje zpracováváme" -- výskyt 1x ──
const CZ_DATA_OLD = `            <li>obsah komunikace s AI chatbotem zobrazeným na stránce,</li>
            <li>technické údaje, například IP adresu, cookies a základní údaje o zařízení.</li>`;
const CZ_DATA_NEW = `            <li>obsah komunikace s AI chatbotem zobrazeným na stránce,</li>
            <li>telefonní číslo, pokud jsi ho ověřil/a kvůli zamezení zneužívání bezplatných testů přes více účtů,</li>
            <li>technické údaje, například IP adresu, cookies a základní údaje o zařízení.</li>`;
html = replaceExactCount(html, CZ_DATA_OLD, CZ_DATA_NEW, 1, 'CZ "Jaké údaje zpracováváme"');

// ── SK: "Účely spracúvania" -- statický blok (s odsadením/newline) -- 1x ──
const SK_PURPOSE_STATIC_OLD = `            <li>zasielanie e-mailov s odporúčaniami a ponukami partnerov (affiliate), vyberaných na základe tvojho používania služby,</li>
            <li>plnenie zákonných povinností.</li>`;
const SK_PURPOSE_STATIC_NEW = `            <li>zasielanie e-mailov s odporúčaniami a ponukami partnerov (affiliate), vyberaných na základe tvojho používania služby — pri vyčerpaní bezplatných testov môžeš udelením tohto súhlasu získať jeden bonusový test naviac,</li>
            <li>overenie telefónnym číslom na zamedzenie zneužívania bezplatných testov cez viacero účtov,</li>
            <li>plnenie zákonných povinností.</li>`;
html = replaceExactCount(html, SK_PURPOSE_STATIC_OLD, SK_PURPOSE_STATIC_NEW, 1, 'SK "Účely spracúvania" (statický blok)');

// ── SK: "Účely spracúvania" -- priv3 i18n blok (bez newline) -- 1x ──
const SK_PURPOSE_JS_OLD = `<li>zasielanie e-mailov s odporúčaniami a ponukami partnerov (affiliate), vyberaných na základe tvojho používania služby,</li><li>plnenie zákonných povinností.</li>`;
const SK_PURPOSE_JS_NEW = `<li>zasielanie e-mailov s odporúčaniami a ponukami partnerov (affiliate), vyberaných na základe tvojho používania služby — pri vyčerpaní bezplatných testov môžeš udelením tohto súhlasu získať jeden bonusový test naviac,</li><li>overenie telefónnym číslom na zamedzenie zneužívania bezplatných testov cez viacero účtov,</li><li>plnenie zákonných povinností.</li>`;
html = replaceExactCount(html, SK_PURPOSE_JS_OLD, SK_PURPOSE_JS_NEW, 1, 'SK "Účely spracúvania" (priv3 i18n)');

// ── CZ: "Účely zpracování" -- priv3 i18n blok (bez newline) -- 1x ──
const CZ_PURPOSE_JS_OLD = `<li>zasílání e-mailů s doporučeními a nabídkami partnerů (affiliate), vybíranými na základě tvého používání služby,</li><li>plnění zákonných povinností.</li>`;
const CZ_PURPOSE_JS_NEW = `<li>zasílání e-mailů s doporučeními a nabídkami partnerů (affiliate), vybíranými na základě tvého používání služby — při vyčerpání bezplatných testů můžeš udělením tohoto souhlasu získat jeden bonusový test navíc,</li><li>ověření telefonním číslem za účelem zamezení zneužívání bezplatných testů přes více účtů,</li><li>plnění zákonných povinností.</li>`;
html = replaceExactCount(html, CZ_PURPOSE_JS_OLD, CZ_PURPOSE_JS_NEW, 1, 'CZ "Účely zpracování" (priv3 i18n)');

const backup = FILE + '.pre-261-legal-phone-marketing-disclosure-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, html);

console.log('✅ legal.html doplnený o telefónne číslo a zmienku o bonusovom teste pri marketingovom súhlase (SK + CZ).');
console.log('   Záloha:', backup);
console.log('   Statický súbor -- žiadny pm2 restart netreba.');
