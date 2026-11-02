// Bezpečnostná oprava: Content-Security-Policy bežala roky len v
// Report-Only režime (main-app-patches/62, 68) -- nič neblokovala, len by
// logovala porušenia do konzoly prehliadača (a bez report-uri to nikto
// ani nevidel). Scanner správne nahlásil "Missing CSP header", pretože
// Report-Only sa nepočíta ako skutočná ochrana.
//
// Zoznam domén v politike bol pred prepnutím overený proti VŠETKÝM
// externým zdrojom v public/*.html a celej historii patchov (Cookiebot,
// Google Tag Manager, cdn.jsdelivr.net -- pokrýva supabase-js, chart.js,
// qrcode-generator, fingerprintjs, webgazer, mediapipe, všetko sa
// načítava odtiaľ -- Google Fonts, Supabase REST/realtime, neoworkly
// widget) -- nič sa nemení, len sa prepína Report-Only na vynucujúci
// režim s tým istým, už vyladeným zoznamom.
//
// Kotva je byte-presne overená z tvojho výstupu main-app-patches/230.
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/231-enforce-csp.js
// Potom: pm2 restart <meno procesu hlavnej appky>
//
// PO nasadení preklikaj a sleduj F12 → Console na "Refused to..." hlásenia:
//   - úvodná stránka (/), /blog, /kurzy/:slug (stránka s video kurzom)
//   - prihlásenie (Google login flow)
//   - checkout/kúpa kurzu
// Ak sa niečo zablokuje, pošli mi presné hlásenie z konzoly -- doplním
// chýbajúcu doménu. Rollback: skopíruj zálohu (vypísanú nižšie) späť na
// server.js a reštartuj.

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som server.js — spusti z koreňa hlavnej appky.');
  process.exit(1);
}
let src = fs.readFileSync(SERVER_PATH, 'utf8');

if (src.includes("res.setHeader('Content-Security-Policy',")) {
  console.log('ℹ️  Už je aplikované, preskakujem.');
  process.exit(0);
}

const OLD = `// ── Bezpečnostné hlavičky (HSTS, COOP, CSP zatiaľ len Report-Only) ──
// CSP je v Report-Only režime — nič neblokuje, len loguje porušenia do
// konzoly prehliadača. Až po overení, že sa nič nehlási, sa prepne na
// vynucujúcu Content-Security-Policy hlavičku.
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Content-Security-Policy-Report-Only', [
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
});`;

const count = src.split(OLD).length - 1;
if (count !== 1) { console.error('❌ Kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil. Pošli mi aktuálny obsah, over.'); process.exit(1); }

src = src.replace(OLD, () => NEW);

const backup = SERVER_PATH + '.pre-231-enforce-csp-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, src);
console.log('✅ server.js prepísaný (Content-Security-Policy je teraz vynucujúca, nie len Report-Only). Záloha:', backup);
console.log('');
console.log('Over: node -c server.js');
console.log('Reštart: pm2 restart <meno procesu hlavnej appky>');
console.log('');
console.log('Rollback, ak by niečo prestalo fungovať:');
console.log('  cp ' + backup + ' server.js && pm2 restart <meno procesu hlavnej appky>');
