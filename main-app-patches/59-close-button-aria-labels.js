const fs = require('fs');
const FILE = 'public/index.html';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('aria-label="Zavrieť"')) {
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
  '<button class="banner-close" onclick="closeBanner()" title="Zavrieť">✕</button>',
  '<button class="banner-close" onclick="closeBanner()" title="Zavrieť" aria-label="Zavrieť">✕</button>',
  'banner-close');

patched = replaceOnce(patched,
  '<button class="popup-close" onclick="closePremiumPopup()">✕</button>',
  '<button class="popup-close" onclick="closePremiumPopup()" aria-label="Zavrieť">✕</button>',
  'popup-close premium');

patched = replaceOnce(patched,
  '<button class="popup-close" onclick="closeElitePopup()">✕</button>',
  '<button class="popup-close" onclick="closeElitePopup()" aria-label="Zavrieť">✕</button>',
  'popup-close elite');

patched = replaceOnce(patched,
  '<button class="exit-popup-close" onclick="closeExitPopup()">✕</button>',
  '<button class="exit-popup-close" onclick="closeExitPopup()" aria-label="Zavrieť">✕</button>',
  'exit-popup-close');

const backup = FILE + '.pre-close-button-aria-labels-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
