// DIAGNOSTICKY skript -- NIC NEMENI. Pred pridaním kategorizácie a
// textového vyhľadávania na /odporucame, /kurzy a /blog potrebujem
// vidieť ich PRESNÝ aktuálny kód (nie rekonštrukciu z patchov -- to sa
// už dvakrát ukázalo ako nespoľahlivé v main-app-patches/200). Výstup
// je cez JSON.stringify, takže medzery/zalomenia riadkov sú
// jednoznačné aj po prilepení do terminálu.
//
// Spusti z korena hlavnej appky a pošli mi CELÝ výpis:
//   node main-app-patches/206-diag-odporucame-kurzy-blog.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const src = fs.readFileSync(SERVER_PATH, 'utf8');

function dumpRoute(label, marker) {
  console.log('════════════ ' + label + ' (kotva: "' + marker + '") ════════════');
  const startIdx = src.indexOf(marker);
  if (startIdx === -1) {
    console.log('❌ Nenašiel som túto routu v server.js vôbec.');
    console.log('');
    return;
  }
  const nextRouteRegex = /app\.(get|post)\(/g;
  nextRouteRegex.lastIndex = startIdx + marker.length;
  const nextMatch = nextRouteRegex.exec(src);
  const endIdx = nextMatch ? nextMatch.index : Math.min(src.length, startIdx + 15000);
  const handlerSrc = src.slice(startIdx, endIdx);
  console.log('dĺžka: ' + handlerSrc.length + ' znakov');
  console.log(JSON.stringify(handlerSrc));
  console.log('');
}

dumpRoute('/odporucame', `app.get('/odporucame'`);
dumpRoute('/kurzy (zoznam)', `app.get('/kurzy'`);
dumpRoute('/blog (zoznam)', `app.get('/blog'`);

console.log('Skopíruj CELÝ výpis vyššie (medzi ════ značkami) a pošli mi ho.');
