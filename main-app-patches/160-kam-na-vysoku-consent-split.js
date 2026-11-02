// Opravuje GDPR bundling problem na /kam-na-vysoku (kariérny kvíz):
// pôvodne JEDEN mandatory checkbox bundloval "pošli mi výsledok testu"
// (nutné pre samotnú službu) s "posielaj mi súvisiace ponuky" (marketing) —
// a keďže ho bolo treba zaškrtnúť aby vôbec fungovalo tlačidlo na Google
// login, marketing súhlas bol de facto podmienkou používania kvízu.
// K tomu server-side cron (sendPendingQuizEmails) mal
// .eq('marketing_consent', true) na CELÝ dotaz vrátane stage 0 (samotné
// odoslanie výsledku) — takže kto by teoreticky mal marketing_consent
// false, by nedostal ani svoj vlastný výsledok testu.
//
// Fix:
//  1) public/kam-na-vysoku.html — rozdelenie na 2 checkboxy:
//     - "consentCheck" (mandatory, gatuje Google login tlačidlo) — teraz
//       len o zaslaní výsledku, nie o marketingu.
//     - "marketingConsentCheck" (nový, voliteľný, NEzaškrtnutý defaultne,
//       negatuje nič) — jeho stav sa posiela ako career_quiz_results.marketing_consent.
//  2) server.js — cron dotaz už nefiltruje stage 0 podľa marketing_consent
//     (výsledok sa pošle vždy, keďže si oň človek priamo požiadal), a
//     marketing_consent teraz gatuje LEN nasledujúcu drip sekvenciu
//     (stage >= 1) — ak je false, sekvencia sa tam rovno ukončí.
//
// Spusti z korena hlavnej appky (kde su server.js aj public/):
//   node main-app-patches/160-kam-na-vysoku-consent-split.js

const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(process.cwd(), 'public', 'kam-na-vysoku.html');
const SERVER_PATH = path.join(process.cwd(), 'server.js');

for (const p of [HTML_PATH, SERVER_PATH]) {
  if (!fs.existsSync(p)) {
    console.error('❌ Nenašiel som súbor:', p, '— spusti tento skript z koreňa hlavnej appky.');
    process.exit(1);
  }
}

const LOCK = path.join(process.cwd(), '.160-kam-na-vysoku-consent-split-lock');
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

function replaceOnceRegex(src, regex, buildNew, label) {
  const g = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
  const matches = src.match(g);
  const count = matches ? matches.length : 0;
  if (count !== 1) {
    console.error('❌ ' + label + ' — kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil.');
    process.exit(1);
  }
  return src.replace(regex, buildNew);
}

// ═══════════════════════ public/kam-na-vysoku.html ═══════════════════════
let html = fs.readFileSync(HTML_PATH, 'utf8');

if (html.includes('marketingConsentCheck')) {
  console.error('❌ kam-na-vysoku.html: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// 1) HTML — druhý (voliteľný) checkbox
html = replaceOnce(html,
  `      <label class="consent-row">
        <input type="checkbox" id="consentCheck" onchange="updateGoogleBtnState()">
        <span id="tConsentText">Súhlasím, že mi SP Tréner môže poslať výsledok tohto testu a súvisiace ponuky e-mailom. Bez súhlasu žiaľ výsledok nemôžeme odoslať.</span>
      </label>
      <button class="google-btn" id="googleLoginBtn" onclick="startLoginKV()" disabled>`,
  `      <label class="consent-row">
        <input type="checkbox" id="consentCheck" onchange="updateGoogleBtnState()">
        <span id="tConsentText">Súhlasím, že mi SP Tréner pošle výsledok tohto testu e-mailom.</span>
      </label>
      <label class="consent-row">
        <input type="checkbox" id="marketingConsentCheck">
        <span id="tMarketingConsentText">Chcem dostávať aj súvisiace tipy na prípravu a časovo obmedzené ponuky e-mailom (voliteľné, kedykoľvek sa dá odhlásiť).</span>
      </label>
      <button class="google-btn" id="googleLoginBtn" onclick="startLoginKV()" disabled>`,
  'HTML: gateSection checkboxy');

// 2) SK i18n — consentText prepis + nový marketingConsentText kľúč
html = replaceOnce(html,
  `    consentText:'Súhlasím, že mi SP Tréner môže poslať výsledok tohto testu a súvisiace ponuky e-mailom. Bez súhlasu žiaľ výsledok nemôžeme odoslať.',`,
  `    consentText:'Súhlasím, že mi SP Tréner pošle výsledok tohto testu e-mailom.', marketingConsentText:'Chcem dostávať aj súvisiace tipy na prípravu a časovo obmedzené ponuky e-mailom (voliteľné, kedykoľvek sa dá odhlásiť).',`,
  'i18n SK consentText');

// 3) CZ i18n — consentText prepis + nový marketingConsentText kľúč
html = replaceOnce(html,
  `    consentText:'Souhlasím, že mi SP Tréner může poslat výsledek tohoto testu a související nabídky e-mailem. Bez souhlasu bohužel výsledek nemůžeme odeslat.',`,
  `    consentText:'Souhlasím, že mi SP Tréner pošle výsledek tohoto testu e-mailem.', marketingConsentText:'Chci dostávat i související tipy na přípravu a časově omezené nabídky e-mailem (volitelné, kdykoliv se dá odhlásit).',`,
  'i18n CZ consentText');

// 4) setLang() — nastav aj text nového checkboxu pri prepnutí jazyka
html = replaceOnce(html,
  `  document.getElementById('tConsentText').textContent = t.consentText;`,
  `  document.getElementById('tConsentText').textContent = t.consentText;
  document.getElementById('tMarketingConsentText').textContent = t.marketingConsentText;`,
  'setLang() tMarketingConsentText');

// 5) JS logika — resultConsent (mandatory, gatuje tlačidlo) oddelený od
//    marketingConsent (voliteľný, nič negatuje)
html = replaceOnce(html,
  `let marketingConsent = false;
function updateGoogleBtnState(){
  marketingConsent = !!document.getElementById('consentCheck').checked;
  document.getElementById('googleLoginBtn').disabled = !marketingConsent;
}`,
  `let resultConsent = false;
let marketingConsent = false;
function updateGoogleBtnState(){
  resultConsent = !!document.getElementById('consentCheck').checked;
  document.getElementById('googleLoginBtn').disabled = !resultConsent;
}`,
  'updateGoogleBtnState() resultConsent split');

html = replaceOnce(html,
  `function startLoginKV(){
  if (!marketingConsent) return;
  sessionStorage.setItem('kv_answers', JSON.stringify(answers));
  sessionStorage.setItem('kv_reflections', JSON.stringify(reflections));
  sessionStorage.setItem('kv_consent', '1');
  sessionStorage.setItem('kv_pending_reveal', '1');`,
  `function startLoginKV(){
  if (!resultConsent) return;
  marketingConsent = !!document.getElementById('marketingConsentCheck').checked;
  sessionStorage.setItem('kv_answers', JSON.stringify(answers));
  sessionStorage.setItem('kv_reflections', JSON.stringify(reflections));
  sessionStorage.setItem('kv_consent', marketingConsent ? '1' : '0');
  sessionStorage.setItem('kv_pending_reveal', '1');`,
  'startLoginKV() real marketing opt-in capture');

// ═══════════════════════ server.js ═══════════════════════
let server = fs.readFileSync(SERVER_PATH, 'utf8');

if (server.includes("marketing_consent.eq.true,email_sequence_stage.eq.0")) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// 1) cron dotaz — uz nevynechava stage 0 (vysledok) kvoli marketing_consent
server = replaceOnce(server,
  `.eq('marketing_consent', true)`,
  `.or('marketing_consent.eq.true,email_sequence_stage.eq.0')`,
  'sendPendingQuizEmails() query filter');

// 2) guard — ak stage >= 1 a marketing_consent je false, sekvencia sa tu
//    ukonci (bez odoslania marketingoveho mailu), zachovava presnu
//    indentaciu zo zivého suboru
server = replaceOnceRegex(server,
  /^([ \t]*)if \(stage === 0\) \{/m,
  (match, indent) =>
    `${indent}if (stage >= 1 && !lead.marketing_consent) {\n` +
    `${indent}  await supabase.from('career_quiz_results').update({ email_sequence_stage: 4 }).eq('id', lead.id);\n` +
    `${indent}  continue;\n` +
    `${indent}}\n\n` +
    `${indent}if (stage === 0) {`,
  'sendPendingQuizEmails() stage>=1 consent guard');

// ═══════════════════════ zápis ═══════════════════════
const htmlBackup = HTML_PATH + '.pre-consent-split-' + Date.now();
const serverBackup = SERVER_PATH + '.pre-consent-split-' + Date.now();
fs.copyFileSync(HTML_PATH, htmlBackup);
fs.copyFileSync(SERVER_PATH, serverBackup);
fs.writeFileSync(HTML_PATH, html);
fs.writeFileSync(SERVER_PATH, server);

console.log('✅ /kam-na-vysoku: výsledok testu a marketingový súhlas oddelené (2 checkboxy), cron už neblokuje odoslanie výsledku kvôli marketing_consent.');
console.log('   Zálohy:', htmlBackup, serverBackup);
console.log('   Over syntax pred reštartom: node -c server.js');
