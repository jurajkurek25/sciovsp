// Pridáva https://www.youtube-nocookie.com do frame-src CSP smernice --
// /sutaz stránka teraz embedduje YouTube live prenos žrebovania
// (youtube.com/live/vGXU8uu5HX4, naplánované na 14.9. o 17:00), bez
// tejto domény v CSP by prehliadač iframe zablokoval ("Refused to
// frame...").
//
// Kotva (presne overená cez živú diagnostiku zo servera) je jediný
// riadok vo frame-src smernici -- okolité riadky (script-src, connect-
// src, atď.) sa vôbec nedotknú.
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/242-youtube-live-frame-src.js
// Potom: pm2 restart <meno procesu hlavnej appky>

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som server.js — spusti z koreňa hlavnej appky.');
  process.exit(1);
}
let src = fs.readFileSync(SERVER_PATH, 'utf8');

if (src.includes('youtube-nocookie.com')) {
  console.log('ℹ️  Už je aplikované, preskakujem.');
  process.exit(0);
}

const OLD = `    "frame-src 'self' https://consent.cookiebot.com https://consentcdn.cookiebot.com",`;
const NEW = `    "frame-src 'self' https://consent.cookiebot.com https://consentcdn.cookiebot.com https://www.youtube-nocookie.com",`;

const count = src.split(OLD).length - 1;
if (count !== 1) { console.error('❌ Kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil. Pošli mi aktuálny obsah, over.'); process.exit(1); }

src = src.replace(OLD, () => NEW);

const backup = SERVER_PATH + '.pre-242-youtube-live-frame-src-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, src);
console.log('✅ server.js prepísaný (frame-src teraz povoľuje YouTube embed). Záloha:', backup);
console.log('');
console.log('Over: node -c server.js');
console.log('Reštart: pm2 restart <meno procesu hlavnej appky>');
