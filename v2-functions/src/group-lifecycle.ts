export interface MemberSnapshot {
  uid: string
  displayName: string
  avatarHex: string
  joinedAt?: unknown
}

export interface GroupLifecycleState {
  name: string
  status: 'forming' | 'active'
  memberUids: string[]
  members: MemberSnapshot[]
  membershipLocked: boolean
  permissionVersion: number
}

export interface GroupAudienceStamp {
  permissionVersion: number
  memberUids: string[]
}

export interface GroupAudienceSource {
  permissionVersion: unknown
  memberUids: unknown
}

export interface CanonicalSignal {
  uid: string
  placeId: string
  tag: 'want' | 'tried' | 'loved'
  ts: number
  note?: string
  memory: UserPlaceMemory
  observations?: PlaceObservations
}

export const PLACE_OBSERVATION_KEYS = [
  'family_friendly', 'quiet', 'easy_parking', 'worth_a_drive',
  'casual', 'special_occasion', 'outdoors',
] as const
export type PlaceObservationKey = (typeof PLACE_OBSERVATION_KEYS)[number]
export type PlaceObservationAudience = 'private' | 'group'
export interface PlaceObservation {
  value: 'yes' | 'no'
  observedAt: number
  audience: PlaceObservationAudience
  source: 'user_authored'
}
export type PlaceObservations = Partial<Record<PlaceObservationKey, PlaceObservation>>

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function boundedMemberUid(value: unknown): string | null {
  if (typeof value !== 'string' || value !== value.trim() || value.length < 1 || value.length > 128) {
    return null
  }
  if (value === '.' || value === '..' || value.includes('/') || /^__.*__$/.test(value)) return null
  return [...value].some(character => {
    const code = character.charCodeAt(0)
    return code <= 31 || code === 127
  }) ? null : value
}

function normalizeMemberUids(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > 6) return null
  const normalized = value.map(boundedMemberUid)
  if (normalized.some(uid => uid === null)) return null
  const memberUids = normalized as string[]
  if (new Set(memberUids).size !== memberUids.length) return null
  return [...memberUids].sort()
}

/** Fail closed on anything except the two reviewed audience keys. */
export function normalizeGroupAudienceStamp(value: unknown): GroupAudienceStamp | null {
  const data = record(value)
  if (!data || Object.keys(data).sort().join('|') !== 'memberUids|permissionVersion') return null
  return buildGroupAudienceStamp({
    permissionVersion: data.permissionVersion,
    memberUids: data.memberUids,
  })
}

export function buildGroupAudienceStamp(source: GroupAudienceSource): GroupAudienceStamp | null {
  const memberUids = normalizeMemberUids(source.memberUids)
  if (
    typeof source.permissionVersion !== 'number'
    || !Number.isSafeInteger(source.permissionVersion)
    || source.permissionVersion < 1
    || !memberUids
  ) return null
  return { permissionVersion: source.permissionVersion, memberUids }
}

export function groupAudienceStampMatches(
  stamp: unknown,
  current: GroupAudienceSource,
): boolean {
  const reviewed = normalizeGroupAudienceStamp(stamp)
  const live = buildGroupAudienceStamp(current)
  return Boolean(
    reviewed && live
    && reviewed.permissionVersion === live.permissionVersion
    && reviewed.memberUids.length === live.memberUids.length
    && reviewed.memberUids.every((uid, index) => uid === live.memberUids[index]),
  )
}

export function normalizePlaceObservations(
  value: unknown,
  audience: PlaceObservationAudience,
): PlaceObservations | null {
  const data = record(value)
  if (!data || Object.keys(data).length > PLACE_OBSERVATION_KEYS.length
    || Object.keys(data).some(key => !PLACE_OBSERVATION_KEYS.includes(key as PlaceObservationKey))) return null
  const normalized: PlaceObservations = {}
  for (const key of PLACE_OBSERVATION_KEYS) {
    if (!(key in data)) continue
    const item = record(data[key])
    if (!item || Object.keys(item).sort().join('|') !== 'audience|observedAt|source|value'
      || !['yes', 'no'].includes(String(item.value))
      || !Number.isSafeInteger(item.observedAt) || Number(item.observedAt) <= 0
      || item.audience !== audience || item.source !== 'user_authored') return null
    normalized[key] = {
      value: item.value as PlaceObservation['value'],
      observedAt: Number(item.observedAt), audience, source: 'user_authored',
    }
  }
  return normalized
}

function groupObservations(value: PlaceObservations): PlaceObservations {
  return Object.fromEntries(Object.entries(value).map(([key, observation]) => [
    key, { ...observation, audience: 'group' as const },
  ])) as PlaceObservations
}

export interface UserPlaceMemory {
  placeId: string
  label: string
  category: 'food' | 'drinks' | 'coffee' | 'activity' | 'other'
  area?: string
  hex: string
  provenance: 'user_confirmed'
}

export const GROUP_QUICK_START_CATEGORIES = ['food', 'coffee', 'activity'] as const
export const GROUP_QUICK_START_CONSTRAINTS = [
  'quiet', 'casual', 'outdoors', 'family_friendly', 'special_occasion',
] as const
export type GroupQuickStartCategory = (typeof GROUP_QUICK_START_CATEGORIES)[number]
export type GroupQuickStartConstraint = (typeof GROUP_QUICK_START_CONSTRAINTS)[number]

export interface GroupQuickStartPreference {
  uid: string
  categoryHints: GroupQuickStartCategory[]
  constraintHints: GroupQuickStartConstraint[]
  permissionVersion: number
}

function boundedUnique<T extends string>(value: unknown, allowed: readonly T[], max: number): T[] | null {
  if (!Array.isArray(value) || value.length > max) return null
  const result = value.filter((item): item is T => typeof item === 'string' && allowed.includes(item as T))
  return result.length === value.length && new Set(result).size === result.length ? result : null
}

export function buildGroupQuickStartPreference(input: {
  uid: string
  categoryHints: unknown
  constraintHints: unknown
  permissionVersion: number
}): GroupQuickStartPreference | null {
  const categoryHints = boundedUnique(input.categoryHints, GROUP_QUICK_START_CATEGORIES, 3)
  const constraintHints = boundedUnique(input.constraintHints, GROUP_QUICK_START_CONSTRAINTS, 5)
  if (
    !input.uid || !categoryHints || !constraintHints
    || categoryHints.length + constraintHints.length === 0
    || !Number.isSafeInteger(input.permissionVersion) || input.permissionVersion < 1
  ) return null
  return { uid: input.uid, categoryHints, constraintHints, permissionVersion: input.permissionVersion }
}

const MEMORY_HEX: Record<UserPlaceMemory['category'], string> = {
  food: '#704739', drinks: '#633C48', coffee: '#5A463C', activity: '#46525A', other: '#4A3A43',
}

export function validUserPlaceMemory(value: unknown, placeId?: string): value is UserPlaceMemory {
  if (!value || typeof value !== 'object') return false
  const memory = value as Record<string, unknown>
  const category = memory.category as UserPlaceMemory['category']
  return typeof memory.placeId === 'string'
    && memory.placeId.length > 2 && memory.placeId.length <= 260
    && (!placeId || memory.placeId === placeId)
    && typeof memory.label === 'string'
    && memory.label.trim().length > 0 && memory.label.length <= 120
    && (memory.area === undefined
      || (typeof memory.area === 'string' && memory.area.trim().length > 0 && memory.area.length <= 80))
    && category in MEMORY_HEX
    && memory.hex === MEMORY_HEX[category]
    && memory.provenance === 'user_confirmed'
}

export function normalizeGroupName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value.trim().replace(/\s+/g, ' ')
  return name.length >= 2 && name.length <= 60 ? name : null
}

export function memberSnapshot(uid: string, profile: unknown): MemberSnapshot | null {
  if (!profile || typeof profile !== 'object') return null
  const data = profile as Record<string, unknown>
  const displayName = typeof data.displayName === 'string' ? data.displayName.trim() : ''
  const avatarHex = typeof data.avatarHex === 'string' ? data.avatarHex : ''
  if (!uid || !displayName || displayName.length > 80 || !/^#[0-9a-f]{6}$/i.test(avatarHex)) return null
  return { uid, displayName, avatarHex }
}

export function acceptGroupMember(
  group: GroupLifecycleState,
  member: MemberSnapshot,
): GroupLifecycleState {
  if (group.membershipLocked) throw new Error('membership-locked')
  if (group.memberUids.includes(member.uid)) return group
  if (group.memberUids.length >= 6) throw new Error('group-full')
  const memberUids = [...group.memberUids, member.uid]
  return {
    ...group,
    status: memberUids.length >= 2 ? 'active' : 'forming',
    memberUids,
    members: [...group.members, member],
  }
}

export function groupSignalProjection(
  signal: CanonicalSignal,
  permissionVersion: number,
  includeNote: boolean,
  includeObservations = false,
): Record<string, unknown> {
  if (!Number.isSafeInteger(permissionVersion) || permissionVersion < 1) {
    throw new Error('invalid-permission-version')
  }
  const projection: Record<string, unknown> = {
    uid: signal.uid,
    placeId: signal.placeId,
    tag: signal.tag,
    visibility: 'circle',
    ts: signal.ts,
    memory: signal.memory,
    includeNote,
    includeObservations,
    permissionVersion,
  }
  if (includeNote && signal.note) projection.note = signal.note
  if (includeObservations && signal.observations && Object.keys(signal.observations).length > 0) {
    projection.observations = groupObservations(signal.observations)
  }
  return projection
}
