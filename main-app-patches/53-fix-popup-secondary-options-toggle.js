const fs = require('fs');
const FILE = 'public/index.html';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("document.getElementById('popupSecondaryOptions').style.display = 'none';")) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

let patched = src;

patched = replaceOnce(patched,
  "  document.getElementById('popupChooserHeader').style.display = 'none';\n  document.getElementById('popupPlanChooser').style.display = 'none';\n  document.querySelector('.popup-free-link').style.display = 'none';\n  document.getElementById('popupPremiumDetail').style.display = 'block';\n}",
  "  document.getElementById('popupChooserHeader').style.display = 'none';\n  document.getElementById('popupPlanChooser').style.display = 'none';\n  document.getElementById('popupSecondaryOptions').style.display = 'none';\n  document.querySelector('.popup-free-link').style.display = 'none';\n  document.getElementById('popupPremiumDetail').style.display = 'block';\n}",
  'choosePopupPlan hide secondary options');

patched = replaceOnce(patched,
  "function backToPopupChooser(){\n  document.getElementById('popupPremiumDetail').style.display = 'none';\n  document.getElementById('popupChooserHeader').style.display = '';\n  document.getElementById('popupPlanChooser').style.display = '';\n  document.querySelector('.popup-free-link').style.display = '';\n}",
  "function backToPopupChooser(){\n  document.getElementById('popupPremiumDetail').style.display = 'none';\n  document.getElementById('popupChooserHeader').style.display = '';\n  document.getElementById('popupPlanChooser').style.display = '';\n  document.getElementById('popupSecondaryOptions').style.display = '';\n  document.querySelector('.popup-free-link').style.display = '';\n}",
  'backToPopupChooser restore secondary options');

patched = replaceOnce(patched,
  "  if(lbl) lbl.textContent = translations[currentLang][storedEmail ? 'popupMainBtnLoggedIn' : 'popupMainBtnLoggedOut'];\n  document.getElementById('popupChooserHeader').style.display = '';\n  document.getElementById('popupPlanChooser').style.display = '';\n  document.querySelector('.popup-free-link').style.display = '';",
  "  if(lbl) lbl.textContent = translations[currentLang][storedEmail ? 'popupMainBtnLoggedIn' : 'popupMainBtnLoggedOut'];\n  document.getElementById('popupChooserHeader').style.display = '';\n  document.getElementById('popupPlanChooser').style.display = '';\n  document.getElementById('popupSecondaryOptions').style.display = '';\n  document.querySelector('.popup-free-link').style.display = '';",
  'openPremiumPopup reset secondary options');

const backup = FILE + '.pre-fix-popup-secondary-options-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
