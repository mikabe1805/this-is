import { planLiveGroupSummary } from './groupLiveState.js'
import type { GroupCircle, GroupSummary } from './groups.js'

function equal(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`)
}

function deepEqual(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(message)
}

const current: GroupCircle = {
  id: 'group-1',
  name: 'Family Sunday',
  status: 'forming',
  memberUids: ['mika'],
  members: [{ uid: 'mika', displayName: 'Mika', avatarHex: '#8E5A6B' }],
  permissionVersion: 1,
  membershipLocked: false,
  projectionCount: 0,
  tastes: [{ uid: 'mika', name: 'Mika', saves: [] }],
  changeLabel: 'Waiting for someone to join',
}

const accepted: GroupSummary = {
  ...current,
  status: 'active',
  memberUids: ['mika', 'vivian'],
  members: [
    current.members[0],
    { uid: 'vivian', displayName: 'Vivian', avatarHex: '#5A6B8E' },
  ],
}

const acceptance = planLiveGroupSummary(current, accepted)
equal(acceptance.action, 'merge', 'membership acceptance is mergeable')
if (acceptance.action === 'merge') {
  equal(acceptance.value.status, 'active', 'forming group becomes active')
  deepEqual(acceptance.value.tastes.map(taste => [taste.uid, taste.saves.length]), [
    ['mika', 0], ['vivian', 0],
  ], 'a newly accepted member begins with unknown taste')
  equal(acceptance.value.changeLabel, 'No shared place signals yet', 'membership does not invent signals')
}

equal(planLiveGroupSummary(current, {
  ...accepted, membershipLocked: true,
}).action, 'refetch', 'audience locking refetches projections')
equal(planLiveGroupSummary(current, {
  ...accepted, projectionCount: 1,
}).action, 'refetch', 'projection changes refetch evidence')
equal(planLiveGroupSummary(current, {
  ...accepted, permissionVersion: 2,
}).action, 'refetch', 'permission changes refetch authorization')
equal(planLiveGroupSummary({ ...current, updatedAt: 10 }, {
  ...accepted, updatedAt: { toMillis: () => 11 },
}).action, 'refetch', 'evidence timestamps refetch projections even when their count is unchanged')

const picked = planLiveGroupSummary(current, {
  ...accepted,
  activePick: { id: 'pick-1', placeId: 'o:place', label: 'Supper Club', attendeeCount: 2, createdAt: 10 },
})
equal(picked.action, 'merge', 'a server-owned current Pick pointer can merge without rereading taste')
if (picked.action === 'merge') equal(picked.value.activePick?.label, 'Supper Club', 'the open group receives its current Pick live')
const visited = planLiveGroupSummary(current, {
  ...accepted,
  recentPick: {
    id: 'pick-1', placeId: 'o:place', label: 'Supper Club',
    attendeeCount: 2, createdAt: 10, visitedAt: 12,
  },
})
equal(visited.action, 'merge', 'a bounded recent Pick pointer can merge without rereading taste')
if (visited.action === 'merge') equal(visited.value.recentPick?.label, 'Supper Club', 'the open group receives its last visited Pick live')

console.log('✓ live group state merges membership only and refetches every evidence boundary change')
