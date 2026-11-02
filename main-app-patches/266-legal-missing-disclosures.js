// Dopĺňa 2 potvrdené medzery (NEOWORKLY na výpise z karty — chýbalo úplne,
// hoci to popup na index.html už user vidí; SMS poskytovateľ pre telefónne
// overenie v zozname sprostredkovateľov) + 3 live funkcie appky, ktoré
// legal.html doteraz vôbec nespomínal (potvrdené userom): SP Komunita
// (príspevky/fotky/súkromné správy), súťaže, kariérny kvíz s emailovou
// sekvenciou. Upravuje všetky 3 duplikované bloky (SK statický, SK i18n,
// CZ i18n).
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/266-legal-missing-disclosures.js
const fs = require('fs');
const path = require('path');

const FILE = path.join(process.cwd(), 'public', 'legal.html');

if (!fs.existsSync(FILE)) {
  console.error('❌ Nenašiel som súbor:', FILE, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.266-legal-missing-disclosures-lock');
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

if (html.includes('SP Komunita')) {
  console.error('❌ legal.html: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// ── 1) NEOWORKLY na výpise z karty — vop1, SK (statický + i18n, identický text) ──
const SK_VOP1_OLD = `          <p>
            Prevádzkovateľom služby je <strong>Ngroup, s. r. o.</strong>, so sídlom <strong>Dunajská 8, 811 08 Bratislava, Slovenská republika</strong>,
            IČO: <strong>53813189</strong>, email: <strong>juraj@jurajkurek.com</strong>.
          </p>`;
const SK_VOP1_NEW = `          <p>
            Prevádzkovateľom služby je <strong>Ngroup, s. r. o.</strong>, so sídlom <strong>Dunajská 8, 811 08 Bratislava, Slovenská republika</strong>,
            IČO: <strong>53813189</strong>, email: <strong>juraj@jurajkurek.com</strong>.
          </p>
          <p>Platby za službu sa môžu na výpise z platobnej karty zobraziť pod obchodným názvom <strong>NEOWORKLY</strong> — ide o rovnakého prevádzkovateľa (Ngroup, s. r. o.), nie o inú spoločnosť.</p>`;
html = replaceExactCount(html, SK_VOP1_OLD, SK_VOP1_NEW, 2, '1a: SK vop1 (NEOWORKLY)');

const CZ_VOP1_OLD = `          <p>
            Provozovatelem služby je <strong>Ngroup, s. r. o.</strong>, se sídlem <strong>Dunajská 8, 811 08 Bratislava, Slovenská republika</strong>,
            IČO: <strong>53813189</strong>, e-mail: <strong>juraj@jurajkurek.com</strong>.
          </p>`;
const CZ_VOP1_NEW = `          <p>
            Provozovatelem služby je <strong>Ngroup, s. r. o.</strong>, se sídlem <strong>Dunajská 8, 811 08 Bratislava, Slovenská republika</strong>,
            IČO: <strong>53813189</strong>, e-mail: <strong>juraj@jurajkurek.com</strong>.
          </p>
          <p>Platby za službu se mohou na výpisu z platební karty zobrazit pod obchodním názvem <strong>NEOWORKLY</strong> — jde o stejného provozovatele (Ngroup, s. r. o.), nikoli o jinou společnost.</p>`;
html = replaceExactCount(html, CZ_VOP1_OLD, CZ_VOP1_NEW, 1, '1b: CZ vop1 (NEOWORKLY)');

// ── 2) vop2 "Charakter služby" — doplniť Komunitu, súťaže, kariérny kvíz do zoznamu funkcií ──
const SK_VOP2_OLD = `            <li>darčekové karty (poukazy) na Premium prístup alebo video kurz, ktoré môže zakúpiť a darovať aj iná osoba než príjemca.</li>
          </ul>`;
const SK_VOP2_NEW = `            <li>darčekové karty (poukazy) na Premium prístup alebo video kurz, ktoré môže zakúpiť a darovať aj iná osoba než príjemca,</li>
            <li>komunitnú funkciu SP Komunita (príspevky, fotografie, súkromné správy medzi používateľmi),</li>
            <li>príležitostné súťaže a propagačné akcie,</li>
            <li>kariérny kvíz a s ním súvisiace odporúčania.</li>
          </ul>`;
html = replaceExactCount(html, SK_VOP2_OLD, SK_VOP2_NEW, 2, '2a: SK vop2 (Komunita/súťaže/kvíz)');

const CZ_VOP2_OLD = `            <li>dárkové karty (poukazy) na Premium přístup nebo video kurz, které může zakoupit a darovat i jiná osoba než příjemce.</li>
          </ul>`;
const CZ_VOP2_NEW = `            <li>dárkové karty (poukazy) na Premium přístup nebo video kurz, které může zakoupit a darovat i jiná osoba než příjemce,</li>
            <li>komunitní funkci SP Komunita (příspěvky, fotografie, soukromé zprávy mezi uživateli),</li>
            <li>příležitostné soutěže a propagační akce,</li>
            <li>kariérní kvíz a s ním související doporučení.</li>
          </ul>`;
html = replaceExactCount(html, CZ_VOP2_OLD, CZ_VOP2_NEW, 1, '2b: CZ vop2 (Komunita/soutěže/kvíz)');

// ── 3) priv2 "Aké údaje spracúvame" — doplniť dátové kategórie pre Komunitu/súťaž/kvíz ──
const SK_PRIV2_OLD = `            <li>telefónne číslo, ak si ho overil/a kvôli zamedzeniu zneužívania bezplatných testov cez viacero účtov,</li>
            <li>technické údaje, napríklad IP adresu, cookies a základné údaje o zariadení.</li>`;
const SK_PRIV2_NEW = `            <li>telefónne číslo, ak si ho overil/a kvôli zamedzeniu zneužívania bezplatných testov cez viacero účtov,</li>
            <li>obsah príspevkov, fotografií, komentárov, lajkov a súkromných správ v rámci komunitnej funkcie (SP Komunita), ak ju využívaš,</li>
            <li>údaje uvedené v prihláške do súťaže (napríklad kontaktné údaje a sprievodné materiály), ak sa do niektorej súťaže zapojíš,</li>
            <li>odpovede v kariérnom kvíze a nadväzujúcu emailovú komunikáciu, ak kvíz absolvuješ,</li>
            <li>technické údaje, napríklad IP adresu, cookies a základné údaje o zariadení.</li>`;
html = replaceExactCount(html, SK_PRIV2_OLD, SK_PRIV2_NEW, 2, '3a: SK priv2 (Komunita/súťaž/kvíz dáta)');

const CZ_PRIV2_OLD = `            <li>telefonní číslo, pokud jsi ho ověřil/a kvůli zamezení zneužívání bezplatných testů přes více účtů,</li>
            <li>technické údaje, například IP adresu, cookies a základní údaje o zařízení.</li>`;
const CZ_PRIV2_NEW = `            <li>telefonní číslo, pokud jsi ho ověřil/a kvůli zamezení zneužívání bezplatných testů přes více účtů,</li>
            <li>obsah příspěvků, fotografií, komentářů, lajků a soukromých zpráv v rámci komunitní funkce (SP Komunita), pokud ji využíváš,</li>
            <li>údaje uvedené v přihlášce do soutěže (například kontaktní údaje a doprovodné materiály), pokud se do některé soutěže zapojíš,</li>
            <li>odpovědi v kariérním kvízu a navazující e-mailovou komunikaci, pokud kvíz absolvuješ,</li>
            <li>technické údaje, například IP adresu, cookies a základní údaje o zařízení.</li>`;
html = replaceExactCount(html, CZ_PRIV2_OLD, CZ_PRIV2_NEW, 1, '3b: CZ priv2 (Komunita/soutěž/kvíz data)');

// ── 4) priv3 "Účely spracúvania" — doplniť účely pre Komunitu/súťaž/kvíz ──
const SK_PRIV3_OLD = `            <li>prevádzka AI chatbota na stránke na účely zákazníckej podpory a predaja,</li>
            <li>zlepšovanie funkčnosti, bezpečnosti a kvality služby,</li>`;
const SK_PRIV3_NEW = `            <li>prevádzka AI chatbota na stránke na účely zákazníckej podpory a predaja,</li>
            <li>prevádzka komunitnej funkcie (príspevky, fotografie, súkromné správy, nahlasovanie nevhodného obsahu),</li>
            <li>organizácia a vyhodnotenie súťaží,</li>
            <li>vyhodnotenie kariérneho kvízu a zasielanie nadväzujúcich odporúčaní emailom,</li>
            <li>zlepšovanie funkčnosti, bezpečnosti a kvality služby,</li>`;
html = replaceExactCount(html, SK_PRIV3_OLD, SK_PRIV3_NEW, 2, '4a: SK priv3 (Komunita/súťaž/kvíz účely)');

const CZ_PRIV3_OLD = `            <li>provoz AI chatbota na stránce za účelem zákaznické podpory a prodeje,</li>
            <li>zlepšování funkčnosti, bezpečnosti a kvality služby,</li>`;
const CZ_PRIV3_NEW = `            <li>provoz AI chatbota na stránce za účelem zákaznické podpory a prodeje,</li>
            <li>provoz komunitní funkce (příspěvky, fotografie, soukromé zprávy, nahlašování nevhodného obsahu),</li>
            <li>organizace a vyhodnocení soutěží,</li>
            <li>vyhodnocení kariérního kvízu a zasílání navazujících doporučení e-mailem,</li>
            <li>zlepšování funkčnosti, bezpečnosti a kvality služby,</li>`;
html = replaceExactCount(html, CZ_PRIV3_OLD, CZ_PRIV3_NEW, 1, '4b: CZ priv3 (komunita/soutěž/kvíz účely)');

// ── 5) priv6 "Sprostredkovatelia a tretie strany" — doplniť SMS overovanie ──
const SK_PRIV6_OLD = `            <li>poskytovateľ e-mailových služieb (SMTP) – doručovanie transakčných a marketingových e-mailov.</li>
          </ul>`;
const SK_PRIV6_NEW = `            <li>poskytovateľ e-mailových služieb (SMTP) – doručovanie transakčných a marketingových e-mailov,</li>
            <li>poskytovateľ SMS overovacích kódov integrovaný cez Supabase Auth – telefonické overenie proti zneužívaniu bezplatných testov cez viacero účtov.</li>
          </ul>`;
html = replaceExactCount(html, SK_PRIV6_OLD, SK_PRIV6_NEW, 2, '5a: SK priv6 (SMS overenie)');

const CZ_PRIV6_OLD = `            <li>poskytovatel e-mailových služeb (SMTP) – doručování transakčních a marketingových e-mailů.</li>
          </ul>`;
const CZ_PRIV6_NEW = `            <li>poskytovatel e-mailových služeb (SMTP) – doručování transakčních a marketingových e-mailů,</li>
            <li>poskytovatel SMS ověřovacích kódů integrovaný přes Supabase Auth – telefonické ověření proti zneužívání bezplatných testů přes více účtů.</li>
          </ul>`;
html = replaceExactCount(html, CZ_PRIV6_OLD, CZ_PRIV6_NEW, 1, '5b: CZ priv6 (SMS ověření)');

const backup = FILE + '.pre-266-legal-missing-disclosures-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, html);

console.log('✅ legal.html: doplnené NEOWORKLY, SMS overenie, SP Komunita, súťaže a kariérny kvíz (SK + CZ).');
console.log('   Záloha:', backup);
console.log('   Statický súbor — žiadny pm2 restart netreba.');
