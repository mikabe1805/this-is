import { arrayRemove, arrayUnion, doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebaseImpl'
import { requireUid } from '../state/session'
import type { FriendUser } from './social'

export interface UserDoc {
  onboardedAt?: number
  /** Vibe tags chosen at onboarding — seeds the taste vector before any saves. */
  tasteSeed?: string[]
  homeCity?: string
  handle?: string
  displayName?: string
  avatarHex?: string
  /** Whom you see in your feed. */
  following?: string[]
  seededFollows?: boolean
}

/** Three seed tastemakers a new user auto-follows so the feed is never empty
 *  (the honest "meet the locals" cold-start — removable in Settings). */
export const TASTEMAKERS = ['demo-vivian', 'demo-uri', 'demo-sam']

/** The avatar colors a user can pick from — muted so white initials read on
 *  every one, and none stray into the reserved madder action hue. */
export const AVATAR_PALETTE = [
  '#8E5A6B', '#5A6B8E', '#6B8E5A', '#8E7A5A', '#7A5A8E', '#5A8E86', '#8E6A5A', '#6A5A8E',
]

/** Deterministic avatar color from a uid. */
export function avatarHexFor(uid: string): string {
  let h = 0
  for (const c of uid) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}

/** On sign-in: fill in a handle/name/avatar and, once, seed the tastemaker
 *  follows. Merge never clobbers a field the user already has. Returns true if
 *  it issued a write (new user / new follows) so the caller can refresh the
 *  user doc + feed; a swallowed write failure still returns true (the caller's
 *  refresh is then a harmless no-op). Offline / denied reads are swallowed —
 *  sign-in must never reject on this. */
export async function ensureProfile(
  uid: string,
  displayName: string | null,
): Promise<boolean> {
  let d: UserDoc = {}
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    d = snap.exists() ? (snap.data() as UserDoc) : {}
  } catch {
    return false // offline / denied — persistence will flush a later write
  }
  const patch: Record<string, unknown> = {}
  if (!d.handle) patch.handle = '@' + (displayName?.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'friend')
  if (!d.displayName) patch.displayName = displayName || 'You'
  if (!d.avatarHex) patch.avatarHex = avatarHexFor(uid)
  if (!d.seededFollows) {
    patch.following = arrayUnion(...TASTEMAKERS)
    patch.seededFollows = true
  }
  if (!Object.keys(patch).length) return false
  await setDoc(doc(db, 'users', uid), patch, { merge: true }).catch(() => {})
  return true
}

/** Follow each other (an invite link makes both sides friends). */
export async function addMutualFollow(otherUid: string): Promise<void> {
  const uid = requireUid()
  if (!otherUid || otherUid === uid) return
  await Promise.all([
    setDoc(doc(db, 'users', uid), { following: arrayUnion(otherUid) }, { merge: true }),
    setDoc(doc(db, 'users', otherUid), { following: arrayUnion(uid) }, { merge: true }),
  ])
}

export async function unfollow(otherUid: string): Promise<void> {
  const uid = requireUid()
  await setDoc(doc(db, 'users', uid), { following: arrayRemove(otherUid) }, { merge: true })
}

/** Resolve a set of uids to display name + avatar (for the following list). */
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
  await setDoc(doc(db, 'users', uid), clean, { merge: true })
}

export async function completeOnboarding(
  tasteSeed: string[],
  homeCityKey?: string
): Promise<void> {
  const uid = requireUid()
  await setDoc(
    doc(db, 'users', uid),
    {
      onboardedAt: Date.now(),
      tasteSeed,
      ...(homeCityKey ? { homeCity: homeCityKey } : {}),
    },
    { merge: true }
  )
}
