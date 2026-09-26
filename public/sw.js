// VSP Tréner — Service Worker
// Verzia cache — zmeň pri každom deploy aby sa aktualizovala appka
const CACHE_VERSION = 'vsp-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

// Súbory ktoré sa cachujú pri inštalácii (app shell)
const PRECACHE_URLS = [
  '/app',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Mono:wght@300;400;500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700&display=swap',
];

// ── Install — predcachuj app shell ────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn('SW: Niektoré súbory sa nepodarilo cachovať:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ── Activate — vymaž staré cache ──────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('vsp-') && key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch — cache stratégia ────────────────────────────────────
self.addEventListener('fetch', event => {
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

  // App shell (/app) — Network first, fallback na cache
  if (url.pathname === '/app' || url.pathname === '/') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match('/app'))
    );
    return;
  }

  // Fonty a statické assets — Cache first
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com') ||
      url.pathname.match(/\.(png|jpg|ico|svg|woff2?)$/)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, response.clone()));
          return response;
        });
      })
    );
    return;
  }

  // Ostatné — Network first
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// ── Push notifikácie (voliteľné, pre budúce SCIO termíny) ─────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'VSP Tréner', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/app' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/app')
  );
});