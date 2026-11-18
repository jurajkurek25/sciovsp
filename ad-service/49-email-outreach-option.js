// Prida stvrtu, NEAUTOMATIZOVANU moznost na ad platformu: "Priame oslovenie
// emailom". Na rozdiel od banneru/videa/PR clanku (self-serve, Stripe
// checkout alebo AI automatizacia) sa tu neda nic rovno kupit ani spustit —
// inzerent musi ponuku poslat rucne na juraj@jurajkurek.com, aby sa dala
// individualne posudit (chrani to doveru databazy — posle sa len tym
// userom, ktori maju marketing_emails_opt_out = false, a rucne, nie
// automaticky).
//
// v2: opravene anchory podla skutocneho ziveho stavu produkcie (3
// existujuce price-cards vratane "PR clanok" za 249€, ktore v1 tohto
// patchu nepoznal + i18n data-i18n/sk/cz slovniky v oboch suboroch).
//
// Prida:
//  - public/landing.html: novu price-card v #cennik pricing-grid + sk/cz i18n kluce
//  - public/dashboard.html: novu card v aside + sk/cz i18n kluce
//
// Spusti z priecinka, kam je ad-service nasadeny (tam, kde su
// public/landing.html a public/dashboard.html):
//   node 49-email-outreach-option.js

const fs = require('fs');
const path = require('path');

const LANDING_PATH = path.join(process.cwd(), 'public', 'landing.html');
const DASHBOARD_PATH = path.join(process.cwd(), 'public', 'dashboard.html');

for (const p of [LANDING_PATH, DASHBOARD_PATH]) {
  if (!fs.existsSync(p)) {
    console.error('❌ Nenašiel som súbor:', p, '— spusti tento skript z priečinka, kde je ad-service nasadený (obsahuje public/landing.html a public/dashboard.html).');
    process.exit(1);
  }
}

const LOCK = path.join(process.cwd(), '.49-email-outreach-lock');
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (' + LOCK + '). Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const MAILTO = 'mailto:juraj@jurajkurek.com?subject=Ponuka%20-%20priame%20oslovenie%20emailom';

function replaceOnce(src, oldStr, newStr, label) {
  const count = src.split(oldStr).length - 1;
  if (count !== 1) {
    console.error('❌ ' + label + ' — kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil.');
    process.exit(1);
  }
  return src.replace(oldStr, () => newStr);
}

// ═══════════════════════ landing.html ═══════════════════════
let landing = fs.readFileSync(LANDING_PATH, 'utf8');

if (landing.includes('priceEmailH') || landing.includes('priceEmailBtn')) {
  console.error('❌ landing.html: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// 1) nová price-card v #cennik pricing-grid, hneď za "PR článok"
landing = replaceOnce(landing,
  `      <a href="/dashboard" class="btn-primary" data-i18n="pricePrBtn">Vytvoriť PR článok →</a>
    </div>
  </div>
</section>`,
  `      <a href="/dashboard" class="btn-primary" data-i18n="pricePrBtn">Vytvoriť PR článok →</a>
    </div>
    <div class="price-card">
      <h3 data-i18n="priceEmailH">Priame oslovenie emailom</h3>
      <div class="price-tag" style="color:var(--purple2)">Na dopyt</div>
      <span class="price-period" data-i18n="priceEmailPeriod">individuálne dohodnuté</span>
      <div class="price-feats">
        <span data-i18n="priceEmailF1">Ručne schvaľovaná ponuka, nie samoobsluha</span>
        <span data-i18n="priceEmailF2">Ide len používateľom, ktorí súhlasili s marketingovými emailmi</span>
        <span data-i18n="priceEmailF3">Obmedzený počet mesačne — chránime dôveru databázy</span>
      </div>
      <a href="${MAILTO}" class="btn-primary" data-i18n="priceEmailBtn">Napíš mi ponuku →</a>
    </div>
  </div>
</section>`,
  'landing.html pricing-grid');

// 2) SK i18n kľúče
landing = replaceOnce(landing,
  `    pricePrBtn: 'Vytvoriť PR článok →',
    faqLabel: 'Časté otázky', faqTitle: 'Ešte pár <em>vecí</em> vopred.',`,
  `    pricePrBtn: 'Vytvoriť PR článok →',
    priceEmailH: 'Priame oslovenie emailom', priceEmailPeriod: 'individuálne dohodnuté',
    priceEmailF1: 'Ručne schvaľovaná ponuka, nie samoobsluha', priceEmailF2: 'Ide len používateľom, ktorí súhlasili s marketingovými emailmi',
    priceEmailF3: 'Obmedzený počet mesačne — chránime dôveru databázy', priceEmailBtn: 'Napíš mi ponuku →',
    faqLabel: 'Časté otázky', faqTitle: 'Ešte pár <em>vecí</em> vopred.',`,
  'landing.html SK i18n');

// 3) CZ i18n kľúče
landing = replaceOnce(landing,
  `    pricePrBtn: 'Vytvořit PR článek →',
    faqLabel: 'Časté otázky', faqTitle: 'Ještě pár <em>věcí</em> předem.',`,
  `    pricePrBtn: 'Vytvořit PR článek →',
    priceEmailH: 'Přímé oslovení e-mailem', priceEmailPeriod: 'individuálně dohodnuté',
    priceEmailF1: 'Ručně schvalovaná nabídka, ne samoobsluha', priceEmailF2: 'Jde jen uživatelům, kteří souhlasili s marketingovými e-maily',
    priceEmailF3: 'Omezený počet měsíčně — chráníme důvěru databáze', priceEmailBtn: 'Napiš mi nabídku →',
    faqLabel: 'Časté otázky', faqTitle: 'Ještě pár <em>věcí</em> předem.',`,
  'landing.html CZ i18n');

// ═══════════════════════ dashboard.html ═══════════════════════
let dashboard = fs.readFileSync(DASHBOARD_PATH, 'utf8');

if (dashboard.includes('priceEmailLabel') || dashboard.includes('priceEmailBtn')) {
  console.error('❌ dashboard.html: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// 1) nová card v aside, za "PR článok" kartou
dashboard = replaceOnce(dashboard,
  `        <span data-i18n="featPr3">Automatická kontrola obsahu pred publikovaním</span>
      </div>
    </div>
  </aside>`,
  `        <span data-i18n="featPr3">Automatická kontrola obsahu pred publikovaním</span>
      </div>
    </div>
    <div class="card" style="margin-top:1.1rem">
      <div class="price-compact">
        <span style="font-family:var(--serif);font-size:1.15rem" data-i18n="priceEmailLabel">Email oslovenie</span>
        <span><span class="price-num" style="color:var(--purple2)" data-i18n="priceOnRequest">Na dopyt</span></span>
      </div>
      <div class="feat-list">
        <span data-i18n="featEmail1">Ručne schvaľovaná ponuka, nie samoobsluha</span>
        <span data-i18n="featEmail2">Ide len tým, čo súhlasili s marketingovými emailmi</span>
        <span data-i18n="featEmail3">Obmedzený počet mesačne — chránime dôveru databázy</span>
      </div>
      <a href="${MAILTO}" class="btn secondary" style="margin-top:.9rem;text-decoration:none;display:inline-flex" data-i18n="priceEmailBtn">Napíš mi ponuku →</a>
    </div>
  </aside>`,
  'dashboard.html aside');

// 2) SK i18n kľúče
dashboard = replaceOnce(dashboard,
  `    featPr2: 'Trvalý SEO odkaz na blogu — nie rotujúci slot', featPr3: 'Automatická kontrola obsahu pred publikovaním',
    footerTerms: 'Podmienky využívania',`,
  `    featPr2: 'Trvalý SEO odkaz na blogu — nie rotujúci slot', featPr3: 'Automatická kontrola obsahu pred publikovaním',
    priceEmailLabel: 'Email oslovenie', priceOnRequest: 'Na dopyt',
    featEmail1: 'Ručne schvaľovaná ponuka, nie samoobsluha', featEmail2: 'Ide len tým, čo súhlasili s marketingovými emailmi',
    featEmail3: 'Obmedzený počet mesačne — chránime dôveru databázy', priceEmailBtn: 'Napíš mi ponuku →',
    footerTerms: 'Podmienky využívania',`,
  'dashboard.html SK i18n');

// 3) CZ i18n kľúče
dashboard = replaceOnce(dashboard,
  `    featPr2: 'Trvalý SEO odkaz na blogu — ne rotující slot', featPr3: 'Automatická kontrola obsahu před publikováním',
    footerTerms: 'Podmínky využívání',`,
  `    featPr2: 'Trvalý SEO odkaz na blogu — ne rotující slot', featPr3: 'Automatická kontrola obsahu před publikováním',
    priceEmailLabel: 'E-mailové oslovení', priceOnRequest: 'Na dotaz',
    featEmail1: 'Ručně schvalovaná nabídka, ne samoobsluha', featEmail2: 'Jde jen těm, kdo souhlasili s marketingovými e-maily',
    featEmail3: 'Omezený počet měsíčně — chráníme důvěru databáze', priceEmailBtn: 'Napiš mi nabídku →',
    footerTerms: 'Podmínky využívání',`,
  'dashboard.html CZ i18n');

// ═══════════════════════ zápis ═══════════════════════
const landingBackup = LANDING_PATH + '.pre-email-outreach-option-' + Date.now();
const dashboardBackup = DASHBOARD_PATH + '.pre-email-outreach-option-' + Date.now();
fs.copyFileSync(LANDING_PATH, landingBackup);
fs.copyFileSync(DASHBOARD_PATH, dashboardBackup);
fs.writeFileSync(LANDING_PATH, landing);
fs.writeFileSync(DASHBOARD_PATH, dashboard);

console.log('✅ Pridaná neautomatizovaná možnosť "Priame oslovenie emailom" (mailto: juraj@jurajkurek.com), vrátane SK/CZ prekladov.');
console.log('   Zálohy:', landingBackup, dashboardBackup);
