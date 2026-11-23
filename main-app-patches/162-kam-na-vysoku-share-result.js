// Prida "Zdieľať výsledok" na /kam-na-vysoku (kariérny kvíz) — vygeneruje
// branded PNG karticku s výsledkom (ikonka odboru, nazov, kratky popis) a
// QR kodom smerujucim spat na kvíz (https://sptrener.online/kam-na-vysoku?src=share),
// aby si kamaráti mohli spravit test tiez. Pouziva Web Share API (mobil,
// priamo do IG/WhatsApp/...) s fallbackom na stiahnutie PNG (desktop).
//
// QR kod sa generuje ciste client-side (kazuhikoarase/qrcode-generator cez
// jsDelivr CDN mirror npm balicka) — ziadna nova server-side zavislost,
// ziadna nova routa, ziadny npm install na produkcii.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/162-kam-na-vysoku-share-result.js

const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(process.cwd(), 'public', 'kam-na-vysoku.html');

if (!fs.existsSync(HTML_PATH)) {
  console.error('❌ Nenašiel som súbor:', HTML_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.162-kam-na-vysoku-share-result-lock');
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

if (html.includes('shareResultBtn')) {
  console.error('❌ kam-na-vysoku.html: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// 1) QR knižnica z CDN, hneď za supabase-js scriptom
html = replaceOnce(html,
  '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>',
  '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>\n<script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js"></script>',
  'HTML: qrcode-generator CDN script');

// 2) Zdieľať tlačidlo, medzi result-card a ai-block
html = replaceOnce(html,
  '<div class="ai-block" id="aiBlock">',
  '<div class="share-row" style="text-align:center;margin:1.4rem 0 2rem">\n      <button class="btn-secondary" id="shareResultBtn" onclick="shareResult()"><span id="tShareBtn">📤 Zdieľať výsledok</span></button>\n    </div>\n    <div class="ai-block" id="aiBlock">',
  'HTML: shareResultBtn');

// 3) SK i18n
html = replaceOnce(html,
  "ctaFree:'Skús zadarmo →', ctaPremium:'Pozrieť Premium/Elite', retake:'↺ Spraviť test znova',",
  "ctaFree:'Skús zadarmo →', ctaPremium:'Pozrieť Premium/Elite', retake:'↺ Spraviť test znova',\n    shareBtn:'📤 Zdieľať výsledok', shareText:'Zisti si aj ty, ktorý odbor ti sedí — spravil/a som si test na SP Tréner.',",
  'i18n SK shareBtn/shareText');

// 4) CZ i18n
html = replaceOnce(html,
  "ctaFree:'Zkus zdarma →', ctaPremium:'Podívat se na Premium/Elite', retake:'↺ Udělat test znovu',",
  "ctaFree:'Zkus zdarma →', ctaPremium:'Podívat se na Premium/Elite', retake:'↺ Udělat test znovu',\n    shareBtn:'📤 Sdílet výsledek', shareText:'Zjisti si i ty, který obor ti sedí — udělal/a jsem si test na SP Tréner.',",
  'i18n CZ shareBtn/shareText');

// 5) setLang() — nastav text tlačidla pri prepnutí jazyka
html = replaceOnce(html,
  "document.getElementById('ctaPremium').textContent = t.ctaPremium;",
  "document.getElementById('ctaPremium').textContent = t.ctaPremium;\n  document.getElementById('tShareBtn').textContent = t.shareBtn;",
  'setLang() tShareBtn');

// 6) JS — generovanie PNG (canvas) + QR + share/download, pred retakeQuiz()
const SHARE_JS = [
  'function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {',
  '  const words = text.split(\' \');',
  '  let line = \'\';',
  '  let curY = y;',
  '  for (let n = 0; n < words.length; n++) {',
  '    const testLine = line + words[n] + \' \';',
  '    if (ctx.measureText(testLine).width > maxWidth && n > 0) {',
  '      ctx.fillText(line, x, curY);',
  '      line = words[n] + \' \';',
  '      curY += lineHeight;',
  '    } else {',
  '      line = testLine;',
  '    }',
  '  }',
  '  ctx.fillText(line, x, curY);',
  '  return curY;',
  '}',
  '',
  'function drawShareQrCode(ctx, text, x, y, size) {',
  '  const qr = qrcode(0, \'M\');',
  '  qr.addData(text);',
  '  qr.make();',
  '  const count = qr.getModuleCount();',
  '  const moduleSize = size / count;',
  '  ctx.fillStyle = \'#ffffff\';',
  '  ctx.fillRect(x - 14, y - 14, size + 28, size + 28);',
  '  ctx.fillStyle = \'#1c2321\';',
  '  for (let row = 0; row < count; row++) {',
  '    for (let col = 0; col < count; col++) {',
  '      if (qr.isDark(row, col)) {',
  '        ctx.fillRect(x + col * moduleSize, y + row * moduleSize, Math.ceil(moduleSize), Math.ceil(moduleSize));',
  '      }',
  '    }',
  '  }',
  '}',
  '',
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
  '}',
  '',
  'async function shareResult() {',
  '  if (!lastTopTag) return;',
  '  const btn = document.getElementById(\'shareResultBtn\');',
  '  const prevLabel = btn.innerHTML;',
  '  btn.disabled = true;',
  '  btn.textContent = currentLang === \'cs\' ? \'Připravuji obrázek…\' : \'Pripravujem obrázok…\';',
  '  try {',
  '    const blob = await generateResultImage(lastTopTag, currentLang);',
  '    const file = new File([blob], \'sp-trener-vysledok.png\', { type: \'image/png\' });',
  '    if (navigator.canShare && navigator.canShare({ files: [file] })) {',
  '      await navigator.share({ files: [file], title: \'SP Tréner\', text: T[currentLang].shareText });',
  '    } else {',
  '      const url = URL.createObjectURL(blob);',
  '      const a = document.createElement(\'a\');',
  '      a.href = url; a.download = \'sp-trener-vysledok.png\';',
  '      document.body.appendChild(a); a.click(); a.remove();',
  '      setTimeout(() => URL.revokeObjectURL(url), 4000);',
  '    }',
  '  } catch (e) {',
  '    if (e && e.name !== \'AbortError\') alert(currentLang === \'cs\' ? \'Nepodařilo se vytvořit obrázek.\' : \'Nepodarilo sa vytvoriť obrázok.\');',
  '  } finally {',
  '    btn.disabled = false;',
  '    btn.innerHTML = prevLabel;',
  '  }',
  '}',
  '',
  'function retakeQuiz(){'
].join('\n');

html = replaceOnce(html, 'function retakeQuiz(){', SHARE_JS, 'JS: share funkcie pred retakeQuiz()');

const backup = HTML_PATH + '.pre-share-result-' + Date.now();
fs.copyFileSync(HTML_PATH, backup);
fs.writeFileSync(HTML_PATH, html);

console.log('✅ Pridané zdieľanie výsledku (PNG + QR kód) na /kam-na-vysoku.');
console.log('   Záloha:', backup);
