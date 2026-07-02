/**
 * Attaches the Firebase auth listener and mirrors state into the session
 * store. Dynamically imported from App after first paint so the Firebase SDK
 * never rides in the entry chunk.
 */
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from './firebaseImpl'
import { setSession } from '../state/session'

let started = false

export function start(): void {
  if (started) return
  started = true
  onAuthStateChanged(auth, user => {
    if (!user) {
      setSession({ status: 'signed-out', user: null })
      return
    }
    setSession({
      status: 'signed-in',
      user: { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL },
    })
    // Lazily ensure the user doc exists; merge never clobbers.
    void setDoc(
      doc(db, 'users', user.uid),
      { handle: user.displayName ?? 'me', v2At: Date.now() },
      { merge: true }
    ).catch(() => { /* offline is fine; persistence will flush */ })
  })
}

export async function signIn(): Promise<void> {
  const provider = new GoogleAuthProvider()
  try {
    await signInWithPopup(auth, provider)
  } catch (err) {
    // Popups die in installed PWAs and strict mobile browsers — fall back to
    // a full-page redirect. Genuine user cancellations stay cancelled.
    const code = (err as { code?: string }).code ?? ''
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return
    await signInWithRedirect(auth, provider)
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(auth)
}
