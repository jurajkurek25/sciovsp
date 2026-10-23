// public/sw.js zachytáva VŠETKY fetch requesty vrátane cudzích domén
// (cdn.jsdelivr.net pre supabase-js, consent.cookiebot.com,
// fonts.googleapis.com, www.googletagmanager.com, videos.jurajkurek.com).
// Pre tie, ktoré nespadajú do žiadnej konkrétnej vetvy, SW zavolá vlastný
// fetch(request) -- a TOTO volanie podlieha CSP smernici connect-src, nie
// script-src/style-src/media-src, akou by sa riadilo natívne <script>/
// <link>/<video> načítanie bez service workera. Keďže connect-src tieto
// domény (zámerne) nepovoľuje, SW ich potichu zablokuje -> ERR_FAILED na
// Cookiebot, supabase-js (čím padne celý kurz-detail.js), Google Fonts,
// GTM aj video.
//
// Potvrdené naživo cez DevTools Console (presne tieto hlášky):
//   "Fetch API cannot load https://fonts.googleapis.com/... Refused to
//    connect because it violates the document's Content Security Policy."
//   Uncaught TypeError: Cannot read properties of undefined (reading
//   'createClient') at kurz-detail.js:4 (window.supabase bolo undefined,
//   lebo supabase-js@2 z cdn.jsdelivr.net sa nenačítal)
//
// Oprava: SW nech sa cudzích domén vôbec nedotýka -- ak event.respondWith()
// nezavoláme, prehliadač request spracuje úplne natívne/nezávisle od SW,
// teda mimo tohto CSP connect-src quirku. Rieši to natrvalo pre VŠETKY
// súčasné aj budúce cudzie domény naraz (namiesto pridávania jednej
// domény za druhou do connect-src).
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/245-sw-ignore-cross-origin.js

const fs = require('fs');
const path = require('path');

const FILE = path.join(process.cwd(), 'public', 'sw.js');

if (!fs.existsSync(FILE)) {
  console.error('❌ Nenašiel som súbor:', FILE, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.245-sw-ignore-cross-origin-lock');
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (' + LOCK + '). Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

function replaceOnce(src, oldStr, newStr, label) {
  const count = src.split(oldStr).length - 1;
  if (count !== 1) {
    console.error('❌ ' + label + ' — kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil.');
    process.exit(1);
  }
  return src.replace(oldStr, () => newStr);
}

let src = fs.readFileSync(FILE, 'utf8');

if (src.includes('vsp-v3')) {
  console.error('❌ sw.js: už je aplikované (nájdené vsp-v3), nič som nezmenil.');
  process.exit(1);
}

// 1) Bump cache version, aby sa aktívnym klientom vynútil activate/skipWaiting.
src = replaceOnce(src,
  `const CACHE_VERSION = 'vsp-v2';`,
  `const CACHE_VERSION = 'vsp-v3';`,
  'CACHE_VERSION bump');

// 2) Cudzie domény -- vôbec nezasahovať, nechať prehliadač nech ich
// spracuje natívne. Zároveň odstránené teraz-mŕtve vetvenie pre
// supabase.co/stripe.com/anthropic.com (tie boli a sú vždy cross-origin,
// takže ich teraz vybaví už tento skorší návrat).
const OLD = `self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // API volania — vždy network (nikdy cache)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline — API nedostupné.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Supabase / Stripe / externé API — vždy network
  if (url.hostname.includes('supabase.co') ||
      url.hostname.includes('stripe.com') ||
      url.hostname.includes('anthropic.com')) {
    event.respondWith(fetch(request));
    return;
  }

  // Kurzy — vždy network, nikdy cache (prístup ku lekciám je per-užívateľ a mení sa)`;

const NEW = `self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Cudzie domény (Cookiebot, supabase-js z cdn.jsdelivr.net, Google Fonts,
  // GTM, video CDN, ...) -- SW sa ich vôbec nedotýka. Bez event.respondWith()
  // prehliadač request spracuje natívne, mimo CSP connect-src quirku, ktorý
  // by inak SW-ov vlastný fetch() vnútri handlera potichu zablokoval.
  if (url.origin !== self.location.origin) {
    return;
  }

  // API volania — vždy network (nikdy cache)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline — API nedostupné.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Kurzy — vždy network, nikdy cache (prístup ku lekciám je per-užívateľ a mení sa)`;

if (!src.includes(OLD)) {
  console.error('❌ Nenašiel som presnú kotvu fetch handlera. Nič som nezmenil.');
  process.exit(1);
}

src = replaceOnce(src, OLD, NEW, 'sw.js: ignorovanie cudzích domén + odstránenie mŕtveho supabase/stripe/anthropic vetvenia');

const backup = FILE + '.pre-245-sw-ignore-cross-origin-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);

console.log('✅ sw.js opravený — cudzie domény (Cookiebot, supabase-js, fonty, GTM, video) už SW vôbec nezachytáva.');
console.log('   Verzia cache: vsp-v2 -> vsp-v3');
console.log('   Záloha:', backup);
console.log('   Statický súbor -- žiadny pm2 restart netreba. Ale aktívni klienti majú starý SW v pamäti prehliadača:');
console.log('   treba tvrdý refresh (Ctrl+Shift+R) alebo počkať, kým sa SW sám re-aktivuje (bežne pri ďalšej navigácii).');
