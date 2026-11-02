// Druhá vrstva obrany pre VOP súhlas (po main-app-patches/267's fail-closed
// klientskej validácii): doteraz ŽIADNA zo 4 checkout routes nekontrolovala
// súhlas s VOP server-side vôbec — len marketingConsent (voliteľný). Priame
// API volanie (mimo tlačidla v appke) mohlo zaplatiť úplne bez súhlasu,
// nezávisle od akejkoľvek klientskej opravy.
//
// Klient teraz posiela vopAccepted:true/false (rovnaký checkbox, čo už
// blokuje kliknutie na tlačidlo), server ho vyžaduje pred spracovaním
// platby — vo všetkých 4 routes:
//   /api/stripe/checkout, /api/membership/checkout,
//   /api/courses/:slug/checkout, /api/generalka/checkout
// a v 7 klientskych volaniach: index.html x2, app.html x2, ponuka.html,
// generalka.html, kurz-detail.js.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/271-server-side-vop-enforcement.js
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
  const backup = relPath.replace(/[\\/]/g, '_') + '.pre-271-' + Date.now();
  fs.copyFileSync(relPath, backup);
  fs.writeFileSync(relPath, src);
  console.log('✅ ' + relPath + ' opravený. Záloha:', backup);
}

const LOCK = '.271-server-side-vop-enforcement-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (' + LOCK + '). Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

// ════════════════════════════════════════════════════════════════
// SERVER — 4 routes
// ════════════════════════════════════════════════════════════════

// ── /api/stripe/checkout ──
patchFile('server.js', [[
  `app.post('/api/stripe/checkout', rateLimit, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Chýba email.' });
  try {`,
  `app.post('/api/stripe/checkout', rateLimit, async (req, res) => {
  const { email, vopAccepted } = req.body;
  if (!email) return res.status(400).json({ error: 'Chýba email.' });
  if (!vopAccepted) return res.status(400).json({ error: 'Musíš súhlasiť s obchodnými podmienkami.' });
  try {`,
  '/api/stripe/checkout'
]]);

// ── /api/membership/checkout ──
patchFile('server.js', [[
  `let { email, tier, months, pricingMode, refCode, marketingConsent } = req.body || {};`,
  `let { email, tier, months, pricingMode, refCode, marketingConsent, vopAccepted } = req.body || {};`,
  '/api/membership/checkout destructure'
], [
  `  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Neplatný email.' });
  if (marketingConsent !== undefined) {
    await supabase.from('users').update({ marketing_emails_opt_out: !marketingConsent }).eq('email', email);
  }
  const cleanTier = tier === 'elite' ? 'elite' : 'premium';`,
  `  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Neplatný email.' });
  if (!vopAccepted) return res.status(400).json({ error: 'Musíš súhlasiť s obchodnými podmienkami.' });
  if (marketingConsent !== undefined) {
    await supabase.from('users').update({ marketing_emails_opt_out: !marketingConsent }).eq('email', email);
  }
  const cleanTier = tier === 'elite' ? 'elite' : 'premium';`,
  '/api/membership/checkout validacia'
]]);

// ── /api/courses/:slug/checkout ──
patchFile('server.js', [[
  `app.post('/api/courses/:slug/checkout', rateLimit, async (req, res) => {
  const { email, discountCode, ref, partnerRefCode, marketingConsent } = req.body || {};
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Neplatný email.' });
  if (marketingConsent !== undefined) {`,
  `app.post('/api/courses/:slug/checkout', rateLimit, async (req, res) => {
  const { email, discountCode, ref, partnerRefCode, marketingConsent, vopAccepted } = req.body || {};
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Neplatný email.' });
  if (!vopAccepted) return res.status(400).json({ error: 'Musíš súhlasiť s obchodnými podmienkami.' });
  if (marketingConsent !== undefined) {`,
  '/api/courses/:slug/checkout'
]]);

// ── routes/generalka.js: /api/generalka/checkout ──
patchFile('routes/generalka.js', [[
  `    const email = (user.email || '').toString().trim().toLowerCase();
    const { marketingConsent } = req.body || {};
    try {`,
  `    const email = (user.email || '').toString().trim().toLowerCase();
    const { marketingConsent, vopAccepted } = req.body || {};
    if (!vopAccepted) return res.status(400).json({ error: 'Musíš súhlasiť s obchodnými podmienkami.' });
    try {`,
  '/api/generalka/checkout'
]]);

// ════════════════════════════════════════════════════════════════
// KLIENT — 7 volaní, pridáva vopAccepted do fetch body
// ════════════════════════════════════════════════════════════════

// ── ponuka.html ──
patchFile('public/ponuka.html', [[
  `marketingConsent: !!document.getElementById('ponukaMarketingCheckbox')?.checked })`,
  `marketingConsent: !!document.getElementById('ponukaMarketingCheckbox')?.checked, vopAccepted: !!(vopBox && vopBox.checked) })`,
  'startPlanCheckout'
]]);

// ── generalka.html ──
patchFile('public/generalka.html', [[
  `body: JSON.stringify({ marketingConsent: !!(marketingBox && marketingBox.checked) })`,
  `body: JSON.stringify({ marketingConsent: !!(marketingBox && marketingBox.checked), vopAccepted: !!(vopBox && vopBox.checked) })`,
  'startCheckout'
]]);

// ── app.html (paywall + elite modal) ──
patchFile('public/app.html', [
  [
    `body:JSON.stringify({email:currentUser.email,refCode:pendingRef,refType:localStorage.getItem('vsp_pending_ref_type')||null,marketingConsent:!!(marketingBox&&marketingBox.checked)})`,
    `body:JSON.stringify({email:currentUser.email,refCode:pendingRef,refType:localStorage.getItem('vsp_pending_ref_type')||null,marketingConsent:!!(marketingBox&&marketingBox.checked),vopAccepted:!!(vopBox&&vopBox.checked)})`,
    'startCheckout (paywall)'
  ],
  [
    `body:JSON.stringify({email:currentUser.email,plan:'elite',refCode:localStorage.getItem('vsp_pending_ref')||null,marketingConsent:!!(eliteMarketingBox&&eliteMarketingBox.checked)})`,
    `body:JSON.stringify({email:currentUser.email,plan:'elite',refCode:localStorage.getItem('vsp_pending_ref')||null,marketingConsent:!!(eliteMarketingBox&&eliteMarketingBox.checked),vopAccepted:!!(eliteVopBox&&eliteVopBox.checked)})`,
    'startEliteCheckout'
  ]
]);

// ── kurz-detail.js ──
patchFile('public/kurz-detail.js', [[
  `body: JSON.stringify({ email: currentUser.email, discountCode, ref, partnerRefCode, marketingConsent: !!(marketingBox && marketingBox.checked) })`,
  `body: JSON.stringify({ email: currentUser.email, discountCode, ref, partnerRefCode, marketingConsent: !!(marketingBox && marketingBox.checked), vopAccepted: !!(vopBox && vopBox.checked) })`,
  'buyCourse'
]]);

// ── index.html (premium popup) ──
patchFile('public/index.html', [[
  `body: JSON.stringify({ email, refCode: pendingRef, refType: pendingRefType })`,
  `body: JSON.stringify({ email, refCode: pendingRef, refType: pendingRefType, vopAccepted: !!(consent && consent.checked) })`,
  'handlePremiumCheckout'
], [
  `body: JSON.stringify({ email, plan: 'elite', refCode: refCode || null, refType: pendingRefType })`,
  `body: JSON.stringify({ email, plan: 'elite', refCode: refCode || null, refType: pendingRefType, vopAccepted: !!(consent && consent.checked) })`,
  'submitEliteCheckout'
]]);

console.log('Hotovo. server.js a routes/generalka.js potrebujú: pm2 restart sptrener-main');
console.log('Statické .html/.js súbory netreba reštartovať.');
