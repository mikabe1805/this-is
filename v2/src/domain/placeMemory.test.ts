import {
  GOOGLE_CONTENT_LIFETIME_MS,
  buildDurablePlaceMemory,
  buildEphemeralGoogleSnapshot,
  isLiveGoogleSnapshot,
  planLegacyPlaceMigration,
} from './placeMemory.js'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const durable = buildDurablePlaceMemory({
  placeId: 'g:ChIJproof',
  userLabel: '  the bakery by Sam  ',
  category: 'coffee',
  userArea: '  Cresskill,   NJ  ',
})
assert(durable?.label === 'the bakery by Sam', 'a deliberate label becomes durable user memory')
assert(durable?.provenance === 'user_confirmed', 'durable memory carries explicit provenance')
assert(durable?.area === 'Cresskill, NJ', 'an optional typed area becomes a bounded user-confirmed place fact')
assert(!('name' in (durable ?? {})), 'Google display-name shape is not copied into durable memory')

assert(buildDurablePlaceMemory({ placeId: 'g:x', userLabel: '', category: 'food' }) === null,
  'an empty label cannot masquerade as user-authored memory')
assert(buildDurablePlaceMemory({ placeId: 'g:x', userLabel: 'x', category: 'restaurant' }) === null,
  'only the small user-facing category vocabulary is durable')
assert(buildDurablePlaceMemory({ placeId: 'g:x', userLabel: 'x', category: 'food', userArea: 'x'.repeat(81) }) === null,
  'an unbounded area cannot enter durable memory')

const fetchedAt = 1_000
const snapshot = buildEphemeralGoogleSnapshot({
  placeId: 'g:ChIJproof', name: 'Google Name', formattedAddress: 'Google Address',
  primaryType: 'bakery', lat: 40.5, lng: -74.5, fetchedAt,
})
assert(snapshot?.expiresAt === fetchedAt + GOOGLE_CONTENT_LIFETIME_MS,
  'Google facts receive an exact 30-day expiry')
assert(Boolean(snapshot && isLiveGoogleSnapshot(snapshot, snapshot.expiresAt - 1)),
  'snapshot is live only before expiry')
assert(Boolean(snapshot && !isLiveGoogleSnapshot(snapshot, snapshot.expiresAt)),
  'snapshot expires at the boundary')

const unresolved = planLegacyPlaceMigration({ placeId: 'g:ChIJproof' })
assert(unresolved.status === 'needs_user_confirmation',
  'legacy Google names are never silently reclassified as user content')
const ready = planLegacyPlaceMigration({
  placeId: 'g:ChIJproof', confirmedLabel: 'our late-night place', confirmedCategory: 'drinks',
  confirmedArea: 'Cresskill, NJ',
})
assert(ready.status === 'ready' && ready.memory.label === 'our late-night place',
  'explicit confirmation makes the durable migration actionable')
assert(ready.status === 'ready' && ready.memory.area === 'Cresskill, NJ',
  'legacy migration can carry only an explicitly confirmed area')

console.log('✓ place memory separates durable user meaning from expiring Google facts')
