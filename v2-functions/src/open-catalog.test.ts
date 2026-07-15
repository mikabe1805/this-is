import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  createOpenCatalogLoader,
  normalizeOpenCatalogServiceConfig,
  parseOpenCatalogArtifact,
  queryOpenCatalogArtifact,
} from './open-catalog.js'

const place = (id: string, lat: number, lng: number, confidence: number) => ({
  id: `o:${id}`,
  name: `Place ${id}`,
  lat,
  lng,
  basicCategory: 'restaurant',
  taxonomy: { primary: 'restaurant', alternates: [], hierarchy: ['food_and_drink'] },
  website: `https://example.com/${id}`,
  confidence,
  sourceAttributions: [{ dataset: 'fixture-open', license: 'Apache-2.0' }],
})

const artifact = {
  schemaVersion: 1,
  provider: 'overture',
  releaseId: '2026-06-17.0',
  overtureSchemaVersion: 'v1.17.0',
  licenseLedgerId: 'overture-reviewed-2026-06-17',
  bbox: [-74.5, 40.5, -74.4, 40.6],
  cells: [
    { cell: '40.55_-74.45', places: [
      place('a', 40.55, -74.45, 0.7),
      place('b', 40.551, -74.451, 0.9),
    ] },
    { cell: '40.60_-74.40', places: [place('c', 40.59, -74.41, 0.8)] },
  ],
}
const bytes = new TextEncoder().encode(JSON.stringify(artifact))
const digest = createHash('sha256').update(bytes).digest('hex')
const config = normalizeOpenCatalogServiceConfig({
  enabled: true,
  objectPath: 'open-catalog/overture-2026-06-17.0.json',
  sha256: digest,
  maxArtifactBytes: 50_000,
  releaseId: '2026-06-17.0',
  overtureSchemaVersion: 'v1.17.0',
  licenseLedgerId: 'overture-reviewed-2026-06-17',
  acceptedRows: 3,
  cellCount: 2,
})
assert(config)
assert.equal(normalizeOpenCatalogServiceConfig({ enabled: false }), null)
assert.equal(normalizeOpenCatalogServiceConfig({ ...config, objectPath: '../private.json' }), null)
assert.equal(normalizeOpenCatalogServiceConfig({ ...config, sha256: 'invented' }), null)
assert.equal(normalizeOpenCatalogServiceConfig({ ...config, userId: 'not-allowed' }), null)

const parsed = parseOpenCatalogArtifact(bytes, config)
assert.deepEqual(queryOpenCatalogArtifact(parsed, {
  provenance: 'explicit_plan',
  lat: 40.55,
  lng: -74.45,
  radiusKm: 2,
}).map(result => result.place.id), ['o:a', 'o:b'])
assert.equal(queryOpenCatalogArtifact(parsed, {
  provenance: 'explicit_plan',
  lat: 40.55,
  lng: -74.45,
  radiusKm: 2,
}, 1).length, 1, 'the spatial pool obeys its caller limit')
assert.throws(() => queryOpenCatalogArtifact(parsed, {
  provenance: 'explicit_plan',
  lat: 40.55,
  lng: -74.45,
  radiusKm: 100,
}), /explicit-area/)

assert.throws(() => parseOpenCatalogArtifact(bytes, { ...config, sha256: '0'.repeat(64) }), /digest/)
assert.throws(() => parseOpenCatalogArtifact(bytes, { ...config, maxArtifactBytes: 1 }), /size/)
assert.throws(() => parseOpenCatalogArtifact(bytes, { ...config, acceptedRows: 2 }), /count/)
assert.throws(() => parseOpenCatalogArtifact(bytes, { ...config, releaseId: '2026-07-01.0' }), /manifest/)

const rejectsArtifact = (mutate: (value: Record<string, unknown>) => void, pattern: RegExp) => {
  const clone = structuredClone(artifact) as unknown as Record<string, unknown>
  mutate(clone)
  const changedBytes = new TextEncoder().encode(JSON.stringify(clone))
  const changedConfig = { ...config, sha256: createHash('sha256').update(changedBytes).digest('hex') }
  assert.throws(() => parseOpenCatalogArtifact(changedBytes, changedConfig), pattern)
}
rejectsArtifact(value => {
  const cells = value.cells as Array<{ places: Array<Record<string, unknown>> }>
  cells[0].places[0].googlePlaceId = 'forbidden-provider-alias'
}, /place/)
rejectsArtifact(value => {
  const cells = value.cells as Array<{ places: Array<Record<string, unknown>> }>
  cells[0].places[0].lat = 40.59
}, /place/)
rejectsArtifact(value => {
  const cells = value.cells as Array<{ places: Array<Record<string, unknown>> }>
  cells[0].places.reverse()
}, /order/)
rejectsArtifact(value => {
  const cells = value.cells as Array<{ places: Array<Record<string, unknown>> }>
  cells[1].places[0] = structuredClone(cells[0].places[0])
}, /place/)

let downloads = 0
const loader = createOpenCatalogLoader(async objectPath => {
  assert.equal(objectPath, config.objectPath)
  downloads++
  return bytes
})
assert.equal((await loader(config)).cells.length, 2)
assert.equal((await loader(config)).cells.length, 2)
assert.equal(downloads, 1, 'one verified artifact is cached per warm server instance')

console.log('✓ server open-catalog packs are digest-pinned, identity-free, spatially bounded, cached, and fail-closed')
