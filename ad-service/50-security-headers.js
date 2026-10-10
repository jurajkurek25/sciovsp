// Bezpečnostné hlavičky pre ad.sptrener.online -- appka nemala VÔBEC
// žiadne (ani helmet nebol nainštalovaný). Rovnaký vzor ako u main app
// (main-app-patches/62 → 231), dash-service a instructor-service: CSP
// v Report-Only režime, zoznam domén overený proti VŠETKÝM externým
// zdrojom v public/*.html (len fonts.googleapis.com, žiadne CDN skripty).
//
// X-Frame-Options, X-Content-Type-Options, X-XSS-Protection,
// Referrer-Policy a X-Permitted-Cross-Domain-Policies NEnecháva
// nastavovať helmet -- globálny /etc/nginx/nginx.conf na tomto serveri
// (platí pre VŠETKY stránky na stroji, nielen túto appku) ich už posiela
// sám, takže by sa inak zdvojili/konfliktovali. HSTS a CSP nginx globálne
// NEnastavuje (sú v nginx.conf zakomentované), takže tie appka nastaví
// sama bez rizika duplicity.
//
// Vyžaduje: npm install helmet@^8.0.0 --save   (spusti PRED týmto patchom)
//
// Spusti z koreňa tejto appky:
//   node 50-security-headers.js
// Potom: pm2 restart sptrener-ads

const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.50-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK zo zlyhaneho behu (' + LOCK + ' existuje). Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

let src = fs.readFileSync(FILE, 'utf8');

if (src.includes("require('helmet')")) {
  console.error('Uz je aplikovane (najdeny require helmet), nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error('❌ ' + label + ' kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil. Pošli mi aktuálny obsah, over.'); process.exit(1); }
  return s.replace(oldStr, () => newStr);
}

// ── 1) require('helmet') hneď za require('express') ──────────────────────
const REQUIRE_ANCHOR = `const express = require('express');\nconst path = require('path');`;
src = replaceOnce(src, REQUIRE_ANCHOR,
  `const express = require('express');\nconst helmet = require('helmet');\nconst path = require('path');`,
  '1: require(helmet)');

// ── 2) Hlavičky hneď za const app = express(); ────────────────────────────
const APP_ANCHOR = `const app = express();\n\n// Stripe webhook potrebuje surové telo requestu na overenie podpisu —`;
const HEADERS_BLOCK = `const app = express();
// Za CloudPanel/Nginx (jeden lokálny reverse proxy hop) -- správne req.ip
// pre logy a prípadný budúci rate-limiting.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet({ contentSecurityPolicy: false, xFrameOptions: false, xContentTypeOptions: false, xXssProtection: false, referrerPolicy: false, xPermittedCrossDomainPolicies: false }));
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy-Report-Only', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://sptrener.online",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'"
  ].join('; '));
  next();
});

// Stripe webhook potrebuje surové telo requestu na overenie podpisu —`;
src = replaceOnce(src, APP_ANCHOR, HEADERS_BLOCK, '2: helmet/CSP middleware (anchor: const app = express())');

const backup = FILE + '.pre-50-security-headers-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);
console.log('✅ server.js prepísaný (helmet + CSP Report-Only + HSTS). Záloha:', backup);
console.log('');
console.log('Over: node -c server.js');
console.log('Reštart: pm2 restart sptrener-ads');
console.log('');
console.log('Po reštarte preklikaj landing/dashboard/platbu a sleduj F12 → Console na "Refused to...".');
