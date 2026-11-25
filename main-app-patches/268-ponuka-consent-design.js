// Dizajnová oprava — VOP + marketing checkboxy na ponuka.html boli holé
// natívne checkboxy voľne položené pod kartami plánov, bez pozadia či
// orámovania, čo vyzeralo ako nedokončený afterthought (user screenshot).
// Zabalí ich do samostatného "consent panelu" (karta s pozadím/borderom
// v rovnakom štýle ako zvyšok stránky) a ofarbí checkboxy cez
// accent-color na --ignite (volt zelená používaná inde v appke).
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/268-ponuka-consent-design.js
const fs = require('fs');
const path = require('path');

const FILE = path.join(process.cwd(), 'public', 'ponuka.html');

if (!fs.existsSync(FILE)) {
  console.error('❌ Nenašiel som súbor:', FILE, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.268-ponuka-consent-design-lock');
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (' + LOCK + '). Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

function replaceExactCount(src, oldStr, newStr, expectedCount, label) {
  const count = src.split(oldStr).length - 1;
  if (count !== expectedCount) {
    console.error('❌ ' + label + ' — očakávaných ' + expectedCount + ' výskytov, nájdených ' + count + '. Nič som nezmenil.');
    process.exit(1);
  }
  return src.split(oldStr).join(newStr);
}

let html = fs.readFileSync(FILE, 'utf8');

if (html.includes('plan-consent')) {
  console.error('❌ ponuka.html: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// ── CSS — nový .plan-consent panel, hneď za .plan-btn ──
const CSS_OLD = `.plan-btn{margin-top:auto;padding:.9rem 1.2rem;border:none;border-radius:3px;font-family:var(--mono);font-size:.85rem;font-weight:700;cursor:pointer;text-align:center}`;
const CSS_NEW = `.plan-btn{margin-top:auto;padding:.9rem 1.2rem;border:none;border-radius:3px;font-family:var(--mono);font-size:.85rem;font-weight:700;cursor:pointer;text-align:center}
.plan-consent{max-width:460px;margin:1.5rem auto 0;padding:1rem 1.2rem;background:var(--ink2);border:1px solid var(--border);border-radius:10px;display:flex;flex-direction:column;gap:.7rem}
.plan-consent label{display:flex;gap:.6rem;align-items:flex-start;font-size:.78rem;line-height:1.5;color:var(--text2);text-align:left;cursor:pointer}
.plan-consent input[type=checkbox]{margin-top:.15rem;flex-shrink:0;width:16px;height:16px;accent-color:var(--ignite);cursor:pointer}
.plan-consent a{color:var(--signal2)}`;
html = replaceExactCount(html, CSS_OLD, CSS_NEW, 1, 'CSS .plan-btn anchor');

// ── HTML — obaliť oba checkboxy do .plan-consent panelu ──
const HTML_OLD = `    <label style="display:flex;gap:.5rem;align-items:flex-start;font-size:.8rem;text-align:left;margin:0 auto .6rem;max-width:480px"><input type="checkbox" id="ponukaVopCheckbox" style="margin-top:.15rem;flex-shrink:0"><span>Súhlasím s <a href="/legal.html#vop" target="_blank">obchodnými podmienkami</a> a <a href="/legal.html#privacy" target="_blank">ochranou osobných údajov</a>.</span></label>
    <label style="display:flex;gap:.5rem;align-items:flex-start;font-size:.8rem;text-align:left;margin:0 auto .6rem;max-width:480px"><input type="checkbox" id="ponukaMarketingCheckbox" style="margin-top:.15rem;flex-shrink:0"><span>Chcem dostávať aj odporúčania a ponuky partnerov (voliteľné, kedykoľvek sa dá odhlásiť).</span></label>`;
const HTML_NEW = `    <div class="plan-consent">
      <label><input type="checkbox" id="ponukaVopCheckbox"><span>Súhlasím s <a href="/legal.html#vop" target="_blank">obchodnými podmienkami</a> a <a href="/legal.html#privacy" target="_blank">ochranou osobných údajov</a>.</span></label>
      <label><input type="checkbox" id="ponukaMarketingCheckbox"><span>Chcem dostávať aj odporúčania a ponuky partnerov (voliteľné, kedykoľvek sa dá odhlásiť).</span></label>
    </div>`;
html = replaceExactCount(html, HTML_OLD, HTML_NEW, 1, 'HTML checkboxy');

const backup = FILE + '.pre-268-ponuka-consent-design-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, html);

console.log('✅ ponuka.html: consent checkboxy teraz majú vlastný štýlovaný panel.');
console.log('   Záloha:', backup);
console.log('   Statický súbor — žiadny pm2 restart netreba.');
