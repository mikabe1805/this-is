import { buildOpenDiscoveryShortlist, openPlaceCategory } from './openDiscovery.js'
import type { GroupMemberTaste } from './groupRecommendation.js'
import { createPlaceAlias, type OwnedOpenPlace } from './openCatalog.js'
import { buildDurablePlaceMemory } from './placeMemory.js'
import type { FriendSave } from './signals.js'

function equal(actual: unknown, expected: unknown, message = 'values differ') {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`)
}
function deepEqual(actual: unknown, expected: unknown, message = 'values differ') {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(message)
}
function match(value: string, pattern: RegExp, message = 'value does not match') {
  if (!pattern.test(value)) throw new Error(message)
}
function throws(run: () => unknown, pattern: RegExp) {
  try { run() } catch (error) {
    if (error instanceof Error && pattern.test(error.message)) return
    throw error
  }
  throw new Error('expected rejection')
}

const openPlace = (
  id: string,
  name: string,
  lat: number,
  lng: number,
  hierarchy: string[],
  operatingStatus: OwnedOpenPlace['operatingStatus'] = 'open',
): OwnedOpenPlace => ({
  id: `o:${id}`,
  gersId: id,
  name,
  lat,
  lng,
  basicCategory: hierarchy.at(-1),
  taxonomy: { primary: hierarchy.at(-1), alternates: [], hierarchy },
  confidence: 0.9,
  operatingStatus,
  provenance: {
    provider: 'overture', releaseId: '2026-06-17.0', schemaVersion: 'v1.17.0',
    licenseLedgerId: 'fixture-ledger', ingestedAt: 1,
    sourceAttributions: [{ dataset: 'fixture-open', license: 'Apache-2.0' }],
  },
})
const save = (uid: string, category: 'food' | 'drinks' | 'coffee' | 'activity', visibility: 'circle' | 'private' = 'circle'): FriendSave => {
  const memory = buildDurablePlaceMemory({ placeId: `${uid}-${category}-history`, userLabel: `${category} history`, category })!
  return { id: `${uid}-${category}`, uid, placeId: memory.placeId, tag: 'loved', visibility, ts: 1, memory,
    place: { name: memory.label, primaryType: category, hex: memory.hex } }
}
const members: GroupMemberTaste[] = [
  { uid: 'a', name: 'A', saves: [save('a', 'food'), save('a', 'coffee', 'private')] },
  { uid: 'b', name: 'B', saves: [save('b', 'food')] },
  { uid: 'c', name: 'C', saves: [], quickStart: { uid: 'c', categoryHints: ['coffee'], constraintHints: [], permissionVersion: 1 } },
]
const places = [
  openPlace('near-food', 'Near Food', 40.001, -74, ['food_and_drink', 'restaurant', 'casual_eatery']),
  openPlace('far-food', 'Far Food', 40.02, -74, ['food_and_drink', 'restaurant']),
  openPlace('coffee', 'Coffee', 40.003, -74, ['food_and_drink', 'coffee_shop']),
  openPlace('wine', 'Wine Bar', 40.004, -74, ['food_and_drink', 'bar', 'wine_bar']),
  openPlace('hospital', 'Hospital', 40.001, -74, ['health_and_medical', 'hospital']),
  openPlace('closed-food', 'Closed Food', 40.001, -74, ['food_and_drink', 'restaurant'], 'permanently_closed'),
  openPlace('paused-food', 'Paused Food', 40.001, -74, ['food_and_drink', 'restaurant'], 'temporarily_closed'),
]

equal(openPlaceCategory(places[0]), 'food')
equal(openPlaceCategory(places[2]), 'coffee')
equal(openPlaceCategory(places[4]), null)

const result = buildOpenDiscoveryShortlist({
  members,
  places,
  area: { label: 'The area we chose', lat: 40, lng: -74, radiusKm: 5, provenance: 'explicit_plan' },
})
deepEqual(result.map(candidate => candidate.place.name), ['Near Food', 'Far Food'])
equal(result[0].reason, 'New to this group · matches food history from 2 of 3.')
deepEqual(result[0].sources, ['Overture open catalog', 'Current group category evidence', 'Explicit plan area'])
equal(result.some(candidate => candidate.place.name === 'Coffee'), false, 'a private signal plus a hint cannot invent group fit')
equal(result.some(candidate => candidate.place.name === 'Hospital'), false, 'unsupported sensitive categories stay out')
equal(result.some(candidate => candidate.place.name === 'Closed Food'), false, 'permanently closed places fail closed')
equal(result.some(candidate => candidate.place.name === 'Paused Food'), false, 'temporarily closed places fail closed')

const googleKnown = save('a', 'food')
googleKnown.id = 'a__g:ChIJNearFood'
googleKnown.placeId = 'g:ChIJNearFood'
googleKnown.memory = { ...googleKnown.memory!, placeId: 'g:ChIJNearFood', label: 'Near Food' }
const explicitAlias = createPlaceAlias({
  ownedPlaceId: 'o:near-food', googlePlaceId: 'ChIJNearFood', method: 'user_confirmed',
  confidence: 1, matchedAt: 1,
})
const deduped = buildOpenDiscoveryShortlist({
  members: [{ ...members[0], saves: [...members[0].saves, googleKnown] }, ...members.slice(1)],
  places,
  placeAliases: [explicitAlias],
  area: { label: 'The area we chose', lat: 40, lng: -74, radiusKm: 5, provenance: 'explicit_plan' },
})
deepEqual(deduped.map(candidate => candidate.place.name), ['Far Food'],
  'one explicit Google-to-open alias prevents the same venue appearing as unfamiliar')

const suggestedAlias = createPlaceAlias({
  ownedPlaceId: 'o:near-food', googlePlaceId: 'ChIJNearFood', method: 'name_geo',
  confidence: 0.99, matchedAt: 1,
})
equal(buildOpenDiscoveryShortlist({
  members: [{ ...members[0], saves: [...members[0].saves, googleKnown] }, ...members.slice(1)],
  places,
  placeAliases: [suggestedAlias],
  area: { label: 'The area we chose', lat: 40, lng: -74, radiusKm: 5, provenance: 'explicit_plan' },
}).some(candidate => candidate.place.id === 'o:near-food'), true,
  'matching name or coordinates never becomes dedup evidence without confirmation')

const privateGoogleKnown = { ...googleKnown, id: 'a__private-google', visibility: 'private' as const }
equal(buildOpenDiscoveryShortlist({
  members: [{ ...members[0], saves: [...members[0].saves, privateGoogleKnown] }, ...members.slice(1)],
  places,
  placeAliases: [explicitAlias],
  area: { label: 'The area we chose', lat: 40, lng: -74, radiusKm: 5, provenance: 'explicit_plan' },
}).some(candidate => candidate.place.id === 'o:near-food'), true,
  'a private known identity cannot silently change the group shortlist')

const contradictoryAlias = createPlaceAlias({
  ownedPlaceId: 'o:far-food', googlePlaceId: 'ChIJNearFood', method: 'user_confirmed',
  confidence: 1, matchedAt: 2,
})
equal(buildOpenDiscoveryShortlist({
  members: [{ ...members[0], saves: [...members[0].saves, googleKnown] }, ...members.slice(1)],
  places,
  placeAliases: [explicitAlias, contradictoryAlias],
  area: { label: 'The area we chose', lat: 40, lng: -74, radiusKm: 5, provenance: 'explicit_plan' },
}).filter(candidate => ['o:near-food', 'o:far-food'].includes(candidate.place.id)).length, 2,
  'ambiguous explicit aliases suppress neither candidate')

const drinksInput = {
  members: [
    { uid: 'a', name: 'A', saves: [save('a', 'drinks')] },
    { uid: 'b', name: 'B', saves: [save('b', 'drinks')] },
  ],
  places,
  area: { label: 'The area we chose', lat: 40, lng: -74, radiusKm: 5, provenance: 'explicit_plan' as const },
}
equal(buildOpenDiscoveryShortlist(drinksInput).some(candidate => candidate.category === 'drinks'), false,
  'shared nightlife history is not a substitute for explicit group consent')
equal(buildOpenDiscoveryShortlist({ ...drinksInput, groupSensitiveCategoryOptIns: new Set(['drinks'] as const) })
  .some(candidate => candidate.category === 'drinks'), true,
  'a reviewed per-group opt-in can activate drinks discovery')

const withWeakCoffee = buildOpenDiscoveryShortlist({
  members: [
    { uid: 'a', name: 'A', saves: [save('a', 'coffee')] },
    members[2],
  ],
  places,
  area: { label: 'The area we chose', lat: 40, lng: -74, radiusKm: 5, provenance: 'explicit_plan' },
  knownPlaceIds: new Set(['o:near-food']),
  limit: 99,
})
equal(withWeakCoffee.length, 1)
match(withWeakCoffee[0].reason, /one member's coffee history and another's coffee hint/)

throws(() => buildOpenDiscoveryShortlist({
  members,
  places,
  area: { label: 'x', lat: 40, lng: -74, radiusKm: 100, provenance: 'explicit_plan' },
}), /explicit bounded plan area/)
equal(result.length <= 3, true)
console.log('✓ open discovery is explicit-area, group-evidence bounded, provenance-carrying, and limited to three')
