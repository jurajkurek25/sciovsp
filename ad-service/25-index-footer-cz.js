// Pridáva CZ preklad pätičky na index.html — pätička doteraz nebola
// zapojená do existujúceho prekladového systému (translations objekt +
// setLanguage()/applyLanguage()), takže SK/CZ prepínač ju nechával vždy
// po slovensky. Pridáva id na každý odkaz + sT() volania v applyLanguage()
// + nové kľúče v SK aj CZ bloku translations objektu.
//
// Predpoklad: 22-footer-partner-ads-links.js už bol aplikovaný (pätička už
// má 7 odkazov: Aplikácia/Blog/Kontakt/VOP/Súkromie/Partnerský program/Inzercia).
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online/public:
//   node /root/ad-service/25-index-footer-cz.js

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'index.html');
const src = fs.readFileSync(FILE_PATH, 'utf8');

if (src.includes('footerAppLink')) {
  console.error('❌ Vyzerá to, že oprava je už aplikovaná. Nič som nezmenil.');
  process.exit(1);
}

const OLD_MARKUP = `<footer>
  <div class="footer-logo">SP TRÉNER © 2026</div>
  <div class="footer-links">
    <a href="/app">Aplikácia</a>
    <a href="/blog">Blog</a>
    <a href="mailto:juraj@jurajkurek.com">Kontakt</a>
    <a href="/legal.html#vop">VOP</a>
    <a href="/legal.html#privacy">Súkromie</a>
    <a href="https://partner.sptrener.online">Partnerský program</a>
    <a href="https://ad.sptrener.online">Inzercia</a>
  </div>
</footer>`;

const NEW_MARKUP = `<footer>
  <div class="footer-logo">SP TRÉNER © 2026</div>
  <div class="footer-links">
    <a href="/app" id="footerAppLink">Aplikácia</a>
    <a href="/blog" id="footerBlogLink">Blog</a>
    <a href="mailto:juraj@jurajkurek.com" id="footerContactLink">Kontakt</a>
    <a href="/legal.html#vop" id="footerVopLink">VOP</a>
    <a href="/legal.html#privacy" id="footerPrivacyLink">Súkromie</a>
    <a href="https://partner.sptrener.online" id="footerPartnerLink">Partnerský program</a>
    <a href="https://ad.sptrener.online" id="footerAdsLink">Inzercia</a>
  </div>
</footer>`;

const OLD_SK_TRANSLATIONS_ANCHOR = `  popupEyebrow:'Premium prístup',popupTitle:'Tréning bez<br><em>obmedzení</em>',`;
const NEW_SK_TRANSLATIONS_ANCHOR = `  footerApp:'Aplikácia',footerBlog:'Blog',footerContact:'Kontakt',footerVop:'VOP',footerPrivacy:'Súkromie',
  footerPartner:'Partnerský program',footerAds:'Inzercia',
  popupEyebrow:'Premium prístup',popupTitle:'Tréning bez<br><em>obmedzení</em>',`;

const OLD_CS_TRANSLATIONS_ANCHOR = `  popupEyebrow:'Premium přístup',popupTitle:'Trénink bez<br><em>omezení</em>',`;
const NEW_CS_TRANSLATIONS_ANCHOR = `  footerApp:'Aplikace',footerBlog:'Blog',footerContact:'Kontakt',footerVop:'VOP',footerPrivacy:'Soukromí',
  footerPartner:'Partnerský program',footerAds:'Inzerce',
  popupEyebrow:'Premium přístup',popupTitle:'Trénink bez<br><em>omezení</em>',`;

const OLD_APPLY_ANCHOR = `  const lbl = document.querySelector('#popupMainBtn .popup-btn-label');
  if(lbl) lbl.textContent = getStoredEmail() ? t.popupMainBtnLoggedIn : t.popupMainBtnLoggedOut;
}`;
const NEW_APPLY_ANCHOR = `  const lbl = document.querySelector('#popupMainBtn .popup-btn-label');
  if(lbl) lbl.textContent = getStoredEmail() ? t.popupMainBtnLoggedIn : t.popupMainBtnLoggedOut;
  sT('footerAppLink', t.footerApp); sT('footerBlogLink', t.footerBlog); sT('footerContactLink', t.footerContact);
  sT('footerVopLink', t.footerVop); sT('footerPrivacyLink', t.footerPrivacy);
  sT('footerPartnerLink', t.footerPartner); sT('footerAdsLink', t.footerAds);
}`;

for (const [name, str] of [
  ['footer markup', OLD_MARKUP],
  ['SK translations kotva', OLD_SK_TRANSLATIONS_ANCHOR],
  ['CZ translations kotva', OLD_CS_TRANSLATIONS_ANCHOR],
  ['applyLanguage() kotva', OLD_APPLY_ANCHOR]
]) {
  if (!src.includes(str)) {
    console.error(`❌ Nenašiel som očakávaný blok "${name}" presne. Nič som nezmenil.`);
    if (name === 'footer markup') {
      console.error('   (Očakával som pätičku s 22-footer-partner-ads-links.js už aplikovaným.)');
    }
    process.exit(1);
  }
}

const backupPath = FILE_PATH + '.pre-footer-cz-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
let out = src.replace(OLD_MARKUP, NEW_MARKUP);
out = out.replace(OLD_SK_TRANSLATIONS_ANCHOR, NEW_SK_TRANSLATIONS_ANCHOR);
out = out.replace(OLD_CS_TRANSLATIONS_ANCHOR, NEW_CS_TRANSLATIONS_ANCHOR);
out = out.replace(OLD_APPLY_ANCHOR, NEW_APPLY_ANCHOR);
fs.writeFileSync(FILE_PATH, out);

console.log('✅ Pätička na index.html sa teraz prekladá spolu so zvyškom stránky (SK/CZ).');
console.log('   Záloha pôvodného index.html:', backupPath);
