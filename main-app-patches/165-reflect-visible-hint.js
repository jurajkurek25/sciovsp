// "Zistiť výsledok" button zostával nevysvetlene sivý — bola tam 8-znakova
// minimalna dlzka na kazdu z 3 reflexnych odpovedi, ale ZIADNA viditelna
// spatna vazba (staticky hint "Napíš aspoň pár slov." sa nemenil), takze
// clovek nevidel preco tlacidlo nejde ani ci mu chyba 1 znak alebo 8.
// Navyse ta.oninput je jediny event listener — na niektorych Android
// klavesniciach sa 'input' event nemusi spolahlivo vystrelit pri kazdom
// stlaceni (zname sporadicke sprava niektorych IME).
//
// Fix:
//  - zivy pocitadlo pod kazdou otazkou ("3/8 znakov" -> "✓ Vyplnené")
//  - viacero listenerov (input, keyup, change, blur) miesto len oninput
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/165-reflect-visible-hint.js

const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(process.cwd(), 'public', 'kam-na-vysoku.html');

if (!fs.existsSync(HTML_PATH)) {
  console.error('❌ Nenašiel som súbor:', HTML_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.165-reflect-visible-hint-lock');
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

if (html.includes('updateReflectHint')) {
  console.error('❌ kam-na-vysoku.html: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

const OLD = [
  'function renderReflectQuestions(){',
  '  const root = document.getElementById(\'reflectRows\');',
  '  root.innerHTML = \'\';',
  '  REFLECTIONS.forEach(r => {',
  '    const item = document.createElement(\'div\');',
  '    item.className = \'reflect-item\';',
  '    const label = document.createElement(\'label\');',
  '    label.textContent = r[currentLang];',
  '    const ta = document.createElement(\'textarea\');',
  '    ta.id = \'reflect_\' + r.id;',
  '    ta.value = reflections[r.id] || \'\';',
  '    ta.maxLength = 600;',
  '    ta.oninput = () => { reflections[r.id] = ta.value; updateReflectSubmitState(); };',
  '    const hint = document.createElement(\'div\');',
  '    hint.className = \'reflect-hint\';',
  '    hint.textContent = T[currentLang].reflectHint;',
  '    item.appendChild(label); item.appendChild(ta); item.appendChild(hint);',
  '    root.appendChild(item);',
  '  });',
  '  updateReflectSubmitState();',
  '}',
  '',
  'function updateReflectSubmitState(){',
  '  const allFilled = REFLECTIONS.every(r => (reflections[r.id] || \'\').trim().length >= 8);',
  '  document.getElementById(\'reflectSubmitBtn\').disabled = !allFilled;',
  '}'
].join('\n');

const NEW = [
  'function updateReflectHint(id){',
  '  const hintEl = document.getElementById(\'reflectHint_\' + id);',
  '  if (!hintEl) return;',
  '  const len = (reflections[id] || \'\').trim().length;',
  '  if (len >= 8) {',
  '    hintEl.textContent = currentLang === \'cs\' ? \'✓ Vyplněno\' : \'✓ Vyplnené\';',
  '    hintEl.classList.add(\'reflect-hint-ok\');',
  '  } else {',
  '    const suffix = currentLang === \'cs\' ? \'/8 znaků\' : \'/8 znakov\';',
  '    hintEl.textContent = (currentLang === \'cs\' ? \'Zatím \' : \'Zatiaľ \') + len + suffix;',
  '    hintEl.classList.remove(\'reflect-hint-ok\');',
  '  }',
  '}',
  '',
  'function renderReflectQuestions(){',
  '  const root = document.getElementById(\'reflectRows\');',
  '  root.innerHTML = \'\';',
  '  REFLECTIONS.forEach(r => {',
  '    const item = document.createElement(\'div\');',
  '    item.className = \'reflect-item\';',
  '    const label = document.createElement(\'label\');',
  '    label.textContent = r[currentLang];',
  '    const ta = document.createElement(\'textarea\');',
  '    ta.id = \'reflect_\' + r.id;',
  '    ta.value = reflections[r.id] || \'\';',
  '    ta.maxLength = 600;',
  '    const syncField = () => { reflections[r.id] = ta.value; updateReflectHint(r.id); updateReflectSubmitState(); };',
  '    ta.oninput = syncField;',
  '    ta.onkeyup = syncField;',
  '    ta.onchange = syncField;',
  '    ta.onblur = syncField;',
  '    const hint = document.createElement(\'div\');',
  '    hint.className = \'reflect-hint\';',
  '    hint.id = \'reflectHint_\' + r.id;',
  '    item.appendChild(label); item.appendChild(ta); item.appendChild(hint);',
  '    root.appendChild(item);',
  '  });',
  '  REFLECTIONS.forEach(r => updateReflectHint(r.id));',
  '  updateReflectSubmitState();',
  '}',
  '',
  'function updateReflectSubmitState(){',
  '  const allFilled = REFLECTIONS.every(r => (reflections[r.id] || \'\').trim().length >= 8);',
  '  document.getElementById(\'reflectSubmitBtn\').disabled = !allFilled;',
  '}'
].join('\n');

html = replaceOnce(html, OLD, NEW, 'renderReflectQuestions()/updateReflectSubmitState() -> živý počítadlo znakov');

const backup = HTML_PATH + '.pre-reflect-visible-hint-' + Date.now();
fs.copyFileSync(HTML_PATH, backup);
fs.writeFileSync(HTML_PATH, html);

console.log('✅ Pridané živé počítadlo znakov ("3/8 znakov" -> "✓ Vyplnené") + odolnejšie sledovanie zmien (input/keyup/change/blur).');
console.log('   Záloha:', backup);
