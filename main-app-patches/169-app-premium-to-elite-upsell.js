// Pridava "Prejst na Elite" tlacidlo do accountoveho panelu (rovnake
// miesto ako "Ziskat Premium" pre FREE pouzivatelov) — ale iba pre
// PREMIUM pouzivatelov (nie FREE, nie uz-ELITE), a zamerne menej
// napadne: outline/ghost styl (fialovy border, priehladne pozadie)
// namiesto plnej tucnej --volt CTA, ktoru ma Free->Premium.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/169-app-premium-to-elite-upsell.js

const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(process.cwd(), 'public', 'app.html');

if (!fs.existsSync(HTML_PATH)) {
  console.error('❌ Nenašiel som súbor:', HTML_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.169-app-premium-to-elite-upsell-lock');
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (' + LOCK + '). Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

function replaceOnce(src, oldStr, newStr, label) {
  const count = src.split(oldStr).length - 1;
  if (count !== 1) {
    console.error('❌ ' + label + ' — kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil.');
    process.exit(1);
  }
  return src.replace(oldStr, () => newStr);
}

let html = fs.readFileSync(HTML_PATH, 'utf8');

if (html.includes('getEliteBtn')) {
  console.error('❌ app.html: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// 1) SK i18n kľúč
html = replaceOnce(html,
  "    loginGoogle:'Prihlásiť sa cez Google',getPremiumBtn:'✦ Získať Premium',logoutBtn:'Odhlásiť',",
  "    loginGoogle:'Prihlásiť sa cez Google',getPremiumBtn:'✦ Získať Premium',getEliteBtn:'Prejsť na Elite →',logoutBtn:'Odhlásiť',",
  'i18n SK getEliteBtn');

// 2) CZ i18n kľúč
html = replaceOnce(html,
  "    loginGoogle:'Přihlásit se přes Google',getPremiumBtn:'✦ Získat Premium',logoutBtn:'Odhlásit',",
  "    loginGoogle:'Přihlásit se přes Google',getPremiumBtn:'✦ Získat Premium',getEliteBtn:'Přejít na Elite →',logoutBtn:'Odhlásit',",
  'i18n CZ getEliteBtn');

// 3) ub tlačidlo — pridaný Premium->Elite vetva (menej nápadný outline štýl)
html = replaceOnce(html,
  "    const ub=!isPremium()?`<button onclick=\"startCheckout()\" style=\"width:100%;background:var(--volt);border:none;border-radius:8px;padding:.4rem .6rem;color:var(--black);font-family:var(--mono);font-size:.74rem;font-weight:700;cursor:pointer;\">${t('getPremiumBtn')}</button>`:'';",
  "    const ub=!isPremium()?`<button onclick=\"startCheckout()\" style=\"width:100%;background:var(--volt);border:none;border-radius:8px;padding:.4rem .6rem;color:var(--black);font-family:var(--mono);font-size:.74rem;font-weight:700;cursor:pointer;\">${t('getPremiumBtn')}</button>`:(!isElite()?`<button onclick=\"startEliteCheckout()\" style=\"width:100%;background:transparent;border:1px solid var(--purple);border-radius:8px;padding:.35rem .6rem;color:var(--purple2);font-family:var(--mono);font-size:.7rem;font-weight:600;cursor:pointer;\">${t('getEliteBtn')}</button>`:'');",
  'renderAuthButton() ub tlačidlo -> Premium->Elite upsell');

const backup = HTML_PATH + '.pre-premium-to-elite-upsell-' + Date.now();
fs.copyFileSync(HTML_PATH, backup);
fs.writeFileSync(HTML_PATH, html);

console.log('✅ Premium používatelia teraz vidia menej nápadné "Prejsť na Elite" tlačidlo v account paneli.');
console.log('   Záloha:', backup);
