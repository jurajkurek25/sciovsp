const fs = require('fs');
const FILE = 'public/index.html';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('popupCourseOnlyLink')) {
  console.error('Uz je aplikovane (najdene popupCourseOnlyLink), nic som nezmenil.');
  process.exit(1);
}

// 1) HTML: add the course-only link between the free-trial button and the gift-redeem link.
const HTML_OLD = `    <button class="popup-free-link popup-btn-secondary" onclick="choosePopupPlan('free')">Najprv vyskúšať zadarmo →</button>
    <a href="/uplatnit-darcek" class="popup-free-link popup-btn-secondary" id="popupRedeemGiftLink" style="margin-top:.5rem">🎁 Mám darčekový kód →</a>`;
const HTML_NEW = `    <button class="popup-free-link popup-btn-secondary" onclick="choosePopupPlan('free')">Najprv vyskúšať zadarmo →</button>
    <a href="/kurzy" class="popup-free-link popup-btn-secondary" id="popupCourseOnlyLink" style="margin-top:.5rem">🎓 Chcem si vybrať len kurz →</a>
    <a href="/uplatnit-darcek" class="popup-free-link popup-btn-secondary" id="popupRedeemGiftLink" style="margin-top:.5rem">🎁 Mám darčekový kód →</a>`;
const htmlCount = src.split(HTML_OLD).length - 1;
if (htmlCount !== 1) { console.error('HTML kotva nie je jednoznacna (najdenych: ' + htmlCount + '). Nic som nezmenil.'); process.exit(1); }

// 2) SK translation key.
const SK_OLD = `  popupRedeemGift:'🎁 Mám darčekový kód →',`;
const SK_NEW = `  popupRedeemGift:'🎁 Mám darčekový kód →',
  popupCourseOnly:'🎓 Chcem si vybrať len kurz →',`;
const skCount = src.split(SK_OLD).length - 1;
if (skCount !== 1) { console.error('SK kotva nie je jednoznacna (najdenych: ' + skCount + '). Nic som nezmenil.'); process.exit(1); }

// 3) CS translation key.
const CS_OLD = `  popupRedeemGift:'🎁 Mám dárkový kód →',`;
const CS_NEW = `  popupRedeemGift:'🎁 Mám dárkový kód →',
  popupCourseOnly:'🎓 Chci si vybrat jen kurz →',`;
const csCount = src.split(CS_OLD).length - 1;
if (csCount !== 1) { console.error('CS kotva nie je jednoznacna (najdenych: ' + csCount + '). Nic som nezmenil.'); process.exit(1); }

// 4) Wire into applyLanguage().
const APPLY_OLD = `  const _redeemGiftLink = document.getElementById('popupRedeemGiftLink');
  if (_redeemGiftLink) _redeemGiftLink.textContent = t.popupRedeemGift;`;
const APPLY_NEW = `  const _redeemGiftLink = document.getElementById('popupRedeemGiftLink');
  if (_redeemGiftLink) _redeemGiftLink.textContent = t.popupRedeemGift;
  const _courseOnlyLink = document.getElementById('popupCourseOnlyLink');
  if (_courseOnlyLink) _courseOnlyLink.textContent = t.popupCourseOnly;`;
const applyCount = src.split(APPLY_OLD).length - 1;
if (applyCount !== 1) { console.error('applyLanguage kotva nie je jednoznacna (najdenych: ' + applyCount + '). Nic som nezmenil.'); process.exit(1); }

const patched = src
  .replace(HTML_OLD, HTML_NEW)
  .replace(SK_OLD, SK_NEW)
  .replace(CS_OLD, CS_NEW)
  .replace(APPLY_OLD, APPLY_NEW);

const backup = FILE + '.pre-popup-course-only-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
