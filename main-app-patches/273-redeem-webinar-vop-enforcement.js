// Pokracovanie auditu VOP suhlasu (267/271/272) — dalsie 2 miesta s
// povinnym checkboxom, ktore server-side vobec nekontroloval:
//   /api/gift-cards/redeem (uplatnit-darcek.html)
//   /api/webinar/register (webinar.html, registracia zdarma)
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/273-redeem-webinar-vop-enforcement.js
const fs = require('fs');

function replaceExactCount(src, oldStr, newStr, expectedCount, label) {
  const count = src.split(oldStr).length - 1;
  if (count !== expectedCount) {
    console.error('❌ ' + label + ' — očakávaných ' + expectedCount + ' výskytov, nájdených ' + count + '. Nič som nezmenil.');
    process.exit(1);
  }
  return src.split(oldStr).join(newStr);
}

function patchFile(relPath, replacements) {
  if (!fs.existsSync(relPath)) {
    console.error('❌ Nenašiel som súbor:', relPath, '— spusti tento skript z koreňa hlavnej appky.');
    process.exit(1);
  }
  let src = fs.readFileSync(relPath, 'utf8');
  for (const [oldStr, newStr, label] of replacements) {
    src = replaceExactCount(src, oldStr, newStr, 1, relPath + ' — ' + label);
  }
  const backup = relPath.replace(/[\\/]/g, '_') + '.pre-273-' + Date.now();
  fs.copyFileSync(relPath, backup);
  fs.writeFileSync(relPath, src);
  console.log('✅ ' + relPath + ' opravený. Záloha:', backup);
}

const LOCK = '.273-redeem-webinar-vop-enforcement-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (' + LOCK + '). Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

// ── server.js: /api/gift-cards/redeem ──
patchFile('server.js', [[
  `app.post('/api/gift-cards/redeem', rateLimit, async (req, res) => {
  const email = await getGoogleEmail(req);
  if (!email) return res.status(401).json({ error: 'Prihlás sa cez Google.' });
  const { code, courseId, marketingConsent } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Zadaj kód.' });
  if (marketingConsent !== undefined) {`,
  `app.post('/api/gift-cards/redeem', rateLimit, async (req, res) => {
  const email = await getGoogleEmail(req);
  if (!email) return res.status(401).json({ error: 'Prihlás sa cez Google.' });
  const { code, courseId, marketingConsent, vopAccepted } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Zadaj kód.' });
  if (!vopAccepted) return res.status(400).json({ error: 'Musíš súhlasiť s obchodnými podmienkami.' });
  if (marketingConsent !== undefined) {`,
  '/api/gift-cards/redeem'
]]);

// ── server.js: /api/webinar/register ──
patchFile('server.js', [[
  `    const email = (user.email || '').toString().trim().toLowerCase();
    const { name, marketingConsent } = req.body || {};
    if (marketingConsent !== undefined) {`,
  `    const email = (user.email || '').toString().trim().toLowerCase();
    const { name, marketingConsent, vopAccepted } = req.body || {};
    if (!vopAccepted) return res.status(400).json({ error: 'Musíš súhlasiť s obchodnými podmienkami.' });
    if (marketingConsent !== undefined) {`,
  '/api/webinar/register'
]]);

// ── public/uplatnit-darcek.html ──
patchFile('public/uplatnit-darcek.html', [[
  `body: JSON.stringify({ code, courseId, marketingConsent: !!document.getElementById('redeemMarketingCheckbox').checked })`,
  `body: JSON.stringify({ code, courseId, marketingConsent: !!document.getElementById('redeemMarketingCheckbox').checked, vopAccepted: !!document.getElementById('redeemVopCheckbox').checked })`,
  'redeem() fetch body'
]]);

// ── public/webinar.html ──
patchFile('public/webinar.html', [[
  `body: JSON.stringify({ name: name || null, marketingConsent: !!document.getElementById('regMarketingCheckbox').checked })`,
  `body: JSON.stringify({ name: name || null, marketingConsent: !!document.getElementById('regMarketingCheckbox').checked, vopAccepted: !!document.getElementById('regVopCheckbox').checked })`,
  'submitRegistration() fetch body'
]]);

console.log('Hotovo. server.js potrebuje: pm2 restart sptrener-main');
console.log('uplatnit-darcek.html a webinar.html su staticke — netreba restart.');
