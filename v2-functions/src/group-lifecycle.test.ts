import {
  acceptGroupMember,
  buildGroupAudienceStamp,
  buildGroupQuickStartPreference,
  groupAudienceStampMatches,
  groupSignalProjection,
  memberSnapshot,
  normalizeGroupAudienceStamp,
  normalizePlaceObservations,
  normalizeGroupName,
  type GroupLifecycleState,
} from './group-lifecycle.js'

function equal(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`)
  }
}

equal(normalizeGroupName('  Friday   Table  '), 'Friday Table', 'group names normalize')
equal(normalizeGroupName('x'), null, 'one-character group names fail')
equal(memberSnapshot('mika', { displayName: 'Mika', avatarHex: '#8E5A6B' })?.uid, 'mika', 'profile becomes member snapshot')
equal(memberSnapshot('mika', { displayName: 'Mika', avatarHex: 'amber' }), null, 'invalid avatar fails closed')

const forming: GroupLifecycleState = {
  name: 'Friday Table', status: 'forming', memberUids: ['mika'],
  members: [{ uid: 'mika', displayName: 'Mika', avatarHex: '#8E5A6B' }],
  membershipLocked: false, permissionVersion: 1,
}
const active = acceptGroupMember(forming, { uid: 'vivian', displayName: 'Vivian', avatarHex: '#5A6B8E' })
equal(active.status, 'active', 'second accepted member activates the group')
equal(acceptGroupMember(active, active.members[1]).memberUids.length, 2, 'acceptance is idempotent for a member')
let locked = false
try { acceptGroupMember({ ...active, membershipLocked: true }, { uid: 'ari', displayName: 'Ari', avatarHex: '#6B8E5A' }) } catch { locked = true }
equal(locked, true, 'sharing locks the membership audience')

const withoutNote = groupSignalProjection({
  uid: 'mika', placeId: 'o:radio', tag: 'loved', ts: 1, note: 'Private detail',
  memory: { placeId: 'o:radio', label: 'Radio Bakery', category: 'coffee', area: 'Cresskill, NJ', hex: '#5A463C', provenance: 'user_confirmed' },
  observations: { quiet: { value: 'yes', observedAt: 10, audience: 'private', source: 'user_authored' } },
}, 2, false)
equal('note' in withoutNote, false, 'notes require explicit group sharing')
equal(withoutNote.permissionVersion, 2, 'projection carries the current permission version')
equal(withoutNote.includeNote, false, 'projection preserves explicit note consent even when false')
equal((withoutNote.memory as { area?: string }).area, 'Cresskill, NJ', 'projection preserves the user-confirmed place area')
equal('observations' in withoutNote, false, 'observations require separate explicit group sharing')
const withObservations = groupSignalProjection({
  uid: 'mika', placeId: 'o:radio', tag: 'loved', ts: 1,
  memory: { placeId: 'o:radio', label: 'Radio Bakery', category: 'coffee', hex: '#5A463C', provenance: 'user_confirmed' },
  observations: { quiet: { value: 'yes', observedAt: 10, audience: 'private', source: 'user_authored' } },
}, 2, false, true)
equal((withObservations.observations as { quiet: { audience: string } }).quiet.audience, 'group',
  'explicitly shared observations carry a group audience')
equal(normalizePlaceObservations({ quiet: {
  value: 'yes', observedAt: 10, audience: 'private', source: 'google',
} }, 'private'), null, 'provider observations fail closed')
equal(buildGroupQuickStartPreference({
  uid: 'mika', categoryHints: ['coffee'], constraintHints: ['quiet'], permissionVersion: 2,
})?.categoryHints, ['coffee'], 'Quick start accepts bounded non-sensitive hints')
equal(buildGroupQuickStartPreference({
  uid: 'mika', categoryHints: ['drinks'], constraintHints: [], permissionVersion: 2,
}), null, 'Quick start excludes nightlife by default')

const audienceInput = ['vivian', 'mika']
const reviewedAudience = normalizeGroupAudienceStamp({
  permissionVersion: 2,
  memberUids: audienceInput,
})
equal(reviewedAudience, { permissionVersion: 2, memberUids: ['mika', 'vivian'] },
  'audience stamps normalize to a deterministic order')
equal(audienceInput, ['vivian', 'mika'], 'audience normalization leaves caller state untouched')
equal(buildGroupAudienceStamp(active), { permissionVersion: 1, memberUids: ['mika', 'vivian'] },
  'a lifecycle state builds an exact audience stamp')
equal(groupAudienceStampMatches(reviewedAudience, { ...active, permissionVersion: 2 }), true,
  'matching is insensitive to member order')
equal(groupAudienceStampMatches(reviewedAudience, { ...active, permissionVersion: 3 }), false,
  'a permission-version change makes an audience stale')
equal(groupAudienceStampMatches(reviewedAudience, {
  ...active, permissionVersion: 2, memberUids: ['mika', 'ari'],
}), false, 'a membership change makes an audience stale')
equal(normalizeGroupAudienceStamp({ ...reviewedAudience, reviewedAt: 10 }), null,
  'the server rejects extra audience stamp keys')
equal(normalizeGroupAudienceStamp({ permissionVersion: 2 }), null,
  'the server rejects a partial audience stamp')
equal(normalizeGroupAudienceStamp({ permissionVersion: 2.5, memberUids: ['mika', 'vivian'] }), null,
  'the server rejects a non-integer permission version')
equal(normalizeGroupAudienceStamp({ permissionVersion: '2', memberUids: ['mika', 'vivian'] }), null,
  'the server rejects a string permission version')
equal(normalizeGroupAudienceStamp({ permissionVersion: 2, memberUids: ['mika', 'mika'] }), null,
  'the server rejects duplicate audience members')
equal(normalizeGroupAudienceStamp({ permissionVersion: 2, memberUids: ['mika', 'bad/member'] }), null,
  'the server rejects unsafe audience member identifiers')

console.log('✓ group lifecycle preserves consent, audience locking, and bounded projections')
