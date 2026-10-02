// Prida appCat (rovnaka mapovacia tabulka QUIZ_APP_CAT, uz pouzivana v
// email-drip systeme) do window.FACULTY_CONTEXT, aby public/js/faculty-quiz-full.js
// mohol po registrácii poslať leada rovno do appky na spravnu kategoriu
// (/app?cat=X&upgrade=free) — rovnaky odkaz, aky uz posiela email stage1.
// Ziadna nova mapovacia tabulka sa nevymysla, len sa recykluje uz
// existujuca QUIZ_APP_CAT (server.js, ~riadok 5315).
//
// Predpoklad: main-app-patches/177 uz je aplikovany (obsahuje
// registerSectionHtml() a ctxObj).
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/179-faculty-appcat-context.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');

if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.179-faculty-appcat-context-lock');
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

if (server.includes('appCat: QUIZ_APP_CAT')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}
if (!server.includes('function registerSectionHtml(')) {
  console.error('❌ Nenašiel som registerSectionHtml() — over, či je main-app-patches/177 už aplikovaný. Nič som nezmenil.');
  process.exit(1);
}
if (!server.includes('const QUIZ_APP_CAT')) {
  console.error('❌ Nenašiel som QUIZ_APP_CAT — nemôžem bezpečne pokračovať. Nič som nezmenil.');
  process.exit(1);
}

const OLD_CTX = `  const ctxObj = { faculty: rec.faculty, university: rec.university, city: rec.city, tag: primaryTag, icon: FIELD_ICONS[primaryTag] || '', lang: lang };`;
const NEW_CTX = `  const ctxObj = { faculty: rec.faculty, university: rec.university, city: rec.city, tag: primaryTag, icon: FIELD_ICONS[primaryTag] || '', lang: lang, appCat: QUIZ_APP_CAT[primaryTag] || 'vsp' };`;

server = replaceOnce(server, OLD_CTX, NEW_CTX, 'ctxObj -> pridanie appCat z QUIZ_APP_CAT');

const backup = SERVER_PATH + '.pre-faculty-appcat-context-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, server);

console.log('✅ window.FACULTY_CONTEXT teraz obsahuje appCat (z QUIZ_APP_CAT) pre presmerovanie do appky po registrácii.');
console.log('   Záloha:', backup);
console.log('   Over syntax pred reštartom: node -c server.js');
