// public/generalka.html (SP Generálka, jednorazový nákup 5,90€) nemalo
// ŽIADEN consent checkbox vôbec -- ani povinný VOP, ani voliteľný
// marketingový (potvrdené naživo, grep "checkbox" na public/generalka.html
// nenašiel nič). routes/generalka.js tiež nikdy nečítalo marketingConsent
// z req.body.
//
// Dve stránky majú tlačidlo "Kúpiť" (buyBtnHero v hero sekcii, buyBtnFinal
// na konci stránky) -- obe volajú tú istú startCheckout(). Checkbox stačí
// raz, v hero sekcii (jediné miesto s existujúcim #landingErr), a
// startCheckout() ho overí bez ohľadu na to, ktoré tlačidlo spustilo platbu.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/251-consent-checkboxes-generalka.js

const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(process.cwd(), 'public', 'generalka.html');
const ROUTE_PATH = path.join(process.cwd(), 'routes', 'generalka.js');

for (const p of [HTML_PATH, ROUTE_PATH]) {
  if (!fs.existsSync(p)) {
    console.error('❌ Nenašiel som súbor:', p, '— spusti tento skript z koreňa hlavnej appky.');
    process.exit(1);
  }
}

const LOCK = path.join(process.cwd(), '.251-consent-checkboxes-generalka-lock');
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

// ═══════════════════════ public/generalka.html ═══════════════════════
let html = fs.readFileSync(HTML_PATH, 'utf8');

if (html.includes('generalkaVopCheckbox')) {
  console.error('❌ generalka.html: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

const CONSENT_STYLE = 'display:flex;gap:.5rem;align-items:flex-start;font-size:.78rem;text-align:left;margin-top:.75rem';

const HTML_OLD = `        <button class="btn" id="buyBtnHero" onclick="startCheckout()">\${t('buyBtn')}</button>
        <div class="err" id="landingErr"></div>
        <div class="gk-hero-note">\${t('heroNote')}</div>`;
const HTML_NEW = `        <label style="${CONSENT_STYLE}"><input type="checkbox" id="generalkaVopCheckbox" style="margin-top:.15rem;flex-shrink:0"><span>Súhlasím s <a href="/legal.html#vop" target="_blank">obchodnými podmienkami</a> a <a href="/legal.html#privacy" target="_blank">ochranou osobných údajov</a>.</span></label>
        <label style="${CONSENT_STYLE}"><input type="checkbox" id="generalkaMarketingCheckbox" style="margin-top:.15rem;flex-shrink:0"><span>Chcem dostávať aj odporúčania a ponuky partnerov (voliteľné, kedykoľvek sa dá odhlásiť).</span></label>
        <button class="btn" id="buyBtnHero" onclick="startCheckout()">\${t('buyBtn')}</button>
        <div class="err" id="landingErr"></div>
        <div class="gk-hero-note">\${t('heroNote')}</div>`;

if (!html.includes(HTML_OLD)) {
  console.error('❌ Nenašiel som presnú kotvu v hero sekcii generalka.html. Nič som nezmenil.');
  process.exit(1);
}
html = replaceOnce(html, HTML_OLD, HTML_NEW, 'generalka.html: VOP + marketing checkboxy v hero sekcii');

const JS_OLD = `async function startCheckout() {
  const btns = ['buyBtnHero', 'buyBtnFinal'].map(id => document.getElementById(id)).filter(Boolean);
  const errEl = document.getElementById('landingErr');
  if (errEl) errEl.textContent = '';
  btns.forEach(b => { b.disabled = true; });
  try {
    const data = await apiFetch('/api/generalka/checkout', { method: 'POST' });
    location.href = data.url;
  } catch (e) {
    if (errEl) errEl.textContent = e.message;
    btns.forEach(b => { b.disabled = false; });
  }
}`;
const JS_NEW = `async function startCheckout() {
  const btns = ['buyBtnHero', 'buyBtnFinal'].map(id => document.getElementById(id)).filter(Boolean);
  const errEl = document.getElementById('landingErr');
  if (errEl) errEl.textContent = '';
  const vopBox = document.getElementById('generalkaVopCheckbox');
  if (vopBox && !vopBox.checked) {
    if (errEl) errEl.textContent = 'Musíš súhlasiť s obchodnými podmienkami.';
    return;
  }
  btns.forEach(b => { b.disabled = true; });
  try {
    const marketingBox = document.getElementById('generalkaMarketingCheckbox');
    const data = await apiFetch('/api/generalka/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marketingConsent: !!(marketingBox && marketingBox.checked) })
    });
    location.href = data.url;
  } catch (e) {
    if (errEl) errEl.textContent = e.message;
    btns.forEach(b => { b.disabled = false; });
  }
}`;

if (!html.includes(JS_OLD)) {
  console.error('❌ Nenašiel som presnú kotvu startCheckout() v generalka.html. Nič som nezmenil.');
  process.exit(1);
}
html = replaceOnce(html, JS_OLD, JS_NEW, 'generalka.html: startCheckout() VOP validácia + marketingConsent v body');

// ═══════════════════════ routes/generalka.js ═══════════════════════
let route = fs.readFileSync(ROUTE_PATH, 'utf8');

if (route.includes('marketingConsent')) {
  console.error('❌ routes/generalka.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

const ROUTE_OLD = `    const user = await verifyToken(req);
    if (!user) return res.status(401).json({ error: 'Musíš byť prihlásený cez Google.' });
    const email = (user.email || '').toString().trim().toLowerCase();
    try {
      let customerId;
      const { data: existingUser } = await supabase.from('users').select('stripe_customer_id').eq('email', email).maybeSingle();`;
const ROUTE_NEW = `    const user = await verifyToken(req);
    if (!user) return res.status(401).json({ error: 'Musíš byť prihlásený cez Google.' });
    const email = (user.email || '').toString().trim().toLowerCase();
    const { marketingConsent } = req.body || {};
    try {
      if (marketingConsent !== undefined) {
        await supabase.from('users').update({ marketing_emails_opt_out: !marketingConsent }).eq('email', email);
      }
      let customerId;
      const { data: existingUser } = await supabase.from('users').select('stripe_customer_id').eq('email', email).maybeSingle();`;

if (!route.includes(ROUTE_OLD)) {
  console.error('❌ Nenašiel som presnú kotvu v routes/generalka.js (POST /api/generalka/checkout). Nič som nezmenil.');
  process.exit(1);
}
route = replaceOnce(route, ROUTE_OLD, ROUTE_NEW, 'routes/generalka.js: marketingConsent wiring');

const now = Date.now();
fs.copyFileSync(HTML_PATH, HTML_PATH + '.pre-251-' + now);
fs.copyFileSync(ROUTE_PATH, ROUTE_PATH + '.pre-251-' + now);
fs.writeFileSync(HTML_PATH, html);
fs.writeFileSync(ROUTE_PATH, route);

console.log('✅ generalka.html + routes/generalka.js: VOP (povinný) + marketing (voliteľný) checkbox pridaný.');
console.log('   express.js vyžaduje restart pre routes/generalka.js (nie je statický súbor):');
console.log('   pm2 restart sptrener-main');
console.log('   generalka.html je statický -- stačí tvrdý refresh.');
