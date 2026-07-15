/** Pure owned/open catalog boundary. No Firebase, Google client, or network code.
 * Only fields explicitly normalized from the Overture-shaped input can cross
 * this boundary; unknown provider fields are discarded. */

export type OpenCatalogId = `o:${string}`
export type OvertureOperatingStatus = 'open' | 'temporarily_closed' | 'permanently_closed'
export interface OpenCatalogSourceAttribution {
  dataset: string
  license?: string
}
export type OpenCatalogNormalizationRejection =
  | 'invalid_identity'
  | 'invalid_geometry'
  | 'invalid_name'
  | 'invalid_status'
  | 'invalid_provenance'

export interface OpenCatalogIngestionContext {
  releaseId: string
  schemaVersion: string
  licenseLedgerId: string
  ingestedAt: number
}

export interface RawOverturePlace {
  id?: unknown
  geometry?: { type?: unknown; coordinates?: unknown }
  names?: { primary?: unknown }
  basic_category?: unknown
  taxonomy?: {
    primary?: unknown
    alternates?: unknown
    hierarchy?: unknown
  }
  operating_status?: unknown
  websites?: unknown
  confidence?: unknown
  sources?: unknown
  [key: string]: unknown
}

export interface OwnedOpenPlace {
  id: OpenCatalogId
  gersId: string
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
  operatingStatus: OvertureOperatingStatus
  provenance: {
    provider: 'overture'
    releaseId: string
    schemaVersion: string
    licenseLedgerId: string
    ingestedAt: number
    sourceAttributions: OpenCatalogSourceAttribution[]
  }
}

export interface PlaceAlias {
  ownedPlaceId: OpenCatalogId
  googlePlaceId: string
  method: 'name_geo' | 'user_confirmed'
  confidence: number
  matchedAt: number
}

export interface OpenCatalogIdentityResolution {
  excludeOpenPlaceIds: Set<OpenCatalogId>
  ambiguousAliasCount: number
  invalidAliasCount: number
}

export type OpenCatalogNormalizationResult =
  | { place: OwnedOpenPlace; rejection?: never }
  | { place?: never; rejection: OpenCatalogNormalizationRejection }

function cleanString(value: unknown, max = 300): string | undefined {
  if (typeof value !== 'string') return undefined
  const cleaned = value.trim()
  return cleaned && cleaned.length <= max ? cleaned : undefined
}

function cleanStrings(value: unknown, maxItems = 20): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(item => cleanString(item, 120)).filter((item): item is string => Boolean(item)))]
    .slice(0, maxItems)
}

function sourceAttributions(value: unknown): OpenCatalogSourceAttribution[] {
  if (!Array.isArray(value)) return []
  const records = value.flatMap(source => {
    if (!source || typeof source !== 'object') return []
    const record = source as Record<string, unknown>
    const dataset = cleanString(record.dataset, 160)
      ?? cleanString(record.dataset_name, 160)
    if (!dataset) return []
    const license = cleanString(record.license, 160)
    return [{ dataset, ...(license ? { license } : {}) }]
  })
  const seen = new Set<string>()
  return records.filter(record => {
    const key = `${record.dataset}\u0000${record.license ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 20)
}

function validIngestionContext(context: OpenCatalogIngestionContext): boolean {
  return /^\d{4}-\d{2}-\d{2}\.\d+$/.test(context.releaseId)
    && /^v\d+\.\d+\.\d+$/.test(context.schemaVersion)
    && Boolean(cleanString(context.licenseLedgerId, 160))
    && Number.isFinite(context.ingestedAt)
    && context.ingestedAt > 0
}

export function normalizeOverturePlaceResult(
  raw: RawOverturePlace,
  context: OpenCatalogIngestionContext,
): OpenCatalogNormalizationResult {
  if (!validIngestionContext(context)) return { rejection: 'invalid_provenance' }
  const gersId = cleanString(raw.id, 180)
  if (!gersId) return { rejection: 'invalid_identity' }
  const name = cleanString(raw.names?.primary, 200)
  if (!name) return { rejection: 'invalid_name' }
  const operatingStatus = cleanString(raw.operating_status, 40)
  if (!['open', 'temporarily_closed', 'permanently_closed'].includes(operatingStatus ?? '')) {
    return { rejection: 'invalid_status' }
  }
  const coordinates = raw.geometry?.type === 'Point' && Array.isArray(raw.geometry.coordinates)
    ? raw.geometry.coordinates
    : null
  const lng = coordinates?.[0]
  const lat = coordinates?.[1]
  if (typeof lat !== 'number' || typeof lng !== 'number') return { rejection: 'invalid_geometry' }
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { rejection: 'invalid_geometry' }
  }

  const basicCategory = cleanString(raw.basic_category, 120)
  const taxonomyPrimary = cleanString(raw.taxonomy?.primary, 120)
  const alternates = cleanStrings(raw.taxonomy?.alternates)
  const hierarchy = cleanStrings(raw.taxonomy?.hierarchy)
  const website = cleanStrings(raw.websites, 1).find(value => /^https?:\/\//i.test(value))
  const confidence = typeof raw.confidence === 'number'
    && Number.isFinite(raw.confidence)
    && raw.confidence >= 0
    && raw.confidence <= 1
    ? raw.confidence
    : undefined
  const attributions = sourceAttributions(raw.sources)
  if (!attributions.length) return { rejection: 'invalid_provenance' }

  return { place: {
    id: `o:${gersId}`,
    gersId,
    name,
    lat,
    lng,
    ...(basicCategory ? { basicCategory } : {}),
    ...(taxonomyPrimary || alternates.length || hierarchy.length
      ? { taxonomy: { ...(taxonomyPrimary ? { primary: taxonomyPrimary } : {}), alternates, hierarchy } }
      : {}),
    ...(website ? { website } : {}),
    ...(confidence !== undefined ? { confidence } : {}),
    operatingStatus: operatingStatus as OvertureOperatingStatus,
    provenance: {
      provider: 'overture',
      releaseId: context.releaseId,
      schemaVersion: context.schemaVersion,
      licenseLedgerId: context.licenseLedgerId,
      ingestedAt: context.ingestedAt,
      sourceAttributions: attributions,
    },
  } }
}

export function normalizeOverturePlace(
  raw: RawOverturePlace,
  context: OpenCatalogIngestionContext,
): OwnedOpenPlace | null {
  return normalizeOverturePlaceResult(raw, context).place ?? null
}

export function createPlaceAlias(input: Omit<PlaceAlias, 'googlePlaceId'> & { googlePlaceId: string }): PlaceAlias {
  const googlePlaceId = input.googlePlaceId.trim()
  if (!/^o:\S{1,180}$/.test(input.ownedPlaceId)
    || !googlePlaceId || googlePlaceId.length > 500 || googlePlaceId.startsWith('g:')) {
    throw new Error('Alias requires one raw Google Place ID.')
  }
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
    throw new Error('Alias confidence must be between 0 and 1.')
  }
  if (!Number.isFinite(input.matchedAt) || input.matchedAt <= 0) {
    throw new Error('Alias timestamp must be positive.')
  }
  if (input.method === 'user_confirmed' && input.confidence !== 1) {
    throw new Error('A user-confirmed alias must have confidence 1.')
  }
  return { ...input, googlePlaceId }
}

function validAlias(alias: PlaceAlias): boolean {
  return /^o:\S{1,180}$/.test(alias.ownedPlaceId)
    && typeof alias.googlePlaceId === 'string'
    && alias.googlePlaceId === alias.googlePlaceId.trim()
    && alias.googlePlaceId.length >= 1 && alias.googlePlaceId.length <= 500
    && !alias.googlePlaceId.startsWith('g:')
    && ['name_geo', 'user_confirmed'].includes(alias.method)
    && Number.isFinite(alias.confidence) && alias.confidence >= 0 && alias.confidence <= 1
    && Number.isFinite(alias.matchedAt) && alias.matchedAt > 0
}

/** Resolves only explicit identity evidence. Coordinates and names never
 * suppress a candidate; ambiguous or malformed aliases leave it visible. */
export function resolveKnownOpenPlaceIds(input: {
  knownPlaceIds: Iterable<string>
  aliases?: readonly PlaceAlias[]
}): OpenCatalogIdentityResolution {
  const excludeOpenPlaceIds = new Set<OpenCatalogId>()
  const knownGooglePlaceIds = new Set<string>()
  for (const placeId of input.knownPlaceIds) {
    if (/^o:\S{1,180}$/.test(placeId)) excludeOpenPlaceIds.add(placeId as OpenCatalogId)
    if (/^g:\S{1,500}$/.test(placeId)) knownGooglePlaceIds.add(placeId.slice(2))
  }

  const aliasesByGoogle = new Map<string, Set<OpenCatalogId>>()
  let invalidAliasCount = 0
  for (const alias of input.aliases ?? []) {
    if (!validAlias(alias)) {
      invalidAliasCount++
      continue
    }
    if (alias.method !== 'user_confirmed' || alias.confidence !== 1
      || !knownGooglePlaceIds.has(alias.googlePlaceId)) continue
    const matches = aliasesByGoogle.get(alias.googlePlaceId) ?? new Set<OpenCatalogId>()
    matches.add(alias.ownedPlaceId)
    aliasesByGoogle.set(alias.googlePlaceId, matches)
  }

  let ambiguousAliasCount = 0
  for (const matches of aliasesByGoogle.values()) {
    if (matches.size !== 1) {
      ambiguousAliasCount++
      continue
    }
    excludeOpenPlaceIds.add([...matches][0])
  }
  return { excludeOpenPlaceIds, ambiguousAliasCount, invalidAliasCount }
}

export function openCatalogCell(lat: number, lng: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error('Catalog coordinates are invalid.')
  }
  return `${(Math.round(lat * 20) / 20).toFixed(2)}_${(Math.round(lng * 20) / 20).toFixed(2)}`
}
