// Doplní "Obchod" do zdieľaného menu (blogLayout -- /blog, /kurzy,
// /odporucame, /skola a ostatné blogLayout stránky), medzi Kurzy a
// Odporúčame, rovnako ako je to už na statických /obchod stránkach
// (obchod.html, obchod-dakujeme.html, obchod-admin.html). Dôvod: predtým
// mali /obchod stránky o 1 link navyše oproti zvyšku webu (Blog, Kurzy,
// Obchod, Odporúčame vs. len Blog, Kurzy, Odporúčame) -- toto to zjednotí
// na 4 linky všade.
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/290-add-obchod-to-site-nav.js
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.290-lock';
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

if (src.includes("navActive === 'obchod'")) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// ── 1) navActive rozpoznáva aj /obchod ──────────────────────────
src = replaceExactCount(
  src,
  `const navActive = (canonicalPath || '').startsWith('/kurzy') ? 'kurzy' : (canonicalPath || '').startsWith('/blog') ? 'blog' : (canonicalPath || '').startsWith('/odporucame') ? 'odporucame' : null;`,
  `const navActive = (canonicalPath || '').startsWith('/kurzy') ? 'kurzy' : (canonicalPath || '').startsWith('/blog') ? 'blog' : (canonicalPath || '').startsWith('/odporucame') ? 'odporucame' : (canonicalPath || '').startsWith('/obchod') ? 'obchod' : null;`,
  1, 'navActive /obchod rozpoznávanie'
);

// ── 2) Nový nav-link medzi Kurzy a Odporúčame ───────────────────
src = replaceExactCount(
  src,
  `      <a href="/odporucame\${l === 'cs' ? '?lang=cs' : ''}" class="nav-link\${navActive === 'odporucame' ? ' active' : ''}">Odporúčame</a>`,
  `      <a href="/obchod" class="nav-link\${navActive === 'obchod' ? ' active' : ''}">Obchod</a>
      <a href="/odporucame\${l === 'cs' ? '?lang=cs' : ''}" class="nav-link\${navActive === 'odporucame' ? ' active' : ''}">Odporúčame</a>`,
  1, 'Obchod nav-link vloženie'
);

const backup = FILE + '.pre-290-add-obchod-to-site-nav-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);

console.log('✅ server.js: menu na /blog, /kurzy, /odporucame, /skola a ostatných blogLayout stránkach má teraz aj link na Obchod (medzi Kurzy a Odporúčame).');
console.log('   Záloha:', backup);
console.log('');
console.log('🚨 Po tomto patchi: pm2 restart <tvoj proces> a over naživo, že /blog, /kurzy aj /odporucame zobrazujú 4 linky (Blog, Kurzy, Obchod, Odporúčame) a že link na Obchod funguje aj v mobilnom menu.');
