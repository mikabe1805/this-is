import {
  EXPLICIT_PLAN_AREA_RADIUS_KM,
  explicitPlanAreaFromSelection,
  parseGeoNamesPlanArea,
  searchPlanAreas,
  type GeoNamesGazetteerContext,
} from './planAreaGazetteer.js'

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message)
}
const context: GeoNamesGazetteerContext = {
  snapshotDate: '2026-07-13',
  sourceDigest: 'a'.repeat(64),
  licenseLedgerId: 'geonames-2026-07-13-reviewed-attribution',
  retrievedAt: 1,
}
const adminNames = {
  admin1: { 'US.NJ': 'New Jersey', 'BR.27': 'São Paulo' },
  admin2: { 'US.NJ.003': 'Bergen County' },
}
const line = (fields: Partial<Record<number, string>> = {}) => [
  '5096767', 'Cresskill', 'Cresskill', 'Cresskill', '40.94149', '-73.9593', 'P', 'PPL', 'US', '',
  'NJ', '003', '', '', '9200', '', '15', 'America/New_York', '2026-06-01',
].map((value, index) => fields[index] ?? value).join('\t')

const cresskill = parseGeoNamesPlanArea(line(), context, adminNames)
assert(cresskill?.displayLabel === 'Cresskill, Bergen County, New Jersey, US', 'selection labels disambiguate globally')
assert(cresskill?.provenance.sourceDigest === context.sourceDigest, 'pinned source provenance crosses')
assert(parseGeoNamesPlanArea(line({ 6: 'A' }), context, adminNames) === null, 'non-populated features fail closed')
assert(parseGeoNamesPlanArea(line({ 4: '999' }), context, adminNames) === null, 'invalid coordinates fail closed')
assert(parseGeoNamesPlanArea(line(), { ...context, sourceDigest: 'placeholder' }, adminNames) === null,
  'unreviewed source digests fail closed')

const saoPaulo = parseGeoNamesPlanArea(line({
  0: '3448439', 1: 'São Paulo', 2: 'Sao Paulo', 3: 'Sampa', 4: '-23.5475', 5: '-46.63611',
  8: 'BR', 10: '27', 11: '', 14: '12396372', 17: 'America/Sao_Paulo',
}), context, adminNames)
assert(cresskill && saoPaulo, 'valid fixture rows normalize')
if (!cresskill || !saoPaulo) throw new Error('fixture normalization failed')

assert(searchPlanAreas('sao paulo', [cresskill, saoPaulo])[0]?.id === saoPaulo.id,
  'diacritic-insensitive explicit text search works without geography bias')
assert(searchPlanAreas('Cresskill New Jersey', [saoPaulo, cresskill])[0]?.id === cresskill.id,
  'region context disambiguates a typed query')
assert(searchPlanAreas('c', [cresskill]).length === 0, 'one-character queries do not search')
assert(searchPlanAreas('Cresskill', [cresskill, saoPaulo], 99).length === 1, 'results remain bounded to matches and five')

const selected = explicitPlanAreaFromSelection(cresskill)
assert(selected.provenance === 'explicit_plan' && selected.radiusKm === EXPLICIT_PLAN_AREA_RADIUS_KM,
  'only an explicit selection creates the fixed-radius draft input')
assert(!('id' in selected) && !('countryCode' in selected), 'provider identity does not cross into plan logistics')

console.log('✓ explicit area resolution is pinned, globally unbiased, selection-only, and identity-free at the plan boundary')
