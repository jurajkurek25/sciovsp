const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

const L = (...lines) => lines.join('\n');

if (src.includes('Content-Security-Policy-Report-Only')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const OLD = L(
  "  if (req.method === 'OPTIONS') return res.sendStatus(204);",
  "  next();",
  "});",
  "",
  "// ── Statické súbory ───────────────────────────────────────────"
);

const NEW = L(
  "  if (req.method === 'OPTIONS') return res.sendStatus(204);",
  "  next();",
  "});",
  "",
  "// ── Bezpečnostné hlavičky (HSTS, COOP, CSP zatiaľ len Report-Only) ──",
  "// CSP je v Report-Only režime — nič neblokuje, len loguje porušenia do",
  "// konzoly prehliadača. Až po overení, že sa nič nehlási, sa prepne na",
  "// vynucujúcu Content-Security-Policy hlavičku.",
  "app.use((req, res, next) => {",
  "  res.setHeader('Strict-Transport-Security', 'max-age=31536000');",
  "  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');",
  "  res.setHeader('Content-Security-Policy-Report-Only', [",
  "    \"default-src 'self'\",",
  "    \"script-src 'self' 'unsafe-inline' https://consent.cookiebot.com https://www.googletagmanager.com https://cdn.jsdelivr.net https://neoworkly.com\",",
  "    \"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com\",",
  "    \"font-src 'self' https://fonts.gstatic.com\",",
  "    \"img-src 'self' data: https:\",",
  "    \"connect-src 'self' https://*.supabase.co wss://*.supabase.co https://consentcdn.cookiebot.com https://*.google-analytics.com https://*.analytics.google.com https://neoworkly.com\",",
  "    \"frame-src 'self' https://consent.cookiebot.com\",",
  "    \"frame-ancestors 'self'\",",
  "    \"object-src 'none'\",",
  "    \"base-uri 'self'\"",
  "  ].join('; '));",
  "  next();",
  "});",
  "",
  "// ── Statické súbory ───────────────────────────────────────────"
);

const patched = replaceOnce(src, OLD, NEW, 'security headers insertion point');

const backup = FILE + '.pre-security-headers-csp-report-only-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
