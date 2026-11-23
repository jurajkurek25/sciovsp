// "✦ Získať Premium" tlačidlo v paneli účtu (free user) volalo
// startCheckout() PRIAMO, bez toho, aby predtým otvorilo paywall overlay
// (showPaywall()), ktorý jediný obsahuje paywallVopCheckbox. Po
// main-app-patches/267 (fail-closed VOP validácia) to teraz správne
// blokuje platbu hláškou "Musíš súhlasiť s obchodnými podmienkami", ale
// user nemá odkiaľ ten súhlas zaškrtnúť — slepá ulička.
//
// Opravuje to na showPaywall('registered') — rovnaký modál, aký sa
// ukazuje po vyčerpaní bezplatných testov, s checkboxom aj CTA tlačidlom,
// ktoré až POTOM zavolá startCheckout().
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/269-account-panel-premium-btn-opens-paywall.js
const fs = require('fs');
const FILE = 'public/app.html';

const LOCK = FILE.replace('/', '_') + '.269-lock';
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

if (!fs.existsSync(FILE)) {
  console.error('❌ Nenašiel som súbor:', FILE, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

let html = fs.readFileSync(FILE, 'utf8');

const OLD = `<button onclick="startCheckout()" style="width:100%;background:var(--volt);border:none;border-radius:8px;padding:.4rem .6rem;color:var(--black);font-family:var(--mono);font-size:.74rem;font-weight:700;cursor:pointer;">\${t('getPremiumBtn')}`;
const NEW = `<button onclick="showPaywall('registered')" style="width:100%;background:var(--volt);border:none;border-radius:8px;padding:.4rem .6rem;color:var(--black);font-family:var(--mono);font-size:.74rem;font-weight:700;cursor:pointer;">\${t('getPremiumBtn')}`;
html = replaceExactCount(html, OLD, NEW, 1, 'account panel "Získať Premium" tlačidlo');

const backup = FILE.replace('/', '_') + '.pre-269-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, html);

console.log('✅ app.html: panel účtu "Získať Premium" teraz otvára paywall overlay (showPaywall) namiesto priameho startCheckout().');
console.log('   Záloha:', backup);
console.log('   Statický súbor — žiadny pm2 restart netreba.');
