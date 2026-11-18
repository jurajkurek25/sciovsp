// Prida skutocny Cookiebot "Cookie Declaration" widget script do sekcie
// "10. Cookies" na legal.html — chyba tam doteraz, takze sa nikdy
// nezobrazoval ziadny zoznam cookies.
//
// DOLEZITE: vklada sa AKO SUROVED SIBLING za .legal-item div, NIE dnu do
// data-i18n="priv10" divu ani do sk/cz JS retazcov — tie sa renderuju cez
// .innerHTML, a <script> vlozeny cez innerHTML sa NIKDY nespusti (browser
// quirk). Umiestnenim mimo neho ostava skript realnou, parserom
// spustenou HTML znackou, ktora prezije aj prepnutie jazyka (i18n meni
// len obsah .legal-item divu, nie jeho súrodencov).
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/172-cookiebot-declaration-widget.js

const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(process.cwd(), 'public', 'legal.html');

if (!fs.existsSync(HTML_PATH)) {
  console.error('❌ Nenašiel som súbor:', HTML_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.172-cookiebot-declaration-widget-lock');
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (' + LOCK + '). Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

function replaceOnce(src, oldStr, newStr, label) {
  const count = src.split(oldStr).length - 1;
  if (count !== 1) {
    console.error('❌ ' + label + ' — kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil.');
    process.exit(1);
  }
  return src.replace(oldStr, () => newStr);
}

let html = fs.readFileSync(HTML_PATH, 'utf8');

if (html.includes('id="CookieDeclaration"')) {
  console.error('❌ legal.html: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

const OLD = `        <div class="legal-item" data-i18n="priv10">
          <h3>10. Cookies</h3>
          <p>
            Web môže používať nevyhnutné cookies, analytické cookies a prípadne marketingové cookies.
            Nepovinné cookies by mali byť používané len na základe platného súhlasu používateľa.
          </p>
          <p>
            Ak používaš analytiku alebo remarketing, samotný text nestačí. Musíš mať aj reálne implementovaný cookie banner a evidenciu súhlasov.
          </p>
          <p>
            Na stránke používame službu <strong>Cookiebot</strong> na správu súhlasov a <strong>Google Analytics</strong> na základnú webovú analytiku — tá beží až po udelení súhlasu.
          </p>
        </div>`;

const NEW = `        <div class="legal-item" data-i18n="priv10">
          <h3>10. Cookies</h3>
          <p>
            Web môže používať nevyhnutné cookies, analytické cookies a prípadne marketingové cookies.
            Nepovinné cookies by mali byť používané len na základe platného súhlasu používateľa.
          </p>
          <p>
            Ak používaš analytiku alebo remarketing, samotný text nestačí. Musíš mať aj reálne implementovaný cookie banner a evidenciu súhlasov.
          </p>
          <p>
            Na stránke používame službu <strong>Cookiebot</strong> na správu súhlasov a <strong>Google Analytics</strong> na základnú webovú analytiku — tá beží až po udelení súhlasu.
          </p>
        </div>
        <script id="CookieDeclaration" src="https://consent.cookiebot.com/082b4b18-7f50-41b6-b374-be0c015a5fe0/cd.js" type="text/javascript" async></script>`;

html = replaceOnce(html, OLD, NEW, 'legal.html: Cookiebot declaration widget script');

const backup = HTML_PATH + '.pre-cookiebot-declaration-' + Date.now();
fs.copyFileSync(HTML_PATH, backup);
fs.writeFileSync(HTML_PATH, html);

console.log('✅ Cookiebot declaration widget pridaný do sekcie "10. Cookies" na legal.html.');
console.log('   Záloha:', backup);
