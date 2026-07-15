import {
  PLACE_OBSERVATION_KEYS,
  type GroupQuickStartCategory,
  type MemberSnapshot,
  type PlaceObservationKey,
  type PlaceObservations,
  type UserPlaceMemory,
} from './group-lifecycle.js'

export const GROUP_PICK_CONTEXTS = ['Anything', 'Food', 'Drinks', 'Coffee'] as const
export type GroupPickContext = (typeof GROUP_PICK_CONTEXTS)[number]
export type GroupPickReason = 'everyone_wants' | 'everyone_supports' | 'broad_support' | 'trusted_introduction' | 'quick_start_fit'

export interface ProjectedSignal {
  uid: string
  placeId: string
  tag: 'want' | 'tried' | 'loved'
  ts: number
  memory: UserPlaceMemory
  observations?: PlaceObservations
  permissionVersion: number
}

export interface ProjectedPreference {
  uid: string
  categoryHints: GroupQuickStartCategory[]
  constraintHints: string[]
  permissionVersion: number
}

export interface DerivedGroupCandidate {
  placeId: string
  memory: UserPlaceMemory
  reasonCode: GroupPickReason
  reason: string
}

export function validGroupAttendees(
  memberUids: string[],
  attendeeUids: string[],
  creatorUid: string,
): boolean {
  const members = new Set(memberUids)
  return attendeeUids.length >= 2
    && attendeeUids.length <= 6
    && new Set(attendeeUids).size === attendeeUids.length
    && attendeeUids.includes(creatorUid)
    && attendeeUids.every(uid => members.has(uid))
}

function fitsContext(memory: UserPlaceMemory, context: GroupPickContext): boolean {
  if (context === 'Anything') return true
  if (context === 'Food') return memory.category === 'food'
  if (context === 'Drinks') return memory.category === 'drinks'
  return memory.category === 'coffee'
}

export const GROUP_PICK_REQUIREMENT_KEYS = [
  'family_friendly', 'quiet', 'easy_parking', 'outdoors', 'special_occasion',
] as const satisfies readonly PlaceObservationKey[]

export function normalizeGroupPickPlanArea(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized) return ''
  return normalized.length <= 80 ? normalized : null
}

function areaWords(value: string): string[] {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
}

function matchesPlanArea(placeArea: unknown, planArea: string): boolean {
  if (!planArea) return true
  if (typeof placeArea !== 'string') return false
  const placeWords = new Set(areaWords(placeArea))
  const planWords = areaWords(planArea)
  return planWords.length > 0 && planWords.every(word => placeWords.has(word))
}

function satisfiesRequiredObservation(
  signals: ProjectedSignal[],
  requiredObservation?: PlaceObservationKey,
): boolean {
  if (!requiredObservation) return true
  let confirmedYes = false
  for (const signal of signals) {
    const observation = signal.observations?.[requiredObservation]
    if (!observation || observation.audience !== 'group' || observation.source !== 'user_authored') continue
    if (observation.value === 'no') return false
    confirmedYes = true
  }
  return confirmedYes
}

export function deriveGroupCandidate(input: {
  placeId: string
  context: GroupPickContext
  permissionVersion: number
  attendeeUids: string[]
  members: MemberSnapshot[]
  signals: ProjectedSignal[]
  preferences?: ProjectedPreference[]
  guestCount?: 0 | 1
  planArea?: string
  requiredObservation?: PlaceObservationKey
  excludedPlaceIds?: readonly string[]
}): DerivedGroupCandidate | null {
  const guestCount = input.guestCount ?? 0
  if (guestCount !== 0 && guestCount !== 1) return null
  if (input.excludedPlaceIds?.includes(input.placeId)) return null
  const totalAttendees = input.attendeeUids.length + guestCount
  const attendees = new Set(input.attendeeUids)
  const attendeeOrder = new Map(input.attendeeUids.map((uid, index) => [uid, index]))
  const currentPlaceSignals = input.signals.filter(signal =>
    attendees.has(signal.uid)
      && signal.placeId === input.placeId
      && signal.permissionVersion === input.permissionVersion)
    .sort((a, b) => (attendeeOrder.get(a.uid) ?? 99) - (attendeeOrder.get(b.uid) ?? 99))
  const support = currentPlaceSignals.filter(signal => ['want', 'loved'].includes(signal.tag))
  if (!support.length || !fitsContext(support[0].memory, input.context)) return null
  const planArea = normalizeGroupPickPlanArea(input.planArea ?? '')
  if (planArea === null || !matchesPlanArea(support[0].memory.area, planArea)) return null
  if (input.requiredObservation
    && (!GROUP_PICK_REQUIREMENT_KEYS.includes(input.requiredObservation as typeof GROUP_PICK_REQUIREMENT_KEYS[number])
      || !PLACE_OBSERVATION_KEYS.includes(input.requiredObservation)
      || !satisfiesRequiredObservation(currentPlaceSignals, input.requiredObservation))) return null
  const wantCount = support.filter(signal => signal.tag === 'want').length
  const loved = support.filter(signal => signal.tag === 'loved')
  const supporterUids = new Set(support.map(signal => signal.uid))
  const quickMatches = (input.preferences ?? []).filter(preference =>
    attendees.has(preference.uid)
      && !supporterUids.has(preference.uid)
      && preference.permissionVersion === input.permissionVersion
      && preference.categoryHints.includes(support[0].memory.category as GroupQuickStartCategory))
  if (support.length < 2 && loved.length === 0 && quickMatches.length === 0) return null
  if (wantCount === totalAttendees) {
    return {
      placeId: input.placeId,
      memory: support[0].memory,
      reasonCode: 'everyone_wants',
      reason: `All ${totalAttendees} want this.`,
    }
  }
  if (support.length === totalAttendees) {
    return {
      placeId: input.placeId,
      memory: support[0].memory,
      reasonCode: 'everyone_supports',
      reason: 'Everyone has a reason to go.',
    }
  }
  if (support.length >= 2) {
    return {
      placeId: input.placeId,
      memory: support[0].memory,
      reasonCode: 'broad_support',
      reason: `${support.length} of ${totalAttendees} want or love this.`,
    }
  }
  if (loved.length === 0 && quickMatches[0]) {
    const supporter = input.members.find(member => member.uid === support[0].uid)?.displayName.split(/\s+/)[0] ?? 'Someone'
    const hinted = input.members.find(member => member.uid === quickMatches[0].uid)?.displayName.split(/\s+/)[0] ?? 'someone'
    return {
      placeId: input.placeId,
      memory: support[0].memory,
      reasonCode: 'quick_start_fit',
      reason: `${supporter} wants this; it fits ${hinted}'s ${support[0].memory.category} hint.`,
    }
  }
  const introducer = input.members.find(member => member.uid === loved[0].uid)?.displayName.split(/\s+/)[0] ?? 'Someone'
  const unknown = totalAttendees - 1
  return {
    placeId: input.placeId,
    memory: support[0].memory,
    reasonCode: 'trusted_introduction',
    reason: `${introducer} loved this; ${unknown} ${unknown === 1 ? 'person hasn’t' : 'people haven’t'} weighed in.`,
  }
}
