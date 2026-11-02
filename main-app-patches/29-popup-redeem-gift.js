const fs = require('fs');
const FILE = 'public/index.html';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('popupRedeemGiftLink')) {
  console.error('Uz je aplikovane (najdene popupRedeemGiftLink), nic som nezmenil.');
  process.exit(1);
}

// 1) HTML: add the link right after the free-trial button in the popup.
const HTML_OLD = `    <button class="popup-free-link popup-btn-secondary" onclick="choosePopupPlan('free')">Najprv vyskúšať zadarmo →</button>`;
const HTML_NEW = `    <button class="popup-free-link popup-btn-secondary" onclick="choosePopupPlan('free')">Najprv vyskúšať zadarmo →</button>
    <a href="/uplatnit-darcek" class="popup-free-link popup-btn-secondary" id="popupRedeemGiftLink" style="margin-top:.5rem">🎁 Mám darčekový kód →</a>`;
const htmlCount = src.split(HTML_OLD).length - 1;
if (htmlCount !== 1) { console.error('HTML kotva nie je jednoznacna (najdenych: ' + htmlCount + '). Nic som nezmenil.'); process.exit(1); }

// 2) SK translation key, right after popupTryFree in the sk block.
const SK_OLD = `  popupTryFree:'Najprv vyskúšať zadarmo →',`;
const SK_NEW = `  popupTryFree:'Najprv vyskúšať zadarmo →',
  popupRedeemGift:'🎁 Mám darčekový kód →',`;
const skCount = src.split(SK_OLD).length - 1;
if (skCount !== 1) { console.error('SK kotva nie je jednoznacna (najdenych: ' + skCount + '). Nic som nezmenil.'); process.exit(1); }

// 3) CS translation key, right after popupTryFree in the cs block.
const CS_OLD = `  popupTryFree:'Nejdřív vyzkoušet zdarma →',`;
const CS_NEW = `  popupTryFree:'Nejdřív vyzkoušet zdarma →',
  popupRedeemGift:'🎁 Mám dárkový kód →',`;
const csCount = src.split(CS_OLD).length - 1;
if (csCount !== 1) { console.error('CS kotva nie je jednoznacna (najdenych: ' + csCount + '). Nic som nezmenil.'); process.exit(1); }

// 4) Wire the new key into applyLanguage().
const APPLY_OLD = `  qT('.popup-btn-secondary', t.popupTryFree);`;
const APPLY_NEW = `  qT('.popup-btn-secondary', t.popupTryFree);
  const _redeemGiftLink = document.getElementById('popupRedeemGiftLink');
  if (_redeemGiftLink) _redeemGiftLink.textContent = t.popupRedeemGift;`;
const applyCount = src.split(APPLY_OLD).length - 1;
if (applyCount !== 1) { console.error('applyLanguage kotva nie je jednoznacna (najdenych: ' + applyCount + '). Nic som nezmenil.'); process.exit(1); }

const patched = src
  .replace(HTML_OLD, HTML_NEW)
  .replace(SK_OLD, SK_NEW)
  .replace(CS_OLD, CS_NEW)
  .replace(APPLY_OLD, APPLY_NEW);

const backup = FILE + '.pre-popup-redeem-gift-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
