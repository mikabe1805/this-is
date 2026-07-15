import { createHash } from 'node:crypto'

const SHA256 = /^[a-f0-9]{64}$/
const RELEASE = /^\d{4}-\d{2}-\d{2}\.\d+$/
const OVERTURE_SCHEMA = /^v\d+\.\d+\.\d+$/
const MAX_PLACES = 100_000
const MAX_CELLS = 1_000
const MAX_QUERY_RESULTS = 64

export interface OpenCatalogServiceConfig {
  enabled: true
  objectPath: string
  sha256: string
  maxArtifactBytes: number
  releaseId: string
  overtureSchemaVersion: string
  licenseLedgerId: string
  acceptedRows: number
  cellCount: number
}

export interface ServerOpenCatalogPlace {
  id: `o:${string}`
  name: string
  lat: number
  lng: number
  basicCategory?: string
  taxonomy?: {
    primary?: string
    alternates: string[]
    hierarchy: string[]
  }
  website?: string
  confidence?: number
  sourceAttributions: Array<{ dataset: string; license?: string }>
}

export interface ServerOpenCatalogArtifact {
  schemaVersion: 1
  provider: 'overture'
  releaseId: string
  overtureSchemaVersion: string
  licenseLedgerId: string
  bbox: [number, number, number, number]
  cells: Array<{ cell: string; places: ServerOpenCatalogPlace[] }>
}

export interface ExplicitOpenCatalogArea {
  lat: number
  lng: number
  radiusKm: number
  provenance: 'explicit_plan'
}

export interface OpenCatalogQueryResult {
  place: ServerOpenCatalogPlace
  distanceKm: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, required: string[], optional: string[] = []): boolean {
  const keys = Object.keys(value)
  return required.every(key => keys.includes(key))
    && keys.every(key => required.includes(key) || optional.includes(key))
}

function boundedString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const result = value.trim()
  return result && result.length <= max ? result : null
}

function parseSourceAttributions(value: unknown): ServerOpenCatalogPlace['sourceAttributions'] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) return null
  const result: ServerOpenCatalogPlace['sourceAttributions'] = []
  const seen = new Set<string>()
  for (const raw of value) {
    if (!isRecord(raw) || !hasExactKeys(raw, ['dataset'], ['license'])) return null
    const dataset = boundedString(raw.dataset, 160)
    const license = raw.license === undefined ? undefined : boundedString(raw.license, 160)
    if (!dataset || (raw.license !== undefined && !license)) return null
    const key = `${dataset}\u0000${license ?? ''}`
    if (seen.has(key)) return null
    seen.add(key)
    result.push({ dataset, ...(license ? { license } : {}) })
  }
  return result
}

function stableCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function validBbox(value: unknown): value is [number, number, number, number] {
  if (!Array.isArray(value) || value.length !== 4
    || !value.every(item => typeof item === 'number' && Number.isFinite(item))) return false
  const [west, south, east, north] = value
  return west >= -180 && east <= 180 && south >= -90 && north <= 90
    && west < east && south < north
}

function catalogCell(lat: number, lng: number): string {
  return `${(Math.round(lat * 20) / 20).toFixed(2)}_${(Math.round(lng * 20) / 20).toFixed(2)}`
}

function withinBbox(place: { lat: number; lng: number }, [west, south, east, north]: [number, number, number, number]): boolean {
  return place.lng >= west && place.lng <= east && place.lat >= south && place.lat <= north
}

export function normalizeOpenCatalogServiceConfig(value: unknown): OpenCatalogServiceConfig | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    'enabled', 'objectPath', 'sha256', 'maxArtifactBytes', 'releaseId', 'overtureSchemaVersion',
    'licenseLedgerId', 'acceptedRows', 'cellCount',
  ])) return null
  if (value.enabled !== true
    || typeof value.objectPath !== 'string'
    || !/^open-catalog\/[A-Za-z0-9._/-]+\.json$/.test(value.objectPath)
    || value.objectPath.includes('..')
    || typeof value.sha256 !== 'string' || !SHA256.test(value.sha256)
    || !Number.isSafeInteger(value.maxArtifactBytes)
    || Number(value.maxArtifactBytes) < 1 || Number(value.maxArtifactBytes) > 100_000_000
    || typeof value.releaseId !== 'string' || !RELEASE.test(value.releaseId)
    || typeof value.overtureSchemaVersion !== 'string' || !OVERTURE_SCHEMA.test(value.overtureSchemaVersion)
    || typeof value.licenseLedgerId !== 'string'
    || !/^overture-[a-z0-9.-]{8,140}$/.test(value.licenseLedgerId)
    || !Number.isSafeInteger(value.acceptedRows)
    || Number(value.acceptedRows) < 1 || Number(value.acceptedRows) > MAX_PLACES
    || !Number.isSafeInteger(value.cellCount)
    || Number(value.cellCount) < 1 || Number(value.cellCount) > MAX_CELLS) return null
  return value as unknown as OpenCatalogServiceConfig
}

function parseTaxonomy(value: unknown): ServerOpenCatalogPlace['taxonomy'] | null {
  if (!isRecord(value) || !hasExactKeys(value, ['alternates', 'hierarchy'], ['primary'])) return null
  const primary = value.primary === undefined ? undefined : boundedString(value.primary, 120)
  const alternates = Array.isArray(value.alternates) && value.alternates.length <= 20
    ? value.alternates.map(item => boundedString(item, 120))
    : null
  const hierarchy = Array.isArray(value.hierarchy) && value.hierarchy.length <= 20
    ? value.hierarchy.map(item => boundedString(item, 120))
    : null
  if ((value.primary !== undefined && !primary) || !alternates || !hierarchy
    || alternates.some(item => !item) || hierarchy.some(item => !item)) return null
  const cleanAlternates = alternates as string[]
  const cleanHierarchy = hierarchy as string[]
  if (new Set(cleanAlternates).size !== cleanAlternates.length
    || new Set(cleanHierarchy).size !== cleanHierarchy.length) return null
  return { ...(primary ? { primary } : {}), alternates: cleanAlternates, hierarchy: cleanHierarchy }
}

function parsePlace(value: unknown): ServerOpenCatalogPlace | null {
  if (!isRecord(value) || !hasExactKeys(value, ['id', 'name', 'lat', 'lng', 'sourceAttributions'], [
    'basicCategory', 'taxonomy', 'website', 'confidence',
  ])) return null
  const id = typeof value.id === 'string' && /^o:\S{1,180}$/.test(value.id)
    ? value.id as `o:${string}` : null
  const name = boundedString(value.name, 200)
  const lat = value.lat
  const lng = value.lng
  const basicCategory = value.basicCategory === undefined ? undefined : boundedString(value.basicCategory, 120)
  const taxonomy = value.taxonomy === undefined ? undefined : parseTaxonomy(value.taxonomy)
  const website = value.website === undefined ? undefined : boundedString(value.website, 300)
  const confidence = value.confidence
  const sourceAttributions = parseSourceAttributions(value.sourceAttributions)
  if (!id || !name
    || typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90
    || typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180
    || (value.basicCategory !== undefined && !basicCategory)
    || (value.taxonomy !== undefined && !taxonomy)
    || (value.website !== undefined && (!website || !/^https?:\/\//i.test(website)))
    || (confidence !== undefined && (typeof confidence !== 'number' || !Number.isFinite(confidence)
      || confidence < 0 || confidence > 1))
    || !sourceAttributions) return null
  return {
    id, name, lat, lng,
    ...(basicCategory ? { basicCategory } : {}),
    ...(taxonomy ? { taxonomy } : {}),
    ...(website ? { website } : {}),
    ...(typeof confidence === 'number' ? { confidence } : {}),
    sourceAttributions,
  }
}

export function parseOpenCatalogArtifact(
  bytes: Uint8Array,
  config: OpenCatalogServiceConfig,
): ServerOpenCatalogArtifact {
  if (bytes.byteLength < 1 || bytes.byteLength > config.maxArtifactBytes) {
    throw new Error('open-catalog-size')
  }
  if (createHash('sha256').update(bytes).digest('hex') !== config.sha256) {
    throw new Error('open-catalog-digest')
  }
  let value: unknown
  try {
    value = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new Error('open-catalog-json')
  }
  if (!isRecord(value) || !hasExactKeys(value, [
    'schemaVersion', 'provider', 'releaseId', 'overtureSchemaVersion', 'licenseLedgerId', 'bbox', 'cells',
  ]) || value.schemaVersion !== 1 || value.provider !== 'overture'
    || value.releaseId !== config.releaseId
    || value.overtureSchemaVersion !== config.overtureSchemaVersion
    || value.licenseLedgerId !== config.licenseLedgerId
    || !validBbox(value.bbox)
    || !Array.isArray(value.cells)
    || value.cells.length !== config.cellCount) throw new Error('open-catalog-manifest')

  const cells: ServerOpenCatalogArtifact['cells'] = []
  const seenPlaces = new Set<string>()
  let acceptedRows = 0
  for (const rawCell of value.cells) {
    if (!isRecord(rawCell) || !hasExactKeys(rawCell, ['cell', 'places'])
      || typeof rawCell.cell !== 'string'
      || !/^-?\d{1,3}\.\d{2}_-?\d{1,3}\.\d{2}$/.test(rawCell.cell)
      || !Array.isArray(rawCell.places) || rawCell.places.length < 1) {
      throw new Error('open-catalog-cell')
    }
    const previousCell = cells.at(-1)
    if (previousCell && stableCompare(previousCell.cell, rawCell.cell) >= 0) {
      throw new Error('open-catalog-order')
    }
    const places: ServerOpenCatalogPlace[] = []
    for (const rawPlace of rawCell.places) {
      const place = parsePlace(rawPlace)
      if (!place || !withinBbox(place, value.bbox)
        || catalogCell(place.lat, place.lng) !== rawCell.cell
        || seenPlaces.has(place.id)) throw new Error('open-catalog-place')
      const previousPlace = places.at(-1)
      if (previousPlace && stableCompare(previousPlace.id, place.id) >= 0) {
        throw new Error('open-catalog-order')
      }
      seenPlaces.add(place.id)
      places.push(place)
      acceptedRows++
      if (acceptedRows > config.acceptedRows) throw new Error('open-catalog-count')
    }
    cells.push({ cell: rawCell.cell, places })
  }
  if (acceptedRows !== config.acceptedRows) throw new Error('open-catalog-count')
  return {
    schemaVersion: 1,
    provider: 'overture',
    releaseId: config.releaseId,
    overtureSchemaVersion: config.overtureSchemaVersion,
    licenseLedgerId: config.licenseLedgerId,
    bbox: value.bbox,
    cells,
  }
}

function validExplicitArea(area: ExplicitOpenCatalogArea): boolean {
  return area.provenance === 'explicit_plan'
    && Number.isFinite(area.lat) && area.lat >= -90 && area.lat <= 90
    && Number.isFinite(area.lng) && area.lng >= -180 && area.lng <= 180
    && Number.isFinite(area.radiusKm) && area.radiusKm >= 0.2 && area.radiusKm <= 50
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const radians = (number: number) => number * Math.PI / 180
  const latDelta = radians(bLat - aLat)
  const lngDelta = radians(bLng - aLng)
  const x = Math.sin(latDelta / 2) ** 2
    + Math.cos(radians(aLat)) * Math.cos(radians(bLat)) * Math.sin(lngDelta / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

/** Returns a bounded spatial pool for one explicit plan area. It does not
 * rank for a person or group, infer an area, or persist the request. */
export function queryOpenCatalogArtifact(
  artifact: ServerOpenCatalogArtifact,
  area: ExplicitOpenCatalogArea,
  limit = MAX_QUERY_RESULTS,
): OpenCatalogQueryResult[] {
  if (!validExplicitArea(area)) throw new Error('open-catalog-explicit-area')
  const boundedLimit = Math.max(0, Math.min(Math.floor(limit), MAX_QUERY_RESULTS))
  return artifact.cells.flatMap(cell => cell.places).flatMap(place => {
    const distance = distanceKm(area.lat, area.lng, place.lat, place.lng)
    return distance <= area.radiusKm ? [{ place, distanceKm: Math.round(distance * 10) / 10 }] : []
  }).sort((left, right) => left.distanceKm - right.distanceKm
    || (right.place.confidence ?? 0) - (left.place.confidence ?? 0)
    || stableCompare(left.place.id, right.place.id))
    .slice(0, boundedLimit)
}

export function createOpenCatalogLoader(
  download: (objectPath: string) => Promise<Uint8Array>,
): (config: OpenCatalogServiceConfig) => Promise<ServerOpenCatalogArtifact> {
  let cacheKey = ''
  let cached: Promise<ServerOpenCatalogArtifact> | null = null
  return config => {
    const key = `${config.objectPath}:${config.sha256}:${config.maxArtifactBytes}:${config.releaseId}:${config.overtureSchemaVersion}:${config.licenseLedgerId}:${config.acceptedRows}:${config.cellCount}`
    if (key !== cacheKey || !cached) {
      cacheKey = key
      cached = download(config.objectPath).then(bytes => parseOpenCatalogArtifact(bytes, config))
    }
    return cached
  }
}
