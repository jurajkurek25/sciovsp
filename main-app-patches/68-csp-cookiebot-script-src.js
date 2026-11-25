const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("script-src 'self' 'unsafe-inline' https://consent.cookiebot.com https://consentcdn.cookiebot.com")) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const patched = replaceOnce(src,
  "    \"script-src 'self' 'unsafe-inline' https://consent.cookiebot.com https://www.googletagmanager.com https://cdn.jsdelivr.net https://neoworkly.com\",",
  "    \"script-src 'self' 'unsafe-inline' https://consent.cookiebot.com https://consentcdn.cookiebot.com https://www.googletagmanager.com https://cdn.jsdelivr.net https://neoworkly.com\",",
  'CSP script-src cookiebot cdn');

const backup = FILE + '.pre-csp-cookiebot-script-src-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
