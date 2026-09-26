// Pridáva "Partnerský program" (partner.sptrener.online) a "Inzercia"
// (ad.sptrener.online) do zjednotenej pätičky na index.html a legal.html
// (Aplikácia/Blog/Kontakt/VOP/Súkromie -> + tieto 2 nové).
//
// Predpoklad: 16-unify-nav-footer-full.js už bol aplikovaný (pätička už má
// tvar Aplikácia/Blog/Kontakt/VOP/Súkromie).
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online/public:
//   node /root/ad-service/22-footer-partner-ads-links.js

const fs = require('fs');
const path = require('path');

function patchFile(filename, replacements) {
  const filePath = path.join(process.cwd(), filename);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ ${filename} sa nenašiel v ${process.cwd()}. Preskakujem.`);
    return false;
  }
  let src = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  for (const [name, oldStr, newStr] of replacements) {
    if (src.includes(newStr)) {
      console.log(`ℹ️  ${filename}: "${name}" už vyzerá aplikované, preskakujem.`);
      continue;
    }
    if (!src.includes(oldStr)) {
      console.error(`❌ ${filename}: nenašiel som očakávaný blok "${name}" presne. Nič v tomto súbore som nezmenil.`);
      return false;
    }
    src = src.replace(oldStr, newStr);
    changed = true;
    console.log(`✅ ${filename}: "${name}" aplikované.`);
  }
  if (changed) {
    const backupPath = filePath + '.pre-footer-partner-ads-' + Date.now();
    fs.copyFileSync(filePath, backupPath);
    fs.writeFileSync(filePath, src);
    console.log(`   Záloha: ${backupPath}`);
  } else {
    console.log(`ℹ️  ${filename}: nič nebolo treba meniť.`);
  }
  return true;
}

// ─── index.html ─────────────────────────────────────────────────
patchFile('index.html', [
  [
    'footer: Partnerský program + Inzercia',
    `    <a href="/app">Aplikácia</a>
    <a href="/blog">Blog</a>
    <a href="mailto:juraj@jurajkurek.com">Kontakt</a>
    <a href="/legal.html#vop">VOP</a>
    <a href="/legal.html#privacy">Súkromie</a>
  </div>`,
    `    <a href="/app">Aplikácia</a>
    <a href="/blog">Blog</a>
    <a href="mailto:juraj@jurajkurek.com">Kontakt</a>
    <a href="/legal.html#vop">VOP</a>
    <a href="/legal.html#privacy">Súkromie</a>
    <a href="https://partner.sptrener.online">Partnerský program</a>
    <a href="https://ad.sptrener.online">Inzercia</a>
  </div>`
  ]
]);

// ─── legal.html ─────────────────────────────────────────────────
patchFile('legal.html', [
  [
    'footer: Partnerský program + Inzercia',
    `      <a href="/app">Aplikácia</a>
      <a href="/blog">Blog</a>
      <a href="mailto:juraj@jurajkurek.com">Kontakt</a>
      <a href="/legal.html#vop">VOP</a>
      <a href="/legal.html#privacy">Súkromie</a>
    </div>`,
    `      <a href="/app">Aplikácia</a>
      <a href="/blog">Blog</a>
      <a href="mailto:juraj@jurajkurek.com">Kontakt</a>
      <a href="/legal.html#vop">VOP</a>
      <a href="/legal.html#privacy">Súkromie</a>
      <a href="https://partner.sptrener.online">Partnerský program</a>
      <a href="https://ad.sptrener.online">Inzercia</a>
    </div>`
  ]
]);
