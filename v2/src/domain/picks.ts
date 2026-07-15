import type { GroupRecommendationReason } from './groupRecommendation.js'
import type { PairRecommendationReason, PlanContext } from './recommendation.js'
import type { FriendUser, PlaceSnapshot } from './signals.js'
import type { DurablePlaceMemory } from './placeMemory.js'
import type { PlaceObservationKey } from './placeObservations.js'

export type PickStatus = 'selected' | 'visited' | 'dismissed'

interface PickBase {
  id: string
  createdBy: string
  memberUids: string[]
  placeId: string
  reason: string
  context: PlanContext
  status: PickStatus
  createdAt: number
  updatedAt: number
}

export interface PairPick extends PickBase {
  kind?: 'pair'
  memberUids: [string, string]
  withUid: string
  withName: string
  place: PlaceSnapshot
  reasonCode: PairRecommendationReason
}

export interface GroupPick extends PickBase {
  kind: 'group'
  groupId: string
  groupName: string
  groupPermissionVersion: number
  attendeeUids: string[]
  attendees: FriendUser[]
  guestCount?: 1
  planArea?: string
  requiredObservation?: PlaceObservationKey
  memory: DurablePlaceMemory
  shareToken?: string
  reasonCode: GroupRecommendationReason
}

export type Pick = PairPick | GroupPick

export interface NewGroupPick {
  groupId: string
  creationKey: string
  attendeeUids: string[]
  placeId: string
  context: PlanContext
  guestCount: 0 | 1
  planArea?: string
  requiredObservation?: PlaceObservationKey
}

export function isGroupPick(pick: Pick): pick is GroupPick {
  return pick.kind === 'group'
}

export function canTransitionPickStatus(from: PickStatus, to: PickStatus): boolean {
  return from === 'selected' && (to === 'visited' || to === 'dismissed')
}

/**
 * Merge responses from the exact-document listener and explicit server reads.
 * The Pick lifecycle never moves backward, while a newer same-status revision
 * always wins even when an older server request resolves later.
 */
export function mergePickSnapshot(
  current: Pick | null | undefined,
  incoming: Pick,
  serverAuthoritative: boolean,
): Pick {
  if (!current || current.id !== incoming.id) return incoming

  if (current.status === incoming.status) {
    const currentUpdatedAt = Number.isFinite(current.updatedAt) ? current.updatedAt : null
    const incomingUpdatedAt = Number.isFinite(incoming.updatedAt) ? incoming.updatedAt : null
    if (currentUpdatedAt !== null && incomingUpdatedAt !== null) {
      if (currentUpdatedAt > incomingUpdatedAt) return current
      if (incomingUpdatedAt > currentUpdatedAt) return incoming
    } else if (currentUpdatedAt !== null) {
      return current
    } else if (incomingUpdatedAt !== null) {
      return incoming
    }
  }

  // Once this client has observed a terminal state, no later selected read may
  // revive its close/share actions, even when that read came from the server.
  if (current.status !== 'selected' && incoming.status === 'selected') return current
  if (serverAuthoritative) return incoming
  if (current.status !== 'selected') return current
  return incoming
}

export function validAttendeeSubset(memberUids: string[], attendeeUids: string[], creatorUid: string): boolean {
  const members = new Set(memberUids)
  const attendees = new Set(attendeeUids)
  return attendeeUids.length >= 2
    && attendeeUids.length <= 6
    && attendees.size === attendeeUids.length
    && attendees.has(creatorUid)
    && attendeeUids.every(uid => members.has(uid))
}
