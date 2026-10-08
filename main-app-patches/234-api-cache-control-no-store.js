// Bezpečnostná oprava: scanner nahlásil, že appka posiela "Cache-Control:
// public, max-age=0" (default z express.static/prehliadača) aj tam, kde
// by nemala -- /api/* odpovede s osobnými/platobnými dátami (profil,
// kurzy, kvízy, výsledky) by takto mohli zostať v zdieľanej cache/proxy.
// Pridáva "Cache-Control: no-store" pre VŠETKY /api/* odpovede.
//
// Kotva je umiestnená hneď po CSP security-headers bloku (main-app-
// patches/231, už nasadený -- potvrdené cez diagnostiku main-app-patches/
// 232/233), čiže beží úplne na začiatku middleware reťazca, PRED
// akoukoľvek routou vrátane webhookov -- pokrýva naozaj všetko.
// Existujúce explicitné Cache-Control pri OG-image SVG endpointoch
// (public, max-age=3600) beží AŽ V HANDLERI, teda po tomto middleware,
// a bezpečne ho prepíše -- nič sa nerozbije.
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/234-api-cache-control-no-store.js
// Potom: pm2 restart <meno procesu hlavnej appky>

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som server.js — spusti z koreňa hlavnej appky.');
  process.exit(1);
}
let src = fs.readFileSync(SERVER_PATH, 'utf8');

if (src.includes("if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store')")) {
  console.log('ℹ️  Už je aplikované, preskakujem.');
  process.exit(0);
}

const OLD = `// ── Bezpečnostné hlavičky (HSTS, COOP, CSP vynucujúca) ──────────────
// Roky bežala len ako Report-Only (main-app-patches/62, 68) -- zoznam
// domén bol overený proti všetkým externým zdrojom v appke, teraz sa
// vynucuje.
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://consent.cookiebot.com https://consentcdn.cookiebot.com https://www.googletagmanager.com https://cdn.jsdelivr.net https://neoworkly.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://consentcdn.cookiebot.com https://*.google-analytics.com https://*.analytics.google.com https://neoworkly.com",
    "frame-src 'self' https://consent.cookiebot.com https://consentcdn.cookiebot.com",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'"
  ].join('; '));
  next();
});`;

const NEW = `// ── Bezpečnostné hlavičky (HSTS, COOP, CSP vynucujúca) ──────────────
// Roky bežala len ako Report-Only (main-app-patches/62, 68) -- zoznam
// domén bol overený proti všetkým externým zdrojom v appke, teraz sa
// vynucuje.
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://consent.cookiebot.com https://consentcdn.cookiebot.com https://www.googletagmanager.com https://cdn.jsdelivr.net https://neoworkly.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://consentcdn.cookiebot.com https://*.google-analytics.com https://*.analytics.google.com https://neoworkly.com",
    "frame-src 'self' https://consent.cookiebot.com https://consentcdn.cookiebot.com",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'"
  ].join('; '));
  next();
});

// /api/* odpovede môžu nosiť osobné/platobné dáta (profil, kurzy, kvízy,
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

const count = src.split(OLD).length - 1;
if (count !== 1) { console.error('❌ Kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil. Pošli mi aktuálny obsah, over.'); process.exit(1); }

src = src.replace(OLD, () => NEW);

const backup = SERVER_PATH + '.pre-234-api-cache-control-no-store-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, src);
console.log('✅ server.js prepísaný (všetky /api/* odpovede teraz majú Cache-Control: no-store). Záloha:', backup);
console.log('');
console.log('Over: node -c server.js');
console.log('Reštart: pm2 restart <meno procesu hlavnej appky>');
