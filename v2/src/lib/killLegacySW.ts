/**
 * Exorcise the v1 service worker.
 *
 * v2 ships NO service worker. But v1 registered an aggressive network-first SW
 * (`sw.js` via `register-sw.js`) that, once installed on an origin, keeps
 * intercepting every request and serving v1's cached bundle — so v2 never
 * loads. This bit the owner on localhost (v1 dev also used :5173) and would
 * bite every existing v1 user at prod cutover, since the SW lives on the real
 * domain until something unregisters it.
 *
 * On boot we unregister any controlling worker and drop the caches it owns.
 * The page currently controlled by the old SW needs ONE more reload to come
 * back fully clean; after that this keeps the origin SW-free. We deliberately
 * do NOT touch IndexedDB (that's Firestore's offline cache).
 */
const RELOAD_FLAG = 'this-is:v2:sw-reloaded'

export function killLegacyServiceWorker(): void {
  if (typeof navigator === 'undefined') return
  try {
    navigator.serviceWorker?.getRegistrations().then(regs => {
      let hadOne = false
      for (const reg of regs) {
        hadOne = true
        void reg.unregister()
      }
      if (!hadOne) return
      if (typeof caches !== 'undefined') {
        void caches.keys().then(keys => keys.forEach(k => void caches.delete(k)))
      }
      // The dead SW still controls this page; reload once to escape it. A
      // sessionStorage one-shot guarantees at most one auto-reload per tab, so
      // a slow unregister can never spin into a reload loop.
      const alreadyReloaded = (() => {
        try { return sessionStorage.getItem(RELOAD_FLAG) === '1' } catch { return true }
      })()
      if (navigator.serviceWorker.controller && !alreadyReloaded) {
        try { sessionStorage.setItem(RELOAD_FLAG, '1') } catch { /* ignore */ }
        window.location.reload()
      }
    }).catch(() => { /* SW API unavailable — nothing to clean */ })
  } catch {
    /* ignore */
  }
}
