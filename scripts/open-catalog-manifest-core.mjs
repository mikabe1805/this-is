const RELEASE = /^\d{4}-\d{2}-\d{2}\.\d+$/
const SCHEMA = /^v\d+\.\d+\.\d+$/
const SHA256 = /^[a-f0-9]{64}$/
const HTTPS = /^https:\/\//
const STAC_URL = 'https://stac.overturemaps.org/catalog.json'
const ATTRIBUTION_URL = 'https://docs.overturemaps.org/attribution/'
const CELL_SIZE = 0.05

const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const finite = value => typeof value === 'number' && Number.isFinite(value)
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

function validReviewedIso(value, now) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return false
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && timestamp > 0 && timestamp <= now + 5 * 60_000
}

function expectedPlacesUri(releaseId) {
  return `s3://overturemaps-us-west-2/release/${releaseId}/theme=places/type=place/*`
}

export function openCatalogCellCount(bbox) {
  if (!Array.isArray(bbox) || bbox.length !== 4 || !bbox.every(finite)) return null
  const [west, south, east, north] = bbox
  if (west < -180 || east > 180 || south < -90 || north > 90 || west >= east || south >= north) return null
  return Math.ceil((east - west) / CELL_SIZE) * Math.ceil((north - south) / CELL_SIZE)
}

export function validateOpenCatalogManifest(value, options = {}) {
  const issues = []
  const now = options.now ?? Date.now()
  if (!exactKeys(value, [
    'schemaVersion', 'provider', 'stage', 'release', 'licenseLedger', 'areaExtraction',
    'limits', 'privacy', 'activation', 'artifact', 'counts',
  ], 'manifest', issues)) return issues

  if (value.schemaVersion !== 1) issues.push('manifest.schemaVersion must equal 1.')
  if (value.provider !== 'overture') issues.push('manifest.provider must equal overture.')
  if (!['planned', 'extracted'].includes(value.stage)) issues.push('manifest.stage must be planned or extracted.')

  if (exactKeys(value.release, ['releaseId', 'schemaVersion', 'stacCatalogUrl', 'placesUri', 'normalizerContract'], 'manifest.release', issues)) {
    if (!RELEASE.test(value.release.releaseId ?? '')) issues.push('manifest.release.releaseId must pin YYYY-MM-DD.N; latest is forbidden.')
    if (!SCHEMA.test(value.release.schemaVersion ?? '')) issues.push('manifest.release.schemaVersion must pin vN.N.N.')
    if (value.release.stacCatalogUrl !== STAC_URL) issues.push(`manifest.release.stacCatalogUrl must equal ${STAC_URL}.`)
    if (RELEASE.test(value.release.releaseId ?? '') && value.release.placesUri !== expectedPlacesUri(value.release.releaseId)) {
      issues.push('manifest.release.placesUri must match the pinned public Overture Places release.')
    }
    if (value.release.normalizerContract !== 'open-catalog-v1') issues.push('manifest.release.normalizerContract must equal open-catalog-v1.')
  }

  if (exactKeys(value.licenseLedger, ['id', 'reviewedAt', 'reviewedByRole', 'artifacts'], 'manifest.licenseLedger', issues)) {
    if (typeof value.licenseLedger.id !== 'string' || !/^overture-[a-z0-9.-]{8,140}$/.test(value.licenseLedger.id)) {
      issues.push('manifest.licenseLedger.id must be a bounded Overture ledger id.')
    }
    if (!validReviewedIso(value.licenseLedger.reviewedAt, now)) issues.push('manifest.licenseLedger.reviewedAt must be a reviewed, non-future ISO timestamp.')
    if (!['owner', 'legal_reviewer'].includes(value.licenseLedger.reviewedByRole)) issues.push('manifest.licenseLedger.reviewedByRole must be owner or legal_reviewer; do not store a person name.')
    if (!Array.isArray(value.licenseLedger.artifacts) || value.licenseLedger.artifacts.length < 1 || value.licenseLedger.artifacts.length > 20) {
      issues.push('manifest.licenseLedger.artifacts must contain 1–20 reviewed artifacts.')
    } else {
      let hasAttribution = false
      value.licenseLedger.artifacts.forEach((artifact, index) => {
        const path = `manifest.licenseLedger.artifacts[${index}]`
        if (!exactKeys(artifact, ['url', 'sha256'], path, issues)) return
        if (artifact.url === ATTRIBUTION_URL) hasAttribution = true
        if (typeof artifact.url !== 'string' || !HTTPS.test(artifact.url)) issues.push(`${path}.url must use HTTPS.`)
        if (!SHA256.test(artifact.sha256 ?? '')) issues.push(`${path}.sha256 must be a reviewed lowercase SHA-256 digest.`)
      })
      if (!hasAttribution) issues.push(`manifest.licenseLedger.artifacts must include ${ATTRIBUTION_URL}.`)
    }
  }

  let cells = null
  if (exactKeys(value.areaExtraction, ['bbox', 'cellSizeDegrees', 'maxCells'], 'manifest.areaExtraction', issues)) {
    cells = openCatalogCellCount(value.areaExtraction.bbox)
    if (cells === null) issues.push('manifest.areaExtraction.bbox must be [west,south,east,north] with valid increasing coordinates.')
    if (value.areaExtraction.cellSizeDegrees !== CELL_SIZE) issues.push(`manifest.areaExtraction.cellSizeDegrees must equal ${CELL_SIZE}.`)
    if (!integer(value.areaExtraction.maxCells) || value.areaExtraction.maxCells < 1 || value.areaExtraction.maxCells > 1000) {
      issues.push('manifest.areaExtraction.maxCells must be an integer from 1 to 1000.')
    } else if (cells !== null && cells > value.areaExtraction.maxCells) {
      issues.push(`manifest area requires ${cells} cells, above maxCells ${value.areaExtraction.maxCells}.`)
    }
  }

  if (exactKeys(value.limits, ['maxRawRows', 'maxAcceptedRows', 'maxArtifactBytes'], 'manifest.limits', issues)) {
    if (!integer(value.limits.maxRawRows) || value.limits.maxRawRows < 1 || value.limits.maxRawRows > 100_000) issues.push('manifest.limits.maxRawRows must be 1–100000.')
    if (!integer(value.limits.maxAcceptedRows) || value.limits.maxAcceptedRows < 1 || value.limits.maxAcceptedRows > value.limits.maxRawRows) issues.push('manifest.limits.maxAcceptedRows must be positive and no greater than maxRawRows.')
    if (!integer(value.limits.maxArtifactBytes) || value.limits.maxArtifactBytes < 1 || value.limits.maxArtifactBytes > 100_000_000) issues.push('manifest.limits.maxArtifactBytes must be 1–100000000.')
  }

  if (exactKeys(value.privacy, ['explicitPlanAreaOnly', 'persistAreaToPersonOrGroup', 'identityFieldsIncluded', 'runtimeProviderQuery'], 'manifest.privacy', issues)) {
    if (value.privacy.explicitPlanAreaOnly !== true) issues.push('manifest.privacy.explicitPlanAreaOnly must be true.')
    if (value.privacy.persistAreaToPersonOrGroup !== false) issues.push('manifest.privacy.persistAreaToPersonOrGroup must be false.')
    if (value.privacy.identityFieldsIncluded !== false) issues.push('manifest.privacy.identityFieldsIncluded must be false.')
    if (value.privacy.runtimeProviderQuery !== false) issues.push('manifest.privacy.runtimeProviderQuery must be false.')
  }
  if (exactKeys(value.activation, ['appServingEnabled', 'deploymentAuthorized'], 'manifest.activation', issues)) {
    if (value.activation.appServingEnabled !== false) issues.push('manifest.activation.appServingEnabled must remain false in a planning manifest.')
    if (value.activation.deploymentAuthorized !== false) issues.push('manifest.activation.deploymentAuthorized must remain false; this planner cannot authorize deployment.')
  }

  if (value.stage === 'planned') {
    if ('artifact' in value) issues.push('A planned manifest must not claim an artifact.')
    if ('counts' in value) issues.push('A planned manifest must not claim extraction counts.')
    if (options.requireExtracted) issues.push('An extracted manifest is required.')
  }

  if (value.stage === 'extracted') {
    if (exactKeys(value.artifact, ['relativePath', 'bytes', 'sha256', 'generatedAt'], 'manifest.artifact', issues)) {
      const path = value.artifact.relativePath
      if (typeof path !== 'string' || !/^output\/open-catalog\/[A-Za-z0-9._/-]+$/.test(path)
        || path.includes('..') || path.includes('\\')) issues.push('manifest.artifact.relativePath must stay under output/open-catalog without traversal.')
      if (!integer(value.artifact.bytes) || value.artifact.bytes < 1 || value.artifact.bytes > value.limits?.maxArtifactBytes) issues.push('manifest.artifact.bytes must be positive and within maxArtifactBytes.')
      if (!SHA256.test(value.artifact.sha256 ?? '')) issues.push('manifest.artifact.sha256 must be a lowercase SHA-256 digest.')
      if (!validReviewedIso(value.artifact.generatedAt, now)) issues.push('manifest.artifact.generatedAt must be a non-future ISO timestamp.')
    }
    if (exactKeys(value.counts, ['rawRows', 'acceptedRows', 'rejectedRows', 'rejectedByReason'], 'manifest.counts', issues)) {
      const { rawRows, acceptedRows, rejectedRows } = value.counts
      if (![rawRows, acceptedRows, rejectedRows].every(integer) || rawRows < 1 || acceptedRows < 0 || rejectedRows < 0) issues.push('manifest.counts row counts must be non-negative integers with rawRows positive.')
      if (integer(rawRows) && integer(acceptedRows) && integer(rejectedRows) && acceptedRows + rejectedRows !== rawRows) issues.push('manifest.counts acceptedRows + rejectedRows must equal rawRows.')
      if (integer(rawRows) && rawRows > value.limits?.maxRawRows) issues.push('manifest.counts.rawRows exceeds maxRawRows.')
      if (integer(acceptedRows) && acceptedRows > value.limits?.maxAcceptedRows) issues.push('manifest.counts.acceptedRows exceeds maxAcceptedRows.')
      const reasons = [
        'invalid_identity', 'invalid_geometry', 'invalid_name', 'invalid_status', 'invalid_provenance',
        'ineligible_status', 'unsupported_category', 'outside_bbox', 'duplicate_identity',
      ]
      if (exactKeys(value.counts.rejectedByReason, reasons, 'manifest.counts.rejectedByReason', issues)) {
        const values = reasons.map(reason => value.counts.rejectedByReason[reason])
        if (!values.every(value => integer(value) && value >= 0)) issues.push('manifest.counts.rejectedByReason values must be non-negative integers.')
        else if (integer(rejectedRows) && values.reduce((sum, value) => sum + value, 0) !== rejectedRows) issues.push('manifest.counts rejected reasons must sum to rejectedRows.')
      }
    }
  }
  return issues
}

export function summarizeOpenCatalogManifest(manifest) {
  return {
    schemaVersion: manifest.schemaVersion,
    provider: manifest.provider,
    stage: manifest.stage,
    releaseId: manifest.release.releaseId,
    overtureSchemaVersion: manifest.release.schemaVersion,
    licenseLedgerId: manifest.licenseLedger.id,
    bbox: manifest.areaExtraction.bbox,
    cellCount: openCatalogCellCount(manifest.areaExtraction.bbox),
    limits: manifest.limits,
    artifact: manifest.stage === 'extracted' ? manifest.artifact : null,
    counts: manifest.stage === 'extracted' ? manifest.counts : null,
    safety: {
      readOnlyPlan: true,
      appServingEnabled: false,
      deploymentAuthorized: false,
      areaAttachedToIdentity: false,
    },
  }
}
