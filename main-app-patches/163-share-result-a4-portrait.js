// Zmeni vysledny obrazok zo zdielania (main-app-patches/162) z 1080x1080
// (square) na A4 na vysku (1240x1754, pomer strán 210:297mm) a odstrani
// oriezanie popisu na 140 znakov — teraz sa zmesti cely text, kedze je
// vyskovo viac miesta. QR kod sa posuva dynamicky pod popis (min. y=1220),
// aby sa nikdy neprekryval s dlhsim textom.
//
// Predpoklad: patch main-app-patches/162-kam-na-vysoku-share-result.js uz
// bol aplikovany (tento patch prepisuje presne jeho generateResultImage()).
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/163-share-result-a4-portrait.js

const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(process.cwd(), 'public', 'kam-na-vysoku.html');

if (!fs.existsSync(HTML_PATH)) {
  console.error('❌ Nenašiel som súbor:', HTML_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.163-share-result-a4-portrait-lock');
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

if (html.includes('const W = 1240, H = 1754;')) {
  console.error('❌ kam-na-vysoku.html: už je aplikované, nič som nezmenil.');
  process.exit(1);
}
if (!html.includes("const W = 1080, H = 1080;")) {
  console.error('❌ Nenašiel som pôvodnú (square) verziu generateResultImage() — over, či je patch 162 už aplikovaný. Nič som nezmenil.');
  process.exit(1);
}

const OLD_FN = [
  'function generateResultImage(topTag, lang) {',
  '  return new Promise((resolve, reject) => {',
  '    try {',
  '      const W = 1080, H = 1080;',
  '      const canvas = document.createElement(\'canvas\');',
  '      canvas.width = W; canvas.height = H;',
  '      const ctx = canvas.getContext(\'2d\');',
  '',
  '      const grad = ctx.createLinearGradient(0, 0, 0, H);',
  '      grad.addColorStop(0, \'#faf6ef\');',
  '      grad.addColorStop(1, \'#f1ead9\');',
  '      ctx.fillStyle = grad;',
  '      ctx.fillRect(0, 0, W, H);',
  '      ctx.textAlign = \'center\';',
  '',
  '      ctx.fillStyle = \'#1f5f5b\';',
  '      ctx.font = \'600 28px sans-serif\';',
  '      ctx.fillText(\'SP TRÉNER · TEST ODBORU\', W / 2, 120);',
  '',
  '      ctx.font = \'150px sans-serif\';',
  '      ctx.fillText(FIELD_TEXT[topTag].icon, W / 2, 320);',
  '',
  '      ctx.fillStyle = \'#1c2321\';',
  '      ctx.font = \'600 60px Georgia, serif\';',
  '      const title = \'Sedí ti \' + FIELD_TEXT[topTag][lang].name + \'.\';',
  '      const afterTitleY = wrapCanvasText(ctx, title, W / 2, 460, 900, 70);',
  '',
  '      ctx.fillStyle = \'#5b6460\';',
  '      ctx.font = \'30px sans-serif\';',
  '      const rawDesc = FIELD_TEXT[topTag][lang].desc || \'\';',
  '      const desc = rawDesc.length > 140 ? rawDesc.slice(0, 140) + \'…\' : rawDesc;',
  '      wrapCanvasText(ctx, desc, W / 2, afterTitleY + 70, 820, 42);',
  '',
  '      const qrSize = 220;',
  '      const qrX = W / 2 - qrSize / 2;',
  '      const qrY = 750;',
  '      drawShareQrCode(ctx, \'https://sptrener.online/kam-na-vysoku?src=share\', qrX, qrY, qrSize);',
  '',
  '      ctx.fillStyle = \'#1c2321\';',
  '      ctx.font = \'600 26px sans-serif\';',
  '      ctx.fillText(lang === \'cs\' ? \'Udělej si test taky →\' : \'Sprav si test aj ty →\', W / 2, qrY + qrSize + 50);',
  '      ctx.fillStyle = \'#8b938f\';',
  '      ctx.font = \'22px sans-serif\';',
  '      ctx.fillText(\'sptrener.online/kam-na-vysoku\', W / 2, qrY + qrSize + 82);',
  '',
  '      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error(\'toBlob zlyhalo\')), \'image/png\');',
  '    } catch (e) { reject(e); }',
  '  });',
  '}'
].join('\n');

const NEW_FN = [
  'function generateResultImage(topTag, lang) {',
  '  return new Promise((resolve, reject) => {',
  '    try {',
  '      const W = 1240, H = 1754;',
  '      const canvas = document.createElement(\'canvas\');',
  '      canvas.width = W; canvas.height = H;',
  '      const ctx = canvas.getContext(\'2d\');',
  '',
  '      const grad = ctx.createLinearGradient(0, 0, 0, H);',
  '      grad.addColorStop(0, \'#faf6ef\');',
  '      grad.addColorStop(1, \'#f1ead9\');',
  '      ctx.fillStyle = grad;',
  '      ctx.fillRect(0, 0, W, H);',
  '      ctx.textAlign = \'center\';',
  '',
  '      ctx.fillStyle = \'#1f5f5b\';',
  '      ctx.font = \'600 32px sans-serif\';',
  '      ctx.fillText(\'SP TRÉNER · TEST ODBORU\', W / 2, 160);',
  '',
  '      ctx.font = \'190px sans-serif\';',
  '      ctx.fillText(FIELD_TEXT[topTag].icon, W / 2, 440);',
  '',
  '      ctx.fillStyle = \'#1c2321\';',
  '      ctx.font = \'600 68px Georgia, serif\';',
  '      const title = \'Sedí ti \' + FIELD_TEXT[topTag][lang].name + \'.\';',
  '      const afterTitleY = wrapCanvasText(ctx, title, W / 2, 600, 1000, 80);',
  '',
  '      ctx.fillStyle = \'#5b6460\';',
  '      ctx.font = \'36px sans-serif\';',
  '      const desc = FIELD_TEXT[topTag][lang].desc || \'\';',
  '      const afterDescY = wrapCanvasText(ctx, desc, W / 2, afterTitleY + 90, 940, 52);',
  '',
  '      const qrSize = 280;',
  '      const qrX = W / 2 - qrSize / 2;',
  '      const qrY = Math.max(afterDescY + 130, 1220);',
  '      drawShareQrCode(ctx, \'https://sptrener.online/kam-na-vysoku?src=share\', qrX, qrY, qrSize);',
  '',
  '      ctx.fillStyle = \'#1c2321\';',
  '      ctx.font = \'600 30px sans-serif\';',
  '      ctx.fillText(lang === \'cs\' ? \'Udělej si test taky →\' : \'Sprav si test aj ty →\', W / 2, qrY + qrSize + 60);',
  '      ctx.fillStyle = \'#8b938f\';',
  '      ctx.font = \'26px sans-serif\';',
  '      ctx.fillText(\'sptrener.online/kam-na-vysoku\', W / 2, qrY + qrSize + 98);',
  '',
  '      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error(\'toBlob zlyhalo\')), \'image/png\');',
  '    } catch (e) { reject(e); }',
  '  });',
  '}'
].join('\n');

html = replaceOnce(html, OLD_FN, NEW_FN, 'generateResultImage() -> A4 portrait');

const backup = HTML_PATH + '.pre-share-a4-' + Date.now();
fs.copyFileSync(HTML_PATH, backup);
fs.writeFileSync(HTML_PATH, html);

console.log('✅ Obrázok zo zdieľania je teraz A4 na výšku (1240×1754), celý popis bez orezania.');
console.log('   Záloha:', backup);
