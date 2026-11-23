// Prida NEPOVINNY, defaultne odskrtnuty checkbox pre marketingove emaily
// (odporucania affiliate partnerov) do oboch checkout popupov (Premium,
// Elite) — oddelene od uz existujuceho POVINNEHO súhlasu s VOP/GDPR.
// Podla GDPR čl. 7 ods. 4 (bundling prohibition) nesmie byt marketingovy
// suhlas podmienkou pouzitia sluzby, preto je to samostatny, nepovinny
// checkbox, ktory sa neoveruje pred checkoutom.
//
// Pouziva regex kotvy (nie presny string match) — presne biele znaky v
// zivom subore nie su cez terminal prenos stoprocentne isté, regex s \s*
// medzi znamymi presnymi tokenmi je voci tomu odolny.
const fs = require('fs');
const FILE = 'public/index.html';

const LOCK = FILE + '.156-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK subor (' + LOCK + ') existuje. Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('popupMarketingCheckbox')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnceRegex(s, regex, buildNew, label) {
  const g = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
  const matches = s.match(g);
  const count = matches ? matches.length : 0;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(regex, buildNew);
}

let patched = src;

// -- 1) Premium popup: novy checkbox za existujuci VOP/GDPR consent --
patched = replaceOnceRegex(patched,
  /(<input type="checkbox" id="popupConsentCheckbox">[\s\S]*?<\/label>\s*<\/div>)(\s*<div class="popup-error" id="popupError">)/,
  (m, before, after) => before + '\n    <div class="popup-consent-wrap">\n      <label class="popup-consent-label">\n        <input type="checkbox" id="popupMarketingCheckbox">\n        Chcem dostávať aj odporúčania a ponuky partnerov (voliteľné, kedykoľvek sa dá odhlásiť).\n      </label>\n    </div>' + after,
  '1: Premium marketing checkbox HTML');

// -- 2) Elite popup: novy checkbox za existujuci VOP/GDPR consent --
patched = replaceOnceRegex(patched,
  /(<input type="checkbox" id="popupEliteConsentCheckbox">[\s\S]*?<\/label>\s*<\/div>)(\s*<div id="popupEliteError" class="popup-error">)/,
  (m, before, after) => before + '\n        <div class="popup-consent-wrap" style="padding:0;margin:.5rem 0 0">\n          <label class="popup-consent-label">\n            <input type="checkbox" id="popupEliteMarketingCheckbox">\n            Chcem dostávať aj odporúčania a ponuky partnerov (voliteľné, kedykoľvek sa dá odhlásiť).\n          </label>\n        </div>' + after,
  '2: Elite marketing checkbox HTML');

// -- 3) handlePremiumCheckout: pridat marketingConsent do POST body --
patched = replaceOnceRegex(patched,
  /body:\s*JSON\.stringify\(\{\s*email,\s*refCode:\s*pendingRef,\s*refType:\s*pendingRefType\s*\}\)/,
  `body: JSON.stringify({ email, refCode: pendingRef, refType: pendingRefType, marketingConsent: document.getElementById('popupMarketingCheckbox').checked })`,
  '3: handlePremiumCheckout marketingConsent');

// -- 4) submitEliteCheckout: pridat marketingConsent do POST body --
patched = replaceOnceRegex(patched,
  /body:\s*JSON\.stringify\(\{\s*email,\s*plan:\s*'elite',\s*refCode:\s*refCode\s*\|\|\s*null,\s*refType:\s*pendingRefType\s*\}\)/,
  `body: JSON.stringify({ email, plan: 'elite', refCode: refCode || null, refType: pendingRefType, marketingConsent: document.getElementById('popupEliteMarketingCheckbox').checked })`,
  '4: submitEliteCheckout marketingConsent');

const backup = FILE + '.pre-marketing-consent-checkbox-ui-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
