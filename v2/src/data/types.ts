/**
 * The v2 data model — small enough to hold in one head.
 *
 * Identity law: every place is keyed by its Google place_id as `g:{pid}`,
 * everywhere (place docs, pin doc IDs, routes). There is no second namespace,
 * no fingerprint matching, no regex bridging. The FSQ/MapLibre escape hatch
 * stays a one-script migration against this key.
 *
 * Snapshot law: a pin carries a minimal render snapshot (name + hex + type +
 * neighborhood + coords) so boards and the library render with ZERO joins.
 * Snapshots never contain photos, ratings, or hours (ToS posture).
 */

export type PinStatus = 'want' | 'been' | 'released'

export interface PlaceSnapshot {
  name: string
  primaryType?: string
  /** Dominant hex — the card's loading/placeholder block. */
  hex: string
  neighborhood?: string
  lat?: number
  lng?: number
  /** When lat/lng came from Google — walk chips hide past the 30-day window. */
  coordsAt?: number
}

export interface Pin {
  /** `g:{placeId}` — same ID as the place doc; saves are idempotent. */
  id: string
  /** Boards this pin lives on (≤3). */
  boardIds: string[]
  status: PinStatus
  note?: string
  /** The six-word line shown on a Been pin, set from the morning-after card. */
  sixWordNote?: string
  savedAt: number
  lastTouchedAt: number
  visitedAt?: number
  userPhotoPath?: string
  snapshot: PlaceSnapshot
}

export interface Board {
  id: string
  name: string
  /** Fallback cover color when the board has no pins yet. */
  coverHex: string
  /** Accumulated vibe tags of saved pins — drives the likely-board guess. */
  vibeTags: string[]
  pinCount: number
  createdAt: number
  lastUsedAt: number
  shareToken?: string
}

export interface PlaceDoc {
  /** `g:{placeId}` */
  id: string
  name: string
  primaryType?: string
  vibeTags: string[]
  neighborhood?: string
  cityKey?: string
  lat?: number
  lng?: number
  /** When coords were fetched from Google — chips hide past 30 days. */
  coordsFetchedAt?: number
  photoHex: string
  savedCount: number
}

/** What savePin needs to know about a place — shaped by lib/places.getDetails. */
export interface SaveablePlace {
  /** Raw Google place_id or already-prefixed `g:` ID. */
  id: string
  name: string
  address?: string
  primaryType?: string
  lat?: number
  lng?: number
}

export const gid = (placeId: string): string =>
  placeId.startsWith('g:') ? placeId : `g:${placeId}`

/** The raw Google place_id back out of a `g:` doc ID. */
export const rawPid = (id: string): string => (id.startsWith('g:') ? id.slice(2) : id)
