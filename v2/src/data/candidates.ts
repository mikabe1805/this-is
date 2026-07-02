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

/** The user's cell plus its 8 neighbors — pool reads must not die at a cell
 *  boundary (Piscataway sits right on one). */
export function cityKeysAround(coords: Coords | null): string[] {
  if (!coords) return []
  const keys: string[] = []
  for (let dLat = -1; dLat <= 1; dLat++) {
    for (let dLng = -1; dLng <= 1; dLng++) {
      const lat = Math.round((coords.lat + dLat * 0.1) * 10) / 10
      const lng = Math.round((coords.lng + dLng * 0.1) * 10) / 10
      keys.push(`${lat.toFixed(1)}_${lng.toFixed(1)}`)
    }
  }
  return keys
}

export async function fetchCandidates(cityKeys: string[], maxPerCell = 60): Promise<PlaceDoc[]> {
  const cells = await Promise.all(
    cityKeys.map(async key => {
      const q = query(collection(db, 'cities', key, 'candidates'), limit(maxPerCell))
      const snap = await getDocs(q)
      return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<PlaceDoc, 'id'>) }))
    })
  )
  return cells.flat()
}

/**
 * The curated catalog — the hand-picked low-lit rooms that ARE the discovery
 * product (DIRECTION.md). Not cell-gated: a curated city guide shows the whole
 * scene, ranked by proximity, so it's alive whether you're in the city or an
 * hour out. One launch city for now (new-york-metro); more get their own docs.
 */
export async function fetchCurated(max = 250): Promise<PlaceDoc[]> {
  const snap = await getDocs(query(collection(db, 'curated'), limit(max)))
  return snap.docs.map(d => ({ id: d.id, curated: true, ...(d.data() as Omit<PlaceDoc, 'id'>) }))
}
