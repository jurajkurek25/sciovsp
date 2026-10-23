const fs = require('fs');
const FILE = 'public/index.html';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('<main id="mainContent">')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

let patched = src;

patched = replaceOnce(patched,
  '    <button class="nav-cta" onclick="openPremiumPopup()">Začať zadarmo →</button>\n  </div>\n</nav>',
  '    <button class="nav-cta" onclick="openPremiumPopup()">Začať zadarmo →</button>\n  </div>\n</nav>\n\n<main id="mainContent">',
  'main open after nav');

patched = replaceOnce(patched,
  '<!-- FOOTER -->\n<footer>',
  '</main>\n\n<!-- FOOTER -->\n<footer>',
  'main close before footer');

const backup = FILE + '.pre-add-main-landmark-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
