// Self-audit po main-app-patches/195-198: skontroloval som title/meta
// description dĺžku aj na zvyšku statického webu (nielen na novopostavených
// stránkach). Google v SERP zvyčajne oreže title okolo ~60 znakov a
// description okolo ~155-160 znakov -- tieto 4 stránky boli nad limitom:
//   generalka.html:     description 192 znakov
//   index.html:         description 175 znakov (HOMEPAGE)
//   kam-na-vysoku.html: title 71 + description 188 znakov
//   vianoce.html:       title 83 + description 203 znakov
// Na kam-na-vysoku.html a vianoce.html og:title/og:description/
// twitter:* už MAJÚ vlastný, kratší text nezávislý od <title>/description
// (existujúci dobrý vzor) -- menia sa preto len tie tagy, čo boli
// skutočne nad limitom (na vianoce.html to zahŕňa aj og:title/
// twitter:title, lebo tie boli identické s dlhým <title>).
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/203-meta-description-length-fixes.js

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(process.cwd(), 'public');

const LOCK = path.join(process.cwd(), '.203-meta-description-length-fixes-lock');
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

function applyToFile(file, edits) {
  const filePath = path.join(PUBLIC_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.error('❌ Nenašiel som public/' + file + '.');
    process.exitCode = 1;
    return;
  }
  let html = fs.readFileSync(filePath, 'utf8');
  if (html.includes(edits.marker)) {
    console.log('ℹ️  ' + file + ': už je aplikované, preskočené.');
    return;
  }
  edits.ops.forEach(([oldStr, newStr, label]) => {
    html = replaceOnce(html, oldStr, newStr, file + ' -> ' + label);
  });
  const backup = filePath + '.pre-meta-length-fix-' + Date.now();
  fs.copyFileSync(filePath, backup);
  fs.writeFileSync(filePath, html);
  console.log('✅ ' + file + ': opravené. Záloha:', backup);
}

applyToFile('generalka.html', {
  marker: 'časomiera, anti-cheat, sledovanie pozornosti a hĺbková AI analýza výsledku. 5,90 € za pokus.',
  ops: [[
    '<meta name="description" content="Jeden kompletný 66-úlohový VŠP test v reálnych podmienkach — časomiera po fázach, anti-cheat, sledovanie pozornosti kamerou a hĺbková AI analýza výsledku. 5,90 € za jeden pokus.">',
    '<meta name="description" content="Jeden kompletný 66-úlohový VŠP test v reálnych podmienkach — časomiera, anti-cheat, sledovanie pozornosti a hĺbková AI analýza výsledku. 5,90 € za pokus.">',
    'description skrátený (192 -> 153 znakov)'
  ]]
});

applyToFile('index.html', {
  marker: 'Neobmedzené úlohy, reálna simulácia, AI mentor. Prvé 3 testy zadarmo.',
  ops: [[
    '<meta name="description" content="AI tréner na prijímačky VŠP aj vlastné testy 39 slovenských a českých univerzít. Neobmedzené AI úlohy, reálna simulácia, osobný AI mentor. Prvé 3 testy zadarmo.">',
    '<meta name="description" content="AI tréner na prijímačky VŠP aj vlastné testy 39 slovenských a českých univerzít. Neobmedzené úlohy, reálna simulácia, AI mentor. Prvé 3 testy zadarmo.">',
    'description skrátený (175 -> 150 znakov)'
  ]]
});

applyToFile('kam-na-vysoku.html', {
  marker: 'Kam na vysokú? Zisti to zadarmo za 7 minút | SP Tréner',
  ops: [
    [
      '<title>Kam na vysokú? Zisti to zadarmo za 7 minút — test odboru SP Tréner</title>',
      '<title>Kam na vysokú? Zisti to zadarmo za 7 minút | SP Tréner</title>',
      'title skrátený (71 -> 54 znakov)'
    ],
    [
      '<meta name="description" content="Nevieš, či ísť na vysokú a na akú? Bezplatný test s AI vyhodnotením ti za 7 minút ukáže, ktorý odbor a ktoré univerzity na Slovensku aj v Česku ti sedia najviac — a prečo.">',
      '<meta name="description" content="Nevieš, či ísť na vysokú a na akú? Bezplatný test s AI vyhodnotením ti za 7 minút ukáže, ktorý odbor a ktoré univerzity ti sedia najviac — a prečo.">',
      'description skrátený (188 -> 147 znakov)'
    ]
  ]
});

applyToFile('vianoce.html', {
  marker: 'Vianočný darček pre stredoškoláka — darčeková karta SP Tréner',
  ops: [
    [
      '<title>Vianočný darček pre stredoškoláka a maturanta — darčeková karta SP Tréner</title>',
      '<title>Vianočný darček pre stredoškoláka — darčeková karta SP Tréner</title>',
      'title skrátený (83 -> 61 znakov)'
    ],
    [
      '<meta property="og:title" content="Vianočný darček pre stredoškoláka a maturanta — darčeková karta SP Tréner">',
      '<meta property="og:title" content="Vianočný darček pre stredoškoláka — darčeková karta SP Tréner">',
      'og:title skrátený'
    ],
    [
      '<meta name="twitter:title" content="Vianočný darček pre stredoškoláka a maturanta — darčeková karta SP Tréner">',
      '<meta name="twitter:title" content="Vianočný darček pre stredoškoláka — darčeková karta SP Tréner">',
      'twitter:title skrátený'
    ],
    [
      '<meta name="description" content="Vianočný darček, ktorý má zmysel: darčeková karta na prípravu na prijímačky VŠP. Premium, Elite alebo kurz podľa výberu. Hneď na stiahnutie a vytlačenie, stihneš to aj na Štedrý večer.">',
      '<meta name="description" content="Vianočný darček, ktorý má zmysel: darčeková karta na prípravu na prijímačky VŠP. Hneď na stiahnutie a vytlačenie, stihneš to aj na Štedrý večer.">',
      'description skrátený (203 -> 144 znakov)'
    ]
  ]
});

console.log('');
console.log('Statické súbory -- žiadny pm2 restart netreba, stačí tvrdý refresh v prehliadači.');
