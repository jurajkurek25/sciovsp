// /blog a /kurzy zdieľajú jednu blogLayout() šablónu v server.js. Pridáva:
// (1) odkaz "Odporúčame" do nav (rovnako ako index.html/odporucame.html),
// (2) zvýraznenie AKTUÁLNEJ stránky (.nav-link.active) — doteraz nemali
// Blog/Kurzy žiadny "aktívny" stav, len odporucame.html malo zelenú farbu
// bez ekvivalentu inde ("zjednot" z konverzácie).
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.136-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK subor (' + LOCK + ') existuje. Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('navActive')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

let patched = src;

// ── 1) CSS: .nav-link.active (rovnaké hodnoty ako index.html/odporucame.html) ──
const OLD_CSS = `.nav-link{text-decoration:none;font-family:var(--mono);font-size:.78rem;letter-spacing:.05em;border-radius:8px;transition:all .2s;color:var(--text2);padding:.65rem .85rem;border:1px solid transparent}
.nav-link:hover{color:var(--text);border-color:var(--border2)}`;
const NEW_CSS = `.nav-link{text-decoration:none;font-family:var(--mono);font-size:.78rem;letter-spacing:.05em;border-radius:8px;transition:all .2s;color:var(--text2);padding:.65rem .85rem;border:1px solid transparent}
.nav-link:hover{color:var(--text);border-color:var(--border2)}
.nav-link.active{color:var(--volt);border-color:rgba(200,255,0,.25)}`;
patched = replaceOnce(patched, OLD_CSS, NEW_CSS, '1: .nav-link.active CSS');

// ── 2) navActive premenná odvodená z canonicalPath ──
const OLD_VAR = `  const ogImage = image || (BASE_URL_BLOG + '/assets/og-image.png');
  return \`<!DOCTYPE html><html lang="\${l}"><head><meta charset="UTF-8">`;
const NEW_VAR = `  const ogImage = image || (BASE_URL_BLOG + '/assets/og-image.png');
  const navActive = (canonicalPath || '').startsWith('/kurzy') ? 'kurzy' : (canonicalPath || '').startsWith('/blog') ? 'blog' : null;
  return \`<!DOCTYPE html><html lang="\${l}"><head><meta charset="UTF-8">`;
patched = replaceOnce(patched, OLD_VAR, NEW_VAR, '2: navActive premenna');

// ── 3) Nav HTML: Odporúčame link + active triedy na Blog/Kurzy ──
const OLD_NAV = `<nav id="mainNav">
  <a href="/\${l === 'cs' ? '?lang=cs' : ''}" class="nav-logo"><span class="nav-dot"></span>SP TRÉNER</a>
  <div style="display:flex;align-items:center;gap:.75rem">
    <a href="/blog\${l === 'cs' ? '?lang=cs' : ''}" class="nav-link">Blog</a>
    <a href="/kurzy\${l === 'cs' ? '?lang=cs' : ''}" class="nav-link">Kurzy</a>
    <div class="lang-switcher">`;
const NEW_NAV = `<nav id="mainNav">
  <a href="/\${l === 'cs' ? '?lang=cs' : ''}" class="nav-logo"><span class="nav-dot"></span>SP TRÉNER</a>
  <div style="display:flex;align-items:center;gap:.75rem">
    <a href="/blog\${l === 'cs' ? '?lang=cs' : ''}" class="nav-link\${navActive === 'blog' ? ' active' : ''}">Blog</a>
    <a href="/kurzy\${l === 'cs' ? '?lang=cs' : ''}" class="nav-link\${navActive === 'kurzy' ? ' active' : ''}">Kurzy</a>
    <a href="/odporucame" class="nav-link">Odporúčame</a>
    <div class="lang-switcher">`;
patched = replaceOnce(patched, OLD_NAV, NEW_NAV, '3: nav HTML Odporucame + active');

const backup = FILE + '.pre-blog-kurzy-nav-odporucame-active-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
