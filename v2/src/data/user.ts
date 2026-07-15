import { doc, getDoc, runTransaction, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebaseImpl'
import { requireUid } from '../state/session'
import type { FriendUser } from './social'

export interface UserDoc {
  onboardedAt?: number
  handle?: string
  displayName?: string
  avatarHex?: string
  /** Legacy pre-connection circle, retained only during reset migration. */
  following?: string[]
  /** Legacy marker from the July 2 demo-follow cold start. */
  seededFollows?: boolean
}

/** Avatar discs — warm night-salon tones drawn from the oxblood family and
 *  differentiated by value/warmth rather than rainbow identity hue, so people
 *  stay recognizable without breaking the one-accent system. White initials read
 *  on every one; none is the reserved madder action hue (#c13b4c). */
export const AVATAR_PALETTE = [
  '#6b333c', '#83493f', '#5e4a53', '#54473d', '#7c3f4c', '#4c3944', '#6f5a50', '#875043',
]

/** Deterministic avatar color from a uid. */
export function avatarHexFor(uid: string): string {
  let h = 0
  for (const c of uid) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}

/** On sign-in: fill in a handle/name/avatar. Merge never clobbers a field the
 *  user already has. Returns true only after a confirmed write so the caller can
 *  refresh the user document. Offline / denied reads and writes are swallowed —
 *  sign-in must never reject on this background convenience. */
export async function ensureProfile(
  uid: string,
  displayName: string | null,
): Promise<boolean> {
  let d: UserDoc = {}
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    d = snap.exists() ? (snap.data() as UserDoc) : {}
  } catch {
    return false
  }
  const patch: Record<string, unknown> = {}
  if (!d.handle) patch.handle = '@' + (displayName?.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'friend')
  if (!d.displayName) patch.displayName = displayName || 'You'
  if (!d.avatarHex) patch.avatarHex = avatarHexFor(uid)
  if (!Object.keys(patch).length) return false
  try {
    await setDoc(doc(db, 'users', uid), patch, { merge: true })
    return true
  } catch {
    return false
  }
}

/** Resolve connected uids to the small profile shown in Together and People. */
export async function fetchUsers(uids: string[]): Promise<FriendUser[]> {
  const out = await Promise.all(
    uids.map(async uid => {
      const snap = await getDoc(doc(db, 'users', uid))
      const d = snap.exists() ? (snap.data() as UserDoc) : {}
      return {
        uid,
        handle: d.handle,
        displayName: d.displayName ?? d.handle ?? 'Someone',
        avatarHex: d.avatarHex ?? avatarHexFor(uid),
      }
    })
  )
  return out
}

/** Edit your own profile — the name + avatar friends recognize you by. Only the
 *  provided, non-empty fields are written; merge keeps everything else. */
export async function updateProfile(patch: {
  displayName?: string
  avatarHex?: string
}): Promise<void> {
  const uid = requireUid()
  const clean: Record<string, unknown> = {}
  const name = patch.displayName?.trim()
  if (name) clean.displayName = name
  if (patch.avatarHex) clean.avatarHex = patch.avatarHex
  if (!Object.keys(clean).length) return
  const ref = doc(db, 'users', uid)
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref)
    const current = snapshot.exists() ? snapshot.data() as UserDoc : {}
    const alreadyExact = Object.entries(clean).every(([key, value]) => current[key as keyof UserDoc] === value)
    if (alreadyExact) return
    transaction.set(ref, clean, { merge: true })
  })
}

export async function completeOnboarding(): Promise<number> {
  const uid = requireUid()
  const ref = doc(db, 'users', uid)
  return runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref)
    const current = snapshot.exists() ? snapshot.data() as UserDoc : {}
    if (current.onboardedAt) return current.onboardedAt
    const onboardedAt = Date.now()
    transaction.set(ref, { onboardedAt }, { merge: true })
    return onboardedAt
  })
}
