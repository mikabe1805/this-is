import {
  createPlaceAlias,
  normalizeOverturePlace,
  normalizeOverturePlaceResult,
  openCatalogCell,
  resolveKnownOpenPlaceIds,
  type OpenCatalogIngestionContext,
} from './openCatalog.js'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

const context: OpenCatalogIngestionContext = {
  releaseId: '2026-06-17.0',
  schemaVersion: 'v1.17.0',
  licenseLedgerId: 'overture-2026-06-17.0-reviewed-attribution',
  ingestedAt: 1,
}

const normalized = normalizeOverturePlace({
  id: 'gers-1',
  geometry: { type: 'Point', coordinates: [-74.474, 40.552] },
  names: { primary: 'Open Café' },
  operating_status: 'open',
  basic_category: 'cafe',
  taxonomy: {
    primary: 'coffee_shop',
    alternates: ['bakery', 'bakery'],
    hierarchy: ['food_and_drink', 'cafe'],
  },
  websites: ['https://example.com'],
  confidence: 0.92,
  sources: [
    { dataset: 'open-source-a', license: 'Apache-2.0' },
    { dataset: 'open-source-a', license: 'Apache-2.0' },
    { dataset_name: 'open-source-b', license: 'CDLA-Permissive-2.0' },
  ],
  displayName: { text: 'Google must not cross this boundary' },
  formattedAddress: 'Google must not cross this boundary',
  rating: 5,
}, context)

assert(normalized?.id === 'o:gers-1', 'owned IDs use the open namespace')
assert(normalized?.name === 'Open Café', 'owned name comes from the open source')
assert(normalized?.taxonomy?.alternates.join(',') === 'bakery', 'taxonomy is bounded and deduplicated')
assert(normalized?.operatingStatus === 'open', 'current operating status crosses explicitly')
assert(normalized?.provenance.releaseId === '2026-06-17.0', 'a pinned release survives normalization')
assert(normalized?.provenance.schemaVersion === 'v1.17.0', 'the schema version survives normalization')
assert(normalized?.provenance.licenseLedgerId === context.licenseLedgerId, 'reviewed license evidence is addressable')
assert(normalized?.provenance.sourceAttributions.map(source => `${source.dataset}:${source.license}`).join(',')
  === 'open-source-a:Apache-2.0,open-source-b:CDLA-Permissive-2.0',
  'per-source dataset and license provenance survives')
assert(!('displayName' in (normalized ?? {})), 'unknown Google display fields cannot cross the normalizer')
assert(!('formattedAddress' in (normalized ?? {})), 'Google address fields cannot cross the normalizer')
assert(!('rating' in (normalized ?? {})), 'Google atmosphere fields cannot cross the normalizer')

assert(normalizeOverturePlace({ id: 'x', names: { primary: 'No point' }, operating_status: 'open' }, context) === null, 'missing geometry is rejected')
assert(normalizeOverturePlace({
  id: 'x', names: { primary: 'Bad point' }, operating_status: 'open', geometry: { type: 'Point', coordinates: [500, 100] },
}, context) === null, 'invalid coordinates are rejected')
assert(normalizeOverturePlace({
  id: 'x', names: { primary: 'Unknown status' }, geometry: { type: 'Point', coordinates: [-74, 40] },
}, context) === null, 'missing operating status is rejected')
assert(normalizeOverturePlace({
  id: 'x', names: { primary: 'No ledger' }, operating_status: 'open', geometry: { type: 'Point', coordinates: [-74, 40] },
}, { ...context, licenseLedgerId: '' }) === null, 'unreviewed license provenance is rejected')
assert(normalizeOverturePlaceResult({
  id: 'x', names: { primary: 'No sources' }, operating_status: 'open', geometry: { type: 'Point', coordinates: [-74, 40] },
}, context).rejection === 'invalid_provenance', 'each accepted row requires source provenance')

const alias = createPlaceAlias({
  ownedPlaceId: 'o:gers-1',
  googlePlaceId: 'ChIJexample',
  method: 'user_confirmed',
  confidence: 1,
  matchedAt: 1,
})
assert(alias.googlePlaceId === 'ChIJexample', 'the durable Google artifact is an opaque Place ID alias')

const resolved = resolveKnownOpenPlaceIds({
  knownPlaceIds: ['g:ChIJexample', 'o:already-known'],
  aliases: [
    alias,
    createPlaceAlias({
      ownedPlaceId: 'o:suggestion-only', googlePlaceId: 'ChIJexample', method: 'name_geo',
      confidence: 0.99, matchedAt: 2,
    }),
  ],
})
assert([...resolved.excludeOpenPlaceIds].sort().join(',') === 'o:already-known,o:gers-1',
  'only direct open identity and an explicit Google alias become exclusions')
assert(resolved.ambiguousAliasCount === 0 && resolved.invalidAliasCount === 0,
  'valid unambiguous evidence reports no conflict')

const ambiguous = resolveKnownOpenPlaceIds({
  knownPlaceIds: ['g:ChIJexample'],
  aliases: [
    alias,
    createPlaceAlias({
      ownedPlaceId: 'o:different', googlePlaceId: 'ChIJexample', method: 'user_confirmed',
      confidence: 1, matchedAt: 3,
    }),
  ],
})
assert(ambiguous.excludeOpenPlaceIds.size === 0 && ambiguous.ambiguousAliasCount === 1,
  'contradictory explicit aliases fail open rather than hiding either place')

let rejectedAlias = false
try {
  createPlaceAlias({
    ownedPlaceId: 'o:gers-1', googlePlaceId: 'g:ChIJbad', method: 'name_geo', confidence: 2, matchedAt: 0,
  })
} catch {
  rejectedAlias = true
}
assert(rejectedAlias, 'malformed aliases fail explicitly')

let rejectedWeakConfirmation = false
try {
  createPlaceAlias({
    ownedPlaceId: 'o:gers-1', googlePlaceId: 'ChIJweak', method: 'user_confirmed',
    confidence: 0.9, matchedAt: 1,
  })
} catch {
  rejectedWeakConfirmation = true
}
assert(rejectedWeakConfirmation, 'user-confirmed identity cannot carry partial confidence')

assert(openCatalogCell(40.552, -74.474) === '40.55_-74.45', 'open catalog cells are deterministic')

console.log('✓ owned/open catalog normalization preserves provenance and excludes Google content')
