const SHA256 = /^[a-f0-9]{64}$/
const SNAPSHOT_DATE = /^\d{4}-\d{2}-\d{2}$/
const HTTPS = /^https:\/\//
const SOURCE_URLS = {
  cities500: 'https://download.geonames.org/export/dump/cities500.zip',
  admin1: 'https://download.geonames.org/export/dump/admin1CodesASCII.txt',
  admin2: 'https://download.geonames.org/export/dump/admin2Codes.txt',
}
const GEONAMES_TERMS_URL = 'https://www.geonames.org/export/'
const CC_BY_URL = 'https://creativecommons.org/licenses/by/4.0/'
const REJECTION_REASONS = [
  'invalid_shape', 'invalid_identity', 'invalid_name', 'invalid_coordinates',
  'invalid_feature_class', 'invalid_country', 'invalid_population', 'invalid_date',
  'duplicate_identity',
]

const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const integer = value => Number.isInteger(value)

function exactKeys(value, allowed, path, issues) {
  if (!isRecord(value)) {
    issues.push(`${path} must be an object.`)
    return false
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) issues.push(`${path}.${key} is not allowed.`)
  }
  return true
}

function validPastIso(value, now) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return false
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && timestamp > 0 && timestamp <= now + 5 * 60_000
}

function validPastDate(value, now) {
  if (typeof value !== 'string' || !SNAPSHOT_DATE.test(value)) return false
  const timestamp = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(timestamp) && timestamp <= now
}

export function validateAreaGazetteerManifest(value, options = {}) {
  const issues = []
  const now = options.now ?? Date.now()
  if (!exactKeys(value, [
    'schemaVersion', 'provider', 'stage', 'snapshot', 'licenseLedger', 'limits',
    'privacy', 'activation', 'artifact', 'counts',
  ], 'manifest', issues)) return issues

  if (value.schemaVersion !== 1) issues.push('manifest.schemaVersion must equal 1.')
  if (value.provider !== 'geonames') issues.push('manifest.provider must equal geonames.')
  if (!['planned', 'indexed'].includes(value.stage)) issues.push('manifest.stage must be planned or indexed.')

  if (exactKeys(value.snapshot, ['snapshotDate', 'parserContract', 'sourceFiles'], 'manifest.snapshot', issues)) {
    if (!validPastDate(value.snapshot.snapshotDate, now)) issues.push('manifest.snapshot.snapshotDate must be a non-future YYYY-MM-DD.')
    if (value.snapshot.parserContract !== 'geonames-plan-area-v1') issues.push('manifest.snapshot.parserContract must equal geonames-plan-area-v1.')
    if (!Array.isArray(value.snapshot.sourceFiles) || value.snapshot.sourceFiles.length !== 3) {
      issues.push('manifest.snapshot.sourceFiles must contain exactly cities500, admin1, and admin2.')
    } else {
      const seen = new Set()
      value.snapshot.sourceFiles.forEach((source, index) => {
        const path = `manifest.snapshot.sourceFiles[${index}]`
        if (!exactKeys(source, ['kind', 'url', 'sha256'], path, issues)) return
        if (!(source.kind in SOURCE_URLS)) issues.push(`${path}.kind is unsupported.`)
        else {
          if (seen.has(source.kind)) issues.push(`${path}.kind is duplicated.`)
          seen.add(source.kind)
          if (source.url !== SOURCE_URLS[source.kind]) issues.push(`${path}.url must match the canonical GeoNames dump URL.`)
        }
        if (!SHA256.test(source.sha256 ?? '')) issues.push(`${path}.sha256 must be a reviewed lowercase SHA-256 digest.`)
      })
      for (const kind of Object.keys(SOURCE_URLS)) {
        if (!seen.has(kind)) issues.push(`manifest.snapshot.sourceFiles is missing ${kind}.`)
      }
    }
  }

  if (exactKeys(value.licenseLedger, ['id', 'reviewedAt', 'reviewedByRole', 'artifacts'], 'manifest.licenseLedger', issues)) {
    if (typeof value.licenseLedger.id !== 'string' || !/^geonames-[a-z0-9.-]{8,140}$/.test(value.licenseLedger.id)) issues.push('manifest.licenseLedger.id must be a bounded GeoNames ledger id.')
    if (!validPastIso(value.licenseLedger.reviewedAt, now)) issues.push('manifest.licenseLedger.reviewedAt must be a reviewed, non-future ISO timestamp.')
    if (!['owner', 'legal_reviewer'].includes(value.licenseLedger.reviewedByRole)) issues.push('manifest.licenseLedger.reviewedByRole must be owner or legal_reviewer; do not store a person name.')
    if (!Array.isArray(value.licenseLedger.artifacts) || value.licenseLedger.artifacts.length < 2 || value.licenseLedger.artifacts.length > 10) {
      issues.push('manifest.licenseLedger.artifacts must contain 2–10 reviewed artifacts.')
    } else {
      const urls = new Set()
      value.licenseLedger.artifacts.forEach((artifact, index) => {
        const path = `manifest.licenseLedger.artifacts[${index}]`
        if (!exactKeys(artifact, ['url', 'sha256'], path, issues)) return
        if (typeof artifact.url !== 'string' || !HTTPS.test(artifact.url)) issues.push(`${path}.url must use HTTPS.`)
        else urls.add(artifact.url)
        if (!SHA256.test(artifact.sha256 ?? '')) issues.push(`${path}.sha256 must be a reviewed lowercase SHA-256 digest.`)
      })
      if (!urls.has(GEONAMES_TERMS_URL)) issues.push(`manifest.licenseLedger.artifacts must include ${GEONAMES_TERMS_URL}.`)
      if (!urls.has(CC_BY_URL)) issues.push(`manifest.licenseLedger.artifacts must include ${CC_BY_URL}.`)
    }
  }

  if (exactKeys(value.limits, [
    'maxRawCityRows', 'maxAcceptedAreas', 'maxAliasesPerArea', 'maxIndexBytes',
    'maxResults', 'queryMinChars', 'queryMaxChars', 'fixedRadiusKm',
  ], 'manifest.limits', issues)) {
    if (!integer(value.limits.maxRawCityRows) || value.limits.maxRawCityRows < 1 || value.limits.maxRawCityRows > 250_000) issues.push('manifest.limits.maxRawCityRows must be 1–250000.')
    if (!integer(value.limits.maxAcceptedAreas) || value.limits.maxAcceptedAreas < 1 || value.limits.maxAcceptedAreas > value.limits.maxRawCityRows) issues.push('manifest.limits.maxAcceptedAreas must be positive and no greater than maxRawCityRows.')
    if (value.limits.maxAliasesPerArea !== 20) issues.push('manifest.limits.maxAliasesPerArea must equal 20.')
    if (!integer(value.limits.maxIndexBytes) || value.limits.maxIndexBytes < 1 || value.limits.maxIndexBytes > 100_000_000) issues.push('manifest.limits.maxIndexBytes must be 1–100000000.')
    if (value.limits.maxResults !== 5) issues.push('manifest.limits.maxResults must equal 5.')
    if (value.limits.queryMinChars !== 2 || value.limits.queryMaxChars !== 80) issues.push('manifest query bounds must remain 2–80 characters.')
    if (value.limits.fixedRadiusKm !== 12) issues.push('manifest.limits.fixedRadiusKm must equal the reviewed development radius 12.')
  }

  if (exactKeys(value.privacy, [
    'explicitSelectionOnly', 'usesDeviceIpHomeOrHistoryBias', 'persistsCoordinatesToPersonGroupSignalEventOrPick',
    'logsQueryCoordinatesGazetteerOrIdentity', 'shipsGlobalIndexToBrowser',
  ], 'manifest.privacy', issues)) {
    if (value.privacy.explicitSelectionOnly !== true) issues.push('manifest.privacy.explicitSelectionOnly must be true.')
    if (value.privacy.usesDeviceIpHomeOrHistoryBias !== false) issues.push('manifest.privacy.usesDeviceIpHomeOrHistoryBias must be false.')
    if (value.privacy.persistsCoordinatesToPersonGroupSignalEventOrPick !== false) issues.push('manifest.privacy.persistsCoordinatesToPersonGroupSignalEventOrPick must be false.')
    if (value.privacy.logsQueryCoordinatesGazetteerOrIdentity !== false) issues.push('manifest.privacy.logsQueryCoordinatesGazetteerOrIdentity must be false.')
    if (value.privacy.shipsGlobalIndexToBrowser !== false) issues.push('manifest.privacy.shipsGlobalIndexToBrowser must be false.')
  }
  if (exactKeys(value.activation, ['serverSearchEnabled', 'deploymentAuthorized'], 'manifest.activation', issues)) {
    if (value.activation.serverSearchEnabled !== false) issues.push('manifest.activation.serverSearchEnabled must remain false in a planning manifest.')
    if (value.activation.deploymentAuthorized !== false) issues.push('manifest.activation.deploymentAuthorized must remain false; this planner cannot authorize deployment.')
  }

  if (value.stage === 'planned') {
    if ('artifact' in value) issues.push('A planned manifest must not claim an index artifact.')
    if ('counts' in value) issues.push('A planned manifest must not claim index counts.')
    if (options.requireIndexed) issues.push('An indexed manifest is required.')
  }
  if (value.stage === 'indexed') {
    if (exactKeys(value.artifact, ['relativePath', 'bytes', 'sha256', 'generatedAt'], 'manifest.artifact', issues)) {
      const path = value.artifact.relativePath
      if (typeof path !== 'string' || !/^output\/area-gazetteer\/[A-Za-z0-9._/-]+$/.test(path)
        || path.includes('..') || path.includes('\\')) issues.push('manifest.artifact.relativePath must stay under output/area-gazetteer without traversal.')
      if (!integer(value.artifact.bytes) || value.artifact.bytes < 1 || value.artifact.bytes > value.limits?.maxIndexBytes) issues.push('manifest.artifact.bytes must be positive and within maxIndexBytes.')
      if (!SHA256.test(value.artifact.sha256 ?? '')) issues.push('manifest.artifact.sha256 must be a lowercase SHA-256 digest.')
      if (!validPastIso(value.artifact.generatedAt, now)) issues.push('manifest.artifact.generatedAt must be a non-future ISO timestamp.')
    }
    if (exactKeys(value.counts, ['rawCityRows', 'admin1Rows', 'admin2Rows', 'acceptedAreas', 'rejectedRows', 'rejectedByReason'], 'manifest.counts', issues)) {
      const { rawCityRows, admin1Rows, admin2Rows, acceptedAreas, rejectedRows } = value.counts
      if (![rawCityRows, admin1Rows, admin2Rows].every(item => integer(item) && item > 0)) issues.push('manifest.counts source row counts must be positive integers.')
      if (![acceptedAreas, rejectedRows].every(item => integer(item) && item >= 0)) issues.push('manifest.counts accepted/rejected counts must be non-negative integers.')
      if (integer(rawCityRows) && integer(acceptedAreas) && integer(rejectedRows) && acceptedAreas + rejectedRows !== rawCityRows) issues.push('manifest.counts acceptedAreas + rejectedRows must equal rawCityRows.')
      if (integer(rawCityRows) && rawCityRows > value.limits?.maxRawCityRows) issues.push('manifest.counts.rawCityRows exceeds maxRawCityRows.')
      if (integer(acceptedAreas) && acceptedAreas > value.limits?.maxAcceptedAreas) issues.push('manifest.counts.acceptedAreas exceeds maxAcceptedAreas.')
      if (exactKeys(value.counts.rejectedByReason, REJECTION_REASONS, 'manifest.counts.rejectedByReason', issues)) {
        const values = REJECTION_REASONS.map(reason => value.counts.rejectedByReason[reason])
        if (!values.every(item => integer(item) && item >= 0)) issues.push('manifest.counts.rejectedByReason values must be non-negative integers.')
        else if (integer(rejectedRows) && values.reduce((sum, item) => sum + item, 0) !== rejectedRows) issues.push('manifest.counts rejection reasons must sum to rejectedRows.')
      }
    }
  }
  return issues
}

export function summarizeAreaGazetteerManifest(manifest) {
  return {
    schemaVersion: manifest.schemaVersion,
    provider: manifest.provider,
    stage: manifest.stage,
    snapshotDate: manifest.snapshot.snapshotDate,
    parserContract: manifest.snapshot.parserContract,
    licenseLedgerId: manifest.licenseLedger.id,
    limits: manifest.limits,
    artifact: manifest.stage === 'indexed' ? manifest.artifact : null,
    counts: manifest.stage === 'indexed' ? manifest.counts : null,
    safety: {
      readOnlyPlan: true,
      explicitSelectionOnly: true,
      locationProfileCreated: false,
      queryOrCoordinatesLogged: false,
      serverSearchEnabled: false,
      deploymentAuthorized: false,
    },
  }
}
