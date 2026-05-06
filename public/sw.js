const CACHE_VERSION = '0.1.55';
const CACHE_NAME = 'stu-face-' + CACHE_VERSION;

// Install — wait for SKIP_WAITING message from client
self.addEventListener('install', () => {
  console.log('[SW] Installed', CACHE_VERSION);
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activate — purge old caches, claim clients
self.addEventListener('activate', (event) => {
  console.log('[SW] Activated', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — Network first for navigation & API, stale-while-revalidate for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, chrome-extension, etc.
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // Never cache API routes
  if (url.pathname.startsWith('/api/')) return;

  // Navigation — network first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Next.js hashed assets (/_next/static/) — cache first (immutable)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            cache.put(request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // Other assets — network first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request))
  );
});
