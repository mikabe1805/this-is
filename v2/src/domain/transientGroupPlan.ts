import { normalizeExplicitPlanArea } from './planArea.js'
import type { PlaceObservationKey } from './placeObservations.js'
import { PLAN_CONTEXTS, type PlanContext } from './recommendation.js'

/** These are the non-safety-critical observations the current group planner
 * can use as one temporary practical need. */
export const TRANSIENT_PLAN_REQUIREMENTS = [
  'family_friendly',
  'quiet',
  'easy_parking',
  'outdoors',
  'special_occasion',
] as const satisfies readonly PlaceObservationKey[]

export type TransientPlanRequirement = (typeof TRANSIENT_PLAN_REQUIREMENTS)[number]

/**
 * One in-progress group plan while the person briefly leaves the group route
 * to discover or capture a place. This value belongs in memory only. It must
 * never be serialized into a URL, browser storage, Firestore, or analytics.
 */
export interface TransientGroupPlanDraft {
  groupId: string
  /** The signed-in member who started this draft. */
  memberUid: string
  /** Membership/audience version at the moment the draft left the group. */
  permissionVersion: number
  /** Exact current group audience, used only to reject stale restoration. */
  memberUids: string[]
  attendeeUids: string[]
  guestIncluded: boolean
  context: PlanContext
  planArea: string
  requiredObservation: TransientPlanRequirement | null
}

/** Typed caller shape. The runtime boundary narrows the page's wider
 * observation-key union to the five needs the planner actually exposes. */
export type TransientGroupPlanDraftInput = Omit<TransientGroupPlanDraft, 'requiredObservation'> & {
  requiredObservation: PlaceObservationKey | null
}

/** Authoritative evidence supplied by the currently loaded group before a
 * transient draft may be shown or restored. */
export interface TransientGroupPlanEvidence {
  groupId: string
  memberUid: string
  permissionVersion: number
  memberUids: string[]
}

export type TransientGroupPlanAction =
  | { type: 'remember'; draft: unknown }
  | { type: 'clear'; groupId?: string }

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function boundedIdentifier(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string' || value !== value.trim() || value.length < 1 || value.length > maxLength) {
    return null
  }
  if (value === '.' || value === '..' || value.includes('/') || /^__.*__$/.test(value)) return null
  return [...value].some(character => {
    const code = character.charCodeAt(0)
    return code <= 31 || code === 127
  }) ? null : value
}

function uniqueIdentifiers(value: unknown, minimum: number, maximum: number): string[] | null {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) return null
  const normalized = value.map(item => boundedIdentifier(item, 128))
  if (normalized.some(item => item === null)) return null
  const identifiers = normalized as string[]
  return new Set(identifiers).size === identifiers.length ? identifiers : null
}

function normalizeEvidence(value: unknown): TransientGroupPlanEvidence | null {
  const data = record(value)
  if (!data) return null
  const groupId = boundedIdentifier(data.groupId, 160)
  const memberUid = boundedIdentifier(data.memberUid, 128)
  const permissionVersion = Number(data.permissionVersion)
  const memberUids = uniqueIdentifiers(data.memberUids, 2, 6)
  if (!groupId || !memberUid || !memberUids || !memberUids.includes(memberUid)
    || !Number.isSafeInteger(permissionVersion) || permissionVersion < 1) {
    return null
  }
  return { groupId, memberUid, permissionVersion, memberUids }
}

/** Runtime-normalize a draft at the only write boundary. Invalid or partial
 * input fails closed instead of replacing an earlier plan with guessed state. */
export function normalizeTransientGroupPlanDraft(value: unknown): TransientGroupPlanDraft | null {
  const data = record(value)
  if (!data) return null
  const evidence = normalizeEvidence(data)
  const attendeeInput = uniqueIdentifiers(data.attendeeUids, 2, 6)
  const planArea = normalizeExplicitPlanArea(data.planArea)
  if (!evidence || !attendeeInput || planArea === null || typeof data.guestIncluded !== 'boolean'
    || !PLAN_CONTEXTS.includes(data.context as PlanContext)
    || !(data.requiredObservation === null
      || TRANSIENT_PLAN_REQUIREMENTS.includes(data.requiredObservation as TransientPlanRequirement))) {
    return null
  }
  const attendeeSet = new Set(attendeeInput)
  if ([...attendeeSet].some(uid => !evidence.memberUids.includes(uid))) return null
  const attendeeUids = evidence.memberUids.filter(uid => attendeeSet.has(uid))
  if (attendeeUids.length < 2) return null
  return {
    ...evidence,
    attendeeUids,
    guestIncluded: data.guestIncluded,
    context: data.context as PlanContext,
    planArea,
    requiredObservation: data.requiredObservation as TransientPlanRequirement | null,
  }
}

function sameMemberSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every(uid => rightSet.has(uid))
}

/** Return a safe current draft, or null when account, group, permission
 * version, or membership changed. Ordinary taste-evidence updates do not
 * invalidate logistics; recommendations will recompute from current data. */
export function currentTransientGroupPlanDraft(
  value: unknown,
  currentEvidence: unknown,
): TransientGroupPlanDraft | null {
  const draft = normalizeTransientGroupPlanDraft(value)
  const current = normalizeEvidence(currentEvidence)
  if (!draft || !current
    || draft.groupId !== current.groupId
    || draft.memberUid !== current.memberUid
    || draft.permissionVersion !== current.permissionVersion
    || !sameMemberSet(draft.memberUids, current.memberUids)) {
    return null
  }
  const selected = new Set(draft.attendeeUids)
  return {
    ...draft,
    memberUids: [...current.memberUids],
    attendeeUids: current.memberUids.filter(uid => selected.has(uid)),
  }
}

/** Pure reducer used by the App-owned provider and domain tests. An invalid
 * remember clears the single transient slot. A group-scoped clear cannot
 * accidentally discard another group's in-progress plan. */
export function transientGroupPlanReducer(
  current: TransientGroupPlanDraft | null,
  action: TransientGroupPlanAction,
): TransientGroupPlanDraft | null {
  if (action.type === 'remember') return normalizeTransientGroupPlanDraft(action.draft)
  if (action.groupId && current?.groupId !== action.groupId) return current
  return null
}
