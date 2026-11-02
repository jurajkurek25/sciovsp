// Bezpečnostná oprava: scanner nahlásil, že appka posiela "Cache-Control:
// public, max-age=0" (default z express.static/prehliadača) aj tam, kde by
// nemala -- API odpovede so superadmin dátami by takto mohli zostať v
// zdieľanej cache/proxy. Pridáva "Cache-Control: no-store" pre VŠETKY
// /api/* odpovede (statické súbory nižšie si svoj Cache-Control riešia
// samé, nedotknuté).
//
// Spusti z koreňa dash-service:
//   node patches/22-api-cache-control-no-store.js
// Potom: pm2 restart dash-service

const fs = require('fs');
const FILE = require('path').join(process.cwd(), 'server.js');
if (!fs.existsSync(FILE)) { console.error('❌ Nenašiel som server.js — spusti z koreňa dash-service.'); process.exit(1); }
let src = fs.readFileSync(FILE, 'utf8');

if (src.includes('no-store')) {
  console.log('ℹ️  Už je aplikované, preskakujem.');
  process.exit(0);
}

const OLD = `app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());`;

const NEW = `app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// Všetky /api/* odpovede nesú superadmin dáta -- default Cache-Control
// (public, max-age=0 z express.static/prehliadača) by to mohlo nechať v
// zdieľanej cache/proxy. Statické súbory nižšie si svoj Cache-Control
// riešia samé (express.static), toto sa ich netýka.
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});`;

const count = src.split(OLD).length - 1;
if (count !== 1) { console.error('❌ Kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil. Pošli mi aktuálny obsah server.js, over.'); process.exit(1); }

src = src.replace(OLD, () => NEW);

const backup = FILE + '.pre-22-api-cache-control-no-store-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);
console.log('✅ server.js prepísaný (všetky /api/* odpovede teraz majú Cache-Control: no-store). Záloha:', backup);
console.log('');
console.log('Over: node -c server.js');
console.log('Reštart: pm2 restart dash-service');
