import assert from 'node:assert/strict'
import { summarizeAreaGazetteerManifest, validateAreaGazetteerManifest } from './area-gazetteer-manifest-core.mjs'

const now = Date.parse('2026-07-13T07:00:00.000Z')
const digest = character => character.repeat(64)
const planned = () => ({
  schemaVersion: 1,
  provider: 'geonames',
  stage: 'planned',
  snapshot: {
    snapshotDate: '2026-07-13',
    parserContract: 'geonames-plan-area-v1',
    sourceFiles: [
      { kind: 'cities500', url: 'https://download.geonames.org/export/dump/cities500.zip', sha256: digest('a') },
      { kind: 'admin1', url: 'https://download.geonames.org/export/dump/admin1CodesASCII.txt', sha256: digest('b') },
      { kind: 'admin2', url: 'https://download.geonames.org/export/dump/admin2Codes.txt', sha256: digest('c') },
    ],
  },
  licenseLedger: {
    id: 'geonames-2026-07-13-reviewed-attribution',
    reviewedAt: '2026-07-13T06:00:00.000Z',
    reviewedByRole: 'legal_reviewer',
    artifacts: [
      { url: 'https://www.geonames.org/export/', sha256: digest('d') },
      { url: 'https://creativecommons.org/licenses/by/4.0/', sha256: digest('e') },
    ],
  },
  limits: {
    maxRawCityRows: 250000,
    maxAcceptedAreas: 200000,
    maxAliasesPerArea: 20,
    maxIndexBytes: 50000000,
    maxResults: 5,
    queryMinChars: 2,
    queryMaxChars: 80,
    fixedRadiusKm: 12,
  },
  privacy: {
    explicitSelectionOnly: true,
    usesDeviceIpHomeOrHistoryBias: false,
    persistsCoordinatesToPersonGroupSignalEventOrPick: false,
    logsQueryCoordinatesGazetteerOrIdentity: false,
    shipsGlobalIndexToBrowser: false,
  },
  activation: { serverSearchEnabled: false, deploymentAuthorized: false },
})
const indexed = () => ({
  ...planned(),
  stage: 'indexed',
  artifact: {
    relativePath: 'output/area-gazetteer/2026-07-13/areas.ndjson.zst',
    bytes: 12000000,
    sha256: digest('f'),
    generatedAt: '2026-07-13T06:30:00.000Z',
  },
  counts: {
    rawCityRows: 100,
    admin1Rows: 10,
    admin2Rows: 20,
    acceptedAreas: 91,
    rejectedRows: 9,
    rejectedByReason: {
      invalid_shape: 1,
      invalid_identity: 1,
      invalid_name: 1,
      invalid_coordinates: 1,
      invalid_feature_class: 1,
      invalid_country: 1,
      invalid_population: 1,
      invalid_date: 1,
      duplicate_identity: 1,
    },
  },
})
const issues = value => validateAreaGazetteerManifest(value, { now })

assert.deepEqual(issues(planned()), [])
assert.deepEqual(issues(indexed()), [])
assert(validateAreaGazetteerManifest(planned(), { now, requireIndexed: true })
  .some(issue => issue.includes('indexed manifest is required')))
const summary = summarizeAreaGazetteerManifest(planned())
assert.equal(summary.snapshotDate, '2026-07-13')
assert.equal(summary.safety.locationProfileCreated, false)
assert.equal(JSON.stringify(summary).includes('sourceFiles'), false)

const future = planned()
future.snapshot.snapshotDate = '2026-07-14'
assert(issues(future).some(issue => issue.includes('non-future YYYY-MM-DD')))

const wrongSource = planned()
wrongSource.snapshot.sourceFiles[0].url = 'https://example.com/cities.zip'
assert(issues(wrongSource).some(issue => issue.includes('canonical GeoNames dump URL')))

const duplicateSource = planned()
duplicateSource.snapshot.sourceFiles[2].kind = 'admin1'
assert(issues(duplicateSource).some(issue => issue.includes('duplicated'))
  && issues(duplicateSource).some(issue => issue.includes('missing admin2')))

const missingLicense = planned()
missingLicense.licenseLedger.artifacts = missingLicense.licenseLedger.artifacts.slice(0, 1)
assert(issues(missingLicense).some(issue => issue.includes('must contain 2–10')))

const identityLeak = planned()
identityLeak.groupId = 'not-allowed'
assert(issues(identityLeak).some(issue => issue.includes('manifest.groupId is not allowed')))

const badBounds = planned()
badBounds.limits.queryMinChars = 1
badBounds.limits.maxResults = 10
assert(issues(badBounds).some(issue => issue.includes('2–80'))
  && issues(badBounds).some(issue => issue.includes('must equal 5')))

const activated = planned()
activated.activation.serverSearchEnabled = true
activated.activation.deploymentAuthorized = true
assert.equal(issues(activated).filter(issue => issue.includes('activation.')).length, 2)

const falseClaim = planned()
falseClaim.artifact = indexed().artifact
assert(issues(falseClaim).some(issue => issue.includes('must not claim an index artifact')))

const badCounts = indexed()
badCounts.counts.acceptedAreas = 92
assert(issues(badCounts).some(issue => issue.includes('acceptedAreas + rejectedRows')))

const badReasons = indexed()
badReasons.counts.rejectedByReason.invalid_shape = 4
assert(issues(badReasons).some(issue => issue.includes('rejection reasons must sum')))

const traversal = indexed()
traversal.artifact.relativePath = 'output/area-gazetteer/../secret.json'
assert(issues(traversal).some(issue => issue.includes('without traversal')))

console.log('✓ area-gazetteer manifests pin GeoNames/license evidence and cannot claim indexing, identity, logging, or activation without proof')
