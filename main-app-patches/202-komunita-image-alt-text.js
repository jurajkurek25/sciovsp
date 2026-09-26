// Prístupnosť + SEO: 3 <img> tagy v komunita.html (avatar, príloha
// príspevku, fotka v galérii) nemali žiadny alt atribút. Nájdené
// systematickým grepom cez všetky public/*.html -- jediný výskyt na
// celom (git-trackovanom) statickom webe.
//
// UPOZORNENIE: public/komunita.html je v gite ZASTARANÝ (napr. canonical
// tag z main-app-patches/191 v ňom chýba -- ten patch menil len
// produkčný súbor priamo). Kotvy nižšie sú preto zámerne úzke,
// jednoznačné JS template-literal riadky hlboko vo funkciách na
// vykresľovanie príspevkov -- oblasť, ktorú žiadny iný patch nemenil,
// takže riziko posunu je nízke, ale replaceOnce aj tak zlyhá nahlas,
// ak kotva na produkcii nesedí presne.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/202-komunita-image-alt-text.js

const fs = require('fs');
const path = require('path');

const TARGET = path.join(process.cwd(), 'public', 'komunita.html');

if (!fs.existsSync(TARGET)) {
  console.error('❌ Nenašiel som public/komunita.html.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.202-komunita-image-alt-text-lock');
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

let html = fs.readFileSync(TARGET, 'utf8');

if (html.includes('class="avatar" src="${url}" style="width:${size}px;height:${size}px" alt=')) {
  console.error('❌ komunita.html: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// 1) avatarHtml() -- avatar konkrétneho používateľa
html = replaceOnce(html,
  '  if (url) return `<img class="avatar" src="${url}" style="width:${size}px;height:${size}px">`;',
  '  if (url) return `<img class="avatar" src="${url}" style="width:${size}px;height:${size}px" alt="${esc(name || \'\')}">`;',
  '1: avatarHtml() -> alt s menom používateľa');

// 2) renderPost() -- príloha (obrázok) k príspevku
html = replaceOnce(html,
  "    ${p.imageUrl ? `<img class=\"attach\" src=\"${p.imageUrl}\" loading=\"lazy\">` : ''}",
  "    ${p.imageUrl ? `<img class=\"attach\" src=\"${p.imageUrl}\" loading=\"lazy\" alt=\"${esc(p.body ? p.body.slice(0, 100) : (p.authorName || p.authorEmail || ''))}\">` : ''}",
  '2: renderPost() -> alt z textu príspevku alebo mena autora');

// 3) renderGalleryPhoto() -- fotka v galérii (rovnaká fallback logika ako existujúci title atribút)
html = replaceOnce(html,
  '    <img src="${p.imageUrl}" loading="lazy" title="${esc(p.caption || p.authorName || p.authorEmail)}">',
  '    <img src="${p.imageUrl}" loading="lazy" title="${esc(p.caption || p.authorName || p.authorEmail)}" alt="${esc(p.caption || p.authorName || p.authorEmail)}">',
  '3: renderGalleryPhoto() -> alt zhodný s existujúcim title');

const backup = TARGET + '.pre-komunita-image-alt-text-' + Date.now();
fs.copyFileSync(TARGET, backup);
fs.writeFileSync(TARGET, html);

console.log('✅ komunita.html: pridané alt atribúty na avatar, prílohu príspevku a fotku v galérii.');
console.log('   Záloha:', backup);
console.log('   Statický súbor -- žiadny pm2 restart netreba, stačí tvrdý refresh v prehliadači.');
