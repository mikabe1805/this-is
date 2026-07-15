import { createHash } from 'node:crypto'

const SHA256 = /^[a-f0-9]{64}$/
const SNAPSHOT_DATE = /^\d{4}-\d{2}-\d{2}$/
const MAX_AREAS = 200_000
const MAX_RESULTS = 5

export interface AreaGazetteerServiceConfig {
  enabled: true
  objectPath: string
  sha256: string
  maxIndexBytes: number
  snapshotDate: string
  licenseLedgerId: string
  acceptedAreas: number
}

export interface ServerPlanArea {
  id: `gn:${string}`
  displayLabel: string
  searchNames: string[]
  countryCode: string
  lat: number
  lng: number
  population?: number
}

export interface AreaGazetteerArtifact {
  schemaVersion: 1
  snapshotDate: string
  licenseLedgerId: string
  areas: ServerPlanArea[]
}

export interface PlanAreaSearchResult {
  id: `gn:${string}`
  label: string
  lat: number
  lng: number
}

export function normalizeAreaGazetteerServiceConfig(value: unknown): AreaGazetteerServiceConfig | null {
  if (!value || typeof value !== 'object') return null
  const config = value as Record<string, unknown>
  if (config.enabled !== true
    || typeof config.objectPath !== 'string'
    || !/^area-gazetteer\/[A-Za-z0-9._/-]+\.json$/.test(config.objectPath)
    || config.objectPath.includes('..')
    || !SHA256.test(typeof config.sha256 === 'string' ? config.sha256 : '')
    || !Number.isSafeInteger(config.maxIndexBytes)
    || Number(config.maxIndexBytes) < 1
    || Number(config.maxIndexBytes) > 50_000_000
    || typeof config.snapshotDate !== 'string' || !SNAPSHOT_DATE.test(config.snapshotDate)
    || typeof config.licenseLedgerId !== 'string'
    || !/^geonames-[a-z0-9.-]{8,140}$/.test(config.licenseLedgerId)
    || !Number.isSafeInteger(config.acceptedAreas)
    || Number(config.acceptedAreas) < 1 || Number(config.acceptedAreas) > MAX_AREAS) return null
  return {
    enabled: true,
    objectPath: config.objectPath,
    sha256: config.sha256 as string,
    maxIndexBytes: config.maxIndexBytes as number,
    snapshotDate: config.snapshotDate,
    licenseLedgerId: config.licenseLedgerId,
    acceptedAreas: config.acceptedAreas as number,
  }
}

function boundedString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const result = value.trim()
  return result && result.length <= max ? result : null
}

function stableCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function normalizeArea(value: unknown): ServerPlanArea | null {
  if (!value || typeof value !== 'object') return null
  const area = value as Record<string, unknown>
  const id = typeof area.id === 'string' && /^gn:\d{1,20}$/.test(area.id)
    ? area.id as `gn:${string}`
    : null
  const displayLabel = boundedString(area.displayLabel, 120)
  const countryCode = typeof area.countryCode === 'string' && /^[A-Z]{2}$/.test(area.countryCode)
    ? area.countryCode
    : null
  const searchNames = Array.isArray(area.searchNames)
    ? [...new Set(area.searchNames.map(item => boundedString(item, 120)).filter((item): item is string => Boolean(item)))]
    : []
  const lat = area.lat
  const lng = area.lng
  const population = area.population
  if (!id || !displayLabel || !countryCode || searchNames.length < 1 || searchNames.length > 22
    || typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90
    || typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180
    || (population !== undefined && (!Number.isSafeInteger(population) || Number(population) < 0))) return null
  return {
    id,
    displayLabel,
    searchNames,
    countryCode,
    lat,
    lng,
    ...(population !== undefined ? { population: population as number } : {}),
  }
}

export function parseAreaGazetteerArtifact(
  bytes: Uint8Array,
  config: AreaGazetteerServiceConfig,
): AreaGazetteerArtifact {
  if (bytes.byteLength < 1 || bytes.byteLength > config.maxIndexBytes) {
    throw new Error('area-gazetteer-size')
  }
  const digest = createHash('sha256').update(bytes).digest('hex')
  if (digest !== config.sha256) throw new Error('area-gazetteer-digest')
  let value: unknown
  try {
    value = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new Error('area-gazetteer-json')
  }
  if (!value || typeof value !== 'object') throw new Error('area-gazetteer-shape')
  const artifact = value as Record<string, unknown>
  const licenseLedgerId = boundedString(artifact.licenseLedgerId, 160)
  if (artifact.schemaVersion !== 1
    || typeof artifact.snapshotDate !== 'string' || !SNAPSHOT_DATE.test(artifact.snapshotDate)
    || !licenseLedgerId || !/^geonames-[a-z0-9.-]{8,140}$/.test(licenseLedgerId)
    || !Array.isArray(artifact.areas)
    || artifact.areas.length < 1 || artifact.areas.length > MAX_AREAS) {
    throw new Error('area-gazetteer-shape')
  }
  if (artifact.snapshotDate !== config.snapshotDate
    || licenseLedgerId !== config.licenseLedgerId
    || artifact.areas.length !== config.acceptedAreas) throw new Error('area-gazetteer-manifest')
  const areas: ServerPlanArea[] = []
  const seen = new Set<string>()
  for (const raw of artifact.areas) {
    const area = normalizeArea(raw)
    if (!area || seen.has(area.id)) throw new Error('area-gazetteer-area')
    const previous = areas.at(-1)
    if (previous && (stableCompare(previous.displayLabel, area.displayLabel) > 0
      || (previous.displayLabel === area.displayLabel && stableCompare(previous.id, area.id) >= 0))) {
      throw new Error('area-gazetteer-order')
    }
    seen.add(area.id)
    areas.push(area)
  }
  return {
    schemaVersion: 1,
    snapshotDate: artifact.snapshotDate,
    licenseLedgerId,
    areas,
  }
}

function searchable(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

export function validPlanAreaQuery(value: unknown): value is string {
  return typeof value === 'string' && searchable(value).length >= 2 && value.trim().length <= 80
}

/** Global text matching only. Population resolves otherwise equal text matches;
 * device, IP, prior plans, group identity, and launch markets never enter. */
export function searchServerPlanAreas(
  query: string,
  artifact: AreaGazetteerArtifact,
  limit = MAX_RESULTS,
): PlanAreaSearchResult[] {
  const normalized = searchable(query)
  if (normalized.length < 2 || normalized.length > 80) return []
  const terms = normalized.split(' ')
  const boundedLimit = Math.max(0, Math.min(Math.floor(limit), MAX_RESULTS))
  return artifact.areas.flatMap(area => {
    const names = area.searchNames.map(searchable)
    const context = searchable(`${area.displayLabel} ${area.countryCode}`)
    const score = names.includes(normalized) ? 0
      : names.some(name => name.startsWith(normalized)) ? 1
        : terms.every(term => context.includes(term)) ? 2
          : null
    return score === null ? [] : [{ area, score }]
  }).sort((left, right) => left.score - right.score
    || (right.area.population ?? 0) - (left.area.population ?? 0)
    || stableCompare(left.area.displayLabel, right.area.displayLabel)
    || stableCompare(left.area.id, right.area.id))
    .slice(0, boundedLimit)
    .map(({ area }) => ({ id: area.id, label: area.displayLabel, lat: area.lat, lng: area.lng }))
}

export function createAreaGazetteerLoader(
  download: (objectPath: string) => Promise<Uint8Array>,
): (config: AreaGazetteerServiceConfig) => Promise<AreaGazetteerArtifact> {
  let cacheKey = ''
  let cached: Promise<AreaGazetteerArtifact> | null = null
  return config => {
    const key = `${config.objectPath}:${config.sha256}:${config.maxIndexBytes}:${config.snapshotDate}:${config.licenseLedgerId}:${config.acceptedAreas}`
    if (key !== cacheKey || !cached) {
      cacheKey = key
      cached = download(config.objectPath).then(bytes => parseAreaGazetteerArtifact(bytes, config))
    }
    return cached
  }
}
