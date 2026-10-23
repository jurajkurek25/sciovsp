// Zmena rozhodnutia (potvrdena uzivatelom): plny vysledok mini-testu
// (percenta + rozpad Zaujem/Predpoklady/Realita + verdikt) sa uz
// NEZOBRAZUJE hned po vyplneni testu. Namiesto toho sa zobrazi len
// teaser ("Test dokončený! Prihlás sa cez Google a zisti ho.") a plny
// vysledok sa vykresli az po registracii (public/js/faculty-quiz-full.js
// uz to tak robi — finishReveal() prepise #fqResult skutocnym obsahom,
// takze staci zmenit, co sa vypise PRED registraciou).
//
// DOLEZITE: predchadzajuci "🔒 Bez záväzkov — výsledok hneď, žiadna
// registrácia" trust-bullet a "zadarmo, bez registrácie" v popise testu
// by boli po tejto zmene NEPRAVDIVE — nahradene honest verziou.
//
// Predpoklad: main-app-patches/173, 175, 176, 177, 178 uz su aplikovane.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/180-faculty-quiz-gate-result.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');

if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.180-faculty-quiz-gate-result-lock');
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

if (server.includes('fq-teaser')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}
if (!server.includes('function registerSectionHtml(')) {
  console.error('❌ Nenašiel som registerSectionHtml() — over, či je main-app-patches/177 už aplikovaný. Nič som nezmenil.');
  process.exit(1);
}

// ═══════════════════════ 1) teaserText const, hneď za gapWarning ═══════════════════════
const OLD_GAP = `  const gapWarning = isCs
    ? 'Zajímá tě to víc, než kolik si zatím umíš představit realitu tohoto povolání — vyplatí se to prozkoumat hlouběji (např. promluvit si s někým, kdo to už dělá).'
    : 'Zaujíma ťa to viac, než koľko si zatiaľ vieš predstaviť realitu tohto povolania — oplatí sa to preskúmať hlbšie (napr. porozprávať sa s niekým, kto to už robí).';
  const quizHeading = isCs ? 'Sedí ti tento obor?' : 'Sedí ti tento odbor?';`;

const NEW_GAP = `  const gapWarning = isCs
    ? 'Zajímá tě to víc, než kolik si zatím umíš představit realitu tohoto povolání — vyplatí se to prozkoumat hlouběji (např. promluvit si s někým, kdo to už dělá).'
    : 'Zaujíma ťa to viac, než koľko si zatiaľ vieš predstaviť realitu tohto povolania — oplatí sa to preskúmať hlbšie (napr. porozprávať sa s niekým, kto to už robí).';
  const teaserText = isCs
    ? 'Test dokončen! ✅ Tvůj výsledek je připravený — přihlas se přes Google níže a zjisti ho.'
    : 'Test dokončený! ✅ Tvoj výsledok je pripravený — prihlás sa cez Google nižšie a zisti ho.';
  const quizHeading = isCs ? 'Sedí ti tento obor?' : 'Sedí ti tento odbor?';`;

server = replaceOnce(server, OLD_GAP, NEW_GAP, 'teaserText const definícia');

// ═══════════════════════ 2) quizSub -> už netvrdí "bez registrácie" ═══════════════════════
const OLD_SUB = `  const quizSub = isCs ? 'Hlubší test — zájem, předpoklady i realita povolání. Zabere 2 minuty, zdarma, bez registrace.' : 'Hlbší test — záujem, predpoklady aj realita povolania. Zaberie 2 minúty, zadarmo, bez registrácie.';`;
const NEW_SUB = `  const quizSub = isCs ? 'Hlubší test — zájem, předpoklady i realita povolání. Zabere 2 minuty, zdarma. Výsledek uvidíš po přihlášení přes Google.' : 'Hlbší test — záujem, predpoklady aj realita povolania. Zaberie 2 minúty, zadarmo. Výsledok uvidíš po prihlásení cez Google.';`;

server = replaceOnce(server, OLD_SUB, NEW_SUB, 'quizSub -> odstránenie "bez registrácie"');

// ═══════════════════════ 3) scoring JS -> vypíš teaser namiesto plného výsledku ═══════════════════════
const OLD_SCORE_END = `+ 'r.innerHTML=\\'<div class="fq-pct">\\'+pct+\\'%</div>\\'+barsHtml+\\'<p>\\'+verdict+\\'</p>\\'+gapHtml+\\'\\';'
    + 'if(window.__facultyQuizShowRegister)window.__facultyQuizShowRegister(pct,{interest:pInterest,aptitude:pAptitude,reality:pReality});'
    + '};'`;

const NEW_SCORE_END = `+ 'r.innerHTML=\\'<p class="fq-teaser">\\'+' + JSON.stringify(teaserText) + '+\\'</p>\\';'
    + 'if(window.__facultyQuizShowRegister)window.__facultyQuizShowRegister(pct,{interest:pInterest,aptitude:pAptitude,reality:pReality});'
    + '};'`;

server = replaceOnce(server, OLD_SCORE_END, NEW_SCORE_END, 'scoring JS -> teaser namiesto plného výsledku pred registráciou');

// ═══════════════════════ 4) CSS -> .fq-teaser ═══════════════════════
server = replaceOnce(server,
  `    + '.fq-cta-secondary:hover{color:var(--text)}'
    + '</style>'`,
  `    + '.fq-cta-secondary:hover{color:var(--text)}'
    + '.fq-teaser{font-size:1.05rem;color:var(--text2);text-align:center;padding:.5rem 0}'
    + '</style>'`,
  'CSS: .fq-teaser');

// ═══════════════════════ 5) trust bullet -> už netvrdí "žiadna registrácia" ═══════════════════════
const OLD_TRUST = `  const trustItems = isCs ? [
    '🎯 Test postavený na stejné metodice jako náš AI generátor otázek',
    '🔒 Bez závazků — výsledek hned, žádná registrace',
    '🇸🇰🇨🇿 Pokrýváme všechny veřejné vysoké školy na Slovensku i v Česku'
  ] : [
    '🎯 Test postavený na rovnakej metodike ako náš AI generátor otázok',
    '🔒 Bez záväzkov — výsledok hneď, žiadna registrácia',
    '🇸🇰🇨🇿 Pokrývame všetky verejné vysoké školy na Slovensku aj v Česku'
  ];`;

const NEW_TRUST = `  const trustItems = isCs ? [
    '🎯 Test postavený na stejné metodice jako náš AI generátor otázek',
    '🔒 Rychlý test zdarma — výsledek zjistíš hned po přihlášení přes Google',
    '🇸🇰🇨🇿 Pokrýváme všechny veřejné vysoké školy na Slovensku i v Česku'
  ] : [
    '🎯 Test postavený na rovnakej metodike ako náš AI generátor otázok',
    '🔒 Rýchly test zadarmo — výsledok zistíš hneď po prihlásení cez Google',
    '🇸🇰🇨🇿 Pokrývame všetky verejné vysoké školy na Slovensku aj v Česku'
  ];`;

server = replaceOnce(server, OLD_TRUST, NEW_TRUST, 'trust bullet -> honest verzia (výsledok po prihlásení)');

// ═══════════════════════ 6) registerSectionHtml -> "zisti výsledok", nie "nepovinný bonus" ═══════════════════════
const OLD_REGISTER_COPY = `  const registerHeading = isCs ? 'Chceš i obrázek a uložený výsledek?' : 'Chceš aj obrázok a uložený výsledok?';
  const registerSub = isCs ? 'Nepovinné — přihlas se přes Google a získej obrázek ke sdílení, osobní přehled a upozornění na přípravu.' : 'Nepovinné — prihlás sa cez Google a získaj obrázok na zdieľanie, osobný prehľad a upozornenia na prípravu.';`;

const NEW_REGISTER_COPY = `  const registerHeading = isCs ? 'Zjisti svůj výsledek' : 'Zisti svoj výsledok';
  const registerSub = isCs ? 'Přihlas se přes Google (10 sekund) a hned uvidíš přesnou shodu, rozbor podle oblastí i obrázek ke sdílení.' : 'Prihlás sa cez Google (10 sekúnd) a hneď uvidíš presnú zhodu, rozbor podľa oblastí aj obrázok na zdieľanie.';`;

server = replaceOnce(server, OLD_REGISTER_COPY, NEW_REGISTER_COPY, 'registerSectionHtml -> "zisti výsledok" namiesto "nepovinný bonus"');

const backup = SERVER_PATH + '.pre-faculty-quiz-gate-result-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, server);

console.log('✅ Plný výsledok mini-testu (percentá, rozpad, verdikt) sa teraz zobrazí až po prihlásení cez Google. Pred registráciou je len teaser. Trust-bullet aj popis testu už netvrdia "bez registrácie".');
console.log('   Záloha:', backup);
console.log('   Over syntax pred reštartom: node -c server.js');
