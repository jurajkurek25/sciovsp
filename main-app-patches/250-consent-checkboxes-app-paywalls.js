// public/app.html nemalo v hlavnom in-app paywalle (startCheckout, Premium)
// ani v Elite upgrade modali (startEliteCheckout) VÔBEC žiadny consent
// checkbox -- ani povinný súhlas s VOP/GDPR, ani voliteľný marketingový
// súhlas (potvrdené naživo: grep "ConsentCheckbox" na public/app.html
// nenašiel nič). Rovnaké dva popupy na public/index.html (Premium/Elite)
// ich majú (main-app-patches/156 + 157), tu chýbali úplne.
//
// Prida:
//  1) showPaywall() overlay (Premium) -- VOP (povinný) + marketing
//     (voliteľný, nezaškrtnutý) checkbox, pred tlačidlo "Overiť" ref kódu
//     zostáva nezmenené, nové checkboxy idú tesne pred koniec paywall-box.
//  2) startCheckout() -- mandatory VOP validácia + marketingConsent v POST body.
//  3) Elite modal -- rovnaké dva checkboxy pred tlačidlo "Nesmiem zlyhať →".
//  4) startEliteCheckout() -- mandatory VOP validácia + marketingConsent v POST body.
//
// Kotvy overené priamo zo živého obsahu (sed -n na serveri).
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/250-consent-checkboxes-app-paywalls.js

const fs = require('fs');
const path = require('path');

const FILE = path.join(process.cwd(), 'public', 'app.html');

if (!fs.existsSync(FILE)) {
  console.error('❌ Nenašiel som súbor:', FILE, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.250-consent-checkboxes-app-paywalls-lock');
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

let src = fs.readFileSync(FILE, 'utf8');

if (src.includes('paywallVopCheckbox')) {
  console.error('❌ app.html: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

const CONSENT_STYLE = 'display:flex;gap:.5rem;align-items:flex-start;font-size:.73rem;color:var(--text3);font-family:var(--mono);text-align:left;margin-top:.6rem';

// ── 1) Premium paywall overlay: checkboxy pred koniec paywall-box ───────
const PREMIUM_OLD = `      <div id="popupRefResult"></div>
    </div>
  </div>\`;`;
const PREMIUM_NEW = `      <div id="popupRefResult"></div>
    </div>
    <label style="${CONSENT_STYLE}"><input type="checkbox" id="paywallVopCheckbox" style="margin-top:.15rem;flex-shrink:0"><span>Súhlasím s <a href="/legal.html#vop" target="_blank" style="color:var(--text2)">obchodnými podmienkami</a> a <a href="/legal.html#privacy" target="_blank" style="color:var(--text2)">ochranou osobných údajov</a>.</span></label>
    <label style="${CONSENT_STYLE}"><input type="checkbox" id="paywallMarketingCheckbox" style="margin-top:.15rem;flex-shrink:0"><span>Chcem dostávať aj odporúčania a ponuky partnerov (voliteľné, kedykoľvek sa dá odhlásiť).</span></label>
  </div>\`;`;

if (!src.includes(PREMIUM_OLD)) {
  console.error('❌ Nenašiel som presnú kotvu v showPaywall() overlay. Nič som nezmenil.');
  process.exit(1);
}
src = replaceOnce(src, PREMIUM_OLD, PREMIUM_NEW, 'showPaywall() -- VOP + marketing checkboxy');

// ── 2) startCheckout(): mandatory VOP validácia + marketingConsent ─────
const CHECKOUT_OLD = `async function startCheckout(){
  if(typeof currentUser==='undefined'||!currentUser){showToast(t('loginRequired'));if(typeof loginWithGoogle==='function')await loginWithGoogle();return;}
  const btn=document.querySelector('.paywall-cta');if(btn){btn.textContent=t('checkoutRedirect');btn.disabled=true;}
  try{
    const pendingRef=localStorage.getItem('vsp_pending_ref')||null;
    const response=await fetch('/api/stripe/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:currentUser.email,refCode:pendingRef,refType:localStorage.getItem('vsp_pending_ref_type')||null})});`;
const CHECKOUT_NEW = `async function startCheckout(){
  if(typeof currentUser==='undefined'||!currentUser){showToast(t('loginRequired'));if(typeof loginWithGoogle==='function')await loginWithGoogle();return;}
  const vopBox=document.getElementById('paywallVopCheckbox');
  if(vopBox&&!vopBox.checked){showToast('⚠️ Musíš súhlasiť s obchodnými podmienkami.');return;}
  const btn=document.querySelector('.paywall-cta');if(btn){btn.textContent=t('checkoutRedirect');btn.disabled=true;}
  try{
    const pendingRef=localStorage.getItem('vsp_pending_ref')||null;
    const marketingBox=document.getElementById('paywallMarketingCheckbox');
    const response=await fetch('/api/stripe/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:currentUser.email,refCode:pendingRef,refType:localStorage.getItem('vsp_pending_ref_type')||null,marketingConsent:!!(marketingBox&&marketingBox.checked)})});`;

if (!src.includes(CHECKOUT_OLD)) {
  console.error('❌ Nenašiel som presnú kotvu v startCheckout(). Nič som nezmenil.');
  process.exit(1);
}
src = replaceOnce(src, CHECKOUT_OLD, CHECKOUT_NEW, 'startCheckout() -- VOP validácia + marketingConsent');

// ── 3) Elite modal: checkboxy pred tlačidlo "Nesmiem zlyhať →" ─────────
const ELITE_HTML_OLD = `          <span>✦ <strong>Všetko z Premium</strong></span>
        </div>
        <button class="elite-plan-btn upgrade" id="eliteCheckoutBtn" onclick="startEliteCheckout()">Nesmiem zlyhať →</button>`;
const ELITE_HTML_NEW = `          <span>✦ <strong>Všetko z Premium</strong></span>
        </div>
        <label style="${CONSENT_STYLE}"><input type="checkbox" id="eliteModalVopCheckbox" style="margin-top:.15rem;flex-shrink:0"><span>Súhlasím s <a href="/legal.html#vop" target="_blank" style="color:var(--text2)">obchodnými podmienkami</a> a <a href="/legal.html#privacy" target="_blank" style="color:var(--text2)">ochranou osobných údajov</a>.</span></label>
        <label style="${CONSENT_STYLE}"><input type="checkbox" id="eliteModalMarketingCheckbox" style="margin-top:.15rem;flex-shrink:0"><span>Chcem dostávať aj odporúčania a ponuky partnerov (voliteľné, kedykoľvek sa dá odhlásiť).</span></label>
        <button class="elite-plan-btn upgrade" id="eliteCheckoutBtn" onclick="startEliteCheckout()">Nesmiem zlyhať →</button>`;

if (!src.includes(ELITE_HTML_OLD)) {
  console.error('❌ Nenašiel som presnú kotvu v Elite modal markupe. Nič som nezmenil.');
  process.exit(1);
}
src = replaceOnce(src, ELITE_HTML_OLD, ELITE_HTML_NEW, 'Elite modal -- VOP + marketing checkboxy');

// ── 4) startEliteCheckout(): mandatory VOP validácia + marketingConsent ─
const ELITE_JS_OLD = `async function startEliteCheckout(){
  if(!currentUser){showToast(t('loginRequired'));if(typeof loginWithGoogle==='function')await loginWithGoogle();return;}
  const btn=document.getElementById('eliteCheckoutBtn');
  if(btn){btn.textContent='⏳ Presmerovávam...';btn.disabled=true;}
  try{
    const res=await fetch('/api/stripe/checkout',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email:currentUser.email,plan:'elite',refCode:localStorage.getItem('vsp_pending_ref')||null})
    });`;
const ELITE_JS_NEW = `async function startEliteCheckout(){
  if(!currentUser){showToast(t('loginRequired'));if(typeof loginWithGoogle==='function')await loginWithGoogle();return;}
  const eliteVopBox=document.getElementById('eliteModalVopCheckbox');
  if(eliteVopBox&&!eliteVopBox.checked){showToast('⚠️ Musíš súhlasiť s obchodnými podmienkami.');return;}
  const btn=document.getElementById('eliteCheckoutBtn');
  if(btn){btn.textContent='⏳ Presmerovávam...';btn.disabled=true;}
  try{
    const eliteMarketingBox=document.getElementById('eliteModalMarketingCheckbox');
    const res=await fetch('/api/stripe/checkout',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email:currentUser.email,plan:'elite',refCode:localStorage.getItem('vsp_pending_ref')||null,marketingConsent:!!(eliteMarketingBox&&eliteMarketingBox.checked)})
    });`;

if (!src.includes(ELITE_JS_OLD)) {
  console.error('❌ Nenašiel som presnú kotvu v startEliteCheckout(). Nič som nezmenil.');
  process.exit(1);
}
src = replaceOnce(src, ELITE_JS_OLD, ELITE_JS_NEW, 'startEliteCheckout() -- VOP validácia + marketingConsent');

const backup = FILE + '.pre-250-consent-checkboxes-app-paywalls-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);

console.log('✅ app.html: VOP (povinný) + marketing (voliteľný) checkbox pridaný do Premium paywallu aj Elite modalu.');
console.log('   Záloha:', backup);
console.log('   Statický súbor -- žiadny pm2 restart netreba, stačí tvrdý refresh.');
