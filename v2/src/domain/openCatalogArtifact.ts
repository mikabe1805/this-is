/** Pure deterministic codec from reviewed extraction output to the compact
 * server artifact contract. No crypto, filesystem, network, Firebase, user,
 * group, or activation capability belongs here. */
import {
  openCatalogCell,
  type OpenCatalogIngestionContext,
  type OpenCatalogId,
  type OpenCatalogSourceAttribution,
  type OwnedOpenPlace,
} from './openCatalog.js'
import type { OpenCatalogExtractionResult } from './openCatalogExtraction.js'

export interface CompactOpenCatalogPlace {
  id: OpenCatalogId
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
  sourceAttributions: OpenCatalogSourceAttribution[]
}

export interface OpenCatalogArtifactV1 {
  schemaVersion: 1
  provider: 'overture'
  releaseId: string
  overtureSchemaVersion: string
  licenseLedgerId: string
  bbox: [number, number, number, number]
  cells: Array<{ cell: string; places: CompactOpenCatalogPlace[] }>
}

function validBbox(value: readonly number[]): value is readonly [number, number, number, number] {
  if (value.length !== 4 || !value.every(Number.isFinite)) return false
  const [west, south, east, north] = value
  return west >= -180 && east <= 180 && south >= -90 && north <= 90
    && west < east && south < north
}

function validContext(context: OpenCatalogIngestionContext): boolean {
  return /^\d{4}-\d{2}-\d{2}\.\d+$/.test(context.releaseId)
    && /^v\d+\.\d+\.\d+$/.test(context.schemaVersion)
    && /^overture-[a-z0-9.-]{8,140}$/.test(context.licenseLedgerId)
    && Number.isFinite(context.ingestedAt) && context.ingestedAt > 0
}

function withinBbox(place: OwnedOpenPlace, [west, south, east, north]: readonly number[]): boolean {
  return place.lng >= west && place.lng <= east && place.lat >= south && place.lat <= north
}

function matchingProvenance(place: OwnedOpenPlace, context: OpenCatalogIngestionContext): boolean {
  return place.provenance.provider === 'overture'
    && place.provenance.releaseId === context.releaseId
    && place.provenance.schemaVersion === context.schemaVersion
    && place.provenance.licenseLedgerId === context.licenseLedgerId
    && place.provenance.ingestedAt === context.ingestedAt
    && place.provenance.sourceAttributions.length >= 1
    && place.provenance.sourceAttributions.length <= 20
}

function compact(place: OwnedOpenPlace): CompactOpenCatalogPlace {
  return {
    id: place.id,
    name: place.name,
    lat: place.lat,
    lng: place.lng,
    ...(place.basicCategory ? { basicCategory: place.basicCategory } : {}),
    ...(place.taxonomy ? { taxonomy: {
      ...(place.taxonomy.primary ? { primary: place.taxonomy.primary } : {}),
      alternates: [...place.taxonomy.alternates],
      hierarchy: [...place.taxonomy.hierarchy],
    } } : {}),
    ...(place.website ? { website: place.website } : {}),
    ...(place.confidence !== undefined ? { confidence: place.confidence } : {}),
    sourceAttributions: place.provenance.sourceAttributions.map(source => ({ ...source })),
  }
}

/** Builds only the server's compact, identity-free pack shape. Extraction
 * counts stay in the reviewed manifest rather than being trusted from bytes. */
export function buildOpenCatalogArtifact(input: {
  extraction: OpenCatalogExtractionResult
  bbox: readonly number[]
  context: OpenCatalogIngestionContext
}): OpenCatalogArtifactV1 {
  if (!validBbox(input.bbox)) throw new Error('Artifact requires one valid increasing bbox.')
  if (!validContext(input.context)) throw new Error('Artifact requires reviewed ingestion context.')
  if (input.extraction.counts.acceptedRows < 1) throw new Error('Artifact requires at least one accepted row.')
  if (input.extraction.cells.length < 1 || input.extraction.cells.length > 1_000) {
    throw new Error('Artifact cell count is invalid.')
  }

  const seen = new Set<string>()
  let acceptedRows = 0
  let previousCell = ''
  const cells = input.extraction.cells.map(({ cell, places }) => {
    if (!cell || (previousCell && previousCell >= cell) || places.length < 1) {
      throw new Error('Artifact cells must be nonempty and stably ordered.')
    }
    previousCell = cell
    let previousPlace = ''
    const compactPlaces = places.map(place => {
      if (place.operatingStatus !== 'open'
        || !matchingProvenance(place, input.context)
        || !withinBbox(place, input.bbox)
        || openCatalogCell(place.lat, place.lng) !== cell
        || seen.has(place.id)
        || (previousPlace && previousPlace >= place.id)) {
        throw new Error('Artifact place violates extraction or ordering invariants.')
      }
      previousPlace = place.id
      seen.add(place.id)
      acceptedRows++
      return compact(place)
    })
    return { cell, places: compactPlaces }
  })
  if (acceptedRows !== input.extraction.counts.acceptedRows) {
    throw new Error('Artifact accepted-row count does not reconcile.')
  }

  return {
    schemaVersion: 1,
    provider: 'overture',
    releaseId: input.context.releaseId,
    overtureSchemaVersion: input.context.schemaVersion,
    licenseLedgerId: input.context.licenseLedgerId,
    bbox: [...input.bbox] as [number, number, number, number],
    cells,
  }
}

/** JSON property and array order are fixed by construction, yielding identical
 * UTF-8 bytes for the same validated extraction result. */
export function serializeOpenCatalogArtifact(artifact: OpenCatalogArtifactV1): string {
  return JSON.stringify(artifact)
}
