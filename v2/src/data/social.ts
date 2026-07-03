/**
 * The friend graph — "discovery of friends' tastes" (v2/FRIENDS.md).
 *
 * A flat top-level `saves` collection is the connective tissue: every Want /
 * Tried / Loved is one document, so the friend feed, a place's "who's been
 * here", and your own Wall are each a single query. Each save DENORMALIZES a
 * minimal place snapshot so every surface renders with zero joins.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { db } from '../lib/firebaseImpl'

export type Tag = 'want' | 'tried' | 'loved'

export interface PlaceSnapshot {
  name: string
  primaryType?: string
  neighborhood?: string
  hex: string
  lat?: number
  lng?: number
}

export interface FriendUser {
  uid: string
  handle?: string
  displayName: string
  avatarHex: string
}

export interface FriendSave {
  id: string
  uid: string
  placeId: string
  tag: Tag
  note?: string
  ts: number
  place?: PlaceSnapshot
  user?: FriendUser
}

const TAG_RANK: Record<Tag, number> = { loved: 0, tried: 1, want: 2 }

async function resolveUsers(uids: string[]): Promise<Map<string, FriendUser>> {
  const uniq = [...new Set(uids)]
  const entries = await Promise.all(
    uniq.map(async uid => {
      const snap = await getDoc(doc(db, 'users', uid))
      const d = snap.exists() ? (snap.data() as Record<string, unknown>) : {}
      return [
        uid,
        {
          uid,
          handle: d.handle as string | undefined,
          displayName: (d.displayName as string) ?? (d.handle as string) ?? 'Someone',
          avatarHex: (d.avatarHex as string) ?? '#5A6B8E',
        },
      ] as const
    })
  )
  return new Map(entries)
}

function shape(docs: { id: string; data: () => Record<string, unknown> }[]): FriendSave[] {
  return docs.map(d => {
    const data = d.data()
    return {
      id: d.id,
      uid: String(data.uid ?? ''),
      placeId: String(data.placeId ?? ''),
      tag: (data.tag as Tag) ?? 'want',
      note: data.note as string | undefined,
      ts: Number(data.ts ?? 0),
      place: data.place as PlaceSnapshot | undefined,
    }
  })
}

/** Who saved this place, and what they thought — Loved first. Includes you. */
export async function fetchPlaceSaves(placeId: string): Promise<FriendSave[]> {
  const snap = await getDocs(query(collection(db, 'saves'), where('placeId', '==', placeId)))
  const saves = shape(snap.docs)
  const users = await resolveUsers(saves.map(s => s.uid))
  return saves
    .map(s => ({ ...s, user: users.get(s.uid) }))
    .sort((a, b) => TAG_RANK[a.tag] - TAG_RANK[b.tag] || b.ts - a.ts)
}

/** The friend feed — your circle's nights out, newest first, minus your own. */
export async function fetchFriendFeed(excludeUid?: string, max = 40): Promise<FriendSave[]> {
  const snap = await getDocs(
    query(collection(db, 'saves'), orderBy('ts', 'desc'), fbLimit(max + 10))
  )
  const saves = shape(snap.docs).filter(s => s.uid !== excludeUid).slice(0, max)
  const users = await resolveUsers(saves.map(s => s.uid))
  return saves.map(s => ({ ...s, user: users.get(s.uid) }))
}

/** Your Wall — everywhere you Want/Tried/Loved, newest first. */
export async function fetchMySaves(uid: string): Promise<FriendSave[]> {
  const snap = await getDocs(query(collection(db, 'saves'), where('uid', '==', uid)))
  return shape(snap.docs).sort((a, b) => b.ts - a.ts)
}
