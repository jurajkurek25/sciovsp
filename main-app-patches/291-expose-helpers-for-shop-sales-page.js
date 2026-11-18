// Sprístupní zdieľané "blogLayout" komponenty (blogLayout, KURZY_STYLE,
// escapeHtml, blogLang) cez app.locals, aby ich mohol použiť
// routes/shop.js pre predajnú stránku jednotlivého produktu
// (/obchod/:slug) -- presne tým istým dizajnom ako /kurzy/:slug.
//
// routes/shop.js je samostatný modul (vlastný require), takže nemá
// priamy prístup k funkciám definovaným v server.js -- app.locals je
// najjednoduchší spôsob, ako mu ich podať (rovnaký vzor, akým
// routes/shop.js naopak dáva server.js svoje shopSignedDownloadUrl).
//
// Poradie v súbore nevadí: handler v routes/shop.js číta app.locals.*
// až v momente, keď príde HTTP request -- vtedy je už celý server.js
// dávno načítaný a tieto hodnoty priradené, bez ohľadu na to, že
// require('./routes/shop')(app) sa v súbore volá skôr, než je
// KURZY_STYLE definované.
//
// Vyžaduje: main-app-patches/292-obchod-slug-sales-page.js (nová verzia
// routes/shop.js s /obchod/:slug routou) nasadenú spolu s týmto patchom
// -- inak sa tieto app.locals len nepoužijú, nič sa nepokazí.
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/291-expose-helpers-for-shop-sales-page.js
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.291-lock';
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

if (src.includes('app.locals.blogLayout = blogLayout;')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

src = replaceExactCount(
  src,
  "</style>`;\n\napp.get('/kurzy', async (req, res) => {",
  "</style>`;\n\n" +
  "// Sprístupnené pre routes/shop.js (predajná stránka /obchod/:slug --\n" +
  "// pozri main-app-patches/291-expose-helpers-for-shop-sales-page.js).\n" +
  "app.locals.blogLayout = blogLayout;\n" +
  "app.locals.KURZY_STYLE = KURZY_STYLE;\n" +
  "app.locals.escapeHtml = escapeHtml;\n" +
  "app.locals.blogLang = blogLang;\n\n" +
  "app.get('/kurzy', async (req, res) => {",
  1, 'app.locals helpers vloženie (po KURZY_STYLE)'
);

const backup = FILE + '.pre-291-expose-helpers-for-shop-sales-page-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);

console.log('✅ server.js: app.locals.blogLayout / KURZY_STYLE / escapeHtml / blogLang sprístupnené pre routes/shop.js.');
console.log('   Záloha:', backup);
