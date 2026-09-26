// SEO audit, posledná položka: chýbajúce meta description.
//
// DÔLEŽITÉ ZISTENIE počas prípravy tohto patchu: /odporucame má AJ
// mŕtvy statický súbor (public/odporucame.html, canonical mu bol
// omylom pridaný v main-app-patches/191 — neškodí, ale nikto ho
// neuvidí) AJ skutočnú dynamickú routu (app.get('/odporucame', async...)),
// ktorá už MÁ vlastný title aj description cez blogLayout(). Skutočná
// stránka teda už description mala — nebola to chyba, len môj skorší
// grep kontroloval nesprávny (nepoužívaný) súbor. Odporucame.html sa
// týmto patchom nedotýka.
//
// /legal a /ponuka sú potvrdené ako čisto statické (žiadna konkurenčná
// dynamická routa) — tie description naozaj chýbalo.
//
// Predpoklad: main-app-patches/191 uz je aplikovany (canonical tag už
// existuje, použitý ako kotva).
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/192-meta-descriptions-legal-ponuka.js

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(process.cwd(), 'public');

const LOCK = path.join(process.cwd(), '.192-meta-descriptions-legal-ponuka-lock');
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

const TARGETS = [
  {
    file: 'legal.html',
    canonicalAnchor: '<link rel="canonical" href="https://sptrener.online/legal">',
    description: 'Všeobecné obchodné podmienky a zásady ochrany osobných údajov (GDPR) pre SP Tréner — AI prípravu na prijímacie skúšky na vysoké školy.'
  },
  {
    file: 'ponuka.html',
    canonicalAnchor: '<link rel="canonical" href="https://sptrener.online/ponuka">',
    description: 'Špeciálna ponuka Premium a Elite členstva SP Tréner pre účastníkov bezplatného webinára.'
  }
];

let anyChange = false;

for (const { file, canonicalAnchor, description } of TARGETS) {
  const filePath = path.join(PUBLIC_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.error('❌ Nenašiel som public/' + file + '.');
    process.exitCode = 1;
    continue;
  }
  let html = fs.readFileSync(filePath, 'utf8');
  if (html.includes('name="description"')) {
    console.log('ℹ️  ' + file + ': už má meta description, preskočené.');
    continue;
  }
  if (!html.includes(canonicalAnchor)) {
    console.error('❌ ' + file + ' — nenašiel som očakávaný canonical tag ako kotvu. Over, či je main-app-patches/191 už aplikovaný. Nič som pri tomto súbore nezmenil.');
    process.exitCode = 1;
    continue;
  }
  const metaTag = '<meta name="description" content="' + description + '">';
  html = replaceOnce(html, canonicalAnchor, canonicalAnchor + '\n' + metaTag, file + ' -> meta description');
  const backup = filePath + '.pre-meta-description-' + Date.now();
  fs.copyFileSync(filePath, backup);
  fs.writeFileSync(filePath, html);
  anyChange = true;
  console.log('✅ ' + file + ': pridaná meta description.');
}

if (!anyChange) {
  console.log('Nič nebolo treba zmeniť.');
}
