const BUILD_ID = '__THIS_IS_BUILD_ID__'
const CACHE_PREFIX = 'this-is-v2-shell-'
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_ID}`
const MANIFEST_URL = '/precache-manifest.json'

function isAppNavigation(pathname) {
  if ([
    '/', '/home', '/together', '/search', '/saved', '/people', '/add',
    '/onboarding', '/settings', '/groups/new', '/terms', '/privacy',
  ].includes(pathname)) return true
  return ['/p/', '/i/', '/with/', '/g/', '/gi/'].some(prefix => pathname.startsWith(prefix))
}

function isOwnedStatic(pathname) {
  return pathname.startsWith('/assets/')
    || pathname === '/icon.svg'
    || pathname === '/manifest.webmanifest'
    || pathname === MANIFEST_URL
}

async function offlineShellResponse() {
  const cached = await caches.match('/index.html')
  if (!cached) {
    return new Response('this.is is offline and the app shell is unavailable.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
  const headers = new Headers(cached.headers)
  headers.set('X-This-Is-Offline-Shell', '1')
  return new Response(cached.body, {
    status: cached.status,
    statusText: cached.statusText,
    headers,
  })
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const response = await fetch(MANIFEST_URL, { cache: 'no-store' })
    if (!response.ok) throw new Error('precache-manifest-unavailable')
    const manifest = await response.json()
    if (manifest?.schemaVersion !== 1 || manifest.buildId !== BUILD_ID || !Array.isArray(manifest.assets)) {
      throw new Error('precache-manifest-mismatch')
    }
    const allowed = manifest.assets.every(asset => typeof asset === 'string'
      && (asset === '/index.html' || isOwnedStatic(new URL(asset, self.location.origin).pathname)))
    if (!allowed) throw new Error('precache-manifest-out-of-scope')
    const cache = await caches.open(CACHE_NAME)
    await cache.addAll([...manifest.assets, MANIFEST_URL])
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys
      .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map(key => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    if (!isAppNavigation(url.pathname)) return
    event.respondWith(self.navigator.onLine
      ? fetch(request).catch(() => offlineShellResponse())
      : offlineShellResponse())
    return
  }

  if (!isOwnedStatic(url.pathname)) return
  event.respondWith((async () => {
    const cached = await caches.match(request)
    if (cached) return cached
    // Every legitimate build asset is present in the immutable precache manifest.
    // A missing path may use the network, but it can never expand Cache Storage.
    return fetch(request)
  })())
})
