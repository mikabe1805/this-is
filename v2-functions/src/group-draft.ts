import { createHash } from 'node:crypto'
import type { GroupPickContext } from './group-pick.js'

export const GROUP_DRAFT_PASS_LIFETIME_MS = 6 * 60 * 60 * 1000
export const GROUP_DRAFT_PASS_LIMIT = 3

export interface GroupDraftIdentity {
  permissionVersion: number
  evidenceUpdatedAt: number
  attendeeUids: string[]
  guestCount: 0 | 1
  context: GroupPickContext
  planArea: string
  requiredObservation?: string
  recentPlaceId?: string
}

export interface GroupDraftPassValue {
  draftKey: string
  placeId: string
  actorUid: string
  permissionVersion: number
  createdAt: number
  expiresAt: number
}

/** The canonical text is hashed before persistence. In particular, temporary
 * plan-area text never enters a group document or draft-pass document. */
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

export function groupDraftKey(identity: GroupDraftIdentity): string {
  return createHash('sha256').update(canonicalGroupDraft(identity)).digest('hex')
}

export function groupDraftPassId(draftKey: string, placeId: string): string {
  if (!/^[a-f0-9]{64}$/.test(draftKey) || !placeId || placeId.length > 512) {
    throw new Error('invalid-group-draft-pass')
  }
  return createHash('sha256').update(`${draftKey}\0${placeId}`).digest('hex')
}

export function validGroupDraftPass(value: unknown, now = Date.now()): value is GroupDraftPassValue {
  if (!value || typeof value !== 'object') return false
  const pass = value as Record<string, unknown>
  return typeof pass.draftKey === 'string' && /^[a-f0-9]{64}$/.test(pass.draftKey)
    && typeof pass.placeId === 'string' && pass.placeId.length >= 1 && pass.placeId.length <= 512
    && typeof pass.actorUid === 'string' && pass.actorUid.length >= 1 && pass.actorUid.length <= 128
    && Number.isSafeInteger(pass.permissionVersion) && Number(pass.permissionVersion) >= 1
    && Number.isFinite(pass.createdAt) && Number(pass.createdAt) > 0
    && Number.isFinite(pass.expiresAt) && Number(pass.expiresAt) > now
    && Number(pass.expiresAt) - Number(pass.createdAt) === GROUP_DRAFT_PASS_LIFETIME_MS
}
