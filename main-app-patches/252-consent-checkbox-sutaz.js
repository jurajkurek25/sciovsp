// public/sutaz.html (súťažná prihláška) už má 2 povinné checkboxy (vek,
// štatút), ale žiadny VOLITEĽNÝ marketingový súhlas pre affiliate partnerov.
// routes/sutaz.js (POST /api/sutaz/apply) nikdy nečítalo marketingConsent.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/252-consent-checkbox-sutaz.js

const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(process.cwd(), 'public', 'sutaz.html');
const ROUTE_PATH = path.join(process.cwd(), 'routes', 'sutaz.js');

for (const p of [HTML_PATH, ROUTE_PATH]) {
  if (!fs.existsSync(p)) {
    console.error('❌ Nenašiel som súbor:', p, '— spusti tento skript z koreňa hlavnej appky.');
    process.exit(1);
  }
}

const LOCK = path.join(process.cwd(), '.252-consent-checkbox-sutaz-lock');
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

// ═══════════════════════ public/sutaz.html ═══════════════════════
let html = fs.readFileSync(HTML_PATH, 'utf8');

if (html.includes('fMarketingConsent')) {
  console.error('❌ sutaz.html: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

const HTML_OLD = `      <div class="consent-row"><input type="checkbox" id="fStatute" required><label for="fStatute">Oboznámil/a som sa so <a href="#" id="fStatuteLink" target="_blank">štatútom súťaže</a> a súhlasím s jeho podmienkami. *</label></div>
      <div class="privacy-note">`;
const HTML_NEW = `      <div class="consent-row"><input type="checkbox" id="fStatute" required><label for="fStatute">Oboznámil/a som sa so <a href="#" id="fStatuteLink" target="_blank">štatútom súťaže</a> a súhlasím s jeho podmienkami. *</label></div>
      <div class="consent-row"><input type="checkbox" id="fMarketingConsent"><label for="fMarketingConsent">Chcem dostávať aj odporúčania a ponuky partnerov (voliteľné, kedykoľvek sa dá odhlásiť).</label></div>
      <div class="privacy-note">`;

if (!html.includes(HTML_OLD)) {
  console.error('❌ Nenašiel som presnú kotvu (fStatute consent-row). Nič som nezmenil.');
  process.exit(1);
}
html = replaceOnce(html, HTML_OLD, HTML_NEW, 'sutaz.html: marketing checkbox za fStatute');

const JS_OLD = `      fd.append('ageConfirmed', 'true');
      fd.append('statuteAck', 'true');`;
const JS_NEW = `      fd.append('ageConfirmed', 'true');
      fd.append('statuteAck', 'true');
      fd.append('marketingConsent', document.getElementById('fMarketingConsent').checked ? 'true' : 'false');`;

if (!html.includes(JS_OLD)) {
  console.error('❌ Nenašiel som presnú kotvu (fd.append ageConfirmed/statuteAck). Nič som nezmenil.');
  process.exit(1);
}
html = replaceOnce(html, JS_OLD, JS_NEW, 'sutaz.html: marketingConsent v FormData');

// ═══════════════════════ routes/sutaz.js ═══════════════════════
let route = fs.readFileSync(ROUTE_PATH, 'utf8');

if (route.includes('marketingConsent')) {
  console.error('❌ routes/sutaz.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

const ROUTE_OLD = `      const { fullName, contactEmail, residenceMunicipality, residenceCountry, schoolName, studyProgram, admissionDecisionDate, ageConfirmed, statuteAck } = req.body || {};`;
const ROUTE_NEW = `      const { fullName, contactEmail, residenceMunicipality, residenceCountry, schoolName, studyProgram, admissionDecisionDate, ageConfirmed, statuteAck, marketingConsent } = req.body || {};`;

if (!route.includes(ROUTE_OLD)) {
  console.error('❌ Nenašiel som presnú kotvu (destructure req.body). Nič som nezmenil.');
  process.exit(1);
}
route = replaceOnce(route, ROUTE_OLD, ROUTE_NEW, 'routes/sutaz.js: marketingConsent destructure');

const ROUTE_OLD2 = `      if (statuteAck !== 'true' && statuteAck !== true) {
        return res.status(400).json({ error: 'Musíš potvrdiť, že si sa oboznámil/a so štatútom súťaže.' });
      }
      if (!req.file) return res.status(400).json({ error: 'Chýba doklad o prijatí na vysokú školu.' });`;
const ROUTE_NEW2 = `      if (statuteAck !== 'true' && statuteAck !== true) {
        return res.status(400).json({ error: 'Musíš potvrdiť, že si sa oboznámil/a so štatútom súťaže.' });
      }
      if (marketingConsent !== undefined) {
        await supabase.from('users').update({ marketing_emails_opt_out: !(marketingConsent === 'true' || marketingConsent === true) }).eq('email', email);
      }
      if (!req.file) return res.status(400).json({ error: 'Chýba doklad o prijatí na vysokú školu.' });`;

if (!route.includes(ROUTE_OLD2)) {
  console.error('❌ Nenašiel som presnú kotvu (statuteAck validácia / req.file check). Nič som nezmenil.');
  process.exit(1);
}
route = replaceOnce(route, ROUTE_OLD2, ROUTE_NEW2, 'routes/sutaz.js: marketingConsent wiring');

const now = Date.now();
fs.copyFileSync(HTML_PATH, HTML_PATH + '.pre-252-' + now);
fs.copyFileSync(ROUTE_PATH, ROUTE_PATH + '.pre-252-' + now);
fs.writeFileSync(HTML_PATH, html);
fs.writeFileSync(ROUTE_PATH, route);

console.log('✅ sutaz.html + routes/sutaz.js: voliteľný marketingový checkbox pridaný k prihláške.');
console.log('   pm2 restart sptrener-main (routes/sutaz.js nie je statický súbor)');
