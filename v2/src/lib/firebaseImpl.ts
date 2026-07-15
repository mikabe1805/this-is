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
 *  - The target project is build-explicit. Local work is demo-emulator-only;
 *    family alpha must use a separate project; the legacy project remains a
 *    production cutover concern rather than a development default.
 */
import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string
const emulatorBuild = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'
const releaseChannel = import.meta.env.VITE_RELEASE_CHANNEL as string | undefined

if (releaseChannel === 'family-alpha'
  && (emulatorBuild || projectId === 'this-is-76332' || projectId === 'demo-this-is-v2')) {
  throw new Error('Unsafe family-alpha Firebase target.')
}

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})

export const auth = getAuth(app)

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

// An explicit build flag lets the production bundle itself be exercised against
// local services. Normal builds omit the flag and continue to use Firebase.
if (emulatorBuild) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9199', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8180)
}

export default app
