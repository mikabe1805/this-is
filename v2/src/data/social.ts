/** Flat personal save reads. */
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../lib/firebaseImpl'
import type { FriendSave, Tag } from '../domain/signals'
import { categoryPrimaryType, isDurablePlaceMemory } from '../domain/placeMemory'
import { normalizePlaceObservations } from '../domain/placeObservations'

export type { FriendSave, FriendUser, PlaceSnapshot, SignalVisibility, Tag } from '../domain/signals'

function shape(docs: { id: string; data: () => Record<string, unknown> }[]): FriendSave[] {
  return docs.map(d => {
    const data = d.data()
    const memory = isDurablePlaceMemory(data.memory) ? data.memory : undefined
    const observationAudience = data.includeObservations === true ? 'group' : 'private'
    const observations = normalizePlaceObservations(data.observations, observationAudience)
    return {
      id: d.id,
      uid: String(data.uid ?? ''),
      placeId: String(data.placeId ?? ''),
      tag: (data.tag as Tag) ?? 'want',
      visibility: data.visibility === 'circle' ? 'circle' : 'private',
      note: data.note as string | undefined,
      ...(observations && Object.keys(observations).length > 0 ? { observations } : {}),
      ts: Number(data.ts ?? 0),
      memory,
      place: memory ? {
        name: memory.label,
        primaryType: categoryPrimaryType(memory.category),
        hex: memory.hex,
      } : undefined,
    }
  })
}

/** All of your own signals, regardless of visibility. */
export async function fetchMySaves(uid: string): Promise<FriendSave[]> {
  const snap = await getDocs(query(collection(db, 'saves'), where('uid', '==', uid)))
  return shape(snap.docs).sort((a, b) => b.ts - a.ts)
}
