// Bezpečnostná oprava: scanner nahlásil X-Powered-By (odhaľuje Express) a
// default error pages (odhaľujú framework). Riešenie:
// 1) app.disable('x-powered-by') -- je to len nastavenie (app.set), takže
//    nezávisí od poradia middleware; stačí, aby bolo zavolané kedykoľvek
//    pred app.listen.
// 2) Univerzálny 404 na konci pre VŠETKY metódy -- SPA fallback je len
//    app.get('*', ...), čiže POST/PUT/DELETE na nezhodnú cestu dostane
//    Express-ovu vlastnú "Cannot POST /xyz" stránku, ktorá priamo
//    odhaľuje framework (overené naživo na dash-service pred/po).
//
// Kotva je byte-presne overená z tvojho výstupu main-app-patches/236 --
// toto je úplne posledný kód v súbore, hneď pred app.listen.
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/238-hide-framework-fingerprint.js
// Potom: pm2 restart <meno procesu hlavnej appky>

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som server.js — spusti z koreňa hlavnej appky.');
  process.exit(1);
}
let src = fs.readFileSync(SERVER_PATH, 'utf8');

if (src.includes("x-powered-by")) {
  console.log('ℹ️  Už je aplikované, preskakujem.');
  process.exit(0);
}

const OLD = `app.listen(PORT, () => {
  console.log(\`✅ VSP Tréner server beží na porte \${PORT}\`);
  if (!API_KEY) console.warn('⚠️  ANTHROPIC_API_KEY chýba!');
  if (!process.env.SUPABASE_URL) console.warn('⚠️  SUPABASE_URL chýba!');
  if (!process.env.STRIPE_SECRET_KEY) console.warn('⚠️  STRIPE_SECRET_KEY chýba!');
});`;

const NEW = `// Express by defaultu posiela X-Powered-By: Express pri res.send()/
// res.json() -- disable() je spoľahlivý spôsob, ako to úplne vypnúť.
app.disable('x-powered-by');

// Čokoľvek, čo sem dorazí (iná HTTP metóda než GET na neexistujúcu
// cestu -- SPA fallback vyššie je len app.get('*', ...)), by inak
// dostalo Express-ovu vlastnú default 404 stránku ("Cannot POST /xyz"),
// ktorá odhaľuje použitý framework.
app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

app.listen(PORT, () => {
  console.log(\`✅ VSP Tréner server beží na porte \${PORT}\`);
  if (!API_KEY) console.warn('⚠️  ANTHROPIC_API_KEY chýba!');
  if (!process.env.SUPABASE_URL) console.warn('⚠️  SUPABASE_URL chýba!');
  if (!process.env.STRIPE_SECRET_KEY) console.warn('⚠️  STRIPE_SECRET_KEY chýba!');
});`;

const count = src.split(OLD).length - 1;
if (count !== 1) { console.error('❌ Kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil. Pošli mi aktuálny obsah, over.'); process.exit(1); }

src = src.replace(OLD, () => NEW);

const backup = SERVER_PATH + '.pre-238-hide-framework-fingerprint-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, src);
console.log('✅ server.js prepísaný (X-Powered-By vypnutý, univerzálny 404 handler pridaný). Záloha:', backup);
console.log('');
console.log('Over: node -c server.js');
console.log('Reštart: pm2 restart <meno procesu hlavnej appky>');
