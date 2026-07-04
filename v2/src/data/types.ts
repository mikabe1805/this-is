/**
 * The v2 place model — small enough to hold in one head.
 *
 * Identity law: every place is keyed by its Google place_id as `g:{pid}`,
 * everywhere (place docs, save doc IDs `{uid}__g:{pid}`, routes). There is no
 * second namespace, no fingerprint matching. The FSQ/MapLibre escape hatch
 * stays a one-script migration against this key.
 *
 * The friend-graph shapes live next to their queries: a save's `PlaceSnapshot`
 * and `FriendSave` in `data/social.ts`, the write-side `SaveablePlace` in
 * `data/saves.ts`. This file holds only the shared place-catalog doc + the id
 * helpers.
 */

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
  /** The FSQ OS Places shadow key (docs/GOOGLE.md, decision 6) — written by
   *  an offline conflation job; keeps the open-catalog escape hatch a
   *  weeks-not-months migration. */
  fsqId?: string

  // ── Curation (the premium layer; FRIENDS.md Layer 1 alongside the friend
  //    graph). Curated docs live in `curated/`; uncurated geo-cell candidates
  //    in `cities/{cell}/candidates/` are the honestly-labeled Layer-2 scaffold. ──
  /** Hand-curated venue in a launch scene. */
  curated?: boolean
  /** The curator's one-line take — the card hero on a curated room. */
  curatorPOV?: string
  /** Owner-owned ambiance photo paths (Firebase Storage). When present these
   *  are the grid image; absent → live Google fallback → hex plate. */
  ownedPhotoPath?: string[]
}

export const gid = (placeId: string): string =>
  placeId.startsWith('g:') ? placeId : `g:${placeId}`

/** The raw Google place_id back out of a `g:` doc ID. */
export const rawPid = (id: string): string => (id.startsWith('g:') ? id.slice(2) : id)
