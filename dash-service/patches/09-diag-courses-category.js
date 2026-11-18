// DIAGNOSTICKY skript -- NIC NEMENI. Predtým, než pridám editáciu
// kategórie kurzu do dash.sptrener.online, potrebujem vidieť presný
// aktuálny obsah routes/courses.js (POST/PUT handlery) a relevantnú
// časť public/index.html (courseFormHtml() + bindCourseForm()) -- tie
// môžu byť iné než git repo, presne ako pri hlavnej appke.
//
// Spusti v koreňovom priečinku TOHTO servisu (tam, kde beží
// dash.sptrener.online, NIE v hlavnej appke) a pošli mi CELÝ výpis:
//   node patches/09-diag-courses-category.js

const fs = require('fs');
const path = require('path');

const ROUTES_PATH = path.join(process.cwd(), 'routes', 'courses.js');
const HTML_PATH = path.join(process.cwd(), 'public', 'index.html');

if (!fs.existsSync(ROUTES_PATH) || !fs.existsSync(HTML_PATH)) {
  console.error('❌ Nenašiel som routes/courses.js alebo public/index.html — spusti tento skript z koreňa dash-service (nie z hlavnej appky).');
  process.exit(1);
}

const routesSrc = fs.readFileSync(ROUTES_PATH, 'utf8');
const htmlSrc = fs.readFileSync(HTML_PATH, 'utf8');

console.log('=== routes/courses.js -- dĺžka:', routesSrc.length, '===');
console.log(JSON.stringify(routesSrc));
console.log('');

function printFunctionSource(label, fnName) {
  const marker = 'function ' + fnName + '(';
  const idx = htmlSrc.indexOf(marker);
  console.log('════════════ ' + label + ' ════════════');
  if (idx === -1) {
    console.log('❌ Nenašiel som "' + marker + '".');
    console.log('');
    return;
  }
  const parenStart = idx + marker.length - 1;
  let parenDepth = 0;
  let parenEnd = -1;
  for (let i = parenStart; i < htmlSrc.length; i++) {
    if (htmlSrc[i] === '(') parenDepth++;
    else if (htmlSrc[i] === ')') { parenDepth--; if (parenDepth === 0) { parenEnd = i; break; } }
  }
  if (parenEnd === -1) { console.log('❌ Nenašiel som koniec parametrov.'); console.log(''); return; }
  const braceStart = htmlSrc.indexOf('{', parenEnd);
  if (braceStart === -1) { console.log('❌ Nenašiel som telo funkcie.'); console.log(''); return; }
  let depth = 0;
  let i = braceStart;
  for (; i < htmlSrc.length; i++) {
    if (htmlSrc[i] === '{') depth++;
    else if (htmlSrc[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  const fnSrc = htmlSrc.slice(idx, i);
  console.log('dĺžka: ' + fnSrc.length + ' znakov');
  console.log(JSON.stringify(fnSrc));
  console.log('');
}

printFunctionSource('courseFormHtml()', 'courseFormHtml');
printFunctionSource('bindCourseForm()', 'bindCourseForm');

console.log('Skopíruj CELÝ výpis vyššie a pošli mi ho.');
