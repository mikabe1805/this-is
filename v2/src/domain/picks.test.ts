import {
  canTransitionPickStatus,
  mergePickSnapshot,
  validAttendeeSubset,
  type GroupPick,
  type PickStatus,
} from './picks.js'

function equal(actual: boolean, expected: boolean, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, received ${actual}`)
}

const cases: Array<[PickStatus, PickStatus, boolean]> = [
  ['selected', 'visited', true],
  ['selected', 'dismissed', true],
  ['selected', 'selected', false],
  ['visited', 'selected', false],
  ['visited', 'dismissed', false],
  ['dismissed', 'selected', false],
  ['dismissed', 'visited', false],
]

for (const [from, to, expected] of cases) {
  equal(canTransitionPickStatus(from, to), expected, `${from} → ${to}`)
}
console.log('✓ Pick status is a one-way selected → visited|dismissed lifecycle')

equal(validAttendeeSubset(['a', 'b', 'c'], ['a', 'c'], 'a'), true, 'creator and one member can attend')
equal(validAttendeeSubset(['a', 'b', 'c'], ['b', 'c'], 'a'), false, 'creator must attend the Pick they make')
equal(validAttendeeSubset(['a', 'b'], ['a', 'a'], 'a'), false, 'attendees must be unique')
equal(validAttendeeSubset(['a', 'b'], ['a', 'outsider'], 'a'), false, 'attendees must be accepted members')
console.log('✓ group Pick attendees are a unique accepted subset containing the creator')

function groupPick(status: PickStatus, updatedAt: number, shareToken?: string): GroupPick {
  return {
    kind: 'group',
    id: 'pick-order-test',
    groupId: 'group-order-test',
    groupName: 'Order test',
    groupPermissionVersion: 1,
    createdBy: 'a',
    memberUids: ['a', 'b'],
    attendeeUids: ['a', 'b'],
    attendees: [
      { uid: 'a', displayName: 'A', avatarHex: '#111111' },
      { uid: 'b', displayName: 'B', avatarHex: '#222222' },
    ],
    placeId: 'g:order-test',
    memory: {
      placeId: 'g:order-test',
      label: 'Order test',
      category: 'coffee',
      area: 'Cresskill, NJ',
      hex: '#5A463C',
      provenance: 'user_confirmed',
    },
    reasonCode: 'everyone_supports',
    reason: 'Everyone has a reason to go.',
    context: 'Anything',
    status,
    createdAt: 1,
    updatedAt,
    ...(shareToken ? { shareToken } : {}),
  }
}

const visitedWithRevokedReceipt = groupPick('visited', 30)
const olderVisitedWithReceipt = groupPick('visited', 20, 'old-share-token')
if (mergePickSnapshot(visitedWithRevokedReceipt, olderVisitedWithReceipt, true) !== visitedWithRevokedReceipt) {
  throw new Error('an older server read must not restore a revoked terminal receipt')
}

const newerVisitedWithRevokedReceipt = groupPick('visited', 40)
if (mergePickSnapshot(olderVisitedWithReceipt, newerVisitedWithRevokedReceipt, true) !== newerVisitedWithRevokedReceipt) {
  throw new Error('a newer same-status listener revision must remove the revoked receipt')
}

const selectedAfterTerminal = groupPick('selected', 50, 'selected-token')
if (mergePickSnapshot(newerVisitedWithRevokedReceipt, selectedAfterTerminal, true) !== newerVisitedWithRevokedReceipt) {
  throw new Error('an authoritative selected response must never revive a terminal Pick')
}

console.log('✓ Pick snapshot merging preserves lifecycle and same-status revision order')
