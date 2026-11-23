// CSP script-src chýal connect.facebook.net -- Meta Pixel (fbevents.js) sa
// preto vôbec nenačítal (CSP violation v Console, potvrdené naživo).
// img-src už 'https:' povoľuje odkiaľkoľvek, takže noscript <img> pixel
// fallback je v poriadku bez zmeny -- chýbal len script-src pre samotný
// fbevents.js.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/246-csp-facebook-pixel-script.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');

if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.246-csp-facebook-pixel-script-lock');
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

let server = fs.readFileSync(SERVER_PATH, 'utf8');

if (server.includes('connect.facebook.net')) {
  console.error('❌ server.js: connect.facebook.net už je v CSP, nič som nezmenil.');
  process.exit(1);
}

server = replaceOnce(server,
  `    "script-src 'self' 'unsafe-inline' https://consent.cookiebot.com https://consentcdn.cookiebot.com https://www.googletagmanager.com https://cdn.jsdelivr.net https://neoworkly.com",`,
  `    "script-src 'self' 'unsafe-inline' https://consent.cookiebot.com https://consentcdn.cookiebot.com https://www.googletagmanager.com https://cdn.jsdelivr.net https://neoworkly.com https://connect.facebook.net",`,
  'CSP script-src -> pridanie connect.facebook.net pre Meta Pixel');

const backup = SERVER_PATH + '.pre-csp-facebook-pixel-script-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, server);

console.log('✅ CSP script-src doplnené o https://connect.facebook.net (Meta Pixel).');
console.log('   Záloha:', backup);
console.log('   Over syntax pred reštartom: node -c server.js');
