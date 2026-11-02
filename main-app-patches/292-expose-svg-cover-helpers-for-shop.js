// Sprístupní escapeXml/wrapSvgLines cez app.locals (rovnaký vzor ako
// main-app-patches/291-expose-helpers-for-shop-sales-page.js), aby
// routes/shop.js mohol generovať branduvaný SVG cover pre produkty bez
// nahratého obrázku -- presne tak, ako appka už robí pre kurzy na
// /kurzy-cover/:slug.svg.
//
// Vyžaduje: main-app-patches/291-expose-helpers-for-shop-sales-page.js
// (uz aplikovaný) -- táto záplata naňho nadväzuje anchorom.
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/292-expose-svg-cover-helpers-for-shop.js
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.292-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (' + LOCK + '). Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

function replaceExactCount(s, oldStr, newStr, expectedCount, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== expectedCount) {
    console.error('❌ ' + label + ' — očakávaných ' + expectedCount + ' výskytov, nájdených ' + count + '. Nič som nezmenil.');
    process.exit(1);
  }
  return s.split(oldStr).join(newStr);
}

if (!fs.existsSync(FILE)) {
  console.error('❌ Nenašiel som súbor:', FILE, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

let src = fs.readFileSync(FILE, 'utf8');

if (src.includes('app.locals.escapeXml = escapeXml;')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}
if (!src.includes('app.locals.blogLang = blogLang;')) {
  console.error('❌ server.js: main-app-patches/291-expose-helpers-for-shop-sales-page.js ešte nie je aplikovaný. Spusti ho najprv -- táto záplata naňho nadväzuje.');
  process.exit(1);
}

src = replaceExactCount(
  src,
  'app.locals.blogLang = blogLang;\n\napp.get(\'/kurzy\', async (req, res) => {',
  'app.locals.blogLang = blogLang;\n' +
  'app.locals.escapeXml = escapeXml;\n' +
  'app.locals.wrapSvgLines = wrapSvgLines;\n\n' +
  'app.get(\'/kurzy\', async (req, res) => {',
  1, 'app.locals.escapeXml/wrapSvgLines vloženie'
);

const backup = FILE + '.pre-292-expose-svg-cover-helpers-for-shop-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);

console.log('✅ server.js: app.locals.escapeXml / wrapSvgLines sprístupnené pre routes/shop.js (brandovaný SVG cover produktov).');
console.log('   Záloha:', backup);
