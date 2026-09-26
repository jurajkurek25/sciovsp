// Pridáva CZ preklad pätičky na app.html cez existujúci data-i18n systém
// (rovnaký mechanizmus ako zvyšok appky — applyTranslations() prechádza
// [data-i18n] atribúty a dosadzuje text z TRANSLATIONS[currentLang]).
// POZOR: app.html interne používa kľúč jazyka 'cz' (nie 'cs') pre češtinu.
//
// Predpoklad: 24-app-footer.js už bol aplikovaný (pätička už existuje).
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online/public:
//   node /root/ad-service/26-app-footer-cz.js

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'app.html');
const src = fs.readFileSync(FILE_PATH, 'utf8');

if (src.includes('data-i18n="footerApp"')) {
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
    <a href="/app" data-i18n="footerApp">Aplikácia</a>
    <a href="/blog" data-i18n="footerBlog">Blog</a>
    <a href="mailto:juraj@jurajkurek.com" data-i18n="footerContact">Kontakt</a>
    <a href="/legal.html#vop" data-i18n="footerVop">VOP</a>
    <a href="/legal.html#privacy" data-i18n="footerPrivacy">Súkromie</a>
    <a href="https://partner.sptrener.online" data-i18n="footerPartner">Partnerský program</a>
    <a href="https://ad.sptrener.online" data-i18n="footerAds">Inzercia</a>
  </div>
</footer>`;

const OLD_SK_ANCHOR = `    logoTag:'SP TRÉNER · SCIO + AI',homeTitle:'Dostaň sa<br>na <span>percentil 85</span>',`;
const NEW_SK_ANCHOR = `    logoTag:'SP TRÉNER · SCIO + AI',homeTitle:'Dostaň sa<br>na <span>percentil 85</span>',
    footerApp:'Aplikácia',footerBlog:'Blog',footerContact:'Kontakt',footerVop:'VOP',footerPrivacy:'Súkromie',
    footerPartner:'Partnerský program',footerAds:'Inzercia',`;

const OLD_CZ_ANCHOR = `    logoTag:'SP TRENÉR · SCIO + AI',homeTitle:'Dostaň se<br>na <span>percentil 85</span>',`;
const NEW_CZ_ANCHOR = `    logoTag:'SP TRENÉR · SCIO + AI',homeTitle:'Dostaň se<br>na <span>percentil 85</span>',
    footerApp:'Aplikace',footerBlog:'Blog',footerContact:'Kontakt',footerVop:'VOP',footerPrivacy:'Soukromí',
    footerPartner:'Partnerský program',footerAds:'Inzerce',`;

for (const [name, str] of [
  ['footer markup', OLD_MARKUP],
  ['SK translations kotva', OLD_SK_ANCHOR],
  ['CZ translations kotva', OLD_CZ_ANCHOR]
]) {
  if (!src.includes(str)) {
    console.error(`❌ Nenašiel som očakávaný blok "${name}" presne. Nič som nezmenil.`);
    if (name === 'footer markup') {
      console.error('   (Očakával som pätičku presne v tvare, aký vytvoril 24-app-footer.js.)');
    }
    process.exit(1);
  }
}

const backupPath = FILE_PATH + '.pre-footer-cz-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
let out = src.replace(OLD_MARKUP, NEW_MARKUP);
out = out.replace(OLD_SK_ANCHOR, NEW_SK_ANCHOR);
out = out.replace(OLD_CZ_ANCHOR, NEW_CZ_ANCHOR);
fs.writeFileSync(FILE_PATH, out);

console.log('✅ Pätička na app.html sa teraz prekladá spolu so zvyškom appky (SK/CZ).');
console.log('   Záloha pôvodného app.html:', backupPath);
