// Prepaja skolne karty vo vysledku kvizu (public/kam-na-vysoku.html) s
// novymi /skola/:univerzita/:fakulta strankami (main-app-patches/173) —
// doteraz to boli len obycajne texty, ziadny odkaz. Toto je najlacnejsi
// a najvyssi-dopad SEO krok pre nove fakultne stranky: realny interny
// link z vysoko-navstevovanej vysledkovej stranky kvizu.
//
// slugify() tu MUSI byt bajtovo rovnaka ako server-side verzia v
// server.js (main-app-patches/173), inak by odkazy mierili na
// neexistujuce URL.
//
// Predpoklad: main-app-patches/173-faculty-landing-pages.js uz je
// aplikovany (inak odkazy vedu na 404).
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/174-kam-na-vysoku-faculty-links.js

const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(process.cwd(), 'public', 'kam-na-vysoku.html');

if (!fs.existsSync(HTML_PATH)) {
  console.error('❌ Nenašiel som súbor:', HTML_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.174-kam-na-vysoku-faculty-links-lock');
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

let html = fs.readFileSync(HTML_PATH, 'utf8');

if (html.includes('function slugify')) {
  console.error('❌ kam-na-vysoku.html: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// 1) slugify() — pridaná pred FIELD_ORDER, bajtovo rovnaká ako server-side verzia
html = replaceOnce(html,
  "const FIELD_ORDER = ['vsp','psych','law','medicina','technika','pedagogika','ekonomia','humanitne','umenie'];",
  "function slugify(str) {\n  return String(str || '')\n    .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')\n    .toLowerCase()\n    .replace(/[^a-z0-9]+/g, '-')\n    .replace(/^-+|-+$/g, '');\n}\n\nconst FIELD_ORDER = ['vsp','psych','law','medicina','technika','pedagogika','ekonomia','humanitne','umenie'];",
  'slugify() definícia');

// 2) skolne karty -> realne odkazy na /skola/:univerzita/:fakulta
html = replaceOnce(html,
  "  const grid = matches.map(m => {\n    const flag = m.u.c === 'SK' ? '🇸🇰' : '🇨🇿';\n    const facNames = m.facs.map(f => f.n).join(', ');\n    return '<div class=\"school-card\"><div class=\"sname\"><span class=\"flag\">'+flag+'</span>'+m.u.n+' <span style=\"color:var(--ink3);font-weight:400\">— '+m.u.city+'</span></div><div class=\"sfac\">'+facNames+'</div></div>';\n  }).join('');",
  "  const grid = matches.map(m => {\n    const flag = m.u.c === 'SK' ? '🇸🇰' : '🇨🇿';\n    const uSlug = slugify(m.u.n);\n    const langQS = currentLang === 'cs' ? '?lang=cs' : '';\n    const facNames = m.facs.map(f => '<a href=\"/skola/'+uSlug+'/'+slugify(f.n)+langQS+'\" style=\"color:inherit;text-decoration:underline;text-decoration-color:var(--border2)\">'+f.n+'</a>').join(', ');\n    return '<div class=\"school-card\"><div class=\"sname\"><span class=\"flag\">'+flag+'</span>'+m.u.n+' <span style=\"color:var(--ink3);font-weight:400\">— '+m.u.city+'</span></div><div class=\"sfac\">'+facNames+'</div></div>';\n  }).join('');",
  'school-card odkazy na /skola');

const backup = HTML_PATH + '.pre-faculty-links-' + Date.now();
fs.copyFileSync(HTML_PATH, backup);
fs.writeFileSync(HTML_PATH, html);

console.log('✅ Školy vo výsledku kvízu teraz odkazujú na /skola/:univerzita/:fakulta stránky.');
console.log('   Záloha:', backup);
