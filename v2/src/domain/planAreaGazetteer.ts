/** Pure GeoNames area-gazetteer boundary. It parses already-provided pinned
 * rows and performs unbiased text matching; it cannot download or persist. */
import type { ExplicitPlanArea } from './openDiscovery.js'

const SHA256 = /^[a-f0-9]{64}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const AREA_RADIUS_KM = 12

export interface GeoNamesGazetteerContext {
  snapshotDate: string
  sourceDigest: string
  licenseLedgerId: string
  retrievedAt: number
}

export interface GeoNamesAdminNames {
  admin1: Readonly<Record<string, string>>
  admin2: Readonly<Record<string, string>>
}

export type GeoNamesPlanAreaRejection =
  | 'invalid_shape'
  | 'invalid_provenance'
  | 'invalid_identity'
  | 'invalid_name'
  | 'invalid_coordinates'
  | 'invalid_feature_class'
  | 'invalid_country'
  | 'invalid_population'
  | 'invalid_date'

export type GeoNamesPlanAreaResult =
  | { area: OwnedPlanArea; rejection?: never }
  | { area?: never; rejection: GeoNamesPlanAreaRejection }

export interface OwnedPlanArea {
  id: `gn:${string}`
  label: string
  displayLabel: string
  searchNames: string[]
  countryCode: string
  regionLabel?: string
  districtLabel?: string
  featureCode: string
  lat: number
  lng: number
  population?: number
  provenance: {
    provider: 'geonames'
    snapshotDate: string
    sourceDigest: string
    licenseLedgerId: string
    retrievedAt: number
  }
}

function clean(value: string | undefined, max = 120): string | undefined {
  const result = value?.trim()
  return result && result.length <= max ? result : undefined
}

export function validGeoNamesGazetteerContext(context: GeoNamesGazetteerContext): boolean {
  return DATE.test(context.snapshotDate)
    && SHA256.test(context.sourceDigest)
    && /^geonames-[a-z0-9.-]{8,140}$/.test(context.licenseLedgerId)
    && Number.isFinite(context.retrievedAt) && context.retrievedAt > 0
}

function compactDisplay(parts: Array<string | undefined>): string | undefined {
  const unique = parts.filter((part): part is string => Boolean(part))
    .filter((part, index, all) => all.findIndex(item => item.toLocaleLowerCase() === part.toLocaleLowerCase()) === index)
  while (unique.length > 1 && unique.join(', ').length > 120) {
    if (unique.length > 2) unique.splice(unique.length - 2, 1)
    else unique.pop()
  }
  return clean(unique.join(', '), 120)
}

/** Parses one 19-column GeoNames cities dump row. Administrative names must
 * come from the separately pinned GeoNames admin tables, never a user locale. */
export function parseGeoNamesPlanAreaResult(
  line: string,
  context: GeoNamesGazetteerContext,
  adminNames: GeoNamesAdminNames,
): GeoNamesPlanAreaResult {
  if (!validGeoNamesGazetteerContext(context)) return { rejection: 'invalid_provenance' }
  if (typeof line !== 'string') return { rejection: 'invalid_shape' }
  const fields = line.split('\t')
  if (fields.length !== 19) return { rejection: 'invalid_shape' }
  const [idValue, nameValue, asciiValue, alternatesValue, latValue, lngValue,
    featureClass, featureCodeValue, countryValue, , admin1Code, admin2Code, , ,
    populationValue, , , , modificationDate] = fields
  const id = /^\d{1,20}$/.test(idValue) ? idValue : null
  if (!id) return { rejection: 'invalid_identity' }
  const label = clean(nameValue, 120)
  if (!label) return { rejection: 'invalid_name' }
  const asciiName = clean(asciiValue, 120)
  const featureCode = clean(featureCodeValue, 20)
  const countryCode = /^[A-Z]{2}$/.test(countryValue) ? countryValue : null
  const lat = Number(latValue)
  const lng = Number(lngValue)
  if (latValue === '' || lngValue === ''
    || !Number.isFinite(lat) || lat < -90 || lat > 90
    || !Number.isFinite(lng) || lng < -180 || lng > 180) return { rejection: 'invalid_coordinates' }
  if (featureClass !== 'P' || !featureCode) return { rejection: 'invalid_feature_class' }
  if (!countryCode) return { rejection: 'invalid_country' }
  if (!DATE.test(modificationDate)) return { rejection: 'invalid_date' }

  const populationNumber = populationValue === '' ? undefined : Number(populationValue)
  if (populationNumber !== undefined && (!Number.isSafeInteger(populationNumber) || populationNumber < 0)) {
    return { rejection: 'invalid_population' }
  }
  const aliases = alternatesValue.split(',').map(value => clean(value, 120))
    .filter((value): value is string => Boolean(value)).slice(0, 20)
  const searchNames = [...new Set([label, asciiName, ...aliases].filter((value): value is string => Boolean(value)))]
  const regionLabel = clean(adminNames.admin1[`${countryCode}.${admin1Code}`], 120)
  const districtLabel = clean(adminNames.admin2[`${countryCode}.${admin1Code}.${admin2Code}`], 120)
  const displayLabel = compactDisplay([label, districtLabel, regionLabel, countryCode])
  if (!displayLabel) return { rejection: 'invalid_name' }

  return { area: {
    id: `gn:${id}`,
    label,
    displayLabel,
    searchNames,
    countryCode,
    ...(regionLabel ? { regionLabel } : {}),
    ...(districtLabel ? { districtLabel } : {}),
    featureCode,
    lat,
    lng,
    ...(populationNumber !== undefined ? { population: populationNumber } : {}),
    provenance: { provider: 'geonames', ...context },
  } }
}

export function parseGeoNamesPlanArea(
  line: string,
  context: GeoNamesGazetteerContext,
  adminNames: GeoNamesAdminNames,
): OwnedPlanArea | null {
  return parseGeoNamesPlanAreaResult(line, context, adminNames).area ?? null
}

function searchable(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

/** Global text match only: no device, IP, prior area, population radius, user,
 * group, or launch-market bias. Population breaks otherwise equal text ties. */
export function searchPlanAreas(query: string, areas: readonly OwnedPlanArea[], limit = 5): OwnedPlanArea[] {
  const normalized = searchable(query)
  if (normalized.length < 2 || normalized.length > 80) return []
  const terms = normalized.split(' ')
  const boundedLimit = Math.max(0, Math.min(Math.floor(limit), 5))
  return areas.flatMap(area => {
    const names = area.searchNames.map(searchable)
    const context = searchable([area.displayLabel, area.countryCode].join(' '))
    const score = names.includes(normalized) ? 0
      : names.some(name => name.startsWith(normalized)) ? 1
        : terms.every(term => context.includes(term)) ? 2
          : null
    return score === null ? [] : [{ area, score }]
  }).sort((a, b) => a.score - b.score
    || (b.area.population ?? 0) - (a.area.population ?? 0)
    || a.area.displayLabel.localeCompare(b.area.displayLabel)
    || a.area.id.localeCompare(b.area.id))
    .slice(0, boundedLimit)
    .map(result => result.area)
}

/** Called only after the person taps one server-owned gazetteer result. The
 * returned coordinates live in the current request/draft and are never memory. */
export function explicitPlanAreaFromSelection(area: OwnedPlanArea): ExplicitPlanArea {
  return {
    label: area.displayLabel,
    lat: area.lat,
    lng: area.lng,
    radiusKm: AREA_RADIUS_KM,
    provenance: 'explicit_plan',
  }
}

export const EXPLICIT_PLAN_AREA_RADIUS_KM = AREA_RADIUS_KM
