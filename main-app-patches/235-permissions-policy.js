// Bezpečnostná oprava: chýbajúca Permissions-Policy hlavička. NA ROZDIEL
// od dash/instructor appka REÁLNE používa niektoré funkcie, overené
// grepom cez celý public/ a historiu patchov:
//   - camera: webgazer.js na /generalka (eye-tracking cez kameru pri
//     mock-skúške) -- MUSÍ zostať povolené pre 'self', inak sa rozbije
//     kľúčová platená funkcia.
//   - fullscreen: /generalka (fullscreen režim skúšky) + branded-player.js
//     (video prehrávač) -- povolené pre 'self'.
//   - clipboard-write: kopírovanie kódov (index.html, app.html,
//     webinar.html) -- povolené pre 'self'.
//   - autoplay: muted video reklamy/odmeny -- povolené pre 'self'.
// Microphone, geolocation, payment, usb a ostatné nikde nepoužité ->
// zamknuté úplne.
//
// Kotva nadväzuje na main-app-patches/234 (Cache-Control), ktorý musí byť
// nasadený ako prvý.
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/235-permissions-policy.js
// Potom: pm2 restart <meno procesu hlavnej appky>

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som server.js — spusti z koreňa hlavnej appky.');
  process.exit(1);
}
let src = fs.readFileSync(SERVER_PATH, 'utf8');

if (src.includes('Permissions-Policy')) {
  console.log('ℹ️  Už je aplikované, preskakujem.');
  process.exit(0);
}

const OLD = `// /api/* odpovede môžu nosiť osobné/platobné dáta (profil, kurzy, kvízy,
// výsledky) -- default Cache-Control (public, max-age=0) by to mohlo
// nechať v zdieľanej cache/proxy. Beží hneď tu, na začiatku, PRED
// akoukoľvek routou vrátane webhookov, takže pokrýva všetko. Endpointy,
// ktoré explicitne CHCÚ byť cacheované (napr. OG-image SVG), si
// Cache-Control nastavujú vo vlastnom handleri AŽ NESKÔR a tento default
// bezpečne prepíšu.
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});`;

const NEW = `// /api/* odpovede môžu nosiť osobné/platobné dáta (profil, kurzy, kvízy,
// výsledky) -- default Cache-Control (public, max-age=0) by to mohlo
// nechať v zdieľanej cache/proxy. Beží hneď tu, na začiatku, PRED
// akoukoľvek routou vrátane webhookov, takže pokrýva všetko. Endpointy,
// ktoré explicitne CHCÚ byť cacheované (napr. OG-image SVG), si
// Cache-Control nastavujú vo vlastnom handleri AŽ NESKÔR a tento default
// bezpečne prepíšu.
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});

// camera pre 'self': webgazer.js na /generalka potrebuje kameru (eye-
// tracking pri mock-skúške). fullscreen/clipboard-write/autoplay pre
// 'self': skúška, video prehrávač, kopírovanie kódov, video reklamy.
// Ostatné (microphone, geolocation, payment, usb...) nikde nepoužité.
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), picture-in-picture=(), fullscreen=(self), clipboard-write=(self), autoplay=(self)');
  next();
});`;

const count = src.split(OLD).length - 1;
if (count !== 1) { console.error('❌ Kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil. Pošli mi aktuálny obsah, over -- over, že main-app-patches/234 je už nasadený.'); process.exit(1); }

src = src.replace(OLD, () => NEW);

const backup = SERVER_PATH + '.pre-235-permissions-policy-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, src);
console.log('✅ server.js prepísaný (Permissions-Policy pridaná, camera/fullscreen/clipboard-write/autoplay povolené pre self, ostatné zamknuté). Záloha:', backup);
console.log('');
console.log('Over: node -c server.js');
console.log('Reštart: pm2 restart <meno procesu hlavnej appky>');
console.log('');
console.log('Po nasadení over na /generalka, že kamera pre webgazer stále funguje.');
