/**
 * Firebase bootstrap — the only module that touches firebase/app config.
 *
 * v2 laws encoded here:
 *  - `persistentLocalCache` from day one: Firestore IS the cache. No ad-hoc
 *    localStorage mirrors of documents, no in-memory service caches, no
 *    CustomEvent bus. (The 12 cache layers of v1 do not exist here.)
 *  - This module is only ever reached through dynamic import (see authWatch
 *    and the data/ modules, all behind lazy routes) so the entry chunk stays
 *    free of the Firebase SDK and the shell paints before auth resolves.
 *  - Same Firebase project as v1 (`this-is-76332`); v2 lives in new
 *    subcollections (`users/{uid}/boards|pins`) and `g:`-prefixed place docs,
 *    so the two apps coexist until cutover.
 */
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})

export const auth = getAuth(app)

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

export default app
