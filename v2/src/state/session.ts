/**
 * Auth session store — a tiny useSyncExternalStore-backed store with NO
 * Firebase import. The shell subscribes to this synchronously; the actual
 * Firebase auth listener is attached later by lib/authWatch.ts (dynamically
 * imported after first paint), which pushes into this store.
 *
 * v2 law: the app tree NEVER waits for auth. `status: 'unknown'` renders an
 * optimistically-neutral shell, then resolves. The family-alpha-only access
 * states never carry identity, so no data hook can run before claim approval.
 */
import { useSyncExternalStore } from 'react'

export type SessionUser = {
  uid: string
  displayName: string | null
  photoURL: string | null
}

export type Session =
  | { status: 'unknown'; user: null }
  | { status: 'access-checking'; user: null }
  | { status: 'access-pending'; user: null; reason: 'not-approved' | 'unavailable' }
  | { status: 'signed-out'; user: null }
  | { status: 'signed-in'; user: SessionUser }

let session: Session = { status: 'unknown', user: null }
const listeners = new Set<() => void>()

export function setSession(next: Session): void {
  session = next
  listeners.forEach(l => l())
}

export function getSession(): Session {
  return session
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useSession(): Session {
  return useSyncExternalStore(subscribe, getSession, getSession)
}

/** The uid, or throw — data mutations must never run signed-out. */
export function requireUid(): string {
  if (session.status !== 'signed-in') throw new Error('Not signed in')
  return session.user.uid
}
