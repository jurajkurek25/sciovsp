// Pridáva "Partnerský program" (partner.sptrener.online) a "Inzercia"
// (ad.sptrener.online) do pätičky blogu — s prekladom do češtiny, rovnako
// ako ostatné pätičkové odkazy (footerApp/footerBlog/...).
//
// Predpoklad: 20-blog-czech.js už bol aplikovaný.
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online:
//   node /root/ad-service/23-blog-footer-partner-ads.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
const src = fs.readFileSync(SERVER_PATH, 'utf8');

if (src.includes('footerPartner')) {
  console.error('❌ Vyzerá to, že oprava je už aplikovaná. Nič som nezmenil.');
  process.exit(1);
}

const OLD_SK_I18N = `    footerApp: 'Aplikácia', footerBlog: 'Blog', footerContact: 'Kontakt', footerTerms: 'VOP', footerPrivacy: 'Súkromie',
    ogLocale: 'sk_SK'`;
const NEW_SK_I18N = `    footerApp: 'Aplikácia', footerBlog: 'Blog', footerContact: 'Kontakt', footerTerms: 'VOP', footerPrivacy: 'Súkromie',
    footerPartner: 'Partnerský program', footerAds: 'Inzercia',
    ogLocale: 'sk_SK'`;

const OLD_CS_I18N = `    footerApp: 'Aplikace', footerBlog: 'Blog', footerContact: 'Kontakt', footerTerms: 'VOP', footerPrivacy: 'Soukromí',
    ogLocale: 'cs_CZ'`;
const NEW_CS_I18N = `    footerApp: 'Aplikace', footerBlog: 'Blog', footerContact: 'Kontakt', footerTerms: 'VOP', footerPrivacy: 'Soukromí',
    footerPartner: 'Partnerský program', footerAds: 'Inzerce',
    ogLocale: 'cs_CZ'`;

const OLD_FOOTER_MARKUP = `    <a href="/app">\${T.footerApp}</a>
    <a href="/blog\${l === 'cs' ? '?lang=cs' : ''}">\${T.footerBlog}</a>
    <a href="mailto:juraj@jurajkurek.com">\${T.footerContact}</a>
    <a href="/legal.html#vop">\${T.footerTerms}</a>
    <a href="/legal.html#privacy">\${T.footerPrivacy}</a>`;
const NEW_FOOTER_MARKUP = `    <a href="/app">\${T.footerApp}</a>
    <a href="/blog\${l === 'cs' ? '?lang=cs' : ''}">\${T.footerBlog}</a>
    <a href="mailto:juraj@jurajkurek.com">\${T.footerContact}</a>
    <a href="/legal.html#vop">\${T.footerTerms}</a>
    <a href="/legal.html#privacy">\${T.footerPrivacy}</a>
    <a href="https://partner.sptrener.online">\${T.footerPartner}</a>
    <a href="https://ad.sptrener.online">\${T.footerAds}</a>`;

for (const [name, str] of [
  ['SK i18n footer kľúče', OLD_SK_I18N],
  ['CZ i18n footer kľúče', OLD_CS_I18N],
  ['footer markup', OLD_FOOTER_MARKUP]
]) {
  if (!src.includes(str)) {
    console.error(`❌ Nenašiel som očakávaný blok "${name}" presne. Nič som nezmenil. Over, či je aplikovaný 20-blog-czech.js.`);
    process.exit(1);
  }
}

const backupPath = SERVER_PATH + '.pre-blog-footer-partner-ads-' + Date.now();
fs.copyFileSync(SERVER_PATH, backupPath);
let out = src.replace(OLD_SK_I18N, NEW_SK_I18N);
out = out.replace(OLD_CS_I18N, NEW_CS_I18N);
out = out.replace(OLD_FOOTER_MARKUP, NEW_FOOTER_MARKUP);
fs.writeFileSync(SERVER_PATH, out);

console.log('✅ Pätička blogu má teraz aj Partnerský program a Inzercia (s CZ prekladom).');
console.log('   Záloha pôvodného server.js:', backupPath);
console.log('   Teraz over syntax: node -c server.js');
