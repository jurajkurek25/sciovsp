// DIAGNOSTICKY skript -- NIC NEMENI. Predtým, než pridám editáciu
// kategórie kurzu do instructor.sptrener.online, potrebujem vidieť
// presný aktuálny obsah routes/courses.js (POST/PUT handlery) a
// relevantnú časť public/index.html (formulár na úpravu kurzu +
// saveCourse()) -- rovnaká disciplína ako v hlavnej appke (main-app-patches),
// keďže produkcia sa tu môže líšiť od git repa rovnako ako pri nej.
//
// Spusti v koreňovom priečinku TOHTO servisu (tam, kde beží
// instructor.sptrener.online, NIE v hlavnej appke) a pošli mi CELÝ výpis:
//   node patches/01-diag-courses-category.js

const fs = require('fs');
const path = require('path');

const ROUTES_PATH = path.join(process.cwd(), 'routes', 'courses.js');
const HTML_PATH = path.join(process.cwd(), 'public', 'index.html');

if (!fs.existsSync(ROUTES_PATH) || !fs.existsSync(HTML_PATH)) {
  console.error('❌ Nenašiel som routes/courses.js alebo public/index.html — spusti tento skript z koreňa instructor-service (nie z hlavnej appky).');
  process.exit(1);
}

const routesSrc = fs.readFileSync(ROUTES_PATH, 'utf8');
const htmlSrc = fs.readFileSync(HTML_PATH, 'utf8');

console.log('=== routes/courses.js -- dĺžka:', routesSrc.length, '===');
console.log(JSON.stringify(routesSrc));
console.log('');

function dumpAround(label, marker, before, after) {
  console.log('════════════ ' + label + ' (kotva: "' + marker + '") ════════════');
  const idx = htmlSrc.indexOf(marker);
  if (idx === -1) {
    console.log('❌ Nenašiel som "' + marker + '" v public/index.html.');
    console.log('');
    return;
  }
  const start = Math.max(0, idx - before);
  const end = Math.min(htmlSrc.length, idx + marker.length + after);
  console.log(JSON.stringify(htmlSrc.slice(start, end)));
  console.log('');
}

dumpAround('accessMode select v edit formulári', "id=\"f-access-mode\"", 400, 900);
dumpAround('saveCourse()', 'async function saveCourse(id)', 0, 900);

console.log('Skopíruj CELÝ výpis vyššie a pošli mi ho.');
