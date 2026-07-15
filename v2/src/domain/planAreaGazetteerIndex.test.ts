import { buildGeoNamesGazetteerIndex } from './planAreaGazetteerIndex.js'
import type { GeoNamesGazetteerContext } from './planAreaGazetteer.js'

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message)
}
const context: GeoNamesGazetteerContext = {
  snapshotDate: '2026-07-13', sourceDigest: 'a'.repeat(64),
  licenseLedgerId: 'geonames-2026-07-13-reviewed-attribution', retrievedAt: 1,
}
const line = (fields: Partial<Record<number, string>> = {}) => [
  '5096767', 'Cresskill', 'Cresskill', 'Cresskill', '40.94149', '-73.9593', 'P', 'PPL', 'US', '',
  'NJ', '003', '', '', '9200', '', '15', 'America/New_York', '2026-06-01',
].map((value, index) => fields[index] ?? value).join('\t')
const admin1 = ['US.NJ\tNew Jersey\tNew Jersey\t5101760']
const admin2 = ['US.NJ.003\tBergen County\tBergen County\t5095598']
const rows = [
  line(),
  line({ 0: '5100000', 1: 'Alpine', 2: 'Alpine', 3: '', 4: '40.95593', 5: '-73.93125', 14: '1800' }),
  line(),
  'too\tshort',
  line({ 0: '' }),
  line({ 1: '', 2: '', 3: '' }),
  line({ 4: '' }),
  line({ 6: 'A' }),
  line({ 8: 'USA' }),
  line({ 14: '-1' }),
  line({ 18: 'yesterday' }),
]
const limits = { maxRawCityRows: 20, maxAcceptedAreas: 10, maxIndexBytes: 100_000 }
const result = buildGeoNamesGazetteerIndex({ cityLines: rows, admin1Lines: admin1, admin2Lines: admin2, context, limits })

assert(result.counts.rawCityRows === 11 && result.counts.acceptedAreas === 2 && result.counts.rejectedRows === 9,
  'every non-empty city row is accepted once or rejected once')
for (const reason of [
  'invalid_shape', 'invalid_identity', 'invalid_name', 'invalid_coordinates', 'invalid_feature_class',
  'invalid_country', 'invalid_population', 'invalid_date', 'duplicate_identity',
] as const) assert(result.counts.rejectedByReason[reason] === 1, `${reason} is reconciled exactly`)
assert(result.areas.map(area => area.label).join(',') === 'Alpine,Cresskill', 'index rows are stably ordered')
assert(result.indexBytes > 0 && result.indexBytes <= limits.maxIndexBytes, 'serialized index bytes are measured and bounded')

const reversed = buildGeoNamesGazetteerIndex({
  cityLines: [...rows].reverse(), admin1Lines: admin1, admin2Lines: admin2, context, limits,
})
assert(JSON.stringify(reversed) === JSON.stringify(result), 'pinned rows produce the same index regardless of input order')

for (const [message, input] of [
  ['invalid provenance fails the whole batch', {
    cityLines: rows, admin1Lines: admin1, admin2Lines: admin2,
    context: { ...context, sourceDigest: 'bad' }, limits,
  }],
  ['raw ceiling fails closed', {
    cityLines: rows, admin1Lines: admin1, admin2Lines: admin2, context,
    limits: { ...limits, maxRawCityRows: 10, maxAcceptedAreas: 10 },
  }],
  ['accepted ceiling fails closed', {
    cityLines: rows, admin1Lines: admin1, admin2Lines: admin2, context,
    limits: { ...limits, maxAcceptedAreas: 1 },
  }],
  ['byte ceiling fails closed', {
    cityLines: rows, admin1Lines: admin1, admin2Lines: admin2, context,
    limits: { ...limits, maxIndexBytes: 1 },
  }],
  ['malformed admin table fails closed', {
    cityLines: rows, admin1Lines: ['bad'], admin2Lines: admin2, context, limits,
  }],
] as const) {
  let failed = false
  try {
    buildGeoNamesGazetteerIndex(input)
  } catch { failed = true }
  assert(failed, message)
}

console.log('✓ GeoNames indexing is deterministic, exactly reconciled, provenance-pinned, and row/byte bounded')
