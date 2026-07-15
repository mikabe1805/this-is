/**
 * Attaches the Firebase auth listener and mirrors state into the session
 * store. Dynamically imported from App after first paint so the Firebase SDK
 * never rides in the entry chunk.
 */
import {
  getIdTokenResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  onIdTokenChanged,
  reauthenticateWithPopup,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth'
import { auth } from './firebaseImpl'
import { setSession } from '../state/session'
import { ensureProfile } from '../data/user'
import { queryClient } from './queryClient'
import { hasFamilyAlphaAccess, isFamilyAlphaRelease } from '../domain/familyAlphaAccess'

let started = false
let authRevision = 0
let profileStartedForUid: string | null = null
let admittedUid: string | null = null
const familyAlphaRelease = isFamilyAlphaRelease(import.meta.env.VITE_RELEASE_CHANNEL)

function isCurrentAttempt(user: User, revision: number): boolean {
  return authRevision === revision && auth.currentUser === user
}

function admitUser(user: User): void {
  admittedUid = user.uid
  setSession({
    status: 'signed-in',
    user: { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL },
  })
  if (profileStartedForUid === user.uid) return
  profileStartedForUid = user.uid
  // A family-alpha identity reaches Firestore only after its claim is proven.
  // Canonical builds retain their existing profile bootstrap behavior.
  void ensureProfile(user.uid, user.displayName)
    .then(changed => {
      if (!changed) return
      void queryClient.invalidateQueries({ queryKey: ['userDoc'] })
    })
    .catch(() => {
      // The normal data surfaces own their recoverable read/write states.
    })
}

async function checkFamilyAlphaAccess(
  user: User,
  forceRefresh: boolean,
  revision: number,
): Promise<void> {
  try {
    const token = await getIdTokenResult(user, forceRefresh)
    if (!isCurrentAttempt(user, revision)) return
    if (!hasFamilyAlphaAccess(token.claims)) {
      queryClient.clear()
      admittedUid = null
      setSession({ status: 'access-pending', user: null, reason: 'not-approved' })
      return
    }
    admitUser(user)
  } catch {
    if (!isCurrentAttempt(user, revision)) return
    queryClient.clear()
    admittedUid = null
    setSession({ status: 'access-pending', user: null, reason: 'unavailable' })
  }
}

function receiveAuthUser(user: User | null): void {
  const revision = ++authRevision
  if (!user) {
    profileStartedForUid = null
    admittedUid = null
    if (familyAlphaRelease) queryClient.clear()
    setSession({ status: 'signed-out', user: null })
    return
  }
  if (!familyAlphaRelease) {
    admitUser(user)
    return
  }
  if (admittedUid && admittedUid !== user.uid) queryClient.clear()
  setSession({ status: 'access-checking', user: null })
  void checkFamilyAlphaAccess(user, false, revision)
}

export function start(): void {
  if (started) return
  started = true
  if (familyAlphaRelease) {
    // Unlike the canonical listener, this also re-checks access when Firebase
    // rotates a token. Revocation therefore fails closed on the next refresh.
    onIdTokenChanged(auth, receiveAuthUser)
    return
  }
  onAuthStateChanged(auth, receiveAuthUser)
}

/** Force a new token after the preview owner adds the reviewed custom claim. */
export async function refreshFamilyAlphaAccess(): Promise<void> {
  if (!familyAlphaRelease) return
  const user = auth.currentUser
  const revision = ++authRevision
  if (!user) {
    queryClient.clear()
    admittedUid = null
    setSession({ status: 'signed-out', user: null })
    return
  }
  setSession({ status: 'access-checking', user: null })
  await checkFamilyAlphaAccess(user, true, revision)
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

export async function reauthenticateUser(): Promise<void> {
  if (!auth.currentUser) throw new Error('authentication-required')
  await reauthenticateWithPopup(auth.currentUser, new GoogleAuthProvider())
}
