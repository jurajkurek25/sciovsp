// Pôvodná úloha z tejto série: pridať interné odkazy z /skola fakultných
// stránok NA zodpovedajúce /vsp-test/ landing pages (LF UK Bratislava,
// LF UPJŠ Košice, teraz aj SZU Bratislava a UVLF Košice) -- doteraz
// medzi nimi neexistoval žiadny prepoj žiadnym smerom.
//
// OPRAVA #2: prvý pokus zlyhal, lebo main-app-patches/184 (UNI_FACTS)
// nie je na produkcii aplikovaný. Druhý pokus zlyhal, lebo kotva
// `const langQS = isCs ? '?lang=cs' : '';` sa v server.js vyskytuje
// 2x (nie len v /skola/:uSlug/:fSlug -- rovnaký idióm používa aj iná
// routa). Tento (tretí) pokus sa preto úplne vyhýba akejkoľvek kotve,
// ktorá nebola priamo overená ako jedinečná v CELOM súbore -- namiesto
// samostatnej deklarácie premenných + samostatnej úpravy zdieľaného
// <style> bloku je VŠETKO (vyhľadávacia tabuľka aj CSS) zabalené do
// jedného self-contained IIFE vloženého na JEDINÉ miesto, ktoré bolo
// priamo potvrdené (cez main-app-patches/205, JSON-escapovaný výpis
// z produkcie) ako jedinečné: presne tento 4-riadkový blok končiaci
// `facultyQuizWidget(lang, statements)`. Používa len premenné (rec,
// isCs, langQS), ktoré sú na tomto mieste už v scope (langQS je
// deklarovaná skôr v tej istej funkcii -- IIFE ju len číta, nie
// deklaruje nanovo, takže jej neunikátnosť v súbore už nevadí).
//
// Na ostatných ~146 fakultných stránkach sa nič nezobrazí (lookup
// vráti undefined -> IIFE vráti '').
//
// VYŽADUJE: main-app-patches/197 a main-app-patches/195/196 (aby cieľové
// /vsp-test/ URL už reálne fungovali) už aplikované. NEVYŽADUJE 184.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/200-skola-vsp-test-internal-links.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');

if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.200-skola-vsp-test-internal-links-lock');
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

let server = fs.readFileSync(SERVER_PATH, 'utf8');

if (server.includes('fac-vsp-test-cta')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// Jediná kotva -- priamo overená ako jedinečná v CELOM súbore cez
// main-app-patches/205 diagnostiku (JSON-escapovaný výpis z produkcie).
server = replaceOnce(server,
  `    + '<p class="fac-intro">' + heroIntro + '</p>'
    + '</section>'
    + facultyQuizWidget(lang, statements)`,
  `    + '<p class="fac-intro">' + heroIntro + '</p>'
    + '</section>'
    + (function() {
        var t = ({
          'univerzita-komenskeho-v-bratislave/lekarska-fakulta': '/vsp-test/lf-uk-bratislava',
          'univerzita-pavla-jozefa-safarika/lekarska-fakulta': '/vsp-test/lf-upjs-kosice',
          'slovenska-zdravotnicka-univerzita/zdravotnicke-odbory': '/vsp-test/lf-szu-bratislava',
          'univerzita-veterinarskeho-lekarstva-a-farmacie/veterinarska-fakulta': '/vsp-test/uvlf-kosice'
        })[rec.uSlug + '/' + rec.fSlug];
        if (!t) return '';
        return '<section class="fac-vsp-test-cta">'
          + '<style>.fac-vsp-test-cta{margin-bottom:1.5rem;padding:1.25rem 1.5rem;background:rgba(200,255,0,.06);border:1px solid rgba(200,255,0,.25);border-radius:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem}.fac-vsp-test-cta p{color:var(--text2);font-size:.86rem;margin:0;max-width:70%}.fac-vsp-test-cta a{color:var(--volt);text-decoration:none;font-family:var(--mono);font-size:.82rem;font-weight:700;white-space:nowrap}.fac-vsp-test-cta a:hover{text-decoration:underline}</style>'
          + '<p>' + (isCs ? 'Tato fakulta má vlastní přijímací test — jiný formát než klasický VŠP/SCIO test.' : 'Táto fakulta má vlastný prijímací test — iný formát než klasický VŠP/SCIO test.') + '</p>'
          + '<a href="' + t + langQS + '">' + (isCs ? 'Zobrazit přesný formát testu →' : 'Zobraziť presný formát testu →') + '</a>'
          + '</section>';
      })()
    + facultyQuizWidget(lang, statements)`,
  '1: vloženie vspTestLinkHtml IIFE do body (self-contained, jediná kotva)');

const backup = SERVER_PATH + '.pre-skola-vsp-test-internal-links-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, server);

console.log('✅ /skola/:uSlug/:fSlug teraz zobrazuje interný odkaz na zodpovedajúcu /vsp-test/ landing page (LF UK Bratislava, LF UPJŠ Košice, SZU Bratislava, UVLF Košice) — na ostatných fakultách sa nič nezobrazí.');
console.log('   Záloha:', backup);
console.log('   Over syntax pred reštartom: node -c server.js && pm2 restart sptrener');
