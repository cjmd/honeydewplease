const CACHE_NAME = 'honeydew-please-v2';
const STATIC_CACHE = [
  '/pwa-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json'
];

// Install - cache only static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.map((key) => key !== CACHE_NAME && caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch - Avoid caching API calls; network-first for HTML/JS/CSS; cache-only for same-origin images/fonts
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, non-http, dev assets
  if (
    request.method !== 'GET' ||
    !url.protocol.startsWith('http') ||
    url.pathname.includes('node_modules') ||
    url.pathname.includes('.vite')
  ) {
    return;
  }

  // Never cache backend/API requests (e.g., Supabase)
  if (url.hostname.includes('supabase.co')) {
    return;
  }
  // Only handle same-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Network first for app shell
  if (
    request.destination === 'document' ||
    request.destination === 'script' ||
    request.destination === 'style'
  ) {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Cache first for static media (same-origin images/fonts)
  if (request.destination === 'image' || request.destination === 'font') {
    event.respondWith(
      caches.match(request)
        .then((cached) => cached || fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
        )
    );
    return;
  }
  // Let everything else pass through without caching
});
