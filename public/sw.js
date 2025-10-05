const CACHE_NAME = 'thisis-cache-v1';
const OFFLINE_URL = '/';

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
  event.respondWith((async () => {
    try {
      const fresh = await fetch(request);
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, fresh.clone());
      return fresh;
    } catch (_) {
      const cached = await caches.match(request);
      return cached || caches.match(OFFLINE_URL);
    }
  })());
});


