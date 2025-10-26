const CACHE_NAME = 'thisis-cache-v1';
const OFFLINE_URL = '/';

// DEVELOPMENT MODE: Completely bypass service worker caching on localhost
// This prevents stale JavaScript bundles from being cached during development
const isDevelopment = () => {
  try {
    return self.location.hostname === 'localhost' ||
           self.location.hostname === '127.0.0.1' ||
           self.location.hostname === '[::1]' ||
           self.location.port === '5173' ||
           self.location.port === '5174';
  } catch {
    return false;
  }
};

if (isDevelopment()) {
  console.log('[SW] Development mode detected - caching disabled');

  self.addEventListener('install', () => {
    console.log('[SW] Dev install - skipping cache');
    self.skipWaiting();
  });

  self.addEventListener('activate', (event) => {
    console.log('[SW] Dev activate - clearing all caches');
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      self.clients.claim();
    })());
  });

  self.addEventListener('fetch', (event) => {
    // In dev mode, always fetch fresh - never cache
    event.respondWith(fetch(event.request));
  });

  // Stop here - don't register production event listeners
} else {
  // PRODUCTION MODE: Normal service worker behavior
  console.log('[SW] Production mode - caching enabled');

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll([
      '/',
      '/index.html',
      '/assets/leaf.png',
      '/assets/leaf2.png',
      '/assets/leaf3.png'
    ]);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE_NAME ? undefined : caches.delete(k))));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  try {
    const url = new URL(request.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  } catch {
    return;
  }
  event.respondWith((async () => {
    try {
      const fresh = await fetch(request);
      const cache = await caches.open(CACHE_NAME);
      const vary = fresh.headers.get('Vary');
      if (!vary || !vary.includes('*')) {
        try {
          await cache.put(request, fresh.clone());
        } catch (error) {
          // Ignore cache put failures (e.g., opaque responses)
          console.warn('[sw] cache put skipped', error);
        }
      }
      return fresh;
    } catch (_) {
      const cached = await caches.match(request);
      return cached || caches.match(OFFLINE_URL);
    }
  })());
});

} // End production mode


