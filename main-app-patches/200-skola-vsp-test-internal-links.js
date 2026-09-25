// Pôvodná úloha z tejto série: pridať interné odkazy z /skola fakultných
// stránok NA zodpovedajúce /vsp-test/ landing pages (LF UK Bratislava,
// LF UPJŠ Košice, teraz aj SZU Bratislava a UVLF Košice) -- doteraz
// medzi nimi neexistoval žiadny prepoj žiadnym smerom.
//
// Pridáva malý CTA box hneď po sekcii "O univerzite" (uniFactsHtml),
// pred kvízovým widgetom, LEN na tých 4 konkrétnych fakultných
// stránkach, ktoré majú zodpovedajúci /vsp-test/ formát:
//   univerzita-komenskeho-v-bratislave/lekarska-fakulta     -> /vsp-test/lf-uk-bratislava
//   univerzita-pavla-jozefa-safarika/lekarska-fakulta       -> /vsp-test/lf-upjs-kosice
//   slovenska-zdravotnicka-univerzita/zdravotnicke-odbory   -> /vsp-test/lf-szu-bratislava
//   univerzita-veterinarskeho-lekarstva-a-farmacie/veterinarska-fakulta -> /vsp-test/uvlf-kosice
// Kľúče sú presné uSlug/fSlug hodnoty overené priamym výpočtom cez
// rovnakú slugify() funkciu, akú používa server.js (nie odhadnuté).
// Na ostatných ~146 fakultných stránkach sa nič nezobrazí (vspTestTarget
// je undefined -> vspTestLinkHtml je prázdny reťazec).
//
// VYŽADUJE: main-app-patches/184-faculty-uni-facts.js (kotva je jeho
// výstupný text), main-app-patches/197 a main-app-patches/195/196 (aby
// cieľové /vsp-test/ URL už reálne fungovali) už aplikované.
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

if (server.includes('vspTestLinkHtml')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// ── 1) Výpočet vspTestLinkHtml -- hneď za deklaráciou uniFactsHtml ──
server = replaceOnce(server,
`  const uniFacts = UNI_FACTS[rec.university] && UNI_FACTS[rec.university][lang];
  const uniFactsHtml = uniFacts ? (
    '<section class="fac-uni-facts">'
    + '<h2>' + (isCs ? 'O univerzitě' : 'O univerzite') + '</h2>'
    + '<p>' + uniFacts.about + '</p>'
    + '<p>' + uniFacts.admission + '</p>'
    + '</section>'
  ) : '';`,
`  const uniFacts = UNI_FACTS[rec.university] && UNI_FACTS[rec.university][lang];
  const uniFactsHtml = uniFacts ? (
    '<section class="fac-uni-facts">'
    + '<h2>' + (isCs ? 'O univerzitě' : 'O univerzite') + '</h2>'
    + '<p>' + uniFacts.about + '</p>'
    + '<p>' + uniFacts.admission + '</p>'
    + '</section>'
  ) : '';

  const VSP_TEST_LINK_TARGETS = {
    'univerzita-komenskeho-v-bratislave/lekarska-fakulta': '/vsp-test/lf-uk-bratislava',
    'univerzita-pavla-jozefa-safarika/lekarska-fakulta': '/vsp-test/lf-upjs-kosice',
    'slovenska-zdravotnicka-univerzita/zdravotnicke-odbory': '/vsp-test/lf-szu-bratislava',
    'univerzita-veterinarskeho-lekarstva-a-farmacie/veterinarska-fakulta': '/vsp-test/uvlf-kosice'
  };
  const vspTestTarget = VSP_TEST_LINK_TARGETS[rec.uSlug + '/' + rec.fSlug];
  const vspTestLinkHtml = vspTestTarget ? (
    '<section class="fac-vsp-test-cta">'
    + '<p>' + (isCs ? 'Tato fakulta má vlastní přijímací test — jiný formát než klasický VŠP/SCIO test.' : 'Táto fakulta má vlastný prijímací test — iný formát než klasický VŠP/SCIO test.') + '</p>'
    + '<a href="' + vspTestTarget + langQS + '">' + (isCs ? 'Zobrazit přesný formát testu →' : 'Zobraziť presný formát testu →') + '</a>'
    + '</section>'
  ) : '';`,
  '1: výpočet vspTestLinkHtml');

// ── 2) Vloženie do body, medzi uniFactsHtml a kvízovým widgetom ──
server = replaceOnce(server,
`    + '<p class="fac-intro">' + heroIntro + '</p>'
    + '</section>'
    + uniFactsHtml
    + facultyQuizWidget(lang, statements)`,
`    + '<p class="fac-intro">' + heroIntro + '</p>'
    + '</section>'
    + uniFactsHtml
    + vspTestLinkHtml
    + facultyQuizWidget(lang, statements)`,
  '2: vloženie vspTestLinkHtml do body');

// ── 3) CSS pre .fac-vsp-test-cta ──
server = replaceOnce(server,
  `.fac-related-list a{color:var(--text2);text-decoration:none;font-size:.86rem}.fac-related-list a:hover{color:var(--volt)}.fac-uni-facts{margin-bottom:1.5rem;padding:1.5rem;background:var(--black2);border:1px solid var(--border);border-radius:16px}.fac-uni-facts h2{font-family:var(--serif);font-size:1.1rem;margin-bottom:.6rem}.fac-uni-facts p{color:var(--text2);font-size:.88rem;line-height:1.6;margin-bottom:.7rem}.fac-uni-facts p:last-child{margin-bottom:0}</style>';`,
  `.fac-related-list a{color:var(--text2);text-decoration:none;font-size:.86rem}.fac-related-list a:hover{color:var(--volt)}.fac-uni-facts{margin-bottom:1.5rem;padding:1.5rem;background:var(--black2);border:1px solid var(--border);border-radius:16px}.fac-uni-facts h2{font-family:var(--serif);font-size:1.1rem;margin-bottom:.6rem}.fac-uni-facts p{color:var(--text2);font-size:.88rem;line-height:1.6;margin-bottom:.7rem}.fac-uni-facts p:last-child{margin-bottom:0}.fac-vsp-test-cta{margin-bottom:1.5rem;padding:1.25rem 1.5rem;background:rgba(200,255,0,.06);border:1px solid rgba(200,255,0,.25);border-radius:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem}.fac-vsp-test-cta p{color:var(--text2);font-size:.86rem;margin:0;max-width:70%}.fac-vsp-test-cta a{color:var(--volt);text-decoration:none;font-family:var(--mono);font-size:.82rem;font-weight:700;white-space:nowrap}.fac-vsp-test-cta a:hover{text-decoration:underline}</style>';`,
  '3: CSS pre .fac-vsp-test-cta');

const backup = SERVER_PATH + '.pre-skola-vsp-test-internal-links-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, server);

console.log('✅ /skola/:uSlug/:fSlug teraz zobrazuje interný odkaz na zodpovedajúcu /vsp-test/ landing page (LF UK Bratislava, LF UPJŠ Košice, SZU Bratislava, UVLF Košice) — na ostatných fakultách sa nič nezobrazí.');
console.log('   Záloha:', backup);
console.log('   Over syntax pred reštartom: node -c server.js && pm2 restart sptrener');
