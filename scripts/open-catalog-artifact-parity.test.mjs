import { strict as assert } from 'node:assert'
import { createHash } from 'node:crypto'

import { buildOpenCatalogArtifact, serializeOpenCatalogArtifact } from '../v2/.domain-test/domain/openCatalogArtifact.js'
import { extractOpenCatalogRows } from '../v2/.domain-test/domain/openCatalogExtraction.js'
import {
  normalizeOpenCatalogServiceConfig,
  parseOpenCatalogArtifact,
  queryOpenCatalogArtifact,
} from '../v2-functions/lib/open-catalog.js'

const context = {
  releaseId: '2026-06-17.0',
  schemaVersion: 'v1.17.0',
  licenseLedgerId: 'overture-reviewed-2026-06-17',
  ingestedAt: 1,
}
const bbox = [-74.5, 40.5, -74.4, 40.6]
const row = (id, lat, lng, category = 'restaurant') => ({
  id,
  geometry: { type: 'Point', coordinates: [lng, lat] },
  names: { primary: `Parity ${id}` },
  operating_status: 'open',
  basic_category: category,
  taxonomy: {
    primary: category,
    alternates: [],
    hierarchy: [category === 'hospital' ? 'health_and_medical' : 'food_and_drink'],
  },
  websites: [`https://example.com/${id}`],
  confidence: 0.8,
  sources: [{ dataset: 'parity-fixture', license: 'Apache-2.0' }],
  google_place_id: 'discard-me',
})

const extraction = extractOpenCatalogRows({
  rows: [
    row('near-b', 40.551, -74.451),
    row('near-a', 40.55, -74.45),
    row('far', 40.59, -74.41),
    row('unsupported', 40.552, -74.452, 'hospital'),
  ],
  bbox,
  context,
  limits: { maxRawRows: 10, maxAcceptedRows: 10, maxCells: 10 },
})
const serialized = serializeOpenCatalogArtifact(buildOpenCatalogArtifact({ extraction, bbox, context }))
const bytes = new TextEncoder().encode(serialized)
const config = normalizeOpenCatalogServiceConfig({
  enabled: true,
  objectPath: 'open-catalog/parity.json',
  sha256: createHash('sha256').update(bytes).digest('hex'),
  maxArtifactBytes: bytes.byteLength,
  releaseId: context.releaseId,
  overtureSchemaVersion: context.schemaVersion,
  licenseLedgerId: context.licenseLedgerId,
  acceptedRows: extraction.counts.acceptedRows,
  cellCount: extraction.cells.length,
})
assert(config, 'server configuration must accept the generator manifest values')
const parsed = parseOpenCatalogArtifact(bytes, config)

assert.deepEqual(
  parsed.cells.flatMap(cell => cell.places).map(place => place.id),
  ['o:near-a', 'o:near-b', 'o:far'],
  'server reader must retain the generator\'s deterministic identities and ordering',
)
assert.equal(serialized.includes('google_place_id'), false, 'unknown provider aliases cannot cross the generator')
assert.equal(serialized.includes('Apache-2.0'), true, 'per-source license evidence crosses the generator and reader')
assert.deepEqual(
  queryOpenCatalogArtifact(parsed, {
    provenance: 'explicit_plan',
    lat: 40.55,
    lng: -74.45,
    radiusKm: 2,
  }).map(result => result.place.id),
  ['o:near-a', 'o:near-b'],
  'the server can spatially bound the generated pack without inferred geography',
)

console.log('✓ generated open-catalog bytes and the inactive server reader share one exact contract')
