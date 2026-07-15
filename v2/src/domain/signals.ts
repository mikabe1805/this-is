/** Product-domain types stay independent of Firebase so recommendation logic
 * can be tested without booting the data layer. */
import type { DurablePlaceMemory } from './placeMemory.js'
import type { PlaceObservations } from './placeObservations.js'
export type Tag = 'want' | 'tried' | 'loved'
export type SignalVisibility = 'circle' | 'private'
export const PRIVATE_PLACE_NOTE_MAX_LENGTH = 280
export const SHARED_PLACE_NOTE_MAX_LENGTH = 180

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
  visibility: SignalVisibility
  note?: string
  observations?: PlaceObservations
  ts: number
  memory?: DurablePlaceMemory
  /** Read-only compatibility view. New persistence writes `memory`, never `place`. */
  place?: PlaceSnapshot
  user?: FriendUser
}
