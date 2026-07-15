import {
  canonicalSignalFromSave,
  planProjectionSync,
  projectionBelongsToSaveLifetime,
} from './projection-sync.js'

function equal(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`)
  }
}

const memory = {
  placeId: 'o:proof', label: 'Owner label', category: 'food' as const,
  area: 'Cresskill, NJ',
  hex: '#704739', provenance: 'user_confirmed' as const,
}
const canonical = canonicalSignalFromSave({
  uid: 'mika', placeId: 'o:proof', tag: 'loved', ts: 4, note: '  Bring everyone  ', memory,
  observations: { quiet: { value: 'yes', observedAt: 10, audience: 'private', source: 'user_authored' } },
}, 'mika', 'o:proof')
if (!canonical) throw new Error('valid canonical fixture rejected')
const group = {
  id: 'group', name: 'Friday', status: 'active' as const, memberUids: ['mika', 'vivian'],
  members: [], permissionVersion: 3, membershipLocked: true, projectionCount: 1,
}

const privateNote = planProjectionSync({
  canonical, group, projection: { uid: 'mika', placeId: 'o:proof', includeNote: false },
})
equal(privateNote.action, 'update', 'an existing selected projection updates')
if (privateNote.action !== 'update') throw new Error('update plan missing')
equal(privateNote.value.tag, 'loved', 'tag follows canonical truth')
equal(privateNote.value.memory, memory, 'user-confirmed memory follows canonical truth')
equal(privateNote.value.includeNote, false, 'note consent remains explicit')
equal('note' in privateNote.value, false, 'private note does not leak during sync')
equal('observations' in privateNote.value, false, 'private observations do not leak during sync')
equal(planProjectionSync({
  canonical,
  group,
  projection: { ...privateNote.value },
}).action, 'none', 'an already-current projection is a semantic no-op')
equal(planProjectionSync({
  canonical,
  group,
  projection: { ...privateNote.value, obsoleteField: true },
}).action, 'update', 'unexpected projection fields are removed by one corrective update')

const emptyLegacyConsent = planProjectionSync({
  canonical,
  group,
  projection: {
    uid: 'mika', placeId: 'o:proof', note: '   ', observations: {},
  },
})
if (emptyLegacyConsent.action !== 'update') throw new Error('empty legacy consent repair plan missing')
equal(emptyLegacyConsent.value.includeNote, false,
  'a blank legacy note never grants future note-sharing consent')
equal('note' in emptyLegacyConsent.value, false,
  'a current private note stays private after blank legacy data')
equal(emptyLegacyConsent.value.includeObservations, false,
  'an empty legacy observation map never grants future observation-sharing consent')
equal('observations' in emptyLegacyConsent.value, false,
  'current private observations stay private after empty legacy data')

const sharedNote = planProjectionSync({
  canonical, group, projection: { uid: 'mika', placeId: 'o:proof', includeNote: true },
})
if (sharedNote.action !== 'update') throw new Error('shared-note update plan missing')
equal(sharedNote.value.note, 'Bring everyone', 'opted-in note follows canonical edits')

const sharedObservations = planProjectionSync({
  canonical, group, projection: {
    uid: 'mika', placeId: 'o:proof', includeNote: false, includeObservations: true,
  },
})
if (sharedObservations.action !== 'update') throw new Error('shared-observation update plan missing')
equal((sharedObservations.value.observations as { quiet: { audience: string } }).quiet.audience, 'group',
  'opted-in observations follow canonical edits with group audience')

equal(planProjectionSync({ canonical: null, group, projection: { uid: 'mika', placeId: 'o:proof' } }).action,
  'delete', 'canonical deletion removes the selected projection')
equal(planProjectionSync({ canonical, group: { ...group, status: 'forming' }, projection: { uid: 'mika', placeId: 'o:proof' } }).action,
  'delete', 'inactive group evidence fails closed')
equal(planProjectionSync({ canonical, group, projection: null }).action,
  'none', 'an unselected group remains untouched')
equal(projectionBelongsToSaveLifetime(
  { seconds: 10, nanoseconds: 2 },
  { seconds: 10, nanoseconds: 1 },
), true, 'a projection written after save creation belongs to that save lifetime')
equal(projectionBelongsToSaveLifetime(
  { seconds: 9, nanoseconds: 999_999_999 },
  { seconds: 10, nanoseconds: 0 },
), false, 'old consent cannot transfer across delete and recreate')
equal(projectionBelongsToSaveLifetime(null, { seconds: 10, nanoseconds: 0 }), false,
  'missing server metadata fails closed')

console.log('✓ selected group projections follow canonical edits, note consent, and deletion')
