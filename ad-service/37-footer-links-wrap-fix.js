// SKUTOČNÝ zdroj scrollovania do boku: .footer-links{display:flex;gap:1.5rem}
// nemá žiadny flex-wrap, takže všetkých 7 odkazov (Aplikácia/Blog/Kontakt/
// VOP/Súkromie/Partnerský program/Inzercia) sa vynucuje na JEDEN riadok bez
// zalomenia — na mobile to ďaleko presiahne šírku obrazovky a vynucuje
// horizontálne scrollovanie CELEJ STRÁNKY (nie len pätičky). Toto
// pravdepodobne spôsobovalo aj pôvodne nahlásený problém, nie nav/sticky-cta.
//
// Pridáva flex-wrap:wrap do základného pravidla (funguje na akejkoľvek
// šírke) a na mobile centruje zalomené odkazy, aby to vyzeralo zámerne.
//
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online/public:
//   node /root/ad-service/37-footer-links-wrap-fix.js

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'index.html');
const src = fs.readFileSync(FILE_PATH, 'utf8');

const OLD_BASE = `.footer-links{display:flex;gap:1.5rem}`;
const NEW_BASE = `.footer-links{display:flex;gap:1.5rem;flex-wrap:wrap}`;

const OLD_MOBILE = `  footer{flex-direction:column;text-align:center}`;
const NEW_MOBILE = `  footer{flex-direction:column;text-align:center;align-items:stretch}
  .footer-links{justify-content:center}`;

if (src.includes(NEW_BASE) && src.includes(NEW_MOBILE)) {
  console.error('❌ Vyzerá to, že oprava je už aplikovaná. Nič som nezmenil.');
  process.exit(1);
}
if (!src.includes(OLD_BASE)) {
  console.error('❌ Nenašiel som očakávané základné CSS pre .footer-links presne. Nič som nezmenil.');
  process.exit(1);
}
if (!src.includes(OLD_MOBILE)) {
  console.error('❌ Nenašiel som očakávané mobilné CSS pre footer presne. Nič som nezmenil.');
  process.exit(1);
}

const backupPath = FILE_PATH + '.pre-footer-wrap-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
let out = src.replace(OLD_BASE, NEW_BASE);
out = out.replace(OLD_MOBILE, NEW_MOBILE);
fs.writeFileSync(FILE_PATH, out);

console.log('✅ .footer-links sa teraz zalomí namiesto vynúteného jedného riadku — toto bola pravdepodobne skutočná príčina scrollovania do boku.');
console.log('   Záloha pôvodného index.html:', backupPath);
