const fs = require('fs');
const FILE = 'public/index.html';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('popupSecondaryOptions')) {
  console.error('Uz je aplikovane (najdene popupSecondaryOptions), nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(src, oldStr, newStr, label) {
  const count = src.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return src.replace(oldStr, newStr);
}

// 1) HTML: replace the two plain links with a proper card grid.
const HTML_OLD = `    <button class="popup-free-link popup-btn-secondary" onclick="choosePopupPlan('free')">Najprv vyskúšať zadarmo →</button>
    <a href="/kurzy" class="popup-free-link popup-btn-secondary" id="popupCourseOnlyLink" style="margin-top:.5rem">🎓 Chcem si vybrať len kurz →</a>
    <a href="/uplatnit-darcek" class="popup-free-link popup-btn-secondary" id="popupRedeemGiftLink" style="margin-top:.5rem">🎁 Mám darčekový kód →</a>`;
const HTML_NEW = `    <div class="popup-secondary-grid" id="popupSecondaryOptions">
      <a href="/kurzy" class="popup-secondary-card" id="popupCourseOnlyLink">
        <span class="popup-secondary-icon">🎓</span>
        <span class="popup-secondary-title" id="popupCourseOnlyTitle">Len kurz</span>
        <span class="popup-secondary-sub" id="popupCourseOnlySub">Bez predplatného, jednorazovo</span>
      </a>
      <a href="/uplatnit-darcek" class="popup-secondary-card" id="popupRedeemGiftLink">
        <span class="popup-secondary-icon">🎁</span>
        <span class="popup-secondary-title" id="popupRedeemGiftTitle">Mám darčekový kód</span>
        <span class="popup-secondary-sub" id="popupRedeemGiftSub">Uplatniť darčekovú kartu</span>
      </a>
    </div>

    <button class="popup-free-link popup-btn-secondary" onclick="choosePopupPlan('free')">Najprv vyskúšať zadarmo →</button>`;

// 2) CSS: card styling matching .popup-plan-card + mobile collapse.
const CSS_OLD = `.popup-free-link:hover{border-color:var(--border2);color:var(--text2)}`;
const CSS_NEW = `.popup-free-link:hover{border-color:var(--border2);color:var(--text2)}
.popup-secondary-grid{display:grid;grid-template-columns:1fr 1fr;gap:.85rem;padding:0 2.25rem;margin-bottom:1rem}
.popup-secondary-card{background:var(--black);border:1px solid var(--border);border-radius:16px;padding:1rem;display:flex;flex-direction:column;align-items:center;text-align:center;gap:.3rem;text-decoration:none;transition:border-color .2s,transform .2s}
.popup-secondary-card:hover{border-color:var(--border2);transform:translateY(-2px)}
.popup-secondary-icon{font-size:1.4rem}
.popup-secondary-title{font-family:var(--mono);font-size:.8rem;font-weight:700;color:var(--text)}
.popup-secondary-sub{font-size:.68rem;color:var(--text3)}`;

const MEDIA_OLD = `@media(max-width:420px){.popup-plan-grid{grid-template-columns:1fr}}`;
const MEDIA_NEW = `@media(max-width:420px){.popup-plan-grid,.popup-secondary-grid{grid-template-columns:1fr}}`;

// 3) SK translation keys.
const SK_OLD = `  popupCourseOnly:'🎓 Chcem si vybrať len kurz →',`;
const SK_NEW = `  popupCourseOnlyTitle:'Len kurz',popupCourseOnlySub:'Bez predplatného, jednorazovo',`;

const SK_OLD2 = `  popupRedeemGift:'🎁 Mám darčekový kód →',`;
const SK_NEW2 = `  popupRedeemGiftTitle:'Mám darčekový kód',popupRedeemGiftSub:'Uplatniť darčekovú kartu',`;

// 4) CS translation keys.
const CS_OLD = `  popupCourseOnly:'🎓 Chci si vybrat jen kurz →',`;
const CS_NEW = `  popupCourseOnlyTitle:'Jen kurz',popupCourseOnlySub:'Bez předplatného, jednorázově',`;

const CS_OLD2 = `  popupRedeemGift:'🎁 Mám dárkový kód →',`;
const CS_NEW2 = `  popupRedeemGiftTitle:'Mám dárkový kód',popupRedeemGiftSub:'Uplatnit dárkovou kartu',`;

// 5) applyLanguage() wiring.
const APPLY_OLD = `  const _redeemGiftLink = document.getElementById('popupRedeemGiftLink');
  if (_redeemGiftLink) _redeemGiftLink.textContent = t.popupRedeemGift;
  const _courseOnlyLink = document.getElementById('popupCourseOnlyLink');
  if (_courseOnlyLink) _courseOnlyLink.textContent = t.popupCourseOnly;`;
const APPLY_NEW = `  sT('popupCourseOnlyTitle', t.popupCourseOnlyTitle); sT('popupCourseOnlySub', t.popupCourseOnlySub);
  sT('popupRedeemGiftTitle', t.popupRedeemGiftTitle); sT('popupRedeemGiftSub', t.popupRedeemGiftSub);`;

let patched = src;
patched = replaceOnce(patched, HTML_OLD, HTML_NEW, 'HTML');
patched = replaceOnce(patched, CSS_OLD, CSS_NEW, 'CSS');
patched = replaceOnce(patched, MEDIA_OLD, MEDIA_NEW, 'MEDIA');
patched = replaceOnce(patched, SK_OLD, SK_NEW, 'SK course-only');
patched = replaceOnce(patched, SK_OLD2, SK_NEW2, 'SK redeem-gift');
patched = replaceOnce(patched, CS_OLD, CS_NEW, 'CS course-only');
patched = replaceOnce(patched, CS_OLD2, CS_NEW2, 'CS redeem-gift');
patched = replaceOnce(patched, APPLY_OLD, APPLY_NEW, 'applyLanguage');

const backup = FILE + '.pre-popup-secondary-cards-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
