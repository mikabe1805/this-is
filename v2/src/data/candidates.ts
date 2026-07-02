/**
 * The city candidate pool read seam — the source of *discovery* (places you
 * haven't saved yet), as opposed to your own boards.
 *
 * Populated by the composer trigger (`onPinWrite`, W3-server / cut-order last)
 * or by the owner-import `--city` seed. Until something writes it, this returns
 * an empty list and the Home feed is honestly your-saves-only — never a fake
 * "discover" row. cityKey is derived from the user's coords at runtime (no
 * hardcoded city; the app is global-first).
 */
import { collection, getDocs, limit, query } from 'firebase/firestore'
import { db } from '../lib/firebaseImpl'
import type { Coords } from '../lib/geo'
import type { PlaceDoc } from './types'

/**
 * A coarse geohash-ish cell key from coordinates (~11km at the equator).
 * Deterministic, global, and stable enough to bucket a city without a lookup.
 */
export function cityKeyFrom(coords: Coords | null): string | null {
  if (!coords) return null
  const lat = Math.round(coords.lat * 10) / 10
  const lng = Math.round(coords.lng * 10) / 10
  return `${lat.toFixed(1)}_${lng.toFixed(1)}`
}

export async function fetchCandidates(cityKey: string, max = 60): Promise<PlaceDoc[]> {
  const q = query(collection(db, 'cities', cityKey, 'candidates'), limit(max))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<PlaceDoc, 'id'>) }))
}
