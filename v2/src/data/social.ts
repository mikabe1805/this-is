/**
 * The friend graph — "discovery of friends' tastes" (v2/FRIENDS.md).
 *
 * A flat top-level `saves` collection is the connective tissue: every Want /
 * Tried / Loved is one document, so the friend feed and a place's "who's been
 * here" are each a single query. Places resolve against the curated catalog
 * (and later a general places doc); users resolve to name + avatar color.
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
    }
  })
}

/** Who saved this place, and what they thought — Loved first. */
export async function fetchPlaceSaves(placeId: string): Promise<FriendSave[]> {
  const snap = await getDocs(query(collection(db, 'saves'), where('placeId', '==', placeId)))
  const saves = shape(snap.docs)
  const users = await resolveUsers(saves.map(s => s.uid))
  return saves
    .map(s => ({ ...s, user: users.get(s.uid) }))
    .sort((a, b) => TAG_RANK[a.tag] - TAG_RANK[b.tag] || b.ts - a.ts)
}

/** The friend feed — the timeline of your circle's nights out, most recent first. */
export async function fetchFriendFeed(max = 30): Promise<FriendSave[]> {
  const snap = await getDocs(
    query(collection(db, 'saves'), orderBy('ts', 'desc'), fbLimit(max))
  )
  const saves = shape(snap.docs)
  const users = await resolveUsers(saves.map(s => s.uid))
  return saves.map(s => ({ ...s, user: users.get(s.uid) }))
}
