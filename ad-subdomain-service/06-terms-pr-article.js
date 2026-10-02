// Pridáva samostatnú sekciu do terms.html pokrývajúcu PR článok — cena,
// automatizovaný proces (AI interview + auto-publikovanie bez manuálneho
// schválenia), povinné označenie ako partnerský/sponzorovaný obsah, a čo
// sa deje, ak automatická kontrola obsah zamietne PO zaplatení.
//
// Presný textový match proti overenému živému súboru public/terms.html.
//
// Spusti z /home/sptrener-ad/htdocs/ad.sptrener.online:
//   node /root/ad-subdomain-service/06-terms-pr-article.js

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'public', 'terms.html');
const src = fs.readFileSync(FILE_PATH, 'utf8');

if (src.includes('PR článok')) {
  console.error('❌ Vyzerá to, že sekcia o PR článku už v terms.html existuje. Nič som nezmenil.');
  process.exit(1);
}

const OLD = `  <h2>5. Cena a platobné podmienky</h2>`;

const NEW = `  <h2>5. PR článok — samostatný typ reklamy</h2>
  <p><strong>5.1 Čo to je.</strong> PR článok je platená služba, pri ktorej Inzerent poskytne podklady o svojom produkte (čo produkt robí, prečo sa hodí študentom, aký výsledok z neho majú, prečo sa hodí na blog SP Tréner) a cieľovú URL. Umelá inteligencia následne položí Inzerentovi doplňujúce otázky. Po zodpovedaní otázok a zaplatení AI <strong>automaticky a bez manuálneho schválenia</strong> vygeneruje bilingválny (slovenský a český) článok a vypublikuje ho na blogu hlavnej aplikácie (sptrener.online/blog).</p>
  <p><strong>5.2 Cena.</strong> PR článok stojí <strong>249 €, jednorazovo</strong> (nie predplatné) — platba prebehne až po tom, čo Inzerent zodpovie doplňujúce otázky AI a pred spustením generovania článku.</p>
  <p><strong>5.3 Označenie ako partnerský obsah.</strong> Každý PR článok je na blogu viditeľne označený ako partnerský/sponzorovaný obsah v úvode článku — Prevádzkovateľ negarantuje ani nenaznačuje, že ide o nezávislé redakčné hodnotenie.</p>
  <p><strong>5.4 Automatická kontrola obsahu a čo sa deje pri zamietnutí.</strong> Vygenerovaný článok aj cieľová URL prechádzajú rovnakou automatizovanou AI kontrolou ako bannery a video reklamy (pozri bod 4.5), s rovnakým fail-closed princípom.</p>
  <ul>
    <li>Ak kontrola článok zamietne, článok sa nevypublikuje. Inzerent je o tom informovaný emailom a Prevádzkovateľ sa s ním individuálne dohodne na riešení — buď ručnej úprave a dodatočnom publikovaní, alebo vrátení platby.</li>
    <li>Keďže platba prebieha PRED automatickým generovaním obsahu (Inzerent v čase platby ešte nevidí finálny text článku), Inzerent berie na vedomie, že finálny text vytvára AI na základe ním poskytnutých podkladov a odpovedí — Prevádzkovateľ zodpovedá za funkčnosť procesu (vygenerovanie, kontrolu, publikovanie), nie za štylistickú podobu textu, ktorú si Inzerent vopred neschvaľuje.</li>
    <li>Inzerent zodpovedá za pravdivosť podkladov, ktoré AI poskytne (rovnako ako pri bode 4.3) — AI z nich pri písaní článku vychádza.</li>
  </ul>
  <p><strong>5.5 Trvalé umiestnenie.</strong> Na rozdiel od bannerov a video reklám nie je PR článok časovo obmedzený predplatným — po vypublikovaní zostáva na blogu natrvalo, pokiaľ ho Prevádzkovateľ neodstráni pre porušenie týchto podmienok alebo na základe dodatočnej dohody s Inzerentom.</p>

  <h2>6. Cena a platobné podmienky (bannery a video reklamy)</h2>`;

if (!src.includes(OLD)) {
  console.error('❌ Nenašiel som presnú kotvu ("<h2>5. Cena a platobné podmienky</h2>"). Nič som nezmenil.');
  process.exit(1);
}

// Zvyšné nadpisy (pôvodne 6-12) treba posunúť o jedno číslo vyššie, keďže
// nová sekcia sa vkladá ako 5 a pôvodná 5 sa premenúva na 6.
const RENUMBER = [
  ['<h2>6. Zobrazovanie a štatistiky</h2>', '<h2>7. Zobrazovanie a štatistiky</h2>'],
  ['<h2>7. Ochrana osobných údajov</h2>', '<h2>8. Ochrana osobných údajov</h2>'],
  ['<h2>8. Obmedzenie zodpovednosti</h2>', '<h2>9. Obmedzenie zodpovednosti</h2>'],
  ['<h2>9. Ukončenie spolupráce</h2>', '<h2>10. Ukončenie spolupráce</h2>'],
  ['<h2>10. Zmeny podmienok</h2>', '<h2>11. Zmeny podmienok</h2>'],
  ['<h2>11. Rozhodné právo a riešenie sporov</h2>', '<h2>12. Rozhodné právo a riešenie sporov</h2>'],
  ['<h2>12. Kontakt</h2>', '<h2>13. Kontakt</h2>']
];

for (const [oldH, _] of RENUMBER) {
  if (!src.includes(oldH)) {
    console.error(`❌ Nenašiel som presný nadpis "${oldH}" na prečíslovanie. Nič som nezmenil.`);
    process.exit(1);
  }
}

const backupPath = FILE_PATH + '.pre-pr-article-terms-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
let out = src.replace(OLD, NEW);
for (const [oldH, newH] of RENUMBER) {
  out = out.replace(oldH, newH);
}
fs.writeFileSync(FILE_PATH, out);

console.log('✅ Sekcia o PR článku pridaná do terms.html (nová sekcia 5), zvyšné sekcie prečíslované.');
console.log('   Záloha pôvodného terms.html:', backupPath);
