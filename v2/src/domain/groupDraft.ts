import type { PlanContext } from './recommendation.js'
import type { PlaceObservationKey } from './placeObservations.js'

export interface GroupDraftIdentity {
  permissionVersion: number
  evidenceUpdatedAt: number
  attendeeUids: string[]
  guestCount: 0 | 1
  context: PlanContext
  planArea: string
  requiredObservation?: PlaceObservationKey
  recentPlaceId?: string
}

/** This exact canonical form is shared with the trusted Functions boundary.
 * Only its SHA-256 crosses into Firestore, so temporary area text is not stored. */
export function canonicalGroupDraft(identity: GroupDraftIdentity): string {
  return JSON.stringify([
    1,
    identity.permissionVersion,
    identity.evidenceUpdatedAt,
    identity.attendeeUids,
    identity.guestCount,
    identity.context,
    identity.planArea,
    identity.requiredObservation ?? '',
    identity.recentPlaceId ?? '',
  ])
}

export async function groupDraftKey(identity: GroupDraftIdentity): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalGroupDraft(identity))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
}

export async function groupDraftPassId(draftKey: string, placeId: string): Promise<string> {
  if (!/^[a-f0-9]{64}$/.test(draftKey) || !placeId || placeId.length > 512) {
    throw new Error('invalid-group-draft-pass')
  }
  const bytes = new TextEncoder().encode(`${draftKey}\0${placeId}`)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
}
