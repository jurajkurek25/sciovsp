// Vycentruje h1.hero-title LEN na dvoch konkrétnych miestach z konverzácie:
// /odporucame ("Odporúčame"/"Doporučujeme") a listing stránke /blog
// ("Ako sa naozaj pripraviť..."/"Jak se opravdu připravit..."). Inline
// style priamo na konkrétnom h1 — nedotýka sa zdieľanej .hero-title
// triedy, takže /kurzy ani jednotlivé blog články sa nezmenia.
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.139-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK subor (' + LOCK + ') existuje. Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('hero-title" style="text-align:center">${T.heroTitle}')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

let patched = src;

// ── 1) /blog listing — "Ako sa naozaj pripraviť.../Jak se opravdu..." ──
patched = replaceOnce(patched,
  `      <h1 class="hero-title">\${T.heroTitle}</h1>`,
  `      <h1 class="hero-title" style="text-align:center">\${T.heroTitle}</h1>`,
  '1: /blog hero-title');

// ── 2) /odporucame — CZ "Doporučujeme" ──
patched = replaceOnce(patched,
  `  <h1 class="hero-title">Doporučujeme</h1>`,
  `  <h1 class="hero-title" style="text-align:center">Doporučujeme</h1>`,
  '2: Doporucujeme');

// ── 3) /odporucame — SK "Odporúčame" ──
patched = replaceOnce(patched,
  `  <h1 class="hero-title">Odporúčame</h1>`,
  `  <h1 class="hero-title" style="text-align:center">Odporúčame</h1>`,
  '3: Odporucame');

const backup = FILE + '.pre-center-odporucame-blog-hero-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
