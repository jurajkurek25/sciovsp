// Prerába /skola/:univerzita/:fakulta z holej sablony (nazov + tagy +
// kviz) na skutocnu landing stranku pre studeneho navstevnika, ktory
// prisiel z Google hladajuc KONKRETNU skolu a SP Trénera vôbec nepozná:
//  - hero sekcia s jasnou otazkou "Sedí ti [Fakulta]?"
//  - "Čo je SP Tréner?" — kontext pre niekoho, kto stránku nikdy nevidel
//  - trust strip (3 dovody, preco veriť testu)
//  - kviz s popisanymi koncami Likertovej skaly (Nesúhlasím ↔ Súhlasím),
//    nie len holé čísla 1-5
//  - po vysledku 2 CTA: plny test AJ samostatny odkaz "zisti viac o SP
//    Tréner" pre tych, co chcu preskocit rovno na produkt
//
// Predpoklad: main-app-patches/173-faculty-landing-pages.js uz je
// aplikovany a bezi (over cez: grep -n "app.get('/skola" server.js).
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/175-faculty-pages-redesign.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');

if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.175-faculty-pages-redesign-lock');
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

if (server.includes('FIELD_ICONS')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}
if (!server.includes("app.get('/skola', async")) {
  console.error('❌ Nenašiel som /skola routy — over, či je main-app-patches/173 už aplikovaný. Nič som nezmenil.');
  process.exit(1);
}

// 1) FIELD_ICONS — hneď za FIELD_LABELS
server = replaceOnce(server,
  "const FIELD_LABELS = {\n  sk: {vsp:'Všeobecné študijné predpoklady',psych:'Psychológia',law:'Právo',medicina:'Medicína',technika:'Technika a IT',pedagogika:'Pedagogika',ekonomia:'Ekonómia',humanitne:'Humanitné vedy',umenie:'Umenie'},\n  cs: {vsp:'Všeobecné studijní předpoklady',psych:'Psychologie',law:'Právo',medicina:'Medicína',technika:'Technika a IT',pedagogika:'Pedagogika',ekonomia:'Ekonomie',humanitne:'Humanitní vědy',umenie:'Umění'}\n};",
  "const FIELD_LABELS = {\n  sk: {vsp:'Všeobecné študijné predpoklady',psych:'Psychológia',law:'Právo',medicina:'Medicína',technika:'Technika a IT',pedagogika:'Pedagogika',ekonomia:'Ekonómia',humanitne:'Humanitné vedy',umenie:'Umenie'},\n  cs: {vsp:'Všeobecné studijní předpoklady',psych:'Psychologie',law:'Právo',medicina:'Medicína',technika:'Technika a IT',pedagogika:'Pedagogika',ekonomia:'Ekonomie',humanitne:'Humanitní vědy',umenie:'Umění'}\n};\n\nconst FIELD_ICONS = {vsp:'📘',psych:'🧠',law:'⚖️',medicina:'🩺',technika:'🔧',pedagogika:'🍎',ekonomia:'💼',humanitne:'📚',umenie:'🎨'};",
  'FIELD_ICONS definícia');

// 2) facultyQuizWidget() — kompletne prerobená (Likert popisky, dvojité CTA)
const OLD_WIDGET = `function facultyQuizWidget(lang, statements) {
  const isCs = lang === 'cs';
  const total = statements.length;
  const qHtml = statements.map(function(s, i) {
    return '<div class="fq-q"><p>' + escapeHtml(s[lang]) + '</p><div class="fq-scale" data-q="' + i + '">'
      + '<button type="button" data-v="1">1</button><button type="button" data-v="2">2</button><button type="button" data-v="3">3</button><button type="button" data-v="4">4</button><button type="button" data-v="5">5</button>'
      + '</div></div>';
  }).join('');
  const verdictHigh = isCs ? 'Vypadá to, že by ti to mohlo sedět!' : 'Vyzerá to, že by ti to mohlo sedieť!';
  const verdictMid = isCs ? 'Částečná shoda — stojí za to prozkoumat i jiné obory.' : 'Čiastočná zhoda — oplatí sa preskúmať aj iné odbory.';
  const verdictLow = isCs ? 'Asi to není přesně pro tebe — zkus si udělat i plný test.' : 'Asi to nie je presne pre teba — skús si spraviť aj plný test.';
  const quizHeading = isCs ? 'Sedí ti tento obor?' : 'Sedí ti tento odbor?';
  const quizSub = isCs ? 'Odpověz na pár otázek a zjisti to za minutu — zdarma.' : 'Odpovedz na pár otázok a zisti to za minútu — zadarmo.';
  const submitLabel = isCs ? 'Zjistit shodu →' : 'Zistiť zhodu →';
  const ctaLabel = isCs ? 'Udělat plný test zdarma →' : 'Spraviť plný test zadarma →';
  const ctaHref = '/kam-na-vysoku' + (isCs ? '?lang=cs' : '');

  return '<div class="faculty-quiz">'
    + '<h2>' + quizHeading + '</h2>'
    + '<p class="fq-sub">' + quizSub + '</p>'
    + '<div id="fqQuestions">' + qHtml + '</div>'
    + '<button id="fqSubmit" class="fq-submit" disabled>' + submitLabel + '</button>'
    + '<div id="fqResult" class="fq-result" style="display:none"></div>'
    + '</div>'
    + '<style>'
    + '.faculty-quiz{margin-top:2rem;padding:1.5rem;background:var(--black2);border:1px solid var(--border2);border-radius:16px}'
    + '.faculty-quiz h2{font-family:var(--serif);font-size:1.4rem;margin-bottom:.4rem}'
    + '.fq-sub{color:var(--text2);font-size:.9rem;margin-bottom:1.2rem}'
    + '.fq-q{margin-bottom:1.1rem}.fq-q p{font-size:.92rem;margin-bottom:.5rem}'
    + '.fq-scale{display:flex;gap:.4rem}'
    + '.fq-scale button{flex:1;padding:.5rem;background:var(--black3);border:1px solid var(--border2);border-radius:8px;color:var(--text2);font-family:var(--mono);cursor:pointer}'
    + '.fq-scale button.active{background:var(--volt);color:var(--black);border-color:var(--volt);font-weight:700}'
    + '.fq-submit{width:100%;margin-top:.5rem;padding:.9rem;background:var(--volt);border:none;border-radius:10px;color:var(--black);font-weight:700;font-family:var(--mono);cursor:pointer}'
    + '.fq-submit:disabled{opacity:.4;cursor:not-allowed}'
    + '.fq-result{text-align:center;padding:1rem 0}'
    + '.fq-pct{font-family:var(--serif);font-size:3rem;color:var(--volt)}'
    + '.fq-cta{display:inline-block;margin-top:1rem;padding:.8rem 1.4rem;background:var(--volt);color:var(--black);border-radius:10px;font-weight:700;font-family:var(--mono);text-decoration:none}'
    + '</style>'
    + '<script>(function(){'
    + 'var answers={};var total=' + total + ';'
    + 'document.querySelectorAll(".fq-scale button").forEach(function(btn){'
    + 'btn.onclick=function(){'
    + 'var scale=btn.closest(".fq-scale");'
    + 'scale.querySelectorAll("button").forEach(function(b){b.classList.remove("active")});'
    + 'btn.classList.add("active");'
    + 'answers[scale.dataset.q]=Number(btn.dataset.v);'
    + 'document.getElementById("fqSubmit").disabled=Object.keys(answers).length<total;'
    + '};});'
    + 'document.getElementById("fqSubmit").onclick=function(){'
    + 'var sum=0;for(var k in answers){sum+=answers[k]}'
    + 'var pct=Math.round(sum/(total*5)*100);'
    + 'var verdict=pct>=70?' + JSON.stringify(verdictHigh) + ':pct>=40?' + JSON.stringify(verdictMid) + ':' + JSON.stringify(verdictLow) + ';'
    + 'document.getElementById("fqQuestions").style.display="none";'
    + 'document.getElementById("fqSubmit").style.display="none";'
    + 'var r=document.getElementById("fqResult");r.style.display="block";'
    + 'r.innerHTML=\\'<div class="fq-pct">\\'+pct+\\'%</div><p>\\'+verdict+\\'</p><a class="fq-cta" href="' + ctaHref + '">' + ctaLabel + '</a>\\';'
    + '};'
    + '})();</script>';
}`;

const NEW_WIDGET = `function facultyQuizWidget(lang, statements) {
  const isCs = lang === 'cs';
  const total = statements.length;
  const likertLo = isCs ? 'Nesouhlasím' : 'Nesúhlasím';
  const likertHi = isCs ? 'Souhlasím' : 'Súhlasím';
  const qHtml = statements.map(function(s, i) {
    return '<div class="fq-q"><p>' + escapeHtml(s[lang]) + '</p><div class="fq-scale" data-q="' + i + '">'
      + '<button type="button" data-v="1">1</button><button type="button" data-v="2">2</button><button type="button" data-v="3">3</button><button type="button" data-v="4">4</button><button type="button" data-v="5">5</button>'
      + '</div><div class="fq-scale-labels"><span>' + likertLo + '</span><span>' + likertHi + '</span></div></div>';
  }).join('');
  const verdictHigh = isCs ? 'Vypadá to, že by ti to mohlo sedět!' : 'Vyzerá to, že by ti to mohlo sedieť!';
  const verdictMid = isCs ? 'Částečná shoda — stojí za to prozkoumat i jiné obory.' : 'Čiastočná zhoda — oplatí sa preskúmať aj iné odbory.';
  const verdictLow = isCs ? 'Asi to není přesně pro tebe — zkus si udělat i plný test.' : 'Asi to nie je presne pre teba — skús si spraviť aj plný test.';
  const quizHeading = isCs ? 'Sedí ti tento obor?' : 'Sedí ti tento odbor?';
  const quizSub = isCs ? 'Odpověz na pár otázek a zjisti to za minutu — zdarma, bez registrace.' : 'Odpovedz na pár otázok a zisti to za minútu — zadarmo, bez registrácie.';
  const submitLabel = isCs ? 'Zjistit shodu →' : 'Zistiť zhodu →';
  const ctaLabel = isCs ? 'Udělat plný test zdarma →' : 'Spraviť plný test zadarma →';
  const ctaHref = '/kam-na-vysoku' + (isCs ? '?lang=cs' : '');
  const homeLabel = isCs ? 'Zjistit víc o SP Tréner →' : 'Zistiť viac o SP Tréner →';
  const homeHref = '/' + (isCs ? '?lang=cs' : '');

  return '<div class="faculty-quiz">'
    + '<h2>' + quizHeading + '</h2>'
    + '<p class="fq-sub">' + quizSub + '</p>'
    + '<div id="fqQuestions">' + qHtml + '</div>'
    + '<button id="fqSubmit" class="fq-submit" disabled>' + submitLabel + '</button>'
    + '<div id="fqResult" class="fq-result" style="display:none"></div>'
    + '</div>'
    + '<style>'
    + '.fac-hero{padding:2.5rem 0 1rem;text-align:center}'
    + '.fac-eyebrow{display:inline-block;font-family:var(--mono);font-size:.72rem;letter-spacing:.06em;color:var(--volt);background:rgba(200,255,0,.08);border:1px solid rgba(200,255,0,.25);padding:.35rem .8rem;border-radius:99px;margin-bottom:1rem}'
    + '.fac-uni{color:var(--text2);font-size:.95rem;margin:.2rem 0 1rem}'
    + '.fac-tags{display:flex;gap:.5rem;justify-content:center;flex-wrap:wrap;margin-bottom:1.2rem}'
    + '.fac-tag-badge{background:var(--black2);border:1px solid var(--border2);border-radius:99px;padding:.35rem .8rem;font-size:.8rem;color:var(--text2)}'
    + '.fac-intro{max-width:640px;margin:0 auto;color:var(--text2);font-size:.95rem;line-height:1.6}'
    + '.fac-about{margin-top:2.5rem;padding:1.5rem;background:var(--black2);border:1px solid var(--border);border-radius:16px}'
    + '.fac-about h2{font-family:var(--serif);font-size:1.2rem;margin-bottom:.6rem}'
    + '.fac-about p{color:var(--text2);font-size:.9rem;line-height:1.6;margin-bottom:1rem}'
    + '.fac-trust{list-style:none;padding:0;margin:0;display:grid;gap:.6rem}'
    + '.fac-trust li{font-size:.85rem;color:var(--text2)}'
    + '.faculty-quiz{margin-top:2rem;padding:1.5rem;background:var(--black2);border:1px solid var(--border2);border-radius:16px}'
    + '.faculty-quiz h2{font-family:var(--serif);font-size:1.4rem;margin-bottom:.4rem}'
    + '.fq-sub{color:var(--text2);font-size:.9rem;margin-bottom:1.2rem}'
    + '.fq-q{margin-bottom:1.3rem}.fq-q p{font-size:.92rem;margin-bottom:.5rem}'
    + '.fq-scale{display:flex;gap:.4rem}'
    + '.fq-scale button{flex:1;padding:.6rem;background:var(--black3);border:1px solid var(--border2);border-radius:8px;color:var(--text2);font-family:var(--mono);cursor:pointer;font-size:.9rem}'
    + '.fq-scale button.active{background:var(--volt);color:var(--black);border-color:var(--volt);font-weight:700}'
    + '.fq-scale-labels{display:flex;justify-content:space-between;margin-top:.3rem;font-size:.7rem;color:var(--text3)}'
    + '.fq-submit{width:100%;margin-top:.5rem;padding:.9rem;background:var(--volt);border:none;border-radius:10px;color:var(--black);font-weight:700;font-family:var(--mono);cursor:pointer}'
    + '.fq-submit:disabled{opacity:.4;cursor:not-allowed}'
    + '.fq-result{text-align:center;padding:1rem 0}'
    + '.fq-pct{font-family:var(--serif);font-size:3rem;color:var(--volt)}'
    + '.fq-cta{display:inline-block;margin-top:1rem;padding:.8rem 1.4rem;background:var(--volt);color:var(--black);border-radius:10px;font-weight:700;font-family:var(--mono);text-decoration:none}'
    + '.fq-cta-secondary{display:block;margin-top:.8rem;color:var(--text2);font-size:.82rem;font-family:var(--mono);text-decoration:none}'
    + '.fq-cta-secondary:hover{color:var(--text)}'
    + '</style>'
    + '<script>(function(){'
    + 'var answers={};var total=' + total + ';'
    + 'document.querySelectorAll(".fq-scale button").forEach(function(btn){'
    + 'btn.onclick=function(){'
    + 'var scale=btn.closest(".fq-scale");'
    + 'scale.querySelectorAll("button").forEach(function(b){b.classList.remove("active")});'
    + 'btn.classList.add("active");'
    + 'answers[scale.dataset.q]=Number(btn.dataset.v);'
    + 'document.getElementById("fqSubmit").disabled=Object.keys(answers).length<total;'
    + '};});'
    + 'document.getElementById("fqSubmit").onclick=function(){'
    + 'var sum=0;for(var k in answers){sum+=answers[k]}'
    + 'var pct=Math.round(sum/(total*5)*100);'
    + 'var verdict=pct>=70?' + JSON.stringify(verdictHigh) + ':pct>=40?' + JSON.stringify(verdictMid) + ':' + JSON.stringify(verdictLow) + ';'
    + 'document.getElementById("fqQuestions").style.display="none";'
    + 'document.getElementById("fqSubmit").style.display="none";'
    + 'var r=document.getElementById("fqResult");r.style.display="block";'
    + 'r.innerHTML=\\'<div class="fq-pct">\\'+pct+\\'%</div><p>\\'+verdict+\\'</p><a class="fq-cta" href="' + ctaHref + '">' + ctaLabel + '</a><a class="fq-cta-secondary" href="' + homeHref + '">' + homeLabel + '</a>\\';'
    + '};'
    + '})();</script>';
}`;

server = replaceOnce(server, OLD_WIDGET, NEW_WIDGET, 'facultyQuizWidget() -> redizajn (hero CSS + Likert popisky + duálne CTA)');

// 3) /skola/:uSlug/:fSlug route — hero + "Čo je SP Tréner" + trust strip
const OLD_ROUTE_BODY = `  const isCs = lang === 'cs';
  const labels = FIELD_LABELS[lang];
  const tagNames = rec.tags.map(function(t) { return labels[t] || t; }).join(', ');
  const flag = rec.country === 'SK' ? '🇸🇰' : '🇨🇿';
  const statements = [];
  rec.tags.forEach(function(t) { (QUIZ_STATEMENTS[t] || []).forEach(function(s) { statements.push(s); }); });
  const title = 'Sedí mi ' + rec.faculty + '? — ' + rec.university;
  const description = (isCs ? 'Zjisti zdarma za minutu, jestli se pro tebe hodí ' : 'Zisti zadarmo za minútu, či sa pre teba hodí ') + rec.faculty + ' (' + rec.university + ', ' + rec.city + ').';
  const langQS = isCs ? '?lang=cs' : '';
  const breadcrumb = '<nav class="breadcrumb"><a href="/' + langQS + '">SP Tréner</a><span>/</span><a href="/skola' + langQS + '">' + (isCs ? 'Fakulty' : 'Fakulty') + '</a><span>/</span><span>' + escapeHtml(rec.faculty) + '</span></nav>';
  const body = '<main class="page">' + breadcrumb + '<article class="prose">'
    + '<div class="fac-eyebrow">' + flag + ' ' + escapeHtml(rec.city) + '</div>'
    + '<h1 class="hero-title">' + escapeHtml(rec.faculty) + '</h1>'
    + '<p class="prose-meta">' + escapeHtml(rec.university) + '</p>'
    + '<p>' + (isCs ? 'Zaměření: ' : 'Zameranie: ') + escapeHtml(tagNames) + '</p>'
    + facultyQuizWidget(lang, statements)
    + '</article></main>';`;

const NEW_ROUTE_BODY = `  const isCs = lang === 'cs';
  const labels = FIELD_LABELS[lang];
  const tagBadges = rec.tags.map(function(t) { return '<span class="fac-tag-badge">' + (FIELD_ICONS[t] || '') + ' ' + (labels[t] || t) + '</span>'; }).join('');
  const flag = rec.country === 'SK' ? '🇸🇰' : '🇨🇿';
  const statements = [];
  rec.tags.forEach(function(t) { (QUIZ_STATEMENTS[t] || []).forEach(function(s) { statements.push(s); }); });
  const title = 'Sedí mi ' + rec.faculty + '? — ' + rec.university;
  const description = (isCs ? 'Zjisti zdarma za minutu, jestli se pro tebe hodí ' : 'Zisti zadarmo za minútu, či sa pre teba hodí ') + rec.faculty + ' (' + rec.university + ', ' + rec.city + ').';
  const langQS = isCs ? '?lang=cs' : '';
  const breadcrumb = '<nav class="breadcrumb"><a href="/' + langQS + '">SP Tréner</a><span>/</span><a href="/skola' + langQS + '">' + (isCs ? 'Fakulty' : 'Fakulty') + '</a><span>/</span><span>' + escapeHtml(rec.faculty) + '</span></nav>';
  const heroEyebrow = flag + ' ' + escapeHtml(rec.city) + ' · ' + (isCs ? 'Test shody zdarma' : 'Test zhody zadarmo');
  const heroIntro = isCs
    ? 'Přemýšlíš nad studiem na ' + escapeHtml(rec.faculty) + '? Ověř si to za 2 minuty — odpověz na pár otázek a zjisti, jestli tě tohle zaměření opravdu baví, ještě než si podáš přihlášku.'
    : 'Premýšľaš nad štúdiom na ' + escapeHtml(rec.faculty) + '? Over si to za 2 minúty — odpovedz na pár otázok a zisti, či ťa toto zameranie naozaj baví, ešte predtým, než si podáš prihlášku.';
  const aboutTitle = isCs ? 'Co je SP Tréner?' : 'Čo je SP Tréner?';
  const aboutText = isCs
    ? 'SP Tréner je AI příprava na přijímací testy na vysoké školy — pomáhá středoškolákům zjistit, který obor jim sedí, a připravit se na přijímačky pomocí testů generovaných umělou inteligencí na míru.'
    : 'SP Tréner je AI príprava na prijímacie testy na vysoké školy — pomáha stredoškolákom zistiť, ktorý odbor im sedí, a pripraviť sa na prijímačky pomocou testov generovaných umelou inteligenciou na mieru.';
  const trustItems = isCs ? [
    '🎯 Test postavený na stejné metodice jako náš AI generátor otázek',
    '🔒 Bez závazků — výsledek hned, žádná registrace',
    '🇸🇰🇨🇿 Pokrýváme všechny veřejné vysoké školy na Slovensku i v Česku'
  ] : [
    '🎯 Test postavený na rovnakej metodike ako náš AI generátor otázok',
    '🔒 Bez záväzkov — výsledok hneď, žiadna registrácia',
    '🇸🇰🇨🇿 Pokrývame všetky verejné vysoké školy na Slovensku aj v Česku'
  ];
  const trustHtml = '<ul class="fac-trust">' + trustItems.map(function(t) { return '<li>' + t + '</li>'; }).join('') + '</ul>';
  const body = '<main class="page">' + breadcrumb
    + '<section class="fac-hero">'
    + '<div class="fac-eyebrow">' + heroEyebrow + '</div>'
    + '<h1 class="hero-title">' + (isCs ? 'Sedí ti ' : 'Sedí ti ') + escapeHtml(rec.faculty) + '?</h1>'
    + '<p class="fac-uni">' + escapeHtml(rec.university) + '</p>'
    + '<div class="fac-tags">' + tagBadges + '</div>'
    + '<p class="fac-intro">' + heroIntro + '</p>'
    + '</section>'
    + facultyQuizWidget(lang, statements)
    + '<section class="fac-about">'
    + '<h2>' + aboutTitle + '</h2>'
    + '<p>' + aboutText + '</p>'
    + trustHtml
    + '</section>'
    + '</main>';`;

server = replaceOnce(server, OLD_ROUTE_BODY, NEW_ROUTE_BODY, '/skola/:uSlug/:fSlug route -> hero + about + trust strip');

const backup = SERVER_PATH + '.pre-faculty-redesign-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, server);

console.log('✅ Fakultné stránky prerobené na skutočné landing stránky (hero, "Čo je SP Tréner", trust strip, lepší kvíz).');
console.log('   Záloha:', backup);
console.log('   Over syntax pred reštartom: node -c server.js');
