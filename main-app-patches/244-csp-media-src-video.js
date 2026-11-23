// CSP enforcing politika (main-app-patches, aplikuje sa priamo na server.js)
// nemala media-src smernicu -- <video> elementy (kurz-intro video cez
// branded-player.js, src="https://videos.jurajkurek.com/...") preto spadali
// pod default-src 'self' a prehliadač ich ticho blokoval (CSP violation),
// video ostalo zaseknuté na 0:00/0:00. Kotva overena priamo zo zivej
// diagnostiky servera (sed -n '595,615p' server.js).
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/244-csp-media-src-video.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');

if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.244-csp-media-src-video-lock');
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

if (server.includes('media-src')) {
  console.error('❌ server.js: media-src už je prítomné, nič som nezmenil.');
  process.exit(1);
}

server = replaceOnce(server,
  `    "img-src 'self' data: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://consentcdn.cookiebot.com https://*.google-analytics.com https://*.analytics.google.com https://neoworkly.com",`,
  `    "img-src 'self' data: https:",
    "media-src 'self' https://videos.jurajkurek.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://consentcdn.cookiebot.com https://*.google-analytics.com https://*.analytics.google.com https://neoworkly.com",`,
  'CSP -> pridanie media-src pre videos.jurajkurek.com');

const backup = SERVER_PATH + '.pre-csp-media-src-video-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, server);

console.log('✅ CSP doplnené o media-src https://videos.jurajkurek.com.');
console.log('   Záloha:', backup);
console.log('   Over syntax pred reštartom: node -c server.js');
