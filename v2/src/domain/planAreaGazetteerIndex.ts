/** Pure index policy for already-provided GeoNames dump text. No downloader,
 * filesystem writer, server, browser storage, Firebase, or activation path. */
import {
  parseGeoNamesPlanAreaResult,
  validGeoNamesGazetteerContext,
  type GeoNamesAdminNames,
  type GeoNamesGazetteerContext,
  type GeoNamesPlanAreaRejection,
  type OwnedPlanArea,
} from './planAreaGazetteer.js'

export type GeoNamesIndexRejection = Exclude<GeoNamesPlanAreaRejection, 'invalid_provenance'> | 'duplicate_identity'
export const GEONAMES_INDEX_REJECTIONS: readonly GeoNamesIndexRejection[] = [
  'invalid_shape', 'invalid_identity', 'invalid_name', 'invalid_coordinates',
  'invalid_feature_class', 'invalid_country', 'invalid_population', 'invalid_date', 'duplicate_identity',
] as const

export interface GeoNamesIndexLimits {
  maxRawCityRows: number
  maxAcceptedAreas: number
  maxIndexBytes: number
}

export interface GeoNamesGazetteerIndexResult {
  areas: OwnedPlanArea[]
  indexBytes: number
  counts: {
    rawCityRows: number
    admin1Rows: number
    admin2Rows: number
    acceptedAreas: number
    rejectedRows: number
    rejectedByReason: Record<GeoNamesIndexRejection, number>
  }
}

function nonEmpty(lines: readonly string[]): string[] {
  return lines.filter(line => line.trim().length > 0)
}

function stableCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function parseAdminTable(lines: readonly string[], depth: 2 | 3, maxRows: number): Record<string, string> {
  const rows = nonEmpty(lines)
  if (rows.length < 1 || rows.length > maxRows) throw new Error(`GeoNames admin${depth - 1} row ceiling is invalid.`)
  const result: Record<string, string> = {}
  for (const line of rows) {
    const fields = line.split('\t')
    if (fields.length !== 4) throw new Error(`GeoNames admin${depth - 1} row shape is invalid.`)
    const [code, name, asciiName, id] = fields
    if (code.split('.').length !== depth || !/^[A-Z]{2}(?:\.[A-Za-z0-9_-]+)+$/.test(code)
      || !/^\d{1,20}$/.test(id)) throw new Error(`GeoNames admin${depth - 1} identity is invalid.`)
    const label = (name.trim() || asciiName.trim())
    if (!label || label.length > 120) throw new Error(`GeoNames admin${depth - 1} name is invalid.`)
    if (code in result) throw new Error(`GeoNames admin${depth - 1} code is duplicated.`)
    result[code] = label
  }
  return result
}

function validLimits(limits: GeoNamesIndexLimits): boolean {
  return Number.isInteger(limits.maxRawCityRows) && limits.maxRawCityRows >= 1 && limits.maxRawCityRows <= 250_000
    && Number.isInteger(limits.maxAcceptedAreas) && limits.maxAcceptedAreas >= 1
    && limits.maxAcceptedAreas <= limits.maxRawCityRows
    && Number.isInteger(limits.maxIndexBytes) && limits.maxIndexBytes >= 1 && limits.maxIndexBytes <= 100_000_000
}

export function buildGeoNamesGazetteerIndex(input: {
  cityLines: readonly string[]
  admin1Lines: readonly string[]
  admin2Lines: readonly string[]
  context: GeoNamesGazetteerContext
  limits: GeoNamesIndexLimits
}): GeoNamesGazetteerIndexResult {
  if (!validGeoNamesGazetteerContext(input.context)) throw new Error('GeoNames index provenance is invalid.')
  if (!validLimits(input.limits)) throw new Error('GeoNames index limits are invalid.')
  const cityLines = nonEmpty(input.cityLines)
  if (cityLines.length < 1) throw new Error('GeoNames index requires city rows.')
  if (cityLines.length > input.limits.maxRawCityRows) throw new Error('GeoNames raw city row ceiling exceeded.')
  const adminNames: GeoNamesAdminNames = {
    admin1: parseAdminTable(input.admin1Lines, 2, 10_000),
    admin2: parseAdminTable(input.admin2Lines, 3, 100_000),
  }
  const rejectedByReason = Object.fromEntries(
    GEONAMES_INDEX_REJECTIONS.map(reason => [reason, 0]),
  ) as Record<GeoNamesIndexRejection, number>
  const areas: OwnedPlanArea[] = []
  const seen = new Set<string>()

  for (const line of [...cityLines].sort(stableCompare)) {
    const parsed = parseGeoNamesPlanAreaResult(line, input.context, adminNames)
    if (parsed.rejection) {
      // Provenance is validated once for the whole pinned batch above. It can
      // never be represented honestly as a rejection of one source row.
      if (parsed.rejection === 'invalid_provenance') throw new Error('GeoNames index provenance changed during parsing.')
      rejectedByReason[parsed.rejection]++
      continue
    }
    if (seen.has(parsed.area.id)) {
      rejectedByReason.duplicate_identity++
      continue
    }
    if (areas.length >= input.limits.maxAcceptedAreas) throw new Error('GeoNames accepted area ceiling exceeded.')
    seen.add(parsed.area.id)
    areas.push(parsed.area)
  }
  areas.sort((a, b) => stableCompare(a.displayLabel, b.displayLabel) || stableCompare(a.id, b.id))
  const rejectedRows = cityLines.length - areas.length
  const rejectionTotal = Object.values(rejectedByReason).reduce((sum, count) => sum + count, 0)
  if (rejectionTotal !== rejectedRows) throw new Error('GeoNames rejection ledger did not reconcile.')
  const indexBytes = new TextEncoder().encode(JSON.stringify({
    schemaVersion: 1,
    snapshotDate: input.context.snapshotDate,
    licenseLedgerId: input.context.licenseLedgerId,
    areas,
  })).byteLength
  if (indexBytes > input.limits.maxIndexBytes) throw new Error('GeoNames index byte ceiling exceeded.')

  return {
    areas,
    indexBytes,
    counts: {
      rawCityRows: cityLines.length,
      admin1Rows: nonEmpty(input.admin1Lines).length,
      admin2Rows: nonEmpty(input.admin2Lines).length,
      acceptedAreas: areas.length,
      rejectedRows,
      rejectedByReason,
    },
  }
}
