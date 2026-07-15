/** Pure extraction policy for already-provided Overture rows. This module has
 * no network, filesystem, Firebase, user, group, or deployment capability. */
import {
  normalizeOverturePlaceResult,
  openCatalogCell,
  type OpenCatalogIngestionContext,
  type OpenCatalogNormalizationRejection,
  type OwnedOpenPlace,
  type RawOverturePlace,
} from './openCatalog.js'
import { openPlaceCategory } from './openDiscovery.js'

export type OpenCatalogExtractionRejection = OpenCatalogNormalizationRejection
  | 'ineligible_status'
  | 'unsupported_category'
  | 'outside_bbox'
  | 'duplicate_identity'

export const OPEN_CATALOG_EXTRACTION_REJECTIONS: readonly OpenCatalogExtractionRejection[] = [
  'invalid_identity',
  'invalid_geometry',
  'invalid_name',
  'invalid_status',
  'invalid_provenance',
  'ineligible_status',
  'unsupported_category',
  'outside_bbox',
  'duplicate_identity',
] as const

export interface OpenCatalogExtractionLimits {
  maxRawRows: number
  maxAcceptedRows: number
  maxCells: number
}

export interface OpenCatalogCellPack {
  cell: string
  places: OwnedOpenPlace[]
}

export interface OpenCatalogExtractionResult {
  cells: OpenCatalogCellPack[]
  counts: {
    rawRows: number
    acceptedRows: number
    rejectedRows: number
    rejectedByReason: Record<OpenCatalogExtractionRejection, number>
  }
}

type Bbox = readonly [west: number, south: number, east: number, north: number]

function validBbox(value: readonly number[]): value is Bbox {
  if (value.length !== 4 || !value.every(Number.isFinite)) return false
  const [west, south, east, north] = value
  return west >= -180 && east <= 180 && south >= -90 && north <= 90
    && west < east && south < north
}

function plannedCellCount([west, south, east, north]: Bbox): number {
  return Math.ceil((east - west) * 20) * Math.ceil((north - south) * 20)
}

function withinBbox(place: OwnedOpenPlace, [west, south, east, north]: Bbox): boolean {
  return place.lng >= west && place.lng <= east && place.lat >= south && place.lat <= north
}

function validLimits(limits: OpenCatalogExtractionLimits): boolean {
  return Number.isInteger(limits.maxRawRows) && limits.maxRawRows >= 1 && limits.maxRawRows <= 100_000
    && Number.isInteger(limits.maxAcceptedRows) && limits.maxAcceptedRows >= 1
    && limits.maxAcceptedRows <= limits.maxRawRows
    && Number.isInteger(limits.maxCells) && limits.maxCells >= 1 && limits.maxCells <= 1_000
}

/**
 * Applies the reviewed row boundary and produces stable in-memory cell packs.
 * It deliberately does not serialize, hash, write, download, or activate them.
 */
export function extractOpenCatalogRows(input: {
  rows: readonly RawOverturePlace[]
  bbox: readonly number[]
  context: OpenCatalogIngestionContext
  limits: OpenCatalogExtractionLimits
}): OpenCatalogExtractionResult {
  if (!validBbox(input.bbox)) throw new Error('Extraction requires one valid increasing bbox.')
  if (!validLimits(input.limits)) throw new Error('Extraction limits are invalid.')
  if (input.rows.length < 1) throw new Error('Extraction requires at least one raw row.')
  if (input.rows.length > input.limits.maxRawRows) throw new Error('Raw row ceiling exceeded.')
  if (plannedCellCount(input.bbox) > input.limits.maxCells) throw new Error('Planned cell ceiling exceeded.')

  const rejectedByReason = Object.fromEntries(
    OPEN_CATALOG_EXTRACTION_REJECTIONS.map(reason => [reason, 0]),
  ) as Record<OpenCatalogExtractionRejection, number>
  const reject = (reason: OpenCatalogExtractionRejection) => { rejectedByReason[reason]++ }
  const seen = new Set<string>()
  const cells = new Map<string, OwnedOpenPlace[]>()
  let acceptedRows = 0

  for (const raw of input.rows) {
    const normalized = normalizeOverturePlaceResult(raw, input.context)
    if (normalized.rejection) {
      reject(normalized.rejection)
      continue
    }
    const place = normalized.place
    if (place.operatingStatus !== 'open') {
      reject('ineligible_status')
      continue
    }
    if (!openPlaceCategory(place)) {
      reject('unsupported_category')
      continue
    }
    if (!withinBbox(place, input.bbox)) {
      reject('outside_bbox')
      continue
    }
    if (seen.has(place.id)) {
      reject('duplicate_identity')
      continue
    }
    if (acceptedRows >= input.limits.maxAcceptedRows) throw new Error('Accepted row ceiling exceeded.')
    seen.add(place.id)
    acceptedRows++
    const cell = openCatalogCell(place.lat, place.lng)
    cells.set(cell, [...(cells.get(cell) ?? []), place])
  }

  const rejectedRows = input.rows.length - acceptedRows
  const rejectionTotal = Object.values(rejectedByReason).reduce((sum, count) => sum + count, 0)
  if (rejectionTotal !== rejectedRows) throw new Error('Extraction rejection ledger did not reconcile.')

  return {
    cells: [...cells.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cell, places]) => ({ cell, places: [...places].sort((a, b) => a.id.localeCompare(b.id)) })),
    counts: { rawRows: input.rows.length, acceptedRows, rejectedRows, rejectedByReason },
  }
}
