import assert from 'node:assert/strict'
import { planLegacyMigration } from './migration-core.mjs'

const timestamp = milliseconds => ({ toMillis: () => milliseconds })
const base = {
  uid: 'alice',
  savedMarkers: [],
  lists: [],
  listPlacesByList: {},
  placesById: {},
  existingSaveIds: [],
}
const confirmed = (placeId, label = 'My place', category = 'other') => ({
  confirmedMemoriesByPlaceId: { [placeId]: { label, category } },
})

function test(name, run) {
  run()
  console.log(`✓ ${name}`)
}

test('explicit list status and note become one deterministic v2 signal', () => {
  const plan = planLegacyMigration({
    ...base,
    ...confirmed('g:ChIJone', 'Our dinner place', 'food'),
    lists: [{ id: 'favorites', name: 'Favorites' }],
    listPlacesByList: { favorites: [{ placeId: 'legacy-1', status: 'loved', note: 'Back room.', addedAt: timestamp(20) }] },
    placesById: { 'legacy-1': { googlePlaceId: 'ChIJone', name: 'One', address: '1 Main St, Brooklyn, NY', primaryType: 'restaurant' } },
  })
  assert.equal(plan.creates[0].saveId, 'alice__g:ChIJone')
  assert.equal(plan.creates[0].save.tag, 'loved')
  assert.equal(plan.creates[0].save.visibility, 'private')
  assert.equal(plan.creates[0].save.note, 'Back room.')
  assert.deepEqual(plan.creates[0].save.memory, {
    placeId: 'g:ChIJone', label: 'Our dinner place', category: 'food',
    hex: '#704739', provenance: 'user_confirmed',
  })
  assert.equal('place' in plan.creates[0].save, false)
})

test('circle visibility requires an explicit migration choice', () => {
  const plan = planLegacyMigration({
    ...base,
    ...confirmed('g:ChIJshared'),
    targetVisibility: 'circle',
    savedMarkers: [{ placeId: 'ChIJshared', status: 'want' }],
    placesById: { ChIJshared: { name: 'Shared' } },
  })
  assert.equal(plan.creates[0].save.visibility, 'circle')
})

test('an auto-status list can recover sentiment when the row lacks it', () => {
  const plan = planLegacyMigration({
    ...base,
    ...confirmed('g:ChIJtwo'),
    lists: [{ id: 'all-want', autoStatus: 'want' }],
    listPlacesByList: { 'all-want': [{ placeId: 'ChIJtwo', addedAt: 10 }] },
    placesById: { ChIJtwo: { name: 'Two' } },
  })
  assert.equal(plan.creates[0].save.tag, 'want')
  assert.equal(plan.creates[0].provenance.source, 'autoStatusList')
})

test('newest explicit signal wins across duplicate list memberships', () => {
  const plan = planLegacyMigration({
    ...base,
    ...confirmed('g:ChIJthree'),
    lists: [{ id: 'a' }, { id: 'b' }],
    listPlacesByList: {
      a: [{ placeId: 'ChIJthree', status: 'want', addedAt: timestamp(10) }],
      b: [{ placeId: 'ChIJthree', status: 'tried', addedAt: timestamp(30) }],
    },
    placesById: { ChIJthree: { name: 'Three' } },
  })
  assert.equal(plan.creates.length, 1)
  assert.equal(plan.creates[0].save.tag, 'tried')
})

test('a marker with no sentiment is reported rather than invented', () => {
  const plan = planLegacyMigration({ ...base, savedMarkers: [{ placeId: 'ChIJunknown' }] })
  assert.deepEqual(plan.skipped, [{ legacyId: 'ChIJunknown', reason: 'unknown_status' }])
})

test('an internal place id without a Google identity is reported', () => {
  const plan = planLegacyMigration({
    ...base,
    ...confirmed('g:ChIJexisting'),
    savedMarkers: [{ placeId: 'internal-1', status: 'loved' }],
    placesById: { 'internal-1': { name: 'Mystery' } },
  })
  assert.equal(plan.skipped[0].reason, 'unresolved_google_place_id')
})

test('an existing v2 signal is never overwritten', () => {
  const plan = planLegacyMigration({
    ...base,
    savedMarkers: [{ placeId: 'ChIJexisting', status: 'want' }],
    placesById: { ChIJexisting: { name: 'Existing' } },
    existingSaveIds: ['alice__g:ChIJexisting'],
  })
  assert.equal(plan.creates.length, 0)
  assert.equal(plan.skipped[0].reason, 'existing_v2_signal')
})

test('legacy provider content is unresolved until a person supplies their own memory', () => {
  const plan = planLegacyMigration({
    ...base,
    savedMarkers: [{ placeId: 'ChIJplace', status: 'loved' }],
    placesById: { ChIJplace: { name: 'Legacy name' } },
  })
  assert.equal(plan.creates.length, 0)
  assert.equal(plan.skipped[0].reason, 'needs_user_confirmation')
  assert.equal(JSON.stringify(plan).includes('Legacy name'), false)
})

test('the rollback manifest contains only documents newly planned', () => {
  const plan = planLegacyMigration({
    ...base,
    ...confirmed('g:ChIJnew'),
    savedMarkers: [{ placeId: 'ChIJnew', status: 'tried' }],
    placesById: { ChIJnew: { name: 'New' } },
  })
  assert.deepEqual(plan.rollback.deleteSaveIds, ['alice__g:ChIJnew'])
  assert.deepEqual(plan.rollback.deletePlaceIds, [])
})

test('re-running after the planned creates is a no-op', () => {
  const input = {
    ...base,
    ...confirmed('g:ChIJrepeat'),
    savedMarkers: [{ placeId: 'ChIJrepeat', status: 'loved' }],
    placesById: { ChIJrepeat: { name: 'Repeat' } },
  }
  const first = planLegacyMigration(input)
  const second = planLegacyMigration({
    ...input,
    existingSaveIds: first.creates.map(item => item.saveId),
  })
  assert.equal(first.creates.length, 1)
  assert.equal(second.creates.length, 0)
  assert.equal(second.skipped[0].reason, 'existing_v2_signal')
})

test('tie resolution is stable regardless of list order', () => {
  const make = lists => planLegacyMigration({
    ...base,
    ...confirmed('g:ChIJtie'),
    lists,
    listPlacesByList: {
      a: [{ id: 'row-a', placeId: 'ChIJtie', status: 'loved', note: 'Alpha', addedAt: 10 }],
      b: [{ id: 'row-b', placeId: 'ChIJtie', status: 'loved', note: 'Beta', addedAt: 10 }],
    },
    placesById: { ChIJtie: { name: 'Tie' } },
  })
  assert.deepEqual(make([{ id: 'a' }, { id: 'b' }]), make([{ id: 'b' }, { id: 'a' }]))
})
