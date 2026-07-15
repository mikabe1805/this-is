import { createHash } from 'node:crypto'
import {
  groupSignalProjection,
  validUserPlaceMemory,
  type CanonicalSignal,
  type MemberSnapshot,
  type UserPlaceMemory,
} from './group-lifecycle.js'

export interface PairConnectionMigrationInput {
  connectionId: string
  memberUids: string[]
  status: string
  members: MemberSnapshot[]
  signals: Array<{
    uid: string
    placeId: string
    tag: 'want' | 'tried' | 'loved'
    visibility: 'circle' | 'private'
    ts: number
    note?: string
    memory?: UserPlaceMemory
  }>
  migratedAt: unknown
}

export interface PairGroupMigrationPlan {
  groupId: string
  group: {
    name: string
    status: 'active'
    memberUids: string[]
    members: MemberSnapshot[]
    membershipLocked: boolean
    permissionVersion: 1
    projectionCount: number
    receiptCount: 0
    migratedFromConnectionId: string
    createdAt: unknown
    updatedAt: unknown
  }
  projections: Array<{ id: string; value: Record<string, unknown> }>
}

export function pairMigrationGroupId(connectionId: string): string {
  if (!connectionId || connectionId.length > 200) throw new Error('invalid-connection-id')
  const digest = createHash('sha256').update(connectionId).digest('base64url').slice(0, 24)
  return `pair_${digest}`
}

export function pairReasonToGroupReason(value: unknown):
  'everyone_wants' | 'everyone_supports' | 'trusted_introduction' {
  if (value === 'both_want') return 'everyone_wants'
  if (value === 'their_love' || value === 'my_love') return 'trusted_introduction'
  return 'everyone_supports'
}

/**
 * Pure, write-free conversion contract for retiring the pair schema.
 * The accepted pair becomes the exact same two-person audience. Existing
 * circle-visible place evidence narrows into that group; private signals and
 * notes never cross the boundary automatically.
 */
export function buildPairGroupMigration(input: PairConnectionMigrationInput): PairGroupMigrationPlan {
  if (input.status !== 'active') throw new Error('connection-unavailable')
  const memberUids = [...input.memberUids].sort()
  if (memberUids.length !== 2 || new Set(memberUids).size !== 2 || memberUids.some(uid => !uid)) {
    throw new Error('invalid-pair-membership')
  }
  const memberByUid = new Map(input.members.map(member => [member.uid, member]))
  if (memberByUid.size !== 2 || memberUids.some(uid => !memberByUid.has(uid))) {
    throw new Error('missing-member-profile')
  }
  const members = memberUids.map(uid => ({ ...memberByUid.get(uid)!, joinedAt: input.migratedAt }))
  const firstNames = members.map(member => member.displayName.trim().split(/\s+/)[0]).filter(Boolean)
  if (firstNames.length !== 2) throw new Error('missing-member-profile')

  const latest = new Map<string, CanonicalSignal>()
  for (const signal of input.signals) {
    if (signal.visibility !== 'circle' || !memberUids.includes(signal.uid)) continue
    if (
      !signal.placeId || !['want', 'tried', 'loved'].includes(signal.tag)
      || !Number.isFinite(signal.ts) || !validUserPlaceMemory(signal.memory, signal.placeId)
    ) continue
    const canonical: CanonicalSignal = { ...signal, memory: signal.memory }
    const id = `${signal.uid}__${signal.placeId}`
    const current = latest.get(id)
    if (!current || signal.ts > current.ts) latest.set(id, canonical)
  }
  if (latest.size > 300) throw new Error('group-signal-limit')
  const projections = [...latest.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, signal]) => ({
      id,
      value: groupSignalProjection(signal, 1, false),
    }))

  return {
    groupId: pairMigrationGroupId(input.connectionId),
    group: {
      name: `${firstNames[0]} & ${firstNames[1]}`,
      status: 'active',
      memberUids,
      members,
      membershipLocked: projections.length > 0,
      permissionVersion: 1,
      projectionCount: projections.length,
      receiptCount: 0,
      migratedFromConnectionId: input.connectionId,
      createdAt: input.migratedAt,
      updatedAt: input.migratedAt,
    },
    projections,
  }
}
