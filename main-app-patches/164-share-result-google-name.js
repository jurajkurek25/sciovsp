// Prida meno z Google uctu (Supabase user_metadata.full_name/name) na
// zdielany vysledkovy obrazok (main-app-patches/162 + 163), pod eyebrow a
// nad ikonku odboru. Ak Google meno z nejakeho dovodu chyba (napr.
// odmietnuty profile scope), riadok sa jednoducho nevykresli — zvysok
// layoutu je uz teraz posunuty tak, aby sedel v oboch pripadoch.
//
// Predpoklad: patche 162 aj 163 uz su aplikovane.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/164-share-result-google-name.js

const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(process.cwd(), 'public', 'kam-na-vysoku.html');

if (!fs.existsSync(HTML_PATH)) {
  console.error('❌ Nenašiel som súbor:', HTML_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.164-share-result-google-name-lock');
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

if (html.includes('userName')) {
  console.error('❌ kam-na-vysoku.html: už je aplikované, nič som nezmenil.');
  process.exit(1);
}
if (!html.includes('const W = 1240, H = 1754;')) {
  console.error('❌ Nenašiel som A4 verziu generateResultImage() — over, či sú patche 162 a 163 už aplikované. Nič som nezmenil.');
  process.exit(1);
}

// 1) generateResultImage(topTag, lang) -> generateResultImage(topTag, lang, userName)
//    + vykresli meno (ak existuje) medzi eyebrow a ikonkou, posun zvyšok o 40px nižšie
html = replaceOnce(html,
  'function generateResultImage(topTag, lang) {',
  'function generateResultImage(topTag, lang, userName) {',
  'generateResultImage() signature');

html = replaceOnce(html,
  '      ctx.fillText(\'SP TRÉNER · TEST ODBORU\', W / 2, 160);\n' +
  '\n' +
  '      ctx.font = \'190px sans-serif\';\n' +
  '      ctx.fillText(FIELD_TEXT[topTag].icon, W / 2, 440);\n' +
  '\n' +
  '      ctx.fillStyle = \'#1c2321\';\n' +
  '      ctx.font = \'600 68px Georgia, serif\';\n' +
  '      const title = \'Sedí ti \' + FIELD_TEXT[topTag][lang].name + \'.\';\n' +
  '      const afterTitleY = wrapCanvasText(ctx, title, W / 2, 600, 1000, 80);',
  '      ctx.fillText(\'SP TRÉNER · TEST ODBORU\', W / 2, 160);\n' +
  '\n' +
  '      if (userName) {\n' +
  '        ctx.fillStyle = \'#5b6460\';\n' +
  '        ctx.font = \'600 34px sans-serif\';\n' +
  '        ctx.fillText(userName, W / 2, 220);\n' +
  '      }\n' +
  '\n' +
  '      ctx.font = \'190px sans-serif\';\n' +
  '      ctx.fillText(FIELD_TEXT[topTag].icon, W / 2, 480);\n' +
  '\n' +
  '      ctx.fillStyle = \'#1c2321\';\n' +
  '      ctx.font = \'600 68px Georgia, serif\';\n' +
  '      const title = \'Sedí ti \' + FIELD_TEXT[topTag][lang].name + \'.\';\n' +
  '      const afterTitleY = wrapCanvasText(ctx, title, W / 2, 640, 1000, 80);',
  'generateResultImage() meno + posun layoutu o 40px');

html = replaceOnce(html,
  '      const qrY = Math.max(afterDescY + 130, 1220);',
  '      const qrY = Math.max(afterDescY + 130, 1260);',
  'generateResultImage() QR floor +40px');

// 2) shareResult() — zisti meno z currentUser a posli ho do generateResultImage()
html = replaceOnce(html,
  '  try {\n' +
  '    const blob = await generateResultImage(lastTopTag, currentLang);',
  '  try {\n' +
  '    const userName = (currentUser && currentUser.user_metadata && (currentUser.user_metadata.full_name || currentUser.user_metadata.name)) || \'\';\n' +
  '    const blob = await generateResultImage(lastTopTag, currentLang, userName);',
  'shareResult() userName extrakcia z Google účtu');

const backup = HTML_PATH + '.pre-share-google-name-' + Date.now();
fs.copyFileSync(HTML_PATH, backup);
fs.writeFileSync(HTML_PATH, html);

console.log('✅ Meno z Google účtu je teraz na zdieľanom výsledkovom obrázku.');
console.log('   Záloha:', backup);
