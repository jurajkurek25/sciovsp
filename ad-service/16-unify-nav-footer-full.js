// Dokončuje zjednotenie hlavičky/pätičky na index.html a legal.html podľa
// rozhodnutia: rovnaký vizuál/štruktúra všade (logo, Blog, jazykový
// prepínač SK/CZ, CTA "Začať zadarmo →"), rovnaká pätička všade
// (Aplikácia, Blog, Kontakt, VOP, Súkromie). Na iných stránkach než
// homepage jazykový prepínač a CTA presmerujú na homepage
// (/?lang=sk|cs, /?openPremium=1) namiesto duplikovania celého
// prekladového/popup systému — homepage spracuje tie parametre pri
// načítaní a spustí setLanguage()/openPremiumPopup().
//
// Predpoklad: 15-unify-header-footer.js už bol aplikovaný.
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online/public:
//   node /root/ad-service/16-unify-nav-footer-full.js

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
    const backupPath = filePath + '.pre-nav-footer-full-' + Date.now();
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
    'logo href na /',
    '<a href="#" class="nav-logo"><div class="nav-dot"></div>SP TRÉNER</a>',
    '<a href="/" class="nav-logo"><div class="nav-dot"></div>SP TRÉNER</a>'
  ],
  [
    'jednotná pätička (VOP + Súkromie samostatne)',
    `<div class="footer-links">
    <a href="https://sptrener.online/app">Aplikácia</a>
    <a href="/blog">Blog</a>
    <a href="mailto:juraj@jurajkurek.com">Kontakt</a>
    <a href="legal.html">Obchodné podmienky a ochrana osobných údajov</a>
  </div>`,
    `<div class="footer-links">
    <a href="/app">Aplikácia</a>
    <a href="/blog">Blog</a>
    <a href="mailto:juraj@jurajkurek.com">Kontakt</a>
    <a href="/legal.html#vop">VOP</a>
    <a href="/legal.html#privacy">Súkromie</a>
  </div>`
  ],
  [
    'spracovanie ?lang= a ?openPremium=1 pri načítaní',
    `const urlParams = new URLSearchParams(window.location.search);
if(urlParams.get('premium') === '1'){
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      const toast = document.createElement('div');
      toast.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:var(--green);color:var(--black);padding:.75rem 1.5rem;border-radius:10px;font-family:var(--mono);font-size:.85rem;font-weight:700;z-index:9999;box-shadow:0 8px 30px rgba(54,232,150,.4);';
      toast.textContent = translations[currentLang].premiumToast;
      localStorage.removeItem('vsp_pending_ref');
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 5000);
    }, 500);
  });
}`,
    `const urlParams = new URLSearchParams(window.location.search);
if(urlParams.get('premium') === '1'){
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      const toast = document.createElement('div');
      toast.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:var(--green);color:var(--black);padding:.75rem 1.5rem;border-radius:10px;font-family:var(--mono);font-size:.85rem;font-weight:700;z-index:9999;box-shadow:0 8px 30px rgba(54,232,150,.4);';
      toast.textContent = translations[currentLang].premiumToast;
      localStorage.removeItem('vsp_pending_ref');
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 5000);
    }, 500);
  });
}

(function(){
  const navParams = new URLSearchParams(window.location.search);
  const wantLang = navParams.get('lang');
  const wantOpenPremium = navParams.get('openPremium') === '1';
  if ((wantLang === 'sk' || wantLang === 'cs') || wantOpenPremium) {
    document.addEventListener('DOMContentLoaded', () => {
      if (wantLang === 'sk' || wantLang === 'cs') setLanguage(wantLang);
      if (wantOpenPremium) openPremiumPopup();
    });
  }
})();`
  ]
]);

// ─── legal.html ─────────────────────────────────────────────────
patchFile('legal.html', [
  [
    'CSS lang-switcher/lang-btn (chýbalo úplne)',
    `    .nav-link:hover {
      color: var(--text);
      border-color: var(--border2);
    }

    .nav-cta {`,
    `    .nav-link:hover {
      color: var(--text);
      border-color: var(--border2);
    }

    .lang-switcher {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    .lang-btn {
      padding: 0.45rem 0.7rem;
      border: 1px solid var(--border2);
      background: transparent;
      color: var(--text2);
      border-radius: 6px;
      font-family: var(--mono);
      font-size: 0.72rem;
      letter-spacing: 0.06em;
      cursor: pointer;
      transition: all 0.2s;
    }

    .lang-btn:hover {
      color: var(--text);
      border-color: var(--purple);
    }

    .nav-cta {`
  ],
  [
    'nav: jazykový prepínač + CTA presmerujúce na homepage',
    `    <div class="nav-links">
      <a href="/blog" class="nav-link">Blog</a>
      <a href="#vop" class="nav-link">VOP</a>
      <a href="#privacy" class="nav-link">Súkromie</a>
      <a href="/app" class="nav-cta">Prejsť do aplikácie →</a>
    </div>`,
    `    <div class="nav-links">
      <a href="/blog" class="nav-link">Blog</a>
      <div class="lang-switcher">
        <button class="lang-btn" onclick="location.href='/?lang=sk'">SK</button>
        <button class="lang-btn" onclick="location.href='/?lang=cs'">CZ</button>
      </div>
      <button class="nav-cta" onclick="location.href='/?openPremium=1'">Začať zadarmo →</button>
    </div>`
  ],
  [
    'jednotná pätička (VOP + Súkromie ako absolútne odkazy)',
    `    <div class="footer-links">
      <a href="/app">Aplikácia</a>
      <a href="/blog">Blog</a>
      <a href="mailto:juraj@jurajkurek.com">Kontakt</a>
      <a href="#vop">Podmienky</a>
      <a href="#privacy">Súkromie</a>
    </div>`,
    `    <div class="footer-links">
      <a href="/app">Aplikácia</a>
      <a href="/blog">Blog</a>
      <a href="mailto:juraj@jurajkurek.com">Kontakt</a>
      <a href="/legal.html#vop">VOP</a>
      <a href="/legal.html#privacy">Súkromie</a>
    </div>`
  ]
]);
