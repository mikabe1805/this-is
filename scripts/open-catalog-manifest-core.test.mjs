import assert from 'node:assert/strict'
import {
  openCatalogCellCount,
  summarizeOpenCatalogManifest,
  validateOpenCatalogManifest,
} from './open-catalog-manifest-core.mjs'

const now = Date.parse('2026-07-13T05:00:00.000Z')
const digest = character => character.repeat(64)
const planned = () => ({
  schemaVersion: 1,
  provider: 'overture',
  stage: 'planned',
  release: {
    releaseId: '2026-06-17.0',
    schemaVersion: 'v1.17.0',
    stacCatalogUrl: 'https://stac.overturemaps.org/catalog.json',
    placesUri: 's3://overturemaps-us-west-2/release/2026-06-17.0/theme=places/type=place/*',
    normalizerContract: 'open-catalog-v1',
  },
  licenseLedger: {
    id: 'overture-2026-06-17.0-reviewed',
    reviewedAt: '2026-07-13T04:00:00.000Z',
    reviewedByRole: 'legal_reviewer',
    artifacts: [
      { url: 'https://docs.overturemaps.org/attribution/', sha256: digest('a') },
      { url: 'https://opensource.foursquare.com/NOTICE.txt', sha256: digest('b') },
    ],
  },
  areaExtraction: { bbox: [0, 0, 0.05, 0.05], cellSizeDegrees: 0.05, maxCells: 4 },
  limits: { maxRawRows: 25000, maxAcceptedRows: 10000, maxArtifactBytes: 25000000 },
  privacy: {
    explicitPlanAreaOnly: true,
    persistAreaToPersonOrGroup: false,
    identityFieldsIncluded: false,
    runtimeProviderQuery: false,
  },
  activation: { appServingEnabled: false, deploymentAuthorized: false },
})
const extracted = () => ({
  ...planned(),
  stage: 'extracted',
  artifact: {
    relativePath: 'output/open-catalog/2026-06-17.0/cell-0_0.ndjson.zst',
    bytes: 12000,
    sha256: digest('c'),
    generatedAt: '2026-07-13T04:30:00.000Z',
  },
  counts: {
    rawRows: 100,
    acceptedRows: 70,
    rejectedRows: 30,
    rejectedByReason: {
      invalid_identity: 2,
      invalid_geometry: 3,
      invalid_name: 4,
      invalid_status: 5,
      invalid_provenance: 6,
      ineligible_status: 1,
      unsupported_category: 5,
      outside_bbox: 3,
      duplicate_identity: 1,
    },
  },
})
const issues = value => validateOpenCatalogManifest(value, { now })

assert.deepEqual(issues(planned()), [])
assert.deepEqual(issues(extracted()), [])
assert.equal(openCatalogCellCount([0, 0, 0.05, 0.05]), 1)
assert.equal(openCatalogCellCount([1, 0, -1, 1]), null)
assert.equal(validateOpenCatalogManifest(planned(), { now, requireExtracted: true })
  .some(issue => issue.includes('extracted manifest is required')), true)

const summary = summarizeOpenCatalogManifest(planned())
assert.equal(summary.releaseId, '2026-06-17.0')
assert.equal(summary.cellCount, 1)
assert.equal(summary.safety.appServingEnabled, false)
assert.equal(JSON.stringify(summary).includes('userId'), false)

const latest = planned()
latest.release.releaseId = 'latest'
assert.equal(issues(latest).some(issue => issue.includes('latest is forbidden')), true)

const mismatchedUri = planned()
mismatchedUri.release.placesUri = 's3://overturemaps-us-west-2/release/another/theme=places/type=place/*'
assert.equal(issues(mismatchedUri).some(issue => issue.includes('must match the pinned')), true)

const placeholderLicense = planned()
placeholderLicense.licenseLedger.artifacts[0].sha256 = 'REPLACE_WITH_SHA'
assert.equal(issues(placeholderLicense).some(issue => issue.includes('reviewed lowercase SHA-256')), true)

const tooLarge = planned()
tooLarge.areaExtraction.bbox = [0, 0, 2, 2]
assert.equal(issues(tooLarge).some(issue => issue.includes('above maxCells')), true)

const identityLeak = planned()
identityLeak.userId = 'not-allowed'
assert.equal(issues(identityLeak).some(issue => issue.includes('manifest.userId is not allowed')), true)

const activated = planned()
activated.activation.appServingEnabled = true
activated.activation.deploymentAuthorized = true
assert.equal(issues(activated).filter(issue => issue.includes('activation.')).length, 2)

const falsePlannedClaim = planned()
falsePlannedClaim.artifact = extracted().artifact
assert.equal(issues(falsePlannedClaim).some(issue => issue.includes('must not claim an artifact')), true)

const badCounts = extracted()
badCounts.counts.acceptedRows = 80
assert.equal(issues(badCounts).some(issue => issue.includes('acceptedRows + rejectedRows')), true)

const badReasons = extracted()
badReasons.counts.rejectedByReason.invalid_status = 99
assert.equal(issues(badReasons).some(issue => issue.includes('rejected reasons must sum')), true)

const traversal = extracted()
traversal.artifact.relativePath = 'output/open-catalog/../secret.json'
assert.equal(issues(traversal).some(issue => issue.includes('without traversal')), true)

const unknownNestedField = planned()
unknownNestedField.privacy.areaLabel = 'home'
assert.equal(issues(unknownNestedField).some(issue => issue.includes('privacy.areaLabel is not allowed')), true)

console.log('✓ open-catalog manifests pin source/license evidence, bound anonymous area work, and cannot claim activation or extraction without proof')
