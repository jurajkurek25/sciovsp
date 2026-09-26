// Pridáva odkaz na Blog do navigácie aj pätičky na index.html a legal.html
// (app.html nemá <nav>/<footer> — je to appka, nie marketingová stránka,
// zámerne sa nedotýka). index.html nemal doteraz definovanú .nav-link
// triedu vôbec (len .nav-cta) — pridáva ju s rovnakým štýlom, aký už legal.html
// používa pre VOP/Súkromie odkazy, nech je navigácia vizuálne jednotná.
//
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online/public:
//   node /root/ad-service/15-unify-header-footer.js

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
    // Skontroluj najprv, či je NOVÝ obsah už prítomný — nutné, lebo pri CSS
    // vsuvke je newStr nadmnožinou oldStr (obsahuje ho ako podreťazec), takže
    // by opačné poradie kontrol viedlo k duplicitnému opakovanému vloženiu.
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
    const backupPath = filePath + '.pre-nav-footer-unify-' + Date.now();
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
    'CSS .nav-link (chýbala úplne)',
    '.nav-cta{display:flex;align-items:center;gap:.5rem;padding:.55rem 1.25rem;background:var(--volt);color:var(--black);border-radius:6px;font-size:.82rem;font-weight:700;letter-spacing:.04em;text-decoration:none;transition:all .2s;font-family:var(--mono);cursor:pointer;border:none}',
    '.nav-link{text-decoration:none;font-family:var(--mono);font-size:.78rem;letter-spacing:.05em;border-radius:8px;transition:all .2s;color:var(--text2);padding:.65rem .85rem;border:1px solid transparent}\n.nav-link:hover{color:var(--text);border-color:var(--border2)}\n.nav-cta{display:flex;align-items:center;gap:.5rem;padding:.55rem 1.25rem;background:var(--volt);color:var(--black);border-radius:6px;font-size:.82rem;font-weight:700;letter-spacing:.04em;text-decoration:none;transition:all .2s;font-family:var(--mono);cursor:pointer;border:none}'
  ],
  [
    'nav Blog odkaz',
    `<nav id="mainNav">
  <a href="#" class="nav-logo"><div class="nav-dot"></div>SP TRÉNER</a>
  <div style="display:flex;align-items:center;gap:.75rem">
    <div class="lang-switcher">`,
    `<nav id="mainNav">
  <a href="#" class="nav-logo"><div class="nav-dot"></div>SP TRÉNER</a>
  <div style="display:flex;align-items:center;gap:.75rem">
    <a href="/blog" class="nav-link">Blog</a>
    <div class="lang-switcher">`
  ],
  [
    'footer Blog odkaz',
    `<div class="footer-links">
    <a href="https://sptrener.online/app">Aplikácia</a>
    <a href="mailto:juraj@jurajkurek.com">Kontakt</a>
    <a href="legal.html">Obchodné podmienky a ochrana osobných údajov</a>
  </div>`,
    `<div class="footer-links">
    <a href="https://sptrener.online/app">Aplikácia</a>
    <a href="/blog">Blog</a>
    <a href="mailto:juraj@jurajkurek.com">Kontakt</a>
    <a href="legal.html">Obchodné podmienky a ochrana osobných údajov</a>
  </div>`
  ]
]);

// ─── legal.html ─────────────────────────────────────────────────
patchFile('legal.html', [
  [
    'nav Blog odkaz',
    `    <div class="nav-links">
      <a href="#vop" class="nav-link">VOP</a>`,
    `    <div class="nav-links">
      <a href="/blog" class="nav-link">Blog</a>
      <a href="#vop" class="nav-link">VOP</a>`
  ],
  [
    'footer Blog odkaz',
    `    <div class="footer-links">
      <a href="/app">Aplikácia</a>
      <a href="mailto:juraj@jurajkurek.com">Kontakt</a>`,
    `    <div class="footer-links">
      <a href="/app">Aplikácia</a>
      <a href="/blog">Blog</a>
      <a href="mailto:juraj@jurajkurek.com">Kontakt</a>`
  ]
]);
