// 1) Opravuje zastaraný dátum "Posledná aktualizácia" / "Poslední aktualizace"
//    (14.8.2026 — ostal tam ešte spred patchov 258-261) na aktuálny dátum.
// 2) Zvýrazňuje zmienku o bonusovom teste za marketingový súhlas (patch 261
//    ju už doplnil, ale iba ako súčasť dlhšieho zoznamu účelov spracúvania —
//    GDPR-transparentnejšie je mať to aj ako samostatnú, zreteľne označenú
//    vetu hneď pod zoznamom) — vo všetkých 3 blokoch (SK statický, SK i18n,
//    CZ i18n).
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/265-legal-date-and-marketing-clarity.js
const fs = require('fs');
const path = require('path');

const FILE = path.join(process.cwd(), 'public', 'legal.html');

if (!fs.existsSync(FILE)) {
  console.error('❌ Nenašiel som súbor:', FILE, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.265-legal-date-and-marketing-clarity-lock');
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

if (html.includes('Neudelenie súhlasu neovplyvňuje prístup')) {
  console.error('❌ legal.html: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// ── 1) Dátum poslednej aktualizácie — 6x (SK statický ×4, CZ i18n ×2) ──
const TODAY_SK = '19.10.2026';
html = replaceExactCount(html, '14.8.2026', TODAY_SK, 6, 'Dátum poslednej aktualizácie (14.8.2026)');

// ── 2) SK statický blok — zvýraznená veta hneď pod zoznamom účelov ──
const SK_STATIC_OLD = `            <li>plnenie zákonných povinností.</li>
          </ul>
        </div>

        <div class="legal-item" data-i18n="priv4">`;
const SK_STATIC_NEW = `            <li>plnenie zákonných povinností.</li>
          </ul>
          <p><strong>Súhlas s odberom odporúčaní a ponúk partnerov (affiliate) je úplne dobrovoľný a kedykoľvek odvolateľný — jeho udelením môžeš po vyčerpaní bezplatných testov získať jeden bonusový test naviac. Neudelenie súhlasu neovplyvňuje prístup k žiadnej inej funkcii ani cene.</strong></p>
        </div>

        <div class="legal-item" data-i18n="priv4">`;
html = replaceExactCount(html, SK_STATIC_OLD, SK_STATIC_NEW, 1, 'SK statický blok — veta za zoznamom účelov');

// ── 3) SK i18n (priv3) blok ──
const SK_JS_OLD = `<li>overenie telefónnym číslom na zamedzenie zneužívania bezplatných testov cez viacero účtov,</li><li>plnenie zákonných povinností.</li>
          </ul>\`,
priv4: \`<h3>4. Právny základ spracúvania</h3>`;
const SK_JS_NEW = `<li>overenie telefónnym číslom na zamedzenie zneužívania bezplatných testov cez viacero účtov,</li><li>plnenie zákonných povinností.</li>
          </ul>
          <p><strong>Súhlas s odberom odporúčaní a ponúk partnerov (affiliate) je úplne dobrovoľný a kedykoľvek odvolateľný — jeho udelením môžeš po vyčerpaní bezplatných testov získať jeden bonusový test naviac. Neudelenie súhlasu neovplyvňuje prístup k žiadnej inej funkcii ani cene.</strong></p>\`,
priv4: \`<h3>4. Právny základ spracúvania</h3>`;
html = replaceExactCount(html, SK_JS_OLD, SK_JS_NEW, 1, 'SK i18n (priv3) blok');

// ── 4) CZ i18n (priv3) blok ──
const CZ_JS_OLD = `<li>ověření telefonním číslem za účelem zamezení zneužívání bezplatných testů přes více účtů,</li><li>plnění zákonných povinností.</li>
          </ul>\`,
priv4: \`<h3>4. Právní základ zpracování</h3>`;
const CZ_JS_NEW = `<li>ověření telefonním číslem za účelem zamezení zneužívání bezplatných testů přes více účtů,</li><li>plnění zákonných povinností.</li>
          </ul>
          <p><strong>Souhlas s odběrem doporučení a nabídek partnerů (affiliate) je zcela dobrovolný a kdykoli odvolatelný — jeho udělením můžeš po vyčerpání bezplatných testů získat jeden bonusový test navíc. Neudělení souhlasu neovlivňuje přístup k žádné jiné funkci ani ceně.</strong></p>\`,
priv4: \`<h3>4. Právní základ zpracování</h3>`;
html = replaceExactCount(html, CZ_JS_OLD, CZ_JS_NEW, 1, 'CZ i18n (priv3) blok');

const backup = FILE + '.pre-265-legal-date-and-marketing-clarity-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, html);

console.log('✅ legal.html: dátum aktualizovaný na ' + TODAY_SK + ', bonusový test za marketing súhlas zvýraznený (SK + CZ).');
console.log('   Záloha:', backup);
console.log('   Statický súbor — žiadny pm2 restart netreba.');
