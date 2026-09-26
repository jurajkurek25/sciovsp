const fs = require('fs');
const FILE = 'public/sw.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("vsp-v2")) {
  console.error('Uz je aplikovane (najdene vsp-v2), nic som nezmenil.');
  process.exit(1);
}

// 1) Bump cache version so every old cached entry gets invalidated on next activate.
const VER_OLD = `const CACHE_VERSION = 'vsp-v1';`;
const VER_NEW = `const CACHE_VERSION = 'vsp-v2';`;
if (!src.includes(VER_OLD)) { console.error('Nenasiel som CACHE_VERSION kotvu. Nic som nezmenil.'); process.exit(1); }

// 2) Course pages must always be fresh — never served from cache.
const ROUTE_OLD = `  // Supabase / Stripe / externé API — vždy network
  if (url.hostname.includes('supabase.co') ||
      url.hostname.includes('stripe.com') ||
      url.hostname.includes('anthropic.com')) {
    event.respondWith(fetch(request));
    return;
  }`;
const ROUTE_NEW = `  // Supabase / Stripe / externé API — vždy network
  if (url.hostname.includes('supabase.co') ||
      url.hostname.includes('stripe.com') ||
      url.hostname.includes('anthropic.com')) {
    event.respondWith(fetch(request));
    return;
  }

  // Kurzy — vždy network, nikdy cache (prístup ku lekciám je per-užívateľ a mení sa)
  if (url.pathname.startsWith('/kurzy')) {
    event.respondWith(fetch(request));
    return;
  }`;
if (!src.includes(ROUTE_OLD)) { console.error('Nenasiel som Supabase/Stripe kotvu. Nic som nezmenil.'); process.exit(1); }

const patched = src.replace(VER_OLD, VER_NEW).replace(ROUTE_OLD, ROUTE_NEW);

const backup = FILE + '.pre-fix-sw-cache-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
