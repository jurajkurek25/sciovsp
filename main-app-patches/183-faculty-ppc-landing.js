// PPC (platená reklama) verzia fakultnej stránky — ROVNAKÁ URL ako SEO
// verzia, aktivuje sa cez ?ppc=1 v query stringu (to bude finálna URL
// v reklamných kampaniach). Nie je to druhá šablóna na údržbu — je to
// jedna route s podmieneným vetvením, zdieľajúca FACULTY_INDEX/UNI_DB/
// QUIZ_STATEMENTS/QUIZ_APP_CAT s SEO verziou.
//
// Rozdiely oproti SEO verzii (zámerné, pre studenu platenu premavku):
//  - 3 otázky namiesto 6-18 (1 za Záujem/Predpoklady/Realitu, z
//    existujúcich QUIZ_STATEMENTS — žiaden nový obsah)
//  - výsledok OKAMŽITE, bez Google prihlásenia (SEO verzia zostáva
//    gated — to je zámerný rozdiel, PPC potrebuje najrýchlejšiu cestu
//    ku konverzii, nie SEO poctivosť o "bez registrácie")
//  - JEDNO CTA rovno do appky (fit-aware, rovnaká 55% hranica ako
//    v post-registračnom CTA na SEO verzii) — žiadny medzikrok
//  - žiadny FAQ/"Ako vyzerajú prijímačky"/"Ďalšie fakulty" — len hero
//    + krátky test, aby sa neplytvalo scrollom studenej premávky
//  - žiadne supabase/qrcode/faculty-quiz-full.js skripty (nepotrebné
//    bez registrácie) — rýchlejšie načítanie
//  - <meta name="robots" content="noindex,follow"> — nesmie konkurovať
//    SEO verzii v indexe; canonical (v blogLayout) aj tak vždy mieri na
//    čistú URL bez ?ppc=1, keďže canonicalPath sa nemení
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/183-faculty-ppc-landing.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');

if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.183-faculty-ppc-landing-lock');
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

if (server.includes('facultyQuizWidgetPPC')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}
if (!server.includes('function registerSectionHtml(')) {
  console.error('❌ Nenašiel som registerSectionHtml() — over, či je main-app-patches/177 už aplikovaný. Nič som nezmenil.');
  process.exit(1);
}
if (!server.includes('const QUIZ_APP_CAT')) {
  console.error('❌ Nenašiel som QUIZ_APP_CAT — nemôžem bezpečne pokračovať. Nič som nezmenil.');
  process.exit(1);
}

// ═══════════════════════ 1) blogLayout() -> voliteľný noindex parameter ═══════════════════════
server = replaceOnce(server,
  `function blogLayout({ title, description, body, canonicalPath, ogType, jsonLd, lang, image }) {`,
  `function blogLayout({ title, description, body, canonicalPath, ogType, jsonLd, lang, image, noindex }) {`,
  'blogLayout() -> pridanie noindex parametra do signatúry');

server = replaceOnce(server,
  `<meta name="description" content="\${escapeHtml(description)}">
<link rel="canonical" href="\${canonicalUrl}">`,
  `<meta name="description" content="\${escapeHtml(description)}">
\${noindex ? '<meta name="robots" content="noindex,follow">\\n' : ''}<link rel="canonical" href="\${canonicalUrl}">`,
  'blogLayout() -> podmienený noindex meta tag');

// ═══════════════════════ 2) nová funkcia facultyQuizWidgetPPC(), pred /skola/:uSlug/:fSlug routou ═══════════════════════
const OLD_ROUTE_ANCHOR = `app.get('/skola/:uSlug/:fSlug', async (req, res) => {`;

const NEW_ROUTE_ANCHOR = `function facultyQuizWidgetPPC(lang, statements, appCat) {
  const isCs = lang === 'cs';
  const total = statements.length;
  const likertLo = isCs ? 'Nesouhlasím' : 'Nesúhlasím';
  const likertHi = isCs ? 'Souhlasím' : 'Súhlasím';
  const qHtml = statements.map(function(s, i) {
    return '<div class="fq-q"><p>' + escapeHtml(s[lang]) + '</p><div class="fq-scale" data-q="' + i + '">'
      + '<button type="button" data-v="1">1</button><button type="button" data-v="2">2</button><button type="button" data-v="3">3</button><button type="button" data-v="4">4</button><button type="button" data-v="5">5</button>'
      + '</div><div class="fq-scale-labels"><span>' + likertLo + '</span><span>' + likertHi + '</span></div></div>';
  }).join('');
  const quizHeading = isCs ? 'Sedí ti tento obor?' : 'Sedí ti tento odbor?';
  const quizSub = isCs ? 'Rychlý test — 3 otázky, půl minuty.' : 'Rýchly test — 3 otázky, pol minúty.';
  const submitLabel = isCs ? 'Zjistit shodu →' : 'Zistiť zhodu →';
  const verdictHigh = isCs ? 'Vypadá to, že by ti to mohlo sedět!' : 'Vyzerá to, že by ti to mohlo sedieť!';
  const verdictMid = isCs ? 'Částečná shoda — stojí za to prozkoumat i jiné obory.' : 'Čiastočná zhoda — oplatí sa preskúmať aj iné odbory.';
  const verdictLow = isCs ? 'Asi to není přesně pro tebe.' : 'Asi to nie je presne pre teba.';
  const goodCtaLabel = isCs ? 'Začít se připravovat zdarma →' : 'Začni sa pripravovať zadarmo →';
  const goodCtaHref = '/app?cat=' + encodeURIComponent(appCat) + '&upgrade=free' + (isCs ? '&lang=cs' : '');
  const weakCtaLabel = isCs ? 'Zjistit, co ti sedí nejvíc →' : 'Zistiť, čo ti sedí najviac →';
  const weakCtaHref = '/kam-na-vysoku' + (isCs ? '?lang=cs' : '');

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
    + '.fac-uni{color:var(--text2);font-size:.95rem;margin:.2rem 0 .6rem}'
    + '.fac-ppc-trust{color:var(--text3);font-size:.82rem;margin:0 0 1rem}'
    + '.faculty-quiz{margin-top:1rem;padding:1.5rem;background:var(--black2);border:1px solid var(--border2);border-radius:16px}'
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
    + 'var ctaHtml=pct>=55?\\'<a class="fq-cta" href="' + goodCtaHref + '">' + goodCtaLabel + '</a>\\':\\'<a class="fq-cta" href="' + weakCtaHref + '">' + weakCtaLabel + '</a>\\';'
    + 'document.getElementById("fqQuestions").style.display="none";'
    + 'document.getElementById("fqSubmit").style.display="none";'
    + 'var r=document.getElementById("fqResult");r.style.display="block";'
    + 'r.innerHTML=\\'<div class="fq-pct">\\'+pct+\\'%</div><p>\\'+verdict+\\'</p>\\'+ctaHtml;'
    + '};'
    + '})();</script>';
}

app.get('/skola/:uSlug/:fSlug', async (req, res) => {`;

server = replaceOnce(server, OLD_ROUTE_ANCHOR, NEW_ROUTE_ANCHOR, 'pridanie facultyQuizWidgetPPC() funkcie');

// ═══════════════════════ 3) route -> vetva pre ?ppc=1, hneď po výpočte title/description ═══════════════════════
const OLD_TITLE_DESC = `  const description = (isCs ? 'Zjisti zdarma za minutu, jestli se pro tebe hodí ' : 'Zisti zadarmo za minútu, či sa pre teba hodí ') + rec.faculty + ' (' + rec.university + ', ' + rec.city + ').';
  const langQS = isCs ? '?lang=cs' : '';`;

const NEW_TITLE_DESC = `  const description = (isCs ? 'Zjisti zdarma za minutu, jestli se pro tebe hodí ' : 'Zisti zadarmo za minútu, či sa pre teba hodí ') + rec.faculty + ' (' + rec.university + ', ' + rec.city + ').';

  if (req.query.ppc === '1') {
    const primaryTag = rec.tags[0];
    const appCat = QUIZ_APP_CAT[primaryTag] || 'vsp';
    const all = QUIZ_STATEMENTS[primaryTag] || [];
    const ppcStatements = [all[0], all[2], all[4]].filter(Boolean);
    const trustLine = isCs
      ? 'AI příprava na přijímací testy — rychlý test zdarma, žádný závazek.'
      : 'AI príprava na prijímacie testy — rýchly test zadarmo, žiadny záväzok.';
    const ppcBody = '<main class="page">'
      + '<section class="fac-hero">'
      + '<div class="fac-eyebrow">' + flag + ' ' + escapeHtml(rec.city) + '</div>'
      + '<h1 class="hero-title">' + (isCs ? 'Sedí ti ' : 'Sedí ti ') + escapeHtml(rec.faculty) + '?</h1>'
      + '<p class="fac-uni">' + escapeHtml(rec.university) + '</p>'
      + '<p class="fac-ppc-trust">' + trustLine + '</p>'
      + '</section>'
      + facultyQuizWidgetPPC(lang, ppcStatements, appCat)
      + '</main>';
    return res.send(blogLayout({ title: title, description: description, body: ppcBody, canonicalPath: '/skola/' + rec.uSlug + '/' + rec.fSlug, lang: lang, ogType: 'website', noindex: true }));
  }

  const langQS = isCs ? '?lang=cs' : '';`;

server = replaceOnce(server, OLD_TITLE_DESC, NEW_TITLE_DESC, 'route -> ?ppc=1 vetva (krátka verzia bez registrácie)');

const backup = SERVER_PATH + '.pre-faculty-ppc-landing-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, server);

console.log('✅ PPC verzia fakultných stránok hotová — /skola/univerzita/fakulta?ppc=1');
console.log('   3 otázky, okamžitý výsledok, jedno CTA rovno do appky, noindex, bez registrácie.');
console.log('   Záloha:', backup);
console.log('   Over syntax pred reštartom: node -c server.js');
