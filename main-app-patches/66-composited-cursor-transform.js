const fs = require('fs');
const FILE = 'public/index.html';
const src = fs.readFileSync(FILE, 'utf8');

const L = (...lines) => lines.join('\n');

if (src.includes('applyCursorTransform')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const OLD = L(
  "const cursor = document.getElementById('cursor');",
  "const ring = document.getElementById('cursorRing');",
  "let mx = 0, my = 0, rx = 0, ry = 0;",
  "document.addEventListener('mousemove', e => {",
  "  mx = e.clientX; my = e.clientY;",
  "  cursor.style.left = mx + 'px'; cursor.style.top = my + 'px';",
  "});",
  "(function animRing(){",
  "  rx += (mx - rx) * .12; ry += (my - ry) * .12;",
  "  ring.style.left = rx + 'px'; ring.style.top = ry + 'px';",
  "  requestAnimationFrame(animRing);",
  "})();",
  "document.querySelectorAll('a,button,.pain-card,.feature-card,.clan-mockup,.owntests-card').forEach(el => {",
  "  el.addEventListener('mouseenter', () => { cursor.style.width = '20px'; cursor.style.height = '20px'; ring.style.width = '60px'; ring.style.height = '60px'; });",
  "  el.addEventListener('mouseleave', () => { cursor.style.width = '10px'; cursor.style.height = '10px'; ring.style.width = '36px'; ring.style.height = '36px'; });",
  "});"
);

const NEW = L(
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

const patched = replaceOnce(src, OLD, NEW, 'cursor position/hover block');

const backup = FILE + '.pre-composited-cursor-transform-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
