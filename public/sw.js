const CACHE_NAME = 'mywaze-v1';
const APP_SHELL = [
  '/',
  '/settings',
  '/places',
  '/navigate',
  '/admin',
];

// Install — cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch — network first, fallback to cache; cache map tiles
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Cache map tiles with cache-first strategy
  if (
    url.hostname.includes('basemaps.cartocdn.com') ||
    url.hostname.includes('tile') ||
    url.pathname.match(/\.(png|jpg|pbf|mvt)$/)
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          });
        })
      )
    );
    return;
  }

  // App pages/assets — network first, cache fallback
  if (event.request.mode === 'navigate' || url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Everything else — network only
  event.respondWith(fetch(event.request));
});
