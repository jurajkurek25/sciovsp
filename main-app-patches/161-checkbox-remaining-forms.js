// Prida mandatory VOP + volitelny marketing checkbox na zvysne formulare,
// ktore doteraz nemali ziadny consent checkbox vobec:
//  - public/darcekova-karta.html (nakup darcekovej karty, raw email formular)
//  - public/webinar.html (registracia na webinar, Google login gate)
//  - public/uplatnit-darcek.html (uplatnenie darcekovej karty, Google login gate)
// + zodpovedajuce 3 server routy (marketingConsent -> users.marketing_emails_opt_out),
// rovnaky vzor ako main-app-patches/157 (Premium/Elite checkout).
//
// public/ponuka.html a course checkout (kurz-detail.js) su zamerne
// VYNECHANE — su to pokracovania existujuceho (uz raz odsuhlaseneho) flow,
// nie nove registracie, potrebuju samostatne posudenie.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/161-checkbox-remaining-forms.js

const fs = require('fs');
const path = require('path');

const FILES = {
  darcek: path.join(process.cwd(), 'public', 'darcekova-karta.html'),
  webinar: path.join(process.cwd(), 'public', 'webinar.html'),
  uplatnit: path.join(process.cwd(), 'public', 'uplatnit-darcek.html'),
  server: path.join(process.cwd(), 'server.js')
};

for (const [key, p] of Object.entries(FILES)) {
  if (!fs.existsSync(p)) {
    console.error('❌ Nenašiel som súbor:', p, '— spusti tento skript z koreňa hlavnej appky.');
    process.exit(1);
  }
}

const LOCK = path.join(process.cwd(), '.161-checkbox-remaining-forms-lock');
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

const CONSENT_ROW_STYLE = 'display:flex;gap:.5rem;align-items:flex-start;font-weight:400;font-size:.85rem';
function vopLabel(id, marginCss) {
  return `<label style="${CONSENT_ROW_STYLE};margin:${marginCss}"><input type="checkbox" id="${id}" style="margin-top:.2rem"><span>Súhlasím s <a href="/legal.html#vop" target="_blank">obchodnými podmienkami</a> a <a href="/legal.html#privacy" target="_blank">ochranou osobných údajov</a>.</span></label>`;
}
function marketingLabel(id, marginCss) {
  return `<label style="${CONSENT_ROW_STYLE};margin:${marginCss}"><input type="checkbox" id="${id}" style="margin-top:.2rem"><span>Chcem dostávať aj odporúčania a ponuky partnerov (voliteľné, kedykoľvek sa dá odhlásiť).</span></label>`;
}

// ═══════════════════════ darcekova-karta.html ═══════════════════════
let darcek = fs.readFileSync(FILES.darcek, 'utf8');

if (darcek.includes('giftVopCheckbox')) {
  console.error('❌ darcekova-karta.html: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

darcek = replaceOnce(darcek,
  `<button class="buy-btn" id="buyBtn">Kúpiť darčekovú kartu</button>`,
  `${vopLabel('giftVopCheckbox', '.9rem 0 0')}\n    ${marketingLabel('giftMarketingCheckbox', '.5rem 0 1rem')}\n    <button class="buy-btn" id="buyBtn">Kúpiť darčekovú kartu</button>`,
  'darcekova-karta.html: checkboxy pred buyBtn');

darcek = replaceOnce(darcek,
  `if (!buyerEmail.includes('@')) { $('#formErr').textContent = 'Zadaj platný e-mail.'; return; }`,
  `if (!buyerEmail.includes('@')) { $('#formErr').textContent = 'Zadaj platný e-mail.'; return; }
  if (!$('#giftVopCheckbox').checked) { $('#formErr').textContent = 'Musíš súhlasiť s obchodnými podmienkami.'; return; }`,
  'darcekova-karta.html: mandatory VOP validácia');

darcek = replaceOnce(darcek,
  `refCode: sessionStorage.getItem('partner_ref') || null`,
  `refCode: sessionStorage.getItem('partner_ref') || null, marketingConsent: !!$('#giftMarketingCheckbox').checked`,
  'darcekova-karta.html: marketingConsent v body');

// ═══════════════════════ webinar.html ═══════════════════════
let webinar = fs.readFileSync(FILES.webinar, 'utf8');

if (webinar.includes('regVopCheckbox')) {
  console.error('❌ webinar.html: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

webinar = replaceOnce(webinar,
  `<input type="text" id="regName" placeholder="Tvoje meno">`,
  `<input type="text" id="regName" placeholder="Tvoje meno">\n    ${vopLabel('regVopCheckbox', '.7rem 0 0')}\n    ${marketingLabel('regMarketingCheckbox', '.4rem 0 .8rem')}`,
  'webinar.html: checkboxy za regName');

webinar = replaceOnce(webinar,
  `if (!currentUser) return;`,
  `if (!currentUser) return;
  if (!document.getElementById('regVopCheckbox').checked) { document.getElementById('regErr').textContent = 'Musíš súhlasiť s obchodnými podmienkami.'; return; }`,
  'webinar.html: mandatory VOP validácia v regSubmitBtn');

webinar = replaceOnce(webinar,
  `body: JSON.stringify({ name: name || null })`,
  `body: JSON.stringify({ name: name || null, marketingConsent: !!document.getElementById('regMarketingCheckbox').checked })`,
  'webinar.html: marketingConsent v submitRegistration');

// ═══════════════════════ uplatnit-darcek.html ═══════════════════════
let uplatnit = fs.readFileSync(FILES.uplatnit, 'utf8');

if (uplatnit.includes('redeemVopCheckbox')) {
  console.error('❌ uplatnit-darcek.html: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

uplatnit = replaceOnce(uplatnit,
  `<button class="btn" id="checkBtn">Uplatniť</button>`,
  `${vopLabel('redeemVopCheckbox', '.8rem 0 0')}${marketingLabel('redeemMarketingCheckbox', '.4rem 0 .8rem')}<button class="btn" id="checkBtn">Uplatniť</button>`,
  'uplatnit-darcek.html: checkboxy pred checkBtn');

uplatnit = replaceOnce(uplatnit,
  `if (!code) { err.textContent = 'Zadaj kód.'; return; }`,
  `if (!code) { err.textContent = 'Zadaj kód.'; return; }
  if (!document.getElementById('redeemVopCheckbox').checked) { err.textContent = 'Musíš súhlasiť s obchodnými podmienkami.'; return; }`,
  'uplatnit-darcek.html: mandatory VOP validácia v checkCode');

uplatnit = replaceOnce(uplatnit,
  `body: JSON.stringify({ code, courseId })`,
  `body: JSON.stringify({ code, courseId, marketingConsent: !!document.getElementById('redeemMarketingCheckbox').checked })`,
  'uplatnit-darcek.html: marketingConsent v redeem()');

// ═══════════════════════ server.js ═══════════════════════
let server = fs.readFileSync(FILES.server, 'utf8');

if (server.includes('const { code, courseId, marketingConsent }')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// 1) /api/gift-cards/checkout
server = replaceOnce(server,
  `const { buyerEmail, recipientName, message, refCode } = req.body || {};`,
  `const { buyerEmail, recipientName, message, refCode, marketingConsent } = req.body || {};`,
  'server.js: gift-cards/checkout destructure');

server = replaceOnce(server,
  `if (!buyerEmail || !buyerEmail.includes('@')) return res.status(400).json({ error: 'Zadaj platný e-mail.' });`,
  `if (!buyerEmail || !buyerEmail.includes('@')) return res.status(400).json({ error: 'Zadaj platný e-mail.' });
  if (marketingConsent !== undefined) {
    await supabase.from('users').update({ marketing_emails_opt_out: !marketingConsent }).eq('email', buyerEmail);
  }`,
  'server.js: gift-cards/checkout marketingConsent wiring');

// 2) /api/gift-cards/redeem
server = replaceOnce(server,
  `const { code, courseId } = req.body || {};`,
  `const { code, courseId, marketingConsent } = req.body || {};`,
  'server.js: gift-cards/redeem destructure');

server = replaceOnce(server,
  `if (!code) return res.status(400).json({ error: 'Zadaj kód.' });`,
  `if (!code) return res.status(400).json({ error: 'Zadaj kód.' });
  if (marketingConsent !== undefined) {
    await supabase.from('users').update({ marketing_emails_opt_out: !marketingConsent }).eq('email', email);
  }`,
  'server.js: gift-cards/redeem marketingConsent wiring');

// 3) /api/webinar/register
server = replaceOnce(server,
  `    const { name } = req.body || {};`,
  `    const { name, marketingConsent } = req.body || {};
    if (marketingConsent !== undefined) {
      await supabase.from('users').update({ marketing_emails_opt_out: !marketingConsent }).eq('email', email);
    }`,
  'server.js: webinar/register marketingConsent wiring');

// ═══════════════════════ zápis ═══════════════════════
const now = Date.now();
const backups = {};
for (const [key, p] of Object.entries(FILES)) {
  backups[key] = p + '.pre-checkbox-remaining-forms-' + now;
  fs.copyFileSync(p, backups[key]);
}
fs.writeFileSync(FILES.darcek, darcek);
fs.writeFileSync(FILES.webinar, webinar);
fs.writeFileSync(FILES.uplatnit, uplatnit);
fs.writeFileSync(FILES.server, server);

console.log('✅ Checkboxy pridané: darcekova-karta.html, webinar.html, uplatnit-darcek.html + server.js (3 routy).');
console.log('   Zálohy:', Object.values(backups).join(', '));
console.log('   Over syntax pred reštartom: node -c server.js');
