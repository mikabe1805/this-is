/**
 * THE save pipeline (v2/FRIENDS.md). One code path: setting your Want / Tried /
 * Loved on a place writes one document to the flat `saves` collection, keyed
 * `{uid}__{g:pid}` so it's idempotent (one save per person per place). Each
 * save denormalizes a minimal place snapshot so the feed, the friend graph,
 * and your Wall all render with zero joins.
 */
import { deleteDoc, doc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebaseImpl'
import { requireUid } from '../state/session'
import type { Tag } from './social'

export interface SaveablePlace {
  /** `g:{place_id}` */
  id: string
  name: string
  primaryType?: string
  neighborhood?: string
  hex: string
  lat?: number
  lng?: number
}

const saveId = (uid: string, placeId: string) => `${uid}__${placeId}`

function snapshotOf(place: SaveablePlace) {
  return {
    name: place.name,
    hex: place.hex,
    ...(place.primaryType ? { primaryType: place.primaryType } : {}),
    ...(place.neighborhood ? { neighborhood: place.neighborhood } : {}),
    ...(typeof place.lat === 'number' && typeof place.lng === 'number'
      ? { lat: place.lat, lng: place.lng }
      : {}),
  }
}

/** Set (or change) your tag on a place. Idempotent per user+place. */
export async function setSave(place: SaveablePlace, tag: Tag, note?: string): Promise<void> {
  const uid = requireUid()
  await setDoc(
    doc(db, 'saves', saveId(uid, place.id)),
    {
      uid,
      placeId: place.id,
      tag,
      ts: Date.now(),
      place: snapshotOf(place),
      ...(note ? { note } : {}),
    },
    { merge: true }
  )
}

/** Remove a place from your Wall entirely. */
export async function clearSave(placeId: string): Promise<void> {
  const uid = requireUid()
  await deleteDoc(doc(db, 'saves', saveId(uid, placeId)))
}

/** Update just the note on an existing save (doesn't bump ts). */
export async function setSaveNote(placeId: string, note: string): Promise<void> {
  const uid = requireUid()
  const trimmed = note.trim()
  await setDoc(
    doc(db, 'saves', saveId(uid, placeId)),
    trimmed ? { note: trimmed } : { note: '' },
    { merge: true }
  )
}
