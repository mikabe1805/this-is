import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  buildOpenCatalogDuckDbSql,
  parseDuckDbVersion,
  runOpenCatalogAcquisition,
} from './open-catalog-acquisition-core.mjs'
import {
  buildOpenCatalogArtifact,
  serializeOpenCatalogArtifact,
} from '../v2/.domain-test/domain/openCatalogArtifact.js'
import { extractOpenCatalogRows } from '../v2/.domain-test/domain/openCatalogExtraction.js'
import {
  normalizeOpenCatalogServiceConfig,
  parseOpenCatalogArtifact,
} from '../v2-functions/lib/open-catalog.js'
import { validateOpenCatalogManifest } from './open-catalog-manifest-core.mjs'

const digest = 'a'.repeat(64)
const manifest = {
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
    id: 'overture-reviewed-2026-06-17',
    reviewedAt: '2026-01-01T00:00:00Z',
    reviewedByRole: 'owner',
    artifacts: [{ url: 'https://docs.overturemaps.org/attribution/', sha256: digest }],
  },
  areaExtraction: { bbox: [-74.5, 40.5, -74.4, 40.6], cellSizeDegrees: 0.05, maxCells: 10 },
  limits: { maxRawRows: 10, maxAcceptedRows: 10, maxArtifactBytes: 100_000 },
  privacy: {
    explicitPlanAreaOnly: true,
    persistAreaToPersonOrGroup: false,
    identityFieldsIncluded: false,
    runtimeProviderQuery: false,
  },
  activation: { appServingEnabled: false, deploymentAuthorized: false },
}

const sql = buildOpenCatalogDuckDbSql(manifest, 'C:/safe/raw.ndjson')
assert(sql.includes(manifest.release.placesUri), 'SQL uses the pinned manifest path')
assert(sql.includes('bbox.xmin >= -74.5') && sql.includes('bbox.ymax <= 40.6'), 'SQL uses only the reviewed bbox')
assert(sql.includes('LIMIT 11'), 'SQL requests one overflow row so truncation cannot masquerade as completeness')
assert(sql.includes('sources') && sql.includes('taxonomy.alternates'), 'SQL retains licensing and current taxonomy inputs')
assert(!/latest|stac\.overturemaps|INSTALL/i.test(sql), 'runtime SQL cannot float releases or install extensions')
assert(parseDuckDbVersion('DuckDB v1.5.2 (Andium)')?.text === '1.5.2')
assert.equal(parseDuckDbVersion('v1.0.9'), null)

const workspaceRoot = mkdtempSync(join(tmpdir(), 'this-is-open-catalog-'))
const fakeDuckDb = join(workspaceRoot, 'fake-duckdb.mjs')
writeFileSync(fakeDuckDb, `
import { writeFileSync } from 'node:fs'
if (process.argv.includes('--version')) {
  console.log('DuckDB v1.5.2')
  process.exit(0)
}
const sql = process.argv[process.argv.indexOf('-c') + 1]
const match = sql.match(/TO '((?:''|[^'])+)' \\(FORMAT JSON/)
if (!match) process.exit(2)
const output = match[1].replaceAll("''", "'")
const row = (id, category, lat, lng, license) => ({
  id,
  geometry: { type: 'Point', coordinates: [lng, lat] },
  names: { primary: 'Place ' + id },
  basic_category: category,
  taxonomy: { primary: category, alternates: [], hierarchy: [category === 'hospital' ? 'health_and_medical' : 'food_and_drink', category] },
  operating_status: 'open',
  websites: ['https://example.com/' + id],
  confidence: 0.8,
  sources: [{ dataset: 'fixture-' + id, license }],
})
const rows = [
  row('a', 'restaurant', 40.55, -74.45, 'Apache-2.0'),
  row('b', 'cafe', 40.551, -74.451, 'CDLA-Permissive-2.0'),
  row('c', 'hospital', 40.552, -74.452, 'CDLA-Permissive-2.0'),
]
writeFileSync(output, rows.map(row => JSON.stringify(row)).join('\\n') + '\\n')
`)

const domain = { extractOpenCatalogRows, buildOpenCatalogArtifact, serializeOpenCatalogArtifact }
const summary = runOpenCatalogAcquisition({
  manifest,
  workspaceRoot,
  artifactOutputPath: 'output/open-catalog/fixture.json',
  duckdbCommand: process.execPath,
  duckdbArgsPrefix: [fakeDuckDb],
  domain,
  ingestedAt: 1,
})
assert.equal(summary.counts.rawRows, 3)
assert.equal(summary.counts.acceptedRows, 2)
assert.equal(summary.counts.rejectedByReason.unsupported_category, 1)
assert.equal(summary.safety.servingEnabled, false)
assert.equal(summary.safety.uploaded, false)
assert.equal(summary.artifact.generatedAt, '1970-01-01T00:00:00.001Z')
assert.equal(readdirSync(join(workspaceRoot, 'output', 'open-catalog')).some(name => name.startsWith('.raw-')), false)

const artifactPath = join(workspaceRoot, ...summary.artifact.relativePath.split('/'))
const artifactBytes = readFileSync(artifactPath)
assert.equal(createHash('sha256').update(artifactBytes).digest('hex'), summary.artifact.sha256)
assert(artifactBytes.includes(Buffer.from('Apache-2.0')), 'per-row license survives real runner boundaries')
const serviceConfig = normalizeOpenCatalogServiceConfig({
  enabled: true,
  objectPath: 'open-catalog/fixture.json',
  sha256: summary.artifact.sha256,
  maxArtifactBytes: summary.artifact.bytes,
  releaseId: summary.releaseId,
  overtureSchemaVersion: summary.overtureSchemaVersion,
  licenseLedgerId: summary.licenseLedgerId,
  acceptedRows: summary.counts.acceptedRows,
  cellCount: summary.cellCount,
})
assert(serviceConfig)
assert.equal(parseOpenCatalogArtifact(artifactBytes, serviceConfig).cells.length, summary.cellCount)
const extractedManifest = {
  ...manifest,
  stage: 'extracted',
  artifact: summary.artifact,
  counts: summary.counts,
}
assert.deepEqual(validateOpenCatalogManifest(extractedManifest, { requireExtracted: true, now: Date.now() }), [],
  'the aggregate summary completes the strict extracted-manifest contract without row data')

assert.throws(() => runOpenCatalogAcquisition({
  manifest,
  workspaceRoot,
  artifactOutputPath: 'output/open-catalog/fixture.json',
  duckdbCommand: process.execPath,
  duckdbArgsPrefix: [fakeDuckDb],
  domain,
}), /already exists/)

const narrowManifest = structuredClone(manifest)
narrowManifest.limits.maxRawRows = 2
narrowManifest.limits.maxAcceptedRows = 2
assert.throws(() => runOpenCatalogAcquisition({
  manifest: narrowManifest,
  workspaceRoot,
  artifactOutputPath: 'output/open-catalog/overflow.json',
  duckdbCommand: process.execPath,
  duckdbArgsPrefix: [fakeDuckDb],
  domain,
}), /Raw row ceiling exceeded/)
assert.equal(existsSync(join(workspaceRoot, 'output', 'open-catalog', 'overflow.json')), false)
assert.throws(() => runOpenCatalogAcquisition({
  manifest,
  workspaceRoot,
  artifactOutputPath: '../escape.json',
  duckdbCommand: process.execPath,
  duckdbArgsPrefix: [fakeDuckDb],
  domain,
}), /output\/open-catalog/)

console.log('✓ explicit Overture acquisition is release-pinned, bbox/row/byte bounded, license-preserving, no-overwrite, and inactive')
