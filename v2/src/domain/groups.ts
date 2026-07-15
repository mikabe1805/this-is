import type { GroupMemberTaste } from './groupRecommendation.js'
import type { FriendSave, FriendUser, PlaceSnapshot, Tag } from './signals.js'
import { categoryPrimaryType, isDurablePlaceMemory } from './placeMemory.js'
import { normalizeGroupQuickStartPreference, type GroupQuickStartPreference } from './groupQuickStart.js'
import { normalizePlaceObservations } from './placeObservations.js'

export interface GroupMember extends FriendUser {
  joinedAt?: unknown
}

export interface ActiveGroupPickSummary {
  id: string
  placeId: string
  label: string
  attendeeCount: number
  createdAt: number
}

export interface RecentGroupPickSummary extends ActiveGroupPickSummary {
  visitedAt: number
}

export interface GroupSummary {
  id: string
  name: string
  status: 'forming' | 'active'
  memberUids: string[]
  members: GroupMember[]
  permissionVersion: number
  membershipLocked: boolean
  projectionCount: number
  activePick?: ActiveGroupPickSummary
  recentPick?: RecentGroupPickSummary
  createdAt?: unknown
  updatedAt?: unknown
}

export interface GroupSignalProjection extends FriendSave {
  permissionVersion: number
  includeNote: boolean
  includeObservations: boolean
}

export type GroupQuickStartProjection = GroupQuickStartPreference

export interface GroupCircle extends GroupSummary {
  tastes: GroupMemberTaste[]
  changeLabel: string
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

/** Normalize Firestore Timestamp-like values without importing Firebase into
 * the domain layer. A missing/invalid value cannot identify a shared draft. */
export function groupUpdatedAtMillis(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  if (!value || typeof value !== 'object') return 0
  const toMillis = (value as { toMillis?: unknown }).toMillis
  if (typeof toMillis !== 'function') return 0
  const millis = Number(toMillis.call(value))
  return Number.isFinite(millis) && millis > 0 ? millis : 0
}

function memberFrom(value: unknown): GroupMember | null {
  const data = record(value)
  if (!data) return null
  const uid = typeof data.uid === 'string' ? data.uid : ''
  const displayName = typeof data.displayName === 'string' ? data.displayName.trim() : ''
  const avatarHex = typeof data.avatarHex === 'string' ? data.avatarHex : ''
  if (!uid || !displayName || displayName.length > 80 || !/^#[0-9a-f]{6}$/i.test(avatarHex)) return null
  return { uid, displayName, avatarHex, joinedAt: data.joinedAt }
}

function activePickFrom(value: unknown): ActiveGroupPickSummary | null {
  const data = record(value)
  if (!data) return null
  const attendeeCount = Number(data.attendeeCount)
  const createdAt = Number(data.createdAt)
  if (
    typeof data.id !== 'string' || !data.id || data.id.length > 200
    || typeof data.placeId !== 'string' || !data.placeId || data.placeId.length > 512
    || typeof data.label !== 'string' || !data.label.trim() || data.label.length > 120
    || !Number.isSafeInteger(attendeeCount) || attendeeCount < 2 || attendeeCount > 7
    || !Number.isFinite(createdAt) || createdAt <= 0
  ) return null
  return { id: data.id, placeId: data.placeId, label: data.label, attendeeCount, createdAt }
}

function recentPickFrom(value: unknown): RecentGroupPickSummary | null {
  const active = activePickFrom(value)
  const data = record(value)
  const visitedAt = Number(data?.visitedAt)
  if (!active || !Number.isFinite(visitedAt) || visitedAt <= 0 || visitedAt < active.createdAt) return null
  return { ...active, visitedAt }
}

/** Fail-closed boundary for server-authored group documents. */
export function normalizeGroupSummary(id: string, value: unknown): GroupSummary | null {
  const data = record(value)
  if (!id || !data || !['forming', 'active'].includes(String(data.status))) return null
  const name = typeof data.name === 'string' ? data.name.trim() : ''
  const memberUids = Array.isArray(data.memberUids)
    ? data.memberUids.filter((uid): uid is string => typeof uid === 'string' && Boolean(uid))
    : []
  const members = Array.isArray(data.members) ? data.members.map(memberFrom) : []
  const permissionVersion = Number(data.permissionVersion)
  const projectionCount = Number(data.projectionCount ?? 0)
  const activePick = data.activePick === undefined ? undefined : activePickFrom(data.activePick)
  const recentPick = data.recentPick === undefined ? undefined : recentPickFrom(data.recentPick)
  const validSize = data.status === 'forming'
    ? memberUids.length === 1
    : memberUids.length >= 2 && memberUids.length <= 6
  if (
    !name || name.length > 60
    || !validSize
    || new Set(memberUids).size !== memberUids.length
    || members.some(member => !member)
    || members.length !== memberUids.length
    || !Number.isSafeInteger(permissionVersion) || permissionVersion < 1
    || typeof data.membershipLocked !== 'boolean'
    || !Number.isSafeInteger(projectionCount) || projectionCount < 0 || projectionCount > 300
    || (data.activePick !== undefined && !activePick)
    || (data.recentPick !== undefined && !recentPick)
  ) return null
  const resolvedMembers = members as GroupMember[]
  const resolvedMemberUids = resolvedMembers.map(member => member.uid)
  if (
    new Set(resolvedMemberUids).size !== resolvedMemberUids.length
    || resolvedMemberUids.some(uid => !memberUids.includes(uid))
  ) return null
  return {
    id,
    name,
    status: data.status as 'forming' | 'active',
    memberUids,
    members: resolvedMembers,
    permissionVersion,
    membershipLocked: data.membershipLocked,
    projectionCount,
    ...(activePick ? { activePick } : {}),
    ...(recentPick ? { recentPick } : {}),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

export function normalizeGroupSignal(id: string, value: unknown): GroupSignalProjection | null {
  const data = record(value)
  const memory = isDurablePlaceMemory(data?.memory) ? data.memory : null
  const tag = data?.tag as Tag
  const visibility = data?.visibility
  const permissionVersion = Number(data?.permissionVersion)
  const observations = data?.observations === undefined
    ? undefined
    : normalizePlaceObservations(data.observations, 'group')
  if (
    !data || !memory || memory.placeId !== data.placeId
    || typeof data.uid !== 'string' || !data.uid
    || typeof data.placeId !== 'string' || !data.placeId
    || !['want', 'tried', 'loved'].includes(tag)
    || visibility !== 'circle'
    || !Number.isSafeInteger(permissionVersion) || permissionVersion < 1
    || (data.observations !== undefined && !observations)
  ) return null
  return {
    id,
    uid: data.uid,
    placeId: data.placeId,
    tag,
    visibility: 'circle',
    note: typeof data.note === 'string' ? data.note : undefined,
    ...(observations ? { observations } : {}),
    ts: Number(data.ts ?? 0),
    memory,
    place: {
      name: memory.label,
      primaryType: categoryPrimaryType(memory.category),
      hex: memory.hex,
    } as PlaceSnapshot,
    permissionVersion,
    includeNote: data.includeNote === true,
    includeObservations: data.includeObservations === true,
  }
}

export function buildGroupCircle(
  group: GroupSummary,
  signals: GroupSignalProjection[],
  preferences: GroupQuickStartProjection[] = [],
): GroupCircle {
  const current = signals.filter(signal =>
    signal.permissionVersion === group.permissionVersion && group.memberUids.includes(signal.uid))
  const tastes = group.members.map(member => ({
    uid: member.uid,
    name: member.displayName,
    saves: current.filter(signal => signal.uid === member.uid),
    quickStart: preferences.find(preference =>
      preference.uid === member.uid && preference.permissionVersion === group.permissionVersion),
  }))
  const sharedCount = current.length
  return {
    ...group,
    tastes,
    changeLabel: group.status === 'forming'
      ? 'Waiting for someone to join'
      : sharedCount === 0
      ? 'No shared place signals yet'
      : `${sharedCount} shared ${sharedCount === 1 ? 'signal' : 'signals'}`,
  }
}

export function normalizeGroupQuickStart(value: unknown): GroupQuickStartProjection | null {
  return normalizeGroupQuickStartPreference(value)
}
