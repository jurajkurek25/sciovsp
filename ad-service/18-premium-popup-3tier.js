// Mení popup vyvolaný cez openPremiumPopup() (nav CTA "Začať zadarmo →",
// sticky mobilná CTA, exit-intent popup) z popupu s jedinou možnosťou
// (rovno Premium) na výber z 3 možností podľa ceny: kompaktné karty
// Premium / Elite vedľa seba + malé, menej výrazné tlačidko "Vyskúšať
// zadarmo" pod nimi. Voľba Premium odkryje pôvodný (nezmenený) checkout
// krok v tom istom popupe (email/ref kód/súhlas/platba), voľba Elite
// zavrie tento popup a otvorí už existujúci #elitePopup, voľba Zdarma
// presmeruje na /app. Nič z existujúcej checkout logiky (handlePremiumCheckout,
// submitEliteCheckout, validateRefOnPopup...) sa nemení.
//
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online/public:
//   node /root/ad-service/18-premium-popup-3tier.js

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'index.html');
const src = fs.readFileSync(FILE_PATH, 'utf8');

const OLD_CSS = `.popup-elite-fields{padding:0 2.25rem;margin-bottom:.75rem;display:flex;flex-direction:column;gap:.5rem}`;

const NEW_CSS = `.popup-elite-fields{padding:0 2.25rem;margin-bottom:.75rem;display:flex;flex-direction:column;gap:.5rem}
.popup-plan-grid{display:grid;grid-template-columns:1fr 1fr;gap:.85rem;padding:0 2.25rem;margin-bottom:1rem}
.popup-plan-card{background:var(--black);border:1px solid var(--border);border-radius:16px;padding:1.1rem 1rem;display:flex;flex-direction:column;transition:border-color .2s}
.popup-plan-card.featured{border-color:rgba(124,92,255,.5);background:linear-gradient(135deg,var(--black),rgba(124,92,255,.05))}
.popup-plan-badge{display:inline-block;font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;padding:3px 9px;border-radius:20px;margin-bottom:.75rem;background:rgba(200,255,0,.12);color:var(--volt);align-self:flex-start}
.popup-plan-card.featured .popup-plan-badge{background:rgba(255,63,94,.12);color:var(--red);border:1px solid rgba(255,63,94,.2)}
.popup-plan-price{font-family:var(--mono);font-size:1.55rem;font-weight:500;line-height:1}
.popup-plan-price sup{font-size:.85rem;vertical-align:super;margin-right:1px}
.popup-plan-period{font-family:var(--mono);font-size:.68rem;color:var(--text3);margin-bottom:.75rem}
.popup-plan-feats{list-style:none;display:flex;flex-direction:column;gap:.4rem;margin-bottom:1rem;flex:1}
.popup-plan-feats li{font-size:.74rem;color:var(--text2);line-height:1.4;display:flex;align-items:flex-start;gap:.4rem}
.popup-plan-feats li::before{content:'✓';color:var(--green);flex-shrink:0;font-family:var(--mono);font-size:.7rem;margin-top:1px}
.popup-plan-btn{display:block;width:100%;padding:.65rem;text-align:center;border-radius:9px;font-family:var(--mono);font-size:.76rem;font-weight:700;letter-spacing:.03em;cursor:pointer;border:none;background:var(--volt);color:var(--black);transition:all .2s}
.popup-plan-btn:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(200,255,0,.3)}
.popup-plan-btn.upgrade{background:linear-gradient(135deg,#7c5cff,#ff3f5e);color:#fff}
.popup-plan-btn.upgrade:hover{box-shadow:0 8px 20px rgba(124,92,255,.4)}
.popup-free-link{display:block;width:calc(100% - 4.5rem);margin:0 2.25rem 1.5rem;padding:.6rem;text-align:center;background:transparent;border:1px solid var(--border);border-radius:10px;color:var(--text3);font-size:.76rem;font-family:var(--mono);cursor:pointer;transition:all .2s}
.popup-free-link:hover{border-color:var(--border2);color:var(--text2)}
.popup-back-btn{display:inline-flex;align-items:center;gap:.3rem;margin:1rem 0 0 2.25rem;background:none;border:none;color:var(--text3);font-family:var(--mono);font-size:.72rem;cursor:pointer;transition:color .2s}
.popup-back-btn:hover{color:var(--text2)}
@media(max-width:420px){.popup-plan-grid{grid-template-columns:1fr}}`;

const OLD_WIDTH = `.premium-popup{
  background:var(--black2);
  border:1px solid rgba(200,255,0,.2);
  border-radius:24px;
  padding:0;
  max-width:480px;`;

const NEW_WIDTH = `.premium-popup{
  background:var(--black2);
  border:1px solid rgba(200,255,0,.2);
  border-radius:24px;
  padding:0;
  max-width:560px;`;

const OLD_MARKUP = `    <div class="popup-header">
      <div class="popup-eyebrow">Premium prístup</div>
      <h2 class="popup-title">Tréning bez<br><em>obmedzení</em></h2>
      <p class="popup-subtitle">Neobmedzené testy, AI generátor, AI Coach — všetko čo potrebuješ na percentil 85.</p>
    </div>

    <div class="popup-price-block">
      <div class="popup-price"><sup>€</sup>9<span style="font-size:1.2rem">,90</span></div>
      <div class="popup-price-detail">
        <div class="popup-price-period">/ MESIAC</div>
        <div class="popup-price-cancel">Zruš kedykoľvek</div>
      </div>
    </div>

    <div class="popup-features">
      <div class="popup-feature"><div class="popup-feature-icon">✓</div>Neobmedzené VŠP simulácie s časomieru</div>
      <div class="popup-feature"><div class="popup-feature-icon">✓</div>AI generátor — nové úlohy každý deň</div>
      <div class="popup-feature"><div class="popup-feature-icon">✓</div>AI Coach analýza po každom teste</div>
      <div class="popup-feature"><div class="popup-feature-icon">✓</div>Percentilový tracker + história výsledkov</div>
      <div class="popup-feature"><div class="popup-feature-icon">✓</div>Cielené precvičovanie slabých miest</div>
    </div>

    <div class="popup-email-wrap" id="popupEmailWrap">
      <label class="popup-email-label" for="popupEmailInput">Tvoj email</label>
      <input type="email" id="popupEmailInput" class="popup-email-input" placeholder="meno@gmail.com" autocomplete="email">
    </div>

    <div class="popup-ref-wrap" id="popupRefWrap">
      <span class="popup-ref-label" id="popupRefLabel">Referral kód kamaráta (voliteľné)</span>
      <div class="popup-ref-row">
        <input class="popup-ref-input" id="popupRefInput" maxlength="20" placeholder="Napr. JURAJ2K6"
          oninput="this.value=this.value.toUpperCase().replace(/[^A-Z0-9]/g,'')"
          onblur="validateRefOnPopup()">
        <button class="popup-ref-btn" onclick="validateRefOnPopup()" id="popupRefBtn">Overiť</button>
      </div>
      <div class="popup-ref-result" id="popupRefResult"></div>
    </div>

    <div class="popup-consent-wrap">
      <label class="popup-consent-label">
        <input type="checkbox" id="popupConsentCheckbox">
        Súhlasím s
        <a href="https://sptrener.online/legal.html#vop" target="_blank">obchodnými podmienkami</a>
        a
        <a href="https://sptrener.online/legal.html#privacy" target="_blank">ochranou osobných údajov</a>.
      </label>
    </div>

    <div class="popup-error" id="popupError"></div>

    <div class="popup-actions">
      <button class="popup-btn-primary" id="popupMainBtn" onclick="handlePremiumCheckout()">
        <span class="popup-btn-label">Získať Premium →</span>
        <div class="popup-spinner"></div>
      </button>
      <a href="https://sptrener.online/app" class="popup-btn-secondary">Najprv vyskúšať zadarmo →</a>
    </div>

    <div class="popup-trust">
      <div class="popup-trust-item"><span>🔒</span> Platba cez Stripe</div>
      <div class="popup-trust-item"><span>✓</span> Bez záväzku</div>
      <div class="popup-trust-item"><span>✓</span> Okamžitý prístup</div>
    </div>`;

const NEW_MARKUP = `    <div class="popup-header" id="popupChooserHeader">
      <div class="popup-eyebrow">Vyber si plán</div>
      <h2 class="popup-title">Priprav sa<br><em>na percentil 85</em></h2>
      <p class="popup-subtitle">Dve cesty k vysnívanej škole. Stripe platba, zruš kedykoľvek jedným klikom.</p>
    </div>

    <div class="popup-plan-grid" id="popupPlanChooser">
      <div class="popup-plan-card">
        <div class="popup-plan-badge">💎 Premium</div>
        <div class="popup-plan-price"><sup>€</sup>9<span style="font-size:1rem">,90</span></div>
        <div class="popup-plan-period">/ mesiac</div>
        <ul class="popup-plan-feats">
          <li>Neobmedzené VŠP simulácie</li>
          <li>AI generátor úloh</li>
          <li>Percentilový tracker</li>
        </ul>
        <button class="popup-plan-btn" onclick="choosePopupPlan('premium')">Vybrať Premium →</button>
      </div>
      <div class="popup-plan-card featured">
        <div class="popup-plan-badge">🔥 Elite — odporúčané</div>
        <div class="popup-plan-price"><sup>€</sup>19<span style="font-size:1rem">,90</span></div>
        <div class="popup-plan-period">/ mesiac</div>
        <ul class="popup-plan-feats">
          <li>Všetko z Premium</li>
          <li>AI Mentor chat</li>
          <li>Týždenný Audit</li>
        </ul>
        <button class="popup-plan-btn upgrade" onclick="choosePopupPlan('elite')">Vybrať Elite →</button>
      </div>
    </div>

    <button class="popup-free-link popup-btn-secondary" onclick="choosePopupPlan('free')">Najprv vyskúšať zadarmo →</button>

    <div id="popupPremiumDetail" style="display:none">
      <button class="popup-back-btn" onclick="backToPopupChooser()">← Späť na plány</button>

      <div class="popup-header">
        <div class="popup-eyebrow">Premium prístup</div>
        <h2 class="popup-title">Tréning bez<br><em>obmedzení</em></h2>
        <p class="popup-subtitle">Neobmedzené testy, AI generátor, AI Coach — všetko čo potrebuješ na percentil 85.</p>
      </div>

      <div class="popup-price-block">
        <div class="popup-price"><sup>€</sup>9<span style="font-size:1.2rem">,90</span></div>
        <div class="popup-price-detail">
          <div class="popup-price-period">/ MESIAC</div>
          <div class="popup-price-cancel">Zruš kedykoľvek</div>
        </div>
      </div>

      <div class="popup-features">
        <div class="popup-feature"><div class="popup-feature-icon">✓</div>Neobmedzené VŠP simulácie s časomieru</div>
        <div class="popup-feature"><div class="popup-feature-icon">✓</div>AI generátor — nové úlohy každý deň</div>
        <div class="popup-feature"><div class="popup-feature-icon">✓</div>AI Coach analýza po každom teste</div>
        <div class="popup-feature"><div class="popup-feature-icon">✓</div>Percentilový tracker + história výsledkov</div>
        <div class="popup-feature"><div class="popup-feature-icon">✓</div>Cielené precvičovanie slabých miest</div>
      </div>

      <div class="popup-email-wrap" id="popupEmailWrap">
        <label class="popup-email-label" for="popupEmailInput">Tvoj email</label>
        <input type="email" id="popupEmailInput" class="popup-email-input" placeholder="meno@gmail.com" autocomplete="email">
      </div>

      <div class="popup-ref-wrap" id="popupRefWrap">
        <span class="popup-ref-label" id="popupRefLabel">Referral kód kamaráta (voliteľné)</span>
        <div class="popup-ref-row">
          <input class="popup-ref-input" id="popupRefInput" maxlength="20" placeholder="Napr. JURAJ2K6"
            oninput="this.value=this.value.toUpperCase().replace(/[^A-Z0-9]/g,'')"
            onblur="validateRefOnPopup()">
          <button class="popup-ref-btn" onclick="validateRefOnPopup()" id="popupRefBtn">Overiť</button>
        </div>
        <div class="popup-ref-result" id="popupRefResult"></div>
      </div>

      <div class="popup-consent-wrap">
        <label class="popup-consent-label">
          <input type="checkbox" id="popupConsentCheckbox">
          Súhlasím s
          <a href="https://sptrener.online/legal.html#vop" target="_blank">obchodnými podmienkami</a>
          a
          <a href="https://sptrener.online/legal.html#privacy" target="_blank">ochranou osobných údajov</a>.
        </label>
      </div>

      <div class="popup-error" id="popupError"></div>

      <div class="popup-actions">
        <button class="popup-btn-primary" id="popupMainBtn" onclick="handlePremiumCheckout()">
          <span class="popup-btn-label">Získať Premium →</span>
          <div class="popup-spinner"></div>
        </button>
      </div>

      <div class="popup-trust">
        <div class="popup-trust-item"><span>🔒</span> Platba cez Stripe</div>
        <div class="popup-trust-item"><span>✓</span> Bez záväzku</div>
        <div class="popup-trust-item"><span>✓</span> Okamžitý prístup</div>
      </div>
    </div>`;

// setLanguage() aplikuje popupEyebrow/popupTitle/popupSubtitle cez
// document.querySelectorAll('.popup-eyebrow')[0] (a rovnako pre .popup-title/
// .popup-subtitle) — keďže nový chooser header je teraz v DOM PRED pôvodným
// Premium-detail headerom, index 0 by bez tejto opravy prepísal chooser
// text späť na "Premium prístup". Pridáva samostatné chooser preklady a mení
// volania na explicitné indexy (0 = chooser, 1 = detail).
const OLD_SK_TRANSLATIONS = `  popupEyebrow:'Premium prístup',popupTitle:'Tréning bez<br><em>obmedzení</em>',
  popupSubtitle:'Neobmedzené testy, AI generátor, AI Coach — všetko čo potrebuješ na percentil 85.',`;

const NEW_SK_TRANSLATIONS = `  popupEyebrow:'Premium prístup',popupTitle:'Tréning bez<br><em>obmedzení</em>',
  popupSubtitle:'Neobmedzené testy, AI generátor, AI Coach — všetko čo potrebuješ na percentil 85.',
  popupChooserEyebrow:'Vyber si plán',popupChooserTitle:'Priprav sa<br><em>na percentil 85</em>',
  popupChooserSubtitle:'Dve cesty k vysnívanej škole. Stripe platba, zruš kedykoľvek jedným klikom.',`;

const OLD_CZ_TRANSLATIONS = `  popupEyebrow:'Premium přístup',popupTitle:'Trénink bez<br><em>omezení</em>',
  popupSubtitle:'Neomezené testy, AI generátor, AI Coach — všechno, co potřebuješ na percentil 85.',`;

const NEW_CZ_TRANSLATIONS = `  popupEyebrow:'Premium přístup',popupTitle:'Trénink bez<br><em>omezení</em>',
  popupSubtitle:'Neomezené testy, AI generátor, AI Coach — všechno, co potřebuješ na percentil 85.',
  popupChooserEyebrow:'Vyber si plán',popupChooserTitle:'Připrav se<br><em>na percentil 85</em>',
  popupChooserSubtitle:'Dvě cesty k vysněné škole. Stripe platba, zruš kdykoliv jedním klikem.',`;

const OLD_APPLY_TRANSLATIONS = `  qT('.popup-eyebrow', t.popupEyebrow);
  qH('.popup-title', t.popupTitle);
  qT('.popup-subtitle', t.popupSubtitle);`;

const NEW_APPLY_TRANSLATIONS = `  qT('.popup-eyebrow', t.popupChooserEyebrow, 0);
  qH('.popup-title', t.popupChooserTitle, 0);
  qT('.popup-subtitle', t.popupChooserSubtitle, 0);
  qT('.popup-eyebrow', t.popupEyebrow, 1);
  qH('.popup-title', t.popupTitle, 1);
  qT('.popup-subtitle', t.popupSubtitle, 1);`;

const OLD_JS = `function openPremiumPopup(){
  const overlay = document.getElementById('premiumPopup');
  const emailWrap = document.getElementById('popupEmailWrap');
  const errEl = document.getElementById('popupError');
  const btn = document.getElementById('popupMainBtn');
  errEl.classList.remove('show'); errEl.textContent = '';
  btn.disabled = false; btn.classList.remove('loading');
  const storedEmail = getStoredEmail();
  emailWrap.classList.toggle('show', !storedEmail);
  const savedRef = localStorage.getItem('vsp_pending_ref');
  const refInput = document.getElementById('popupRefInput');
  if(refInput && savedRef){
    refInput.value = savedRef;
    const rr = document.getElementById('popupRefResult');
    if(rr){ rr.className = 'popup-ref-result ok'; rr.textContent = translations[currentLang].refValidOk || '+14 dní pre oboch! ✓'; }
  }
  const lbl = btn.querySelector('.popup-btn-label');
  if(lbl) lbl.textContent = translations[currentLang][storedEmail ? 'popupMainBtnLoggedIn' : 'popupMainBtnLoggedOut'];
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}`;

const NEW_JS = `function openPremiumPopup(){
  const overlay = document.getElementById('premiumPopup');
  const emailWrap = document.getElementById('popupEmailWrap');
  const errEl = document.getElementById('popupError');
  const btn = document.getElementById('popupMainBtn');
  errEl.classList.remove('show'); errEl.textContent = '';
  btn.disabled = false; btn.classList.remove('loading');
  const storedEmail = getStoredEmail();
  emailWrap.classList.toggle('show', !storedEmail);
  const savedRef = localStorage.getItem('vsp_pending_ref');
  const refInput = document.getElementById('popupRefInput');
  if(refInput && savedRef){
    refInput.value = savedRef;
    const rr = document.getElementById('popupRefResult');
    if(rr){ rr.className = 'popup-ref-result ok'; rr.textContent = translations[currentLang].refValidOk || '+14 dní pre oboch! ✓'; }
  }
  const lbl = btn.querySelector('.popup-btn-label');
  if(lbl) lbl.textContent = translations[currentLang][storedEmail ? 'popupMainBtnLoggedIn' : 'popupMainBtnLoggedOut'];
  document.getElementById('popupChooserHeader').style.display = '';
  document.getElementById('popupPlanChooser').style.display = '';
  document.querySelector('.popup-free-link').style.display = '';
  document.getElementById('popupPremiumDetail').style.display = 'none';
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function choosePopupPlan(plan){
  if(plan === 'free'){
    window.location.href = 'https://sptrener.online/app';
    return;
  }
  if(plan === 'elite'){
    closePremiumPopup();
    openElitePopup();
    return;
  }
  document.getElementById('popupChooserHeader').style.display = 'none';
  document.getElementById('popupPlanChooser').style.display = 'none';
  document.querySelector('.popup-free-link').style.display = 'none';
  document.getElementById('popupPremiumDetail').style.display = 'block';
}

function backToPopupChooser(){
  document.getElementById('popupPremiumDetail').style.display = 'none';
  document.getElementById('popupChooserHeader').style.display = '';
  document.getElementById('popupPlanChooser').style.display = '';
  document.querySelector('.popup-free-link').style.display = '';
}`;

if (src.includes('popupPlanChooser')) {
  console.error('❌ Vyzerá to, že oprava je už aplikovaná. Nič som nezmenil.');
  process.exit(1);
}
for (const [name, str] of [
  ['CSS', OLD_CSS],
  ['šírka popupu', OLD_WIDTH],
  ['markup popupu', OLD_MARKUP],
  ['SK preklady', OLD_SK_TRANSLATIONS],
  ['CZ preklady', OLD_CZ_TRANSLATIONS],
  ['aplikovanie prekladov v setLanguage()', OLD_APPLY_TRANSLATIONS],
  ['openPremiumPopup()', OLD_JS]
]) {
  if (!src.includes(str)) {
    console.error(`❌ Nenašiel som očakávaný blok "${name}" presne. Nič som nezmenil.`);
    process.exit(1);
  }
}

const backupPath = FILE_PATH + '.pre-popup-3tier-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
let out = src.replace(OLD_CSS, NEW_CSS);
out = out.replace(OLD_WIDTH, NEW_WIDTH);
out = out.replace(OLD_MARKUP, NEW_MARKUP);
out = out.replace(OLD_SK_TRANSLATIONS, NEW_SK_TRANSLATIONS);
out = out.replace(OLD_CZ_TRANSLATIONS, NEW_CZ_TRANSLATIONS);
out = out.replace(OLD_APPLY_TRANSLATIONS, NEW_APPLY_TRANSLATIONS);
out = out.replace(OLD_JS, NEW_JS);
fs.writeFileSync(FILE_PATH, out);

console.log('✅ Premium popup teraz ponúka výber z 3 možností (Premium/Elite karty + malé tlačidko Zdarma).');
console.log('   Záloha pôvodného index.html:', backupPath);
