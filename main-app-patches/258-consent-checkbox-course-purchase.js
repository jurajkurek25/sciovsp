// public/kurz-detail.js (nákup kurzov, /kurzy/:slug stránky) nemal
// ŽIADEN consent checkbox -- ani povinný VOP, ani voliteľný
// marketingový. Stránka môže mať AŽ 2 nezávislé .courseAuthSlot
// (main-app-patches/24 -- buyBoxHtml hore aj dole), takže checkboxy
// musia byť trieda (nie id), scoped na konkrétny slot/kliknuté tlačidlo,
// rovnako ako už existujúci .js-discount-input.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/258-consent-checkbox-course-purchase.js

const fs = require('fs');
const path = require('path');

const JS_PATH = path.join(process.cwd(), 'public', 'kurz-detail.js');
const SERVER_PATH = path.join(process.cwd(), 'server.js');

for (const p of [JS_PATH, SERVER_PATH]) {
  if (!fs.existsSync(p)) {
    console.error('❌ Nenašiel som súbor:', p, '— spusti tento skript z koreňa hlavnej appky.');
    process.exit(1);
  }
}

const LOCK = path.join(process.cwd(), '.258-consent-checkbox-course-purchase-lock');
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

// ═══════════════════════ public/kurz-detail.js ═══════════════════════
let js = fs.readFileSync(JS_PATH, 'utf8');

if (js.includes('js-vop-checkbox')) {
  console.error('❌ kurz-detail.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

const CONSENT_LABEL = 'display:flex;gap:.4rem;align-items:flex-start;font-size:.72rem;color:var(--text2);text-align:left';

const RENDER_OLD = `      } else if (currentUser) {
        const email = currentUser.email;
        const short = email.length > 22 ? email.substring(0, 20) + '...' : email;
        const discountInputHtml = isFreeCourse() ? '' : '<input type="text" class="js-discount-input" placeholder="Zľavový kód" style="font-family:var(--mono);font-size:.78rem;background:var(--black2);border:1px solid var(--border2);border-radius:8px;color:var(--text);padding:.5rem .7rem;width:140px">';
        slot.innerHTML = '<div style="display:flex;align-items:center;gap:.8rem;flex-wrap:wrap">'
          + '<span style="font-family:var(--mono);font-size:.78rem;color:var(--text3)">' + short + '</span>'
          + discountInputHtml
          + '<button class="course-buy-btn js-buy-btn">' + buyLabel + '</button>'
          + '</div>';
      } else {`;
const RENDER_NEW = `      } else if (currentUser) {
        const email = currentUser.email;
        const short = email.length > 22 ? email.substring(0, 20) + '...' : email;
        const discountInputHtml = isFreeCourse() ? '' : '<input type="text" class="js-discount-input" placeholder="Zľavový kód" style="font-family:var(--mono);font-size:.78rem;background:var(--black2);border:1px solid var(--border2);border-radius:8px;color:var(--text);padding:.5rem .7rem;width:140px">';
        slot.innerHTML = '<div style="display:flex;flex-direction:column;gap:.5rem">'
          + '<label style="${CONSENT_LABEL}"><input type="checkbox" class="js-vop-checkbox" style="margin-top:.15rem;flex-shrink:0"><span>Súhlasím s <a href="/legal.html#vop" target="_blank">obchodnými podmienkami</a> a <a href="/legal.html#privacy" target="_blank">ochranou osobných údajov</a>.</span></label>'
          + '<label style="${CONSENT_LABEL}"><input type="checkbox" class="js-marketing-checkbox" style="margin-top:.15rem;flex-shrink:0"><span>Chcem dostávať aj odporúčania a ponuky partnerov (voliteľné, kedykoľvek sa dá odhlásiť).</span></label>'
          + '<div style="display:flex;align-items:center;gap:.8rem;flex-wrap:wrap">'
          + '<span style="font-family:var(--mono);font-size:.78rem;color:var(--text3)">' + short + '</span>'
          + discountInputHtml
          + '<button class="course-buy-btn js-buy-btn">' + buyLabel + '</button>'
          + '</div>'
          + '</div>';
      } else {`;

if (!js.includes(RENDER_OLD)) {
  console.error('❌ Nenašiel som presnú kotvu (render() currentUser vetva). Nič som nezmenil.');
  process.exit(1);
}
js = replaceOnce(js, RENDER_OLD, RENDER_NEW, 'kurz-detail.js: VOP + marketing checkboxy v buy boxe');

const BUY_OLD = `  async function buyCourse(e) {
    const buyBtns = document.querySelectorAll('.js-buy-btn');
    const free = isFreeCourse();
    buyBtns.forEach(b => { b.disabled = true; b.textContent = free ? 'Získavam prístup…' : 'Chvíľu strpenia…'; });
    const clickedSlot = e && e.target ? e.target.closest('.courseAuthSlot') : null;
    const discountInput = clickedSlot ? clickedSlot.querySelector('.js-discount-input') : document.querySelector('.js-discount-input');
    const discountCode = discountInput && discountInput.value.trim() ? discountInput.value.trim() : undefined;
    const ref = new URLSearchParams(location.search).get('ref') || undefined;
    const partnerRefCode = sessionStorage.getItem('partner_ref') || undefined;
    try {
      const res = await fetch('/api/courses/' + slug + '/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email, discountCode, ref, partnerRefCode })
      });`;
const BUY_NEW = `  async function buyCourse(e) {
    const clickedSlot = e && e.target ? e.target.closest('.courseAuthSlot') : null;
    const vopBox = clickedSlot ? clickedSlot.querySelector('.js-vop-checkbox') : document.querySelector('.js-vop-checkbox');
    if (vopBox && !vopBox.checked) { alert('Musíš súhlasiť s obchodnými podmienkami.'); return; }
    const buyBtns = document.querySelectorAll('.js-buy-btn');
    const free = isFreeCourse();
    buyBtns.forEach(b => { b.disabled = true; b.textContent = free ? 'Získavam prístup…' : 'Chvíľu strpenia…'; });
    const discountInput = clickedSlot ? clickedSlot.querySelector('.js-discount-input') : document.querySelector('.js-discount-input');
    const discountCode = discountInput && discountInput.value.trim() ? discountInput.value.trim() : undefined;
    const marketingBox = clickedSlot ? clickedSlot.querySelector('.js-marketing-checkbox') : document.querySelector('.js-marketing-checkbox');
    const ref = new URLSearchParams(location.search).get('ref') || undefined;
    const partnerRefCode = sessionStorage.getItem('partner_ref') || undefined;
    try {
      const res = await fetch('/api/courses/' + slug + '/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email, discountCode, ref, partnerRefCode, marketingConsent: !!(marketingBox && marketingBox.checked) })
      });`;

if (!js.includes(BUY_OLD)) {
  console.error('❌ Nenašiel som presnú kotvu (buyCourse() začiatok). Nič som nezmenil.');
  process.exit(1);
}
js = replaceOnce(js, BUY_OLD, BUY_NEW, 'kurz-detail.js: VOP validácia + marketingConsent v buyCourse()');

// ═══════════════════════ server.js ═══════════════════════
let server = fs.readFileSync(SERVER_PATH, 'utf8');

if (server.includes("const { email, discountCode, ref, partnerRefCode, marketingConsent }")) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

const SERVER_OLD = `app.post('/api/courses/:slug/checkout', rateLimit, async (req, res) => {
  const { email, discountCode, ref, partnerRefCode } = req.body || {};
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Neplatný email.' });
  try {`;
const SERVER_NEW = `app.post('/api/courses/:slug/checkout', rateLimit, async (req, res) => {
  const { email, discountCode, ref, partnerRefCode, marketingConsent } = req.body || {};
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Neplatný email.' });
  if (marketingConsent !== undefined) {
    await supabase.from('users').update({ marketing_emails_opt_out: !marketingConsent }).eq('email', email);
  }
  try {`;

if (!server.includes(SERVER_OLD)) {
  console.error('❌ Nenašiel som presnú kotvu (/api/courses/:slug/checkout). Nič som nezmenil.');
  process.exit(1);
}
server = replaceOnce(server, SERVER_OLD, SERVER_NEW, 'server.js: marketingConsent wiring v course checkout');

const now = Date.now();
fs.copyFileSync(JS_PATH, JS_PATH + '.pre-258-' + now);
fs.copyFileSync(SERVER_PATH, SERVER_PATH + '.pre-258-' + now);
fs.writeFileSync(JS_PATH, js);
fs.writeFileSync(SERVER_PATH, server);

console.log('✅ kurz-detail.js + server.js: VOP (povinný) + marketing (voliteľný) checkbox pridaný k nákupu kurzov.');
console.log('   kurz-detail.js je statický -- stačí tvrdý refresh. server.js potrebuje:');
console.log('   pm2 restart sptrener-main');
