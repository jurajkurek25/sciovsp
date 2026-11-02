// Piata checkout route objavená pri audite (main-app-patches/267/271) —
// /api/gift-cards/checkout — mala klientsky checkbox (giftVopCheckbox) aj
// JS validáciu, ale server súhlas vôbec nekontroloval (rovnaký chýbajúci
// vzor ako predtým pri ostatných 4 routes).
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/272-gift-cards-vop-enforcement.js
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
  const backup = relPath.replace(/[\\/]/g, '_') + '.pre-272-' + Date.now();
  fs.copyFileSync(relPath, backup);
  fs.writeFileSync(relPath, src);
  console.log('✅ ' + relPath + ' opravený. Záloha:', backup);
}

const LOCK = '.272-gift-cards-vop-enforcement-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (' + LOCK + '). Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

// ── server.js: /api/gift-cards/checkout ──
patchFile('server.js', [[
  `app.post('/api/gift-cards/checkout', rateLimit, async (req, res) => {
  const { buyerEmail, recipientName, message, refCode, marketingConsent } = req.body || {};
  let items = Array.isArray(req.body?.items) ? req.body.items : null;
  if (!items && req.body?.optionId) {
    items = [{ optionId: req.body.optionId, quantity: 1, includeCourse: !!req.body.includeCourse }];
  }
  if (!buyerEmail || !buyerEmail.includes('@')) return res.status(400).json({ error: 'Zadaj platný e-mail.' });
  if (marketingConsent !== undefined) {`,
  `app.post('/api/gift-cards/checkout', rateLimit, async (req, res) => {
  const { buyerEmail, recipientName, message, refCode, marketingConsent, vopAccepted } = req.body || {};
  let items = Array.isArray(req.body?.items) ? req.body.items : null;
  if (!items && req.body?.optionId) {
    items = [{ optionId: req.body.optionId, quantity: 1, includeCourse: !!req.body.includeCourse }];
  }
  if (!buyerEmail || !buyerEmail.includes('@')) return res.status(400).json({ error: 'Zadaj platný e-mail.' });
  if (!vopAccepted) return res.status(400).json({ error: 'Musíš súhlasiť s obchodnými podmienkami.' });
  if (marketingConsent !== undefined) {`,
  '/api/gift-cards/checkout'
]]);

// ── public/darcekova-karta.html ──
patchFile('public/darcekova-karta.html', [[
  `        items, buyerEmail,
        recipientName: $('#recipientName').value.trim(), message: $('#giftMessage').value.trim(),
        refCode: sessionStorage.getItem('partner_ref') || null, marketingConsent: !!$('#giftMarketingCheckbox').checked
      })`,
  `        items, buyerEmail,
        recipientName: $('#recipientName').value.trim(), message: $('#giftMessage').value.trim(),
        refCode: sessionStorage.getItem('partner_ref') || null, marketingConsent: !!$('#giftMarketingCheckbox').checked, vopAccepted: !!$('#giftVopCheckbox').checked
      })`,
  'buy() fetch body'
]]);

console.log('Hotovo. server.js potrebuje: pm2 restart sptrener-main');
console.log('darcekova-karta.html je statický — netreba reštart.');
