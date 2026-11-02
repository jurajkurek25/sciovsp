// DIAGNOSTICKY skript -- NIC NEMENI. main-app-patches/204's terminal
// výstup mal miestami preusporiadané/zbalené medzery (terminál zalamoval
// riadky), takže sa naň nedá spoľahnúť pre presnú (na medzery citlivú)
// kotvu. Tento skript vypíše to isté cez JSON.stringify (medzery aj
// zalomenia riadkov v ňom sú jednoznačne '\n'/'  ' escapované, terminál
// ich nemôže zmiešať).
//
// Zároveň si všimni: v main-app-patches/204 výstupe sa vôbec
// nevyskytuje "uniFactsHtml" ani "UNI_FACTS" ani ".fac-uni-facts" --
// vyzerá to, že main-app-patches/184-faculty-uni-facts.js (sekcia
// "O univerzite") sa na produkcii nikdy reálne nespustil. Tento skript
// to explicitne potvrdí/vyvráti.
//
// Spusti z korena hlavnej appky a pošli mi CELÝ výpis:
//   node main-app-patches/205-diag-skola-handler-json.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const src = fs.readFileSync(SERVER_PATH, 'utf8');

console.log('=== main-app-patches/184 (UNI_FACTS / uniFactsHtml) je aplikovaný? ===');
console.log('obsahuje "uniFactsHtml":', src.includes('uniFactsHtml'));
console.log('obsahuje "UNI_FACTS":', src.includes('UNI_FACTS'));
console.log('obsahuje ".fac-uni-facts":', src.includes('.fac-uni-facts'));
console.log('');

const marker = `app.get('/skola/:uSlug/:fSlug'`;
const startIdx = src.indexOf(marker);
if (startIdx === -1) {
  console.log('❌ Nenašiel som "' + marker + '" v server.js vôbec.');
  process.exit(1);
}
const nextRouteRegex = /app\.(get|post)\(/g;
nextRouteRegex.lastIndex = startIdx + marker.length;
const nextMatch = nextRouteRegex.exec(src);
const endIdx = nextMatch ? nextMatch.index : Math.min(src.length, startIdx + 12000);
const handlerSrc = src.slice(startIdx, endIdx);

console.log('=== presné okolie vloženia (medzi hero sekciou a facultyQuizWidget) -- JSON ===');
const heroIdx = handlerSrc.indexOf(`facultyQuizWidget(lang, statements)`);
if (heroIdx === -1) {
  console.log('❌ Nenašiel som "facultyQuizWidget(lang, statements)" v handleri.');
} else {
  const contextStart = Math.max(0, heroIdx - 200);
  const contextEnd = Math.min(handlerSrc.length, heroIdx + 60);
  console.log(JSON.stringify(handlerSrc.slice(contextStart, contextEnd)));
}
console.log('');

console.log('=== presný koniec <style> bloku (posledné CSS pravidlo pred </style>) -- JSON ===');
const styleCloseIdx = handlerSrc.indexOf('</style>');
if (styleCloseIdx === -1) {
  console.log('❌ Nenašiel som "</style>" v handleri.');
} else {
  const contextStart = Math.max(0, styleCloseIdx - 150);
  const contextEnd = Math.min(handlerSrc.length, styleCloseIdx + 10);
  console.log(JSON.stringify(handlerSrc.slice(contextStart, contextEnd)));
}
console.log('');
console.log('Skopíruj CELÝ výpis vyššie a pošli mi ho.');
