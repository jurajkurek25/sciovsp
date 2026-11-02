// VOP (obchodné podmienky) checkbox validácia pred platbou bola na 4
// miestach napísaná ako "fail-open": `if (vopBox && !vopBox.checked)`.
// Ak checkbox element z nejakého dôvodu v DOM nie je (zastaraná cache
// stránky, timing problém, iný variant tlačidla...), `vopBox` je null,
// celá podmienka je false a platba sa odošle BEZ akejkoľvek kontroly
// súhlasu. Mení to na "fail-closed": `if (!vopBox || !vopBox.checked)`
// — chýbajúci checkbox teraz blokuje platbu, nie naopak.
//
// index.html (handlePremiumCheckout/submitEliteCheckout) bolo overené a
// je v poriadku — iný vzor, náhodou fail-safe — nič sa tam nemení.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/267-vop-checkbox-fail-closed.js
const fs = require('fs');
const path = require('path');

const LOCK = path.join(process.cwd(), '.267-vop-checkbox-fail-closed-lock');
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

function patchFile(relPath, replacements) {
  const file = path.join(process.cwd(), relPath);
  if (!fs.existsSync(file)) {
    console.error('❌ Nenašiel som súbor:', file, '— spusti tento skript z koreňa hlavnej appky.');
    process.exit(1);
  }
  let src = fs.readFileSync(file, 'utf8');
  for (const [oldStr, newStr, label] of replacements) {
    src = replaceExactCount(src, oldStr, newStr, 1, relPath + ' — ' + label);
  }
  const backup = file + '.pre-267-vop-checkbox-fail-closed-' + Date.now();
  fs.copyFileSync(file, backup);
  fs.writeFileSync(file, src);
  console.log('✅ ' + relPath + ' opravený. Záloha:', backup);
}

// ── ponuka.html ──
patchFile('public/ponuka.html', [[
  `  const vopBox = document.getElementById('ponukaVopCheckbox');
  if (vopBox && !vopBox.checked) {`,
  `  const vopBox = document.getElementById('ponukaVopCheckbox');
  if (!vopBox || !vopBox.checked) {`,
  'startPlanCheckout'
]]);

// ── generalka.html ──
patchFile('public/generalka.html', [[
  `  const vopBox = document.getElementById('generalkaVopCheckbox');
  if (vopBox && !vopBox.checked) {`,
  `  const vopBox = document.getElementById('generalkaVopCheckbox');
  if (!vopBox || !vopBox.checked) {`,
  'startCheckout'
]]);

// ── app.html (paywall + elite modal) ──
patchFile('public/app.html', [
  [
    `const vopBox=document.getElementById('paywallVopCheckbox');
  if(vopBox&&!vopBox.checked){showToast('⚠️ Musíš súhlasiť s obchodnými podmienkami.');return;}`,
    `const vopBox=document.getElementById('paywallVopCheckbox');
  if(!vopBox||!vopBox.checked){showToast('⚠️ Musíš súhlasiť s obchodnými podmienkami.');return;}`,
    'startCheckout (paywall)'
  ],
  [
    `const eliteVopBox=document.getElementById('eliteModalVopCheckbox');
  if(eliteVopBox&&!eliteVopBox.checked){showToast('⚠️ Musíš súhlasiť s obchodnými podmienkami.');return;}`,
    `const eliteVopBox=document.getElementById('eliteModalVopCheckbox');
  if(!eliteVopBox||!eliteVopBox.checked){showToast('⚠️ Musíš súhlasiť s obchodnými podmienkami.');return;}`,
    'startEliteCheckout'
  ]
]);

// ── kurz-detail.js ──
patchFile('public/kurz-detail.js', [[
  `    const vopBox = clickedSlot ? clickedSlot.querySelector('.js-vop-checkbox') : document.querySelector('.js-vop-checkbox');
    if (vopBox && !vopBox.checked) { alert('Musíš súhlasiť s obchodnými podmienkami.'); return; }`,
  `    const vopBox = clickedSlot ? clickedSlot.querySelector('.js-vop-checkbox') : document.querySelector('.js-vop-checkbox');
    if (!vopBox || !vopBox.checked) { alert('Musíš súhlasiť s obchodnými podmienkami.'); return; }`,
  'buyCourse'
]]);

console.log('Hotovo. Statické súbory — žiadny pm2 restart netreba.');
