// public/ponuka.html (webinárová/kvízová ponuka členstva) nemalo ŽIADEN
// consent checkbox -- ani povinný VOP, ani voliteľný marketingový.
// Tri tlačidlá (premiumBtn, eliteBtn, finalCtaBtn) volajú tú istú
// startPlanCheckout(tier) -- checkbox stačí raz, pred #planFeedback.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/257-consent-checkbox-ponuka.js

const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(process.cwd(), 'public', 'ponuka.html');
const SERVER_PATH = path.join(process.cwd(), 'server.js');

for (const p of [HTML_PATH, SERVER_PATH]) {
  if (!fs.existsSync(p)) {
    console.error('❌ Nenašiel som súbor:', p, '— spusti tento skript z koreňa hlavnej appky.');
    process.exit(1);
  }
}

const LOCK = path.join(process.cwd(), '.257-consent-checkbox-ponuka-lock');
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

// ═══════════════════════ public/ponuka.html ═══════════════════════
let html = fs.readFileSync(HTML_PATH, 'utf8');

if (html.includes('ponukaVopCheckbox')) {
  console.error('❌ ponuka.html: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

const CONSENT_STYLE = 'display:flex;gap:.5rem;align-items:flex-start;font-size:.8rem;text-align:left;margin:0 auto .6rem;max-width:480px';

const HTML_OLD = `        <button class="plan-btn primary js-plan-btn" data-tier="elite" id="eliteBtn">Získať Elite →</button>
      </div>
    </div>
    <div id="planFeedback"></div>`;
const HTML_NEW = `        <button class="plan-btn primary js-plan-btn" data-tier="elite" id="eliteBtn">Získať Elite →</button>
      </div>
    </div>
    <label style="${CONSENT_STYLE}"><input type="checkbox" id="ponukaVopCheckbox" style="margin-top:.15rem;flex-shrink:0"><span>Súhlasím s <a href="/legal.html#vop" target="_blank">obchodnými podmienkami</a> a <a href="/legal.html#privacy" target="_blank">ochranou osobných údajov</a>.</span></label>
    <label style="${CONSENT_STYLE}"><input type="checkbox" id="ponukaMarketingCheckbox" style="margin-top:.15rem;flex-shrink:0"><span>Chcem dostávať aj odporúčania a ponuky partnerov (voliteľné, kedykoľvek sa dá odhlásiť).</span></label>
    <div id="planFeedback"></div>`;

if (!html.includes(HTML_OLD)) {
  console.error('❌ Nenašiel som presnú kotvu (Elite tlačidlo / planFeedback). Nič som nezmenil.');
  process.exit(1);
}
html = replaceOnce(html, HTML_OLD, HTML_NEW, 'ponuka.html: VOP + marketing checkboxy');

const JS_OLD = `async function startPlanCheckout(tier) {
  const feedback = document.getElementById('planFeedback');
  feedback.textContent = '';
  if (!quizToken && !currentUser) {
    await _supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href } });
    return;
  }
  const btns = document.querySelectorAll('.js-plan-btn');`;
const JS_NEW = `async function startPlanCheckout(tier) {
  const feedback = document.getElementById('planFeedback');
  feedback.textContent = '';
  if (!quizToken && !currentUser) {
    await _supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href } });
    return;
  }
  const vopBox = document.getElementById('ponukaVopCheckbox');
  if (vopBox && !vopBox.checked) {
    feedback.textContent = 'Musíš súhlasiť s obchodnými podmienkami.';
    return;
  }
  const btns = document.querySelectorAll('.js-plan-btn');`;

if (!html.includes(JS_OLD)) {
  console.error('❌ Nenašiel som presnú kotvu (startPlanCheckout() začiatok). Nič som nezmenil.');
  process.exit(1);
}
html = replaceOnce(html, JS_OLD, JS_NEW, 'ponuka.html: startPlanCheckout() VOP validácia');

const JS_OLD2 = `body: JSON.stringify({ email: quizToken ? undefined : currentUser.email, tier, months: duration, pricingMode: offerExpired ? 'classic' : 'promo', refCode: sessionStorage.getItem('partner_ref') || null, token: quizToken || undefined })`;
const JS_NEW2 = `body: JSON.stringify({ email: quizToken ? undefined : currentUser.email, tier, months: duration, pricingMode: offerExpired ? 'classic' : 'promo', refCode: sessionStorage.getItem('partner_ref') || null, token: quizToken || undefined, marketingConsent: !!document.getElementById('ponukaMarketingCheckbox')?.checked })`;

if (!html.includes(JS_OLD2)) {
  console.error('❌ Nenašiel som presnú kotvu (fetch body v startPlanCheckout()). Nič som nezmenil.');
  process.exit(1);
}
html = replaceOnce(html, JS_OLD2, JS_NEW2, 'ponuka.html: marketingConsent v tele requestu');

// ═══════════════════════ server.js ═══════════════════════
let server = fs.readFileSync(SERVER_PATH, 'utf8');

if (server.includes("let { email, tier, months, pricingMode, refCode, marketingConsent }")) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

const SERVER_OLD = `app.post('/api/membership/checkout', rateLimit, async (req, res) => {
  let { email, tier, months, pricingMode, refCode } = req.body || {};`;
const SERVER_NEW = `app.post('/api/membership/checkout', rateLimit, async (req, res) => {
  let { email, tier, months, pricingMode, refCode, marketingConsent } = req.body || {};`;

if (!server.includes(SERVER_OLD)) {
  console.error('❌ Nenašiel som presnú kotvu (/api/membership/checkout destructure). Nič som nezmenil.');
  process.exit(1);
}
server = replaceOnce(server, SERVER_OLD, SERVER_NEW, 'server.js: marketingConsent destructure');

const SERVER_OLD2 = `  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Neplatný email.' });
  const cleanTier = tier === 'elite' ? 'elite' : 'premium';`;
const SERVER_NEW2 = `  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Neplatný email.' });
  if (marketingConsent !== undefined) {
    await supabase.from('users').update({ marketing_emails_opt_out: !marketingConsent }).eq('email', email);
  }
  const cleanTier = tier === 'elite' ? 'elite' : 'premium';`;

if (!server.includes(SERVER_OLD2)) {
  console.error('❌ Nenašiel som presnú kotvu (email validácia v /api/membership/checkout). Nič som nezmenil.');
  process.exit(1);
}
server = replaceOnce(server, SERVER_OLD2, SERVER_NEW2, 'server.js: marketingConsent wiring');

const now = Date.now();
fs.copyFileSync(HTML_PATH, HTML_PATH + '.pre-257-' + now);
fs.copyFileSync(SERVER_PATH, SERVER_PATH + '.pre-257-' + now);
fs.writeFileSync(HTML_PATH, html);
fs.writeFileSync(SERVER_PATH, server);

console.log('✅ ponuka.html + server.js: VOP (povinný) + marketing (voliteľný) checkbox pridaný k členstvu.');
console.log('   pm2 restart sptrener-main (server.js nie je statický súbor)');
