const fs = require('fs');
const FILE = 'public/index.html';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('heroBtn3')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

// 1) HTML: add the button in the hero actions row.
const HTML_OLD = `  <div class="hero-actions">
    <button class="btn-primary" id="heroBtn1" onclick="openPremiumPopup()">Spustiť prvý test →</button>
    <a href="#how" class="btn-secondary" id="heroBtn2">Ako to funguje ↓</a>
  </div>`;
const HTML_NEW = `  <div class="hero-actions">
    <button class="btn-primary" id="heroBtn1" onclick="openPremiumPopup()">Spustiť prvý test →</button>
    <a href="/kurzy" class="btn-secondary" id="heroBtn3">Vybrať kurzy →</a>
    <a href="#how" class="btn-secondary" id="heroBtn2">Ako to funguje ↓</a>
  </div>`;

// 2) SK translation key.
const SK_OLD = `  heroBtn1:'Spustiť prvý test →',heroBtn2:'Ako to funguje ↓',`;
const SK_NEW = `  heroBtn1:'Spustiť prvý test →',heroBtn2:'Ako to funguje ↓',heroBtn3:'Vybrať kurzy →',`;

// 3) CS translation key.
const CS_OLD = `  heroBtn1:'Spustit první test →',heroBtn2:'Jak to funguje ↓',`;
const CS_NEW = `  heroBtn1:'Spustit první test →',heroBtn2:'Jak to funguje ↓',heroBtn3:'Vybrat kurzy →',`;

// 4) applyLanguage() wiring.
const APPLY_OLD = `  sT('heroBtn1', t.heroBtn1);
  sT('heroBtn2', t.heroBtn2);`;
const APPLY_NEW = `  sT('heroBtn1', t.heroBtn1);
  sT('heroBtn2', t.heroBtn2);
  sT('heroBtn3', t.heroBtn3);`;

let patched = src;
patched = replaceOnce(patched, HTML_OLD, HTML_NEW, 'HTML');
patched = replaceOnce(patched, SK_OLD, SK_NEW, 'SK translation');
patched = replaceOnce(patched, CS_OLD, CS_NEW, 'CS translation');
patched = replaceOnce(patched, APPLY_OLD, APPLY_NEW, 'applyLanguage wiring');

const backup = FILE + '.pre-hero-courses-btn-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
