// Prida VOLITEĽNÝ krok po instantnom mini-teste (main-app-patches/176):
// registracia cez Google + rovnaky PNG+QR zdielatelny obrazok ako ma
// kam-na-vysoku.html, plus zapis do career_quiz_results (takze existujuci
// email drip cron automaticky zaradi aj tychto leadov). Logika je v
// samostatnom static subore public/js/faculty-quiz-full.js — NIE
// vnorena v dalsom leveli template literalov v server.js (uz je tu
// dost hlbokeho escapovania z patchu 176).
//
// Zostava PRAVDIVE: instantny bez-registracny vysledok (main-app-patches/176)
// ostava presne taky, ako je — tento krok je jasne oznaceny ako
// dobrovolny bonus ("Chceš aj obrázok...?"), nie povinnost na vidiet
// zakladny vysledok.
//
// Predpoklad: main-app-patches/173, 175 a 176 uz su aplikovane, a
// public/js/faculty-quiz-full.js uz je nahraty (z git repa priamo, nie
// cez tento patch skript).
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/177-faculty-quiz-registration.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
const WIDGET_JS_PATH = path.join(process.cwd(), 'public', 'js', 'faculty-quiz-full.js');

if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}
if (!fs.existsSync(WIDGET_JS_PATH)) {
  console.error('❌ Nenašiel som', WIDGET_JS_PATH, '— najprv ho nahraj (je v git repe na ceste public/js/faculty-quiz-full.js), potom spusti tento skript znova.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.177-faculty-quiz-registration-lock');
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

if (server.includes('fqRegisterSection')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// 1) scoring JS -> zavolaj window.__facultyQuizShowRegister(pct, dimenzie) po vykreslení výsledku
const OLD_SCORE_END = `+ 'r.innerHTML=\\'<div class="fq-pct">\\'+pct+\\'%</div>\\'+barsHtml+\\'<p>\\'+verdict+\\'</p>\\'+gapHtml+\\'<a class="fq-cta" href="' + ctaHref + '">' + ctaLabel + '</a><a class="fq-cta-secondary" href="' + homeHref + '">' + homeLabel + '</a>\\';'
    + '};'`;

const NEW_SCORE_END = `+ 'r.innerHTML=\\'<div class="fq-pct">\\'+pct+\\'%</div>\\'+barsHtml+\\'<p>\\'+verdict+\\'</p>\\'+gapHtml+\\'<a class="fq-cta" href="' + ctaHref + '">' + ctaLabel + '</a><a class="fq-cta-secondary" href="' + homeHref + '">' + homeLabel + '</a>\\';'
    + 'if(window.__facultyQuizShowRegister)window.__facultyQuizShowRegister(pct,{interest:pInterest,aptitude:pAptitude,reality:pReality});'
    + '};'`;

server = replaceOnce(server, OLD_SCORE_END, NEW_SCORE_END, 'scoring JS -> __facultyQuizShowRegister volanie');

// 2) route handler -> pridaj registračnú sekciu + CDN skripty + FACULTY_CONTEXT
const OLD_BODY_TAIL = `    + facultyQuizWidget(lang, statements)
    + '<section class="fac-about">'`;

const NEW_BODY_TAIL = `    + facultyQuizWidget(lang, statements)
    + registerSectionHtml(rec, lang, isCs)
    + '<section class="fac-about">'`;

server = replaceOnce(server, OLD_BODY_TAIL, NEW_BODY_TAIL, 'body -> vlož registerSectionHtml()');

// 3) pridaj funkciu registerSectionHtml() pred /skola/:uSlug/:fSlug routu
const OLD_ROUTE_ANCHOR = `app.get('/skola/:uSlug/:fSlug', async (req, res) => {`;

const NEW_ROUTE_ANCHOR = `function registerSectionHtml(rec, lang, isCs) {
  const primaryTag = rec.tags[0];
  const ctxObj = { faculty: rec.faculty, university: rec.university, city: rec.city, tag: primaryTag, icon: FIELD_ICONS[primaryTag] || '', lang: lang };
  const registerHeading = isCs ? 'Chceš i obrázek a uložený výsledek?' : 'Chceš aj obrázok a uložený výsledok?';
  const registerSub = isCs ? 'Nepovinné — přihlas se přes Google a získej obrázek ke sdílení, osobní přehled a upozornění na přípravu.' : 'Nepovinné — prihlás sa cez Google a získaj obrázok na zdieľanie, osobný prehľad a upozornenia na prípravu.';
  const vopLabel = isCs ? 'Souhlasím s <a href="/legal.html#vop" target="_blank">podmínkami</a> a <a href="/legal.html#privacy" target="_blank">ochranou osobních údajů</a>.' : 'Súhlasím s <a href="/legal.html#vop" target="_blank">podmienkami</a> a <a href="/legal.html#privacy" target="_blank">ochranou osobných údajov</a>.';
  const marketingLabel = isCs ? 'Chci dostávat i doporučení a nabídky partnerů (volitelné).' : 'Chcem dostávať aj odporúčania a ponuky partnerov (voliteľné).';
  const registerBtnLabel = isCs ? 'Přihlásit se přes Google →' : 'Prihlásiť sa cez Google →';
  return '<div class="faculty-quiz" id="fqRegisterSection" style="display:none">'
    + '<h2>' + registerHeading + '</h2>'
    + '<p class="fq-sub">' + registerSub + '</p>'
    + '<label class="fq-consent-row"><input type="checkbox" id="fqVopCheckbox"><span>' + vopLabel + '</span></label>'
    + '<label class="fq-consent-row"><input type="checkbox" id="fqMarketingCheckbox"><span>' + marketingLabel + '</span></label>'
    + '<button id="fqRegisterBtn" class="fq-submit" disabled>' + registerBtnLabel + '</button>'
    + '<div id="fqRegisterBox" style="margin-top:1rem;text-align:center"></div>'
    + '</div>'
    + '<style>.fq-consent-row{display:flex;gap:.5rem;align-items:flex-start;font-size:.82rem;color:var(--text2);margin-bottom:.7rem}.fq-consent-row input{margin-top:.2rem}.fq-consent-row a{color:var(--volt)}</style>'
    + '<script>window.FACULTY_CONTEXT=' + JSON.stringify(ctxObj) + ';</script>'
    + '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>'
    + '<script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js"></script>'
    + '<script src="/js/faculty-quiz-full.js"></script>';
}

app.get('/skola/:uSlug/:fSlug', async (req, res) => {`;

server = replaceOnce(server, OLD_ROUTE_ANCHOR, NEW_ROUTE_ANCHOR, 'pridanie registerSectionHtml() funkcie');

const backup = SERVER_PATH + '.pre-faculty-quiz-registration-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, server);

console.log('✅ Voliteľná registrácia (Google + PNG/QR obrázok + career_quiz_results zápis) pridaná po instantnom teste.');
console.log('   Záloha:', backup);
console.log('   Over syntax pred reštartom: node -c server.js');
