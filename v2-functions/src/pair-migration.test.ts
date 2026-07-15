import { buildPairGroupMigration, pairMigrationGroupId, pairReasonToGroupReason } from './pair-migration.js'

function equal(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`)
  }
}

const input = {
  connectionId: 'mika__vivian',
  memberUids: ['vivian', 'mika'],
  status: 'active',
  members: [
    { uid: 'mika', displayName: 'Mika H', avatarHex: '#8E5A6B' },
    { uid: 'vivian', displayName: 'Vivian L', avatarHex: '#5A6B8E' },
  ],
  signals: [
    { uid: 'mika', placeId: 'o:radio', tag: 'loved' as const, visibility: 'circle' as const, ts: 1, note: 'Do not copy', memory: { placeId: 'o:radio', label: 'Radio', category: 'coffee' as const, hex: '#5A463C', provenance: 'user_confirmed' as const } },
    { uid: 'mika', placeId: 'o:radio', tag: 'want' as const, visibility: 'circle' as const, ts: 2, place: { name: 'Radio', hex: '#5d4437' } },
    { uid: 'vivian', placeId: 'o:private', tag: 'loved' as const, visibility: 'private' as const, ts: 3, place: { name: 'Private', hex: '#49352f' } },
    { uid: 'outsider', placeId: 'o:outside', tag: 'loved' as const, visibility: 'circle' as const, ts: 4, place: { name: 'Outside', hex: '#49352f' } },
  ],
  migratedAt: 100,
}

const plan = buildPairGroupMigration(input)
equal(plan.groupId, pairMigrationGroupId(input.connectionId), 'group id is deterministic')
equal(plan.group.memberUids, ['mika', 'vivian'], 'migration preserves the exact accepted audience')
equal(plan.group.name, 'Mika & Vivian', 'pair becomes a normal two-member group')
equal(plan.group.membershipLocked, true, 'carried evidence locks the audience')
equal(plan.projections.length, 1, 'private, outsider, and stale duplicate signals are excluded')
equal(plan.projections[0].value.tag, 'loved', 'legacy Google snapshot cannot replace confirmed memory')
equal('note' in plan.projections[0].value, false, 'notes never migrate without separate consent')

let invalid = false
try { buildPairGroupMigration({ ...input, memberUids: ['mika', 'vivian', 'ari'] }) } catch { invalid = true }
equal(invalid, true, 'non-pair membership fails closed')
equal(pairMigrationGroupId(input.connectionId), pairMigrationGroupId(input.connectionId), 'retry targets the same group')
equal(pairReasonToGroupReason('both_want'), 'everyone_wants', 'unanimous pair evidence keeps its meaning')
equal(pairReasonToGroupReason('their_love'), 'trusted_introduction', 'one-person introduction keeps its meaning')
console.log('✓ pair migration is deterministic, audience-preserving, note-stripping, and idempotent by target')
