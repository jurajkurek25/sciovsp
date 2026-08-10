const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("frame-src 'self' https://consent.cookiebot.com https://consentcdn.cookiebot.com")) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const patched = replaceOnce(src,
  "    \"frame-src 'self' https://consent.cookiebot.com\",",
  "    \"frame-src 'self' https://consent.cookiebot.com https://consentcdn.cookiebot.com\",",
  'CSP frame-src cookiebot');

const backup = FILE + '.pre-csp-cookiebot-frame-src-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
