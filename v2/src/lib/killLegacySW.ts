/** Replace v1's origin-wide worker with v2's bounded owned-asset shell.
 * Development remains worker-free so a production cache can never mask HMR.
 * Firestore's separate IndexedDB cache is deliberately untouched. */
const RELOAD_FLAG = 'this-is:v2:sw-reloaded'
const CANONICAL_WORKER_PATH = '/sw-v2.js'
const CANONICAL_CACHE_PREFIX = 'this-is-v2-shell-'

function workerPath(worker: ServiceWorker | null): string | null {
  if (!worker) return null
  try { return new URL(worker.scriptURL).pathname } catch { return null }
}

function registrationPath(registration: ServiceWorkerRegistration): string | null {
  return workerPath(registration.active ?? registration.waiting ?? registration.installing)
}

async function clearCaches(preserveCanonical: boolean): Promise<void> {
  if (typeof caches === 'undefined') return
  const keys = await caches.keys()
  await Promise.all(keys
    .filter(key => !preserveCanonical || !key.startsWith(CANONICAL_CACHE_PREFIX))
    .map(key => caches.delete(key)))
}

export async function prepareCanonicalServiceWorker(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return
  try {
    const production = import.meta.env.PROD
    const registrations = await navigator.serviceWorker.getRegistrations()
    const obsolete = production
      ? registrations.filter(registration => registrationPath(registration) !== CANONICAL_WORKER_PATH)
      : registrations
    const controllerMustGo = Boolean(navigator.serviceWorker.controller
      && (!production || workerPath(navigator.serviceWorker.controller) !== CANONICAL_WORKER_PATH))

    if (obsolete.length > 0) {
      await Promise.all(obsolete.map(registration => registration.unregister()))
    }
    // A previously unregistered worker may still have left Cache Storage behind.
    // Development owns no cache; production preserves only versioned v2 shell caches.
    await clearCaches(production)

    if (controllerMustGo) {
      const alreadyReloaded = (() => {
        try { return sessionStorage.getItem(RELOAD_FLAG) === '1' } catch { return true }
      })()
      if (!alreadyReloaded) {
        try { sessionStorage.setItem(RELOAD_FLAG, '1') } catch { /* ignore */ }
        window.location.reload()
      }
      return
    }

    if (!production) return
    try { sessionStorage.removeItem(RELOAD_FLAG) } catch { /* ignore */ }
    await navigator.serviceWorker.register(CANONICAL_WORKER_PATH, { scope: '/', updateViaCache: 'none' })
  } catch {
    // The online app remains usable when browser policy or private mode denies SW/cache access.
  }
}
