import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  createAreaGazetteerLoader,
  normalizeAreaGazetteerServiceConfig,
  parseAreaGazetteerArtifact,
  searchServerPlanAreas,
  validPlanAreaQuery,
} from './area-gazetteer.js'

const artifact = {
  schemaVersion: 1,
  snapshotDate: '2026-07-13',
  licenseLedgerId: 'geonames-reviewed-2026-07-13',
  areas: [
    { id: 'gn:2', displayLabel: 'Cresskill, New Jersey, US', searchNames: ['Cresskill'], countryCode: 'US', lat: 40.9415, lng: -73.9593, population: 9200 },
    { id: 'gn:3', displayLabel: 'Piscataway, New Jersey, US', searchNames: ['Piscataway'], countryCode: 'US', lat: 40.5549, lng: -74.4643, population: 61000 },
    { id: 'gn:1', displayLabel: 'Québec, Quebec, CA', searchNames: ['Québec', 'Quebec'], countryCode: 'CA', lat: 46.8139, lng: -71.208, population: 550000 },
  ],
}
const bytes = new TextEncoder().encode(JSON.stringify(artifact))
const digest = createHash('sha256').update(bytes).digest('hex')
const config = normalizeAreaGazetteerServiceConfig({
  enabled: true,
  objectPath: 'area-gazetteer/geonames-2026-07-13.json',
  sha256: digest,
  maxIndexBytes: 50_000,
  snapshotDate: '2026-07-13',
  licenseLedgerId: 'geonames-reviewed-2026-07-13',
  acceptedAreas: 3,
})
assert(config)
assert.equal(normalizeAreaGazetteerServiceConfig({ enabled: false }), null)
assert.equal(normalizeAreaGazetteerServiceConfig({ ...config, objectPath: '../private.json' }), null)
assert.equal(normalizeAreaGazetteerServiceConfig({ ...config, sha256: 'invented' }), null)

const parsed = parseAreaGazetteerArtifact(bytes, config)
assert.deepEqual(searchServerPlanAreas('cress', parsed), [
  { id: 'gn:2', label: 'Cresskill, New Jersey, US', lat: 40.9415, lng: -73.9593 },
])
assert.equal(searchServerPlanAreas('quebec', parsed)[0]?.id, 'gn:1', 'search is diacritic tolerant')
assert.deepEqual(searchServerPlanAreas('new jersey us', parsed).map(area => area.id), ['gn:3', 'gn:2'], 'population breaks equal text matches without user-location bias')
assert.equal(validPlanAreaQuery('Cresskill'), true)
assert.equal(validPlanAreaQuery('x'), false)
assert.equal(searchServerPlanAreas('x', parsed).length, 0)
assert.throws(() => parseAreaGazetteerArtifact(bytes, { ...config, sha256: '0'.repeat(64) }), /digest/)
assert.throws(() => parseAreaGazetteerArtifact(bytes, { ...config, maxIndexBytes: 1 }), /size/)
assert.throws(() => parseAreaGazetteerArtifact(bytes, { ...config, acceptedAreas: 2 }), /manifest/)

let downloads = 0
const loader = createAreaGazetteerLoader(async objectPath => {
  assert.equal(objectPath, config.objectPath)
  downloads++
  return bytes
})
assert.equal((await loader(config)).areas.length, 3)
assert.equal((await loader(config)).areas.length, 3)
assert.equal(downloads, 1, 'one verified artifact is cached per warm server instance')

console.log('✓ server area search is digest-pinned, global, bounded, cached, and fail-closed')
