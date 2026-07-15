import { buildGroupCircle, normalizeGroupQuickStart, normalizeGroupSignal, normalizeGroupSummary } from './groups.js'
import {
  buildGroupAudienceStamp,
  groupAudienceStampMatches,
  normalizeGroupAudienceStamp,
} from './groupAudience.js'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const rawGroup = {
  name: 'Friday Table',
  status: 'active',
  memberUids: ['mika', 'vivian'],
  members: [
    { uid: 'mika', displayName: 'Mika', avatarHex: '#8E5A6B' },
    { uid: 'vivian', displayName: 'Vivian', avatarHex: '#5A6B8E' },
  ],
  permissionVersion: 3,
  membershipLocked: true,
  projectionCount: 1,
}

const group = normalizeGroupSummary('friday', rawGroup)
assert(group, 'a bounded active group normalizes')
const groupWithPick = normalizeGroupSummary('friday', {
  ...rawGroup,
  activePick: { id: 'pick-1', placeId: 'o:proof', label: 'Proof Place', attendeeCount: 3, createdAt: 10 },
})
assert(groupWithPick?.activePick?.label === 'Proof Place', 'a bounded server-owned current Pick pointer normalizes')
assert(!normalizeGroupSummary('friday', {
  ...rawGroup,
  activePick: { id: 'pick-1', placeId: 'o:proof', label: 'Proof Place', attendeeCount: 8, createdAt: 10 },
}), 'an impossible current Pick audience fails closed')
const groupWithRecentPick = normalizeGroupSummary('friday', {
  ...rawGroup,
  recentPick: {
    id: 'pick-visited', placeId: 'o:proof', label: 'Proof Place',
    attendeeCount: 3, createdAt: 10, visitedAt: 12,
  },
})
assert(groupWithRecentPick?.recentPick?.visitedAt === 12, 'one bounded visited Pick pointer normalizes')
assert(!normalizeGroupSummary('friday', {
  ...rawGroup,
  recentPick: {
    id: 'pick-visited', placeId: 'o:proof', label: 'Proof Place',
    attendeeCount: 3, createdAt: 10, visitedAt: 9,
  },
}), 'a visited pointer cannot predate its Pick')
assert(!normalizeGroupSummary('friday', { ...rawGroup, memberUids: ['mika'] }), 'one-person groups fail closed')
assert(!normalizeGroupSummary('friday', {
  ...rawGroup,
  members: [{ uid: 'mika', displayName: 'Mika', avatarHex: '#8E5A6B' }],
}), 'missing member snapshots fail closed')
assert(!normalizeGroupSummary('friday', {
  ...rawGroup,
  members: [
    { uid: 'mika', displayName: 'Mika', avatarHex: '#8E5A6B' },
    { uid: 'mika', displayName: 'Mika again', avatarHex: '#8E5A6B' },
  ],
}), 'duplicate member snapshots cannot misstate the exact reviewed audience')
assert(normalizeGroupSummary('forming', {
  ...rawGroup,
  status: 'forming',
  memberUids: ['mika'],
  members: [{ uid: 'mika', displayName: 'Mika', avatarHex: '#8E5A6B' }],
  membershipLocked: false,
  projectionCount: 0,
}), 'one-person forming groups are a valid invitation state')

const signal = normalizeGroupSignal('mika__radio', {
  uid: 'mika',
  placeId: 'radio',
  tag: 'want',
  visibility: 'circle',
  ts: 10,
  memory: { placeId: 'radio', label: 'Radio Bakery', category: 'coffee', hex: '#5A463C', provenance: 'user_confirmed' },
  permissionVersion: 3,
})
assert(signal, 'a current server projection normalizes')
const stale = normalizeGroupSignal('vivian__old', {
  uid: 'vivian', placeId: 'old', tag: 'loved', visibility: 'circle', ts: 1,
  memory: { placeId: 'old', label: 'Old Place', category: 'other', hex: '#4A3A43', provenance: 'user_confirmed' }, permissionVersion: 2,
})
assert(stale, 'stale projections remain shape-valid before permission filtering')
const quickStart = normalizeGroupQuickStart({
  uid: 'vivian', categoryHints: ['coffee'], constraintHints: ['quiet'], permissionVersion: 3,
})
assert(quickStart, 'a bounded current Quick start preference normalizes')
const circle = buildGroupCircle(group, [signal, stale], [quickStart])
assert(circle.tastes[0]?.saves.length === 1, 'current projections reach their member')
assert(circle.tastes[1]?.saves.length === 0, 'stale permission versions fail closed')
assert(circle.tastes[1]?.quickStart?.categoryHints[0] === 'coffee', 'current weak preferences reach only their member')
assert(circle.changeLabel === '1 shared signal', 'group summary describes real projection count')
assert(!normalizeGroupSignal('legacy', {
  uid: 'mika', placeId: 'legacy', tag: 'loved', visibility: 'circle', ts: 1,
  place: { name: 'Provider name', hex: '#333333' }, permissionVersion: 3,
}), 'legacy provider snapshots do not normalize as group evidence')

const reviewedAudienceInput = ['vivian', 'mika']
const reviewedAudience = normalizeGroupAudienceStamp({
  permissionVersion: 3,
  memberUids: reviewedAudienceInput,
})
assert(reviewedAudience?.memberUids.join('|') === 'mika|vivian', 'reviewed audiences normalize to a stable order')
assert(reviewedAudienceInput.join('|') === 'vivian|mika', 'audience normalization does not mutate its input')
assert(buildGroupAudienceStamp(group)?.memberUids.join('|') === 'mika|vivian',
  'a loaded group builds the exact audience stamp used by a write')
assert(groupAudienceStampMatches(reviewedAudience, group), 'member order does not change audience identity')
assert(!groupAudienceStampMatches(reviewedAudience, { ...group, permissionVersion: 4 }),
  'a permission-version change invalidates an earlier review')
assert(!groupAudienceStampMatches(reviewedAudience, { ...group, memberUids: ['mika', 'ari'] }),
  'a membership change invalidates an earlier review')
assert(!normalizeGroupAudienceStamp({ ...reviewedAudience, groupId: 'friday' }),
  'the submitted audience stamp rejects extra keys')
assert(!normalizeGroupAudienceStamp({ permissionVersion: 3 }), 'the submitted audience stamp requires both keys')
assert(!normalizeGroupAudienceStamp({ permissionVersion: 0, memberUids: ['mika', 'vivian'] }),
  'the submitted audience stamp requires a positive safe permission version')
assert(!normalizeGroupAudienceStamp({ permissionVersion: '3', memberUids: ['mika', 'vivian'] }),
  'the submitted audience stamp rejects a string permission version')
assert(!normalizeGroupAudienceStamp({ permissionVersion: 3, memberUids: ['mika'] }),
  'the submitted audience stamp requires a valid active-group size')
assert(!normalizeGroupAudienceStamp({ permissionVersion: 3, memberUids: ['mika', 'mika'] }),
  'the submitted audience stamp rejects duplicate members')
assert(!normalizeGroupAudienceStamp({ permissionVersion: 3, memberUids: ['mika', 'bad/member'] }),
  'the submitted audience stamp rejects unsafe member identifiers')

console.log('✓ persistent groups fail closed and reject stale signal projections')
