/**
 * The v2 place model — small enough to hold in one head.
 *
 * Current pair implementation keys saved routes by Google place_id as
 * `g:{pid}`. The approved replacement catalog uses owned `o:{GERS id}`
 * profiles plus an opaque Google Place ID alias; see domain/openCatalog.ts.
 * Do not add more durable Google-derived facts to this legacy snapshot shape.
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
  /** Legacy unimplemented FSQ shadow-key proposal. Do not populate; the open
   * catalog decision now requires an explicit owned ID + provenance record. */
  fsqId?: string

}

export const gid = (placeId: string): string =>
  placeId.startsWith('g:') ? placeId : `g:${placeId}`

/** The raw Google place_id back out of a `g:` doc ID. */
export const rawPid = (id: string): string => (id.startsWith('g:') ? id.slice(2) : id)
