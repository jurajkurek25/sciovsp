const fs = require('fs');
const FILE = 'public/index.html';
const src = fs.readFileSync(FILE, 'utf8');

const L = (...lines) => lines.join('\n');

if (!src.includes('id="cursor"')) {
  console.error('Uz je aplikovane (cursor element uz nie je v subore), nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

let patched = src;

// ── HTML: remove the two cursor divs ──────────────────────────────
patched = replaceOnce(patched,
  L(
    '<div class="cursor" id="cursor"></div>',
    '<div class="cursor-ring" id="cursorRing"></div>'
  ),
  '',
  'cursor HTML divs');

// ── CSS: drop cursor:none from body, remove .cursor/.cursor-ring rules ──
patched = replaceOnce(patched,
  L(
    "body{background:var(--black);color:var(--text);font-family:var(--sans);overflow-x:hidden;cursor:none}",
    "",
    ".cursor{position:fixed;width:10px;height:10px;background:var(--volt);border-radius:50%;pointer-events:none;z-index:10010;transform:translate(-50%,-50%);transition:transform .1s,width .2s,height .2s,background .2s;mix-blend-mode:difference}",
    ".cursor-ring{position:fixed;width:36px;height:36px;border:1px solid rgba(200,255,0,.4);border-radius:50%;pointer-events:none;z-index:10009;transform:translate(-50%,-50%);transition:transform .15s ease-out,width .25s,height .25s}",
    "body::after{content:'';position:fixed;inset:0;background-image:url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E\");pointer-events:none;z-index:9997}"
  ),
  L(
    "body{background:var(--black);color:var(--text);font-family:var(--sans);overflow-x:hidden}",
    "",
    "body::after{content:'';position:fixed;inset:0;background-image:url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E\");pointer-events:none;z-index:9997}"
  ),
  'cursor CSS rules + body cursor:none');

// ── JS: remove the whole cursor tracking block (post patch-66 shape) ──
const JS_OLD = L(
  "const cursor = document.getElementById('cursor');",
  "const ring = document.getElementById('cursorRing');",
  "let mx = 0, my = 0, rx = 0, ry = 0, cursorHover = false;",
  "function applyCursorTransform() { cursor.style.transform = 'translate(' + mx + 'px, ' + my + 'px) translate(-50%, -50%) scale(' + (cursorHover ? 2 : 1) + ')'; }",
  "function applyRingTransform() { ring.style.transform = 'translate(' + rx + 'px, ' + ry + 'px) translate(-50%, -50%) scale(' + (cursorHover ? 1.667 : 1) + ')'; }",
  "document.addEventListener('mousemove', e => {",
  "  mx = e.clientX; my = e.clientY;",
  "  applyCursorTransform();",
  "});",
  "(function animRing(){",
  "  rx += (mx - rx) * .12; ry += (my - ry) * .12;",
  "  applyRingTransform();",
  "  requestAnimationFrame(animRing);",
  "})();",
  "document.querySelectorAll('a,button,.pain-card,.feature-card,.clan-mockup,.owntests-card').forEach(el => {",
  "  el.addEventListener('mouseenter', () => { cursorHover = true; applyCursorTransform(); applyRingTransform(); });",
  "  el.addEventListener('mouseleave', () => { cursorHover = false; applyCursorTransform(); applyRingTransform(); });",
  "});"
);
if (!patched.includes(JS_OLD)) {
  console.error('Cursor JS blok (po patchi 66) sa nenasiel — najprv treba nasadit patch 66-composited-cursor-transform.js. Nic som nezmenil.');
  process.exit(1);
}
patched = replaceOnce(patched, JS_OLD, '', 'cursor JS block');

const backup = FILE + '.pre-remove-custom-cursor-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
