// Prida vecny obsah na fakultne stranky (main-app-patches/173+175+176+177)
// kvoli SEO ("thin content" riziko) a zredukuje pocet CTA na PRESNE jedno:
//   - "Ako vyzerajú prijímačky na odbory ako X?" — zniekedy honest field-level
//     tip, ZNOVU-POUZITY z uz existujuceho QUIZ_FIELD_TIPS (z email-drip
//     systemu, sendExamGoodluckAndReviewEmails/quizStage2Content) — ziadny
//     novy text sa nevymysla, len sa recykluje uz overeny, uprimny obsah.
//   - FAQ sekcia (4 otazky/odpovede, honest, + FAQPage JSON-LD pre SEO bonus)
//   - "Ďalšie fakulty na [Univerzita]" — interne odkazy z uz existujuceho
//     FACULTY_LIST (ziadne nove data)
//   - JEDNO CTA: odstranuje sa dvojica odkazov po vysledku miniqvizu
//     ("Spraviť plný test zadarma" + "Zistiť viac o SP Tréner"), ktore
//     odvádzali navstevnika PREC zo stranky. Jediny zostavajuci CTA je
//     Google-registracne tlacidlo (main-app-patches/177), ktore sa zobrazi
//     hned po vysledku a drzi navstevnika NA stranke (silnejsia akcia —
//     zapis leadu + PNG/QR obrazok + email drip).
//
// Predpoklad: main-app-patches/173, 175, 176 a 177 uz su aplikovane.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/178-faculty-content-single-cta.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');

if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.178-faculty-content-single-cta-lock');
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

if (server.includes('fac-examprep')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}
if (!server.includes('fqRegisterSection')) {
  console.error('❌ Nenašiel som fqRegisterSection — over, či je main-app-patches/177 už aplikovaný. Nič som nezmenil.');
  process.exit(1);
}

// ═══════════════════════ 1) JEDNO CTA — odstráň dvojicu odkazov po výsledku mini-testu ═══════════════════════
const OLD_SCORE_END = `+ 'r.innerHTML=\\'<div class="fq-pct">\\'+pct+\\'%</div>\\'+barsHtml+\\'<p>\\'+verdict+\\'</p>\\'+gapHtml+\\'<a class="fq-cta" href="' + ctaHref + '">' + ctaLabel + '</a><a class="fq-cta-secondary" href="' + homeHref + '">' + homeLabel + '</a>\\';'
    + 'if(window.__facultyQuizShowRegister)window.__facultyQuizShowRegister(pct,{interest:pInterest,aptitude:pAptitude,reality:pReality});'
    + '};'`;

const NEW_SCORE_END = `+ 'r.innerHTML=\\'<div class="fq-pct">\\'+pct+\\'%</div>\\'+barsHtml+\\'<p>\\'+verdict+\\'</p>\\'+gapHtml+\\'\\';'
    + 'if(window.__facultyQuizShowRegister)window.__facultyQuizShowRegister(pct,{interest:pInterest,aptitude:pAptitude,reality:pReality});'
    + '};'`;

server = replaceOnce(server, OLD_SCORE_END, NEW_SCORE_END, 'scoring JS -> odstránenie dvoch odchádzajúcich odkazov (jedno CTA = Google registrácia)');

// ═══════════════════════ 2) nový obsah — vypočítaj pred zostavením body ═══════════════════════
const OLD_PRE_BODY = `  const trustHtml = '<ul class="fac-trust">' + trustItems.map(function(t) { return '<li>' + t + '</li>'; }).join('') + '</ul>';
  const body = '<main class="page">' + breadcrumb`;

const NEW_PRE_BODY = `  const trustHtml = '<ul class="fac-trust">' + trustItems.map(function(t) { return '<li>' + t + '</li>'; }).join('') + '</ul>';

  const primaryTag = rec.tags[0];
  const fieldTip = (QUIZ_FIELD_TIPS[primaryTag] && QUIZ_FIELD_TIPS[primaryTag][lang]) || '';
  const examPrepTitle = isCs ? 'Jak vypadají přijímačky na obory jako ' + escapeHtml(rec.faculty) + '?' : 'Ako vyzerajú prijímačky na odbory ako ' + escapeHtml(rec.faculty) + '?';
  const examPrepNote = isCs
    ? 'Konkrétní formát přijímaček se liší škola od školy — tohle je obecný postřeh, na co si dát pozor při přípravě na tento typ oboru.'
    : 'Konkrétny formát prijímačiek sa líši škola od školy — toto je všeobecný postreh, na čo si dať pozor pri príprave na tento typ odboru.';
  const examPrepHtml = fieldTip ? (
    '<section class="fac-examprep">'
    + '<h2>' + examPrepTitle + '</h2>'
    + '<p class="fac-examprep-note">' + examPrepNote + '</p>'
    + '<p>' + escapeHtml(fieldTip) + '</p>'
    + '</section>'
  ) : '';

  const faqItems = isCs ? [
    { q: 'Je tento test oficiální součástí přijímacího řízení na ' + rec.faculty + '?', a: 'Ne. Je to orientační test SP Tréner, který ti pomůže rychle zjistit, jestli tě dané zaměření baví a sedí ti — není to oficiální nástroj školy ani náhrada přijímacích zkoušek.' },
    { q: 'Co když mi vyjde nízká shoda?', a: 'Nízké procento neznamená, že se na školu nedostaneš — jen naznačuje, že by ti mohlo sedět jiné zaměření víc, než jsi čekal/a. Test je jen orientační pomocník, ne definitivní rozhodnutí.' },
    { q: 'Jak dlouho trvá příprava na přijímací zkoušky?', a: 'Záleží na konkrétní škole a tvé úrovni — SP Tréner ti pomocí AI generuje testy na míru a sleduje, v čem děláš chyby, takže se dá připravovat efektivněji než jen biflováním.' },
    { q: 'Je používání SP Tréner zpoplatněné?', a: 'Základní orientace je zdarma — plnou přípravu s AI generátorem testů na míru nabízíme v plánech Premium a Elite.' }
  ] : [
    { q: 'Je tento test oficiálnou súčasťou prijímacieho konania na ' + rec.faculty + '?', a: 'Nie. Je to orientačný test SP Tréner, ktorý ti pomôže rýchlo zistiť, či ťa dané zameranie baví a sedí ti — nie je to oficiálny nástroj školy ani náhrada prijímacích skúšok.' },
    { q: 'Čo ak mi vyjde nízka zhoda?', a: 'Nízke percento neznamená, že sa na školu nedostaneš — len naznačuje, že by ti mohlo sedieť iné zameranie viac, než si čakal/a. Test je len orientačný pomocník, nie definitívne rozhodnutie.' },
    { q: 'Ako dlho trvá príprava na prijímacie skúšky?', a: 'Závisí to od konkrétnej školy a tvojej úrovne — SP Tréner ti pomocou AI generuje testy na mieru a sleduje, v čom robíš chyby, takže sa dá pripravovať efektívnejšie než len biflovaním.' },
    { q: 'Je používanie SP Tréner spoplatnené?', a: 'Základná orientácia je zadarmo — plnú prípravu s AI generátorom testov na mieru ponúkame v plánoch Premium a Elite.' }
  ];
  const faqHtml = '<section class="fac-faq"><h2>' + (isCs ? 'Časté otázky' : 'Časté otázky') + '</h2>'
    + faqItems.map(function(item) { return '<div class="fac-faq-item"><h3>' + escapeHtml(item.q) + '</h3><p>' + escapeHtml(item.a) + '</p></div>'; }).join('')
    + '</section>';

  const relatedFacs = FACULTY_LIST.filter(function(f) { return f.uSlug === rec.uSlug && f.fSlug !== rec.fSlug; });
  const relatedHtml = relatedFacs.length ? (
    '<section class="fac-related">'
    + '<h2>' + (isCs ? 'Další obory na ' : 'Ďalšie fakulty na ') + escapeHtml(rec.university) + '</h2>'
    + '<ul class="fac-related-list">' + relatedFacs.map(function(f) { return '<li><a href="/skola/' + f.uSlug + '/' + f.fSlug + langQS + '">' + escapeHtml(f.faculty) + '</a></li>'; }).join('') + '</ul>'
    + '</section>'
  ) : '';

  const body = '<main class="page">' + breadcrumb`;

server = replaceOnce(server, OLD_PRE_BODY, NEW_PRE_BODY, 'nové content premenné (examPrepHtml, faqItems/faqHtml, relatedHtml) pred zostavením body');

// ═══════════════════════ 3) vlož nové sekcie pred </main> + CSS ═══════════════════════
const OLD_BODY_TAIL = `    + '<section class="fac-about">'
    + '<h2>' + aboutTitle + '</h2>'
    + '<p>' + aboutText + '</p>'
    + trustHtml
    + '</section>'
    + '</main>';`;

const NEW_BODY_TAIL = `    + '<section class="fac-about">'
    + '<h2>' + aboutTitle + '</h2>'
    + '<p>' + aboutText + '</p>'
    + trustHtml
    + '</section>'
    + examPrepHtml
    + faqHtml
    + relatedHtml
    + '</main>'
    + '<style>.fac-examprep{margin-top:1.5rem;padding:1.5rem;background:var(--black2);border:1px solid var(--border);border-radius:16px}.fac-examprep h2{font-family:var(--serif);font-size:1.2rem;margin-bottom:.5rem}.fac-examprep-note{color:var(--text3);font-size:.8rem;margin-bottom:.8rem}.fac-examprep p:not(.fac-examprep-note){color:var(--text2);font-size:.92rem;line-height:1.6}.fac-faq{margin-top:1.5rem}.fac-faq h2{font-family:var(--serif);font-size:1.2rem;margin-bottom:1rem}.fac-faq-item{padding:1rem 0;border-top:1px solid var(--border)}.fac-faq-item h3{font-size:.92rem;margin-bottom:.4rem}.fac-faq-item p{color:var(--text2);font-size:.85rem;line-height:1.6}.fac-related{margin-top:1.5rem;padding:1.5rem;background:var(--black2);border:1px solid var(--border);border-radius:16px}.fac-related h2{font-family:var(--serif);font-size:1.1rem;margin-bottom:.7rem}.fac-related-list{list-style:none;padding:0;margin:0;display:grid;gap:.4rem}.fac-related-list a{color:var(--text2);text-decoration:none;font-size:.86rem}.fac-related-list a:hover{color:var(--volt)}</style>';`;

server = replaceOnce(server, OLD_BODY_TAIL, NEW_BODY_TAIL, 'body -> vlož examPrepHtml + faqHtml + relatedHtml + CSS pred </main>');

// ═══════════════════════ 4) JSON-LD -> pridaj FAQPage ═══════════════════════
const OLD_JSONLD = `  const jsonLd = [{
    '@context': 'https://schema.org', '@type': 'CollegeOrUniversity', name: rec.university,
    department: { '@type': 'CollegeOrUniversity', name: rec.faculty },
    address: { '@type': 'PostalAddress', addressLocality: rec.city, addressCountry: rec.country }
  }];`;

const NEW_JSONLD = `  const jsonLd = [{
    '@context': 'https://schema.org', '@type': 'CollegeOrUniversity', name: rec.university,
    department: { '@type': 'CollegeOrUniversity', name: rec.faculty },
    address: { '@type': 'PostalAddress', addressLocality: rec.city, addressCountry: rec.country }
  }, {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqItems.map(function(item) { return { '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } }; })
  }];`;

server = replaceOnce(server, OLD_JSONLD, NEW_JSONLD, 'jsonLd -> pridanie FAQPage schémy');

const backup = SERVER_PATH + '.pre-faculty-content-single-cta-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, server);

console.log('✅ Fakultné stránky majú viac reálneho obsahu (prijímačky na odbor, FAQ + FAQPage JSON-LD, ďalšie fakulty na univerzite) a presne JEDNO CTA (Google registrácia).');
console.log('   Záloha:', backup);
console.log('   Over syntax pred reštartom: node -c server.js');
