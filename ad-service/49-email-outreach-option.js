// Prida tretiu, NEAUTOMATIZOVANU moznost na ad platformu: "Priame oslovenie
// emailom". Na rozdiel od banneru/videa (self-serve, Stripe checkout) sa
// tu neda nic rovno kupit ani spustit — inzerent musi ponuku poslat
// rucne na juraj@jurajkurek.com, aby sa dala individualne posudit (chrani
// to doveru databazy — poslane su len tym userom, ktori maju
// marketing_emails_opt_out = false, a rucne, nie automaticky).
//
// Prida:
//  - public/landing.html: novu price-card v #cennik pricing-grid
//  - public/dashboard.html: novu card v aside, vedla banner/video cien
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

// ─── landing.html ───────────────────────────────────────────
const landingSrc = fs.readFileSync(LANDING_PATH, 'utf8');

if (landingSrc.includes('Priame oslovenie emailom')) {
  console.error('❌ landing.html: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

const LANDING_OLD = `      <a href="/dashboard" class="btn-primary">Nahrať video →</a>
    </div>
  </div>
</section>`;

const LANDING_NEW = `      <a href="/dashboard" class="btn-primary">Nahrať video →</a>
    </div>
    <div class="price-card">
      <h3>Priame oslovenie emailom</h3>
      <div class="price-tag">Na dopyt</div>
      <span class="price-period">individuálne dohodnuté</span>
      <div class="price-feats">
        <span>Ručne schvaľovaná ponuka, nie samoobsluha</span>
        <span>Ide len používateľom, ktorí súhlasili s marketingovými emailmi</span>
        <span>Obmedzený počet mesačne — chránime dôveru databázy</span>
      </div>
      <a href="${MAILTO}" class="btn-primary">Napíš mi ponuku →</a>
    </div>
  </div>
</section>`;

const landingOut = replaceOnce(landingSrc, LANDING_OLD, LANDING_NEW, 'landing.html pricing-grid');

// ─── dashboard.html ─────────────────────────────────────────
const dashboardSrc = fs.readFileSync(DASHBOARD_PATH, 'utf8');

if (dashboardSrc.includes('Priame oslovenie emailom') || dashboardSrc.includes('Email oslovenie')) {
  console.error('❌ dashboard.html: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

const DASHBOARD_OLD = `      <div class="side-note">Podrobný cenník a argumenty, prečo tu inzerovať, nájdeš na <a href="/">hlavnej stránke</a>.</div>
    </div>
  </aside>`;

const DASHBOARD_NEW = `      <div class="side-note">Podrobný cenník a argumenty, prečo tu inzerovať, nájdeš na <a href="/">hlavnej stránke</a>.</div>
    </div>
    <div class="card" style="margin-top:1.1rem">
      <div class="price-compact">
        <span style="font-family:var(--serif);font-size:1.15rem">Email oslovenie</span>
        <span><span class="price-num">Na dopyt</span></span>
      </div>
      <div class="feat-list">
        <span>Ručne schvaľovaná ponuka, nie samoobsluha</span>
        <span>Ide len tým, čo súhlasili s marketingovými emailmi</span>
        <span>Obmedzený počet mesačne — chránime dôveru databázy</span>
      </div>
      <a href="${MAILTO}" class="btn secondary" style="margin-top:.9rem;text-decoration:none;display:inline-flex">Napíš mi ponuku →</a>
    </div>
  </aside>`;

const dashboardOut = replaceOnce(dashboardSrc, DASHBOARD_OLD, DASHBOARD_NEW, 'dashboard.html aside');

// ─── zápis ───────────────────────────────────────────────────
const landingBackup = LANDING_PATH + '.pre-email-outreach-option-' + Date.now();
const dashboardBackup = DASHBOARD_PATH + '.pre-email-outreach-option-' + Date.now();
fs.copyFileSync(LANDING_PATH, landingBackup);
fs.copyFileSync(DASHBOARD_PATH, dashboardBackup);
fs.writeFileSync(LANDING_PATH, landingOut);
fs.writeFileSync(DASHBOARD_PATH, dashboardOut);

console.log('✅ Pridaná neautomatizovaná možnosť "Priame oslovenie emailom" (mailto: juraj@jurajkurek.com).');
console.log('   Zálohy:', landingBackup, dashboardBackup);
