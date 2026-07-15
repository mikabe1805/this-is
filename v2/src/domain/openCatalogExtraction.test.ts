import { extractOpenCatalogRows } from './openCatalogExtraction.js'
import type { OpenCatalogIngestionContext, RawOverturePlace } from './openCatalog.js'

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message)
}

const context: OpenCatalogIngestionContext = {
  releaseId: '2026-06-17.0',
  schemaVersion: 'v1.17.0',
  licenseLedgerId: 'overture-2026-06-17.0-reviewed-attribution',
  ingestedAt: 1,
}
const row = (id: string, overrides: Partial<RawOverturePlace> = {}): RawOverturePlace => ({
  id,
  geometry: { type: 'Point', coordinates: [-74.47, 40.55] },
  names: { primary: `Place ${id}` },
  operating_status: 'open',
  basic_category: 'restaurant',
  taxonomy: { primary: 'restaurant', alternates: [], hierarchy: ['food_and_drink'] },
  sources: [{ dataset: 'fixture-open' }],
  ...overrides,
})

const result = extractOpenCatalogRows({
  rows: [
    row('b'),
    row('a'),
    row('a'),
    row('closed', { operating_status: 'temporarily_closed' }),
    row('unsupported', { basic_category: 'hospital', taxonomy: { primary: 'hospital', alternates: [], hierarchy: ['health_and_medical'] } }),
    row('far', { geometry: { type: 'Point', coordinates: [-75, 41] } }),
    row('no-source', { sources: [] }),
    row('bad-geometry', { geometry: { type: 'Polygon', coordinates: [] } }),
    row('no-id', { id: undefined }),
    row('no-name', { names: {} }),
    row('bad-status', { operating_status: 'unknown' }),
  ],
  bbox: [-74.5, 40.5, -74.4, 40.6],
  context,
  limits: { maxRawRows: 20, maxAcceptedRows: 10, maxCells: 10 },
})

assert(result.counts.rawRows === 11 && result.counts.acceptedRows === 2 && result.counts.rejectedRows === 9,
  'accepted and rejected rows reconcile exactly')
assert(result.counts.rejectedByReason.invalid_identity === 1, 'invalid identity is accounted for')
assert(result.counts.rejectedByReason.invalid_name === 1, 'invalid name is accounted for')
assert(result.counts.rejectedByReason.invalid_status === 1, 'malformed status is accounted for')
assert(result.counts.rejectedByReason.duplicate_identity === 1, 'duplicate GERS identities are explicit')
assert(result.counts.rejectedByReason.ineligible_status === 1, 'closed rows are distinguished from malformed statuses')
assert(result.counts.rejectedByReason.unsupported_category === 1, 'unsupported categories do not enter packs')
assert(result.counts.rejectedByReason.outside_bbox === 1, 'rows outside the explicit extraction area are excluded')
assert(result.counts.rejectedByReason.invalid_provenance === 1, 'source-less rows fail provenance')
assert(result.counts.rejectedByReason.invalid_geometry === 1, 'malformed geometry is accounted for')
assert(result.cells.length === 1 && result.cells[0].places.map(place => place.id).join(',') === 'o:a,o:b',
  'cell packs and their rows are stably ordered')

for (const [message, makeInput] of [
  ['invalid bbox fails closed', () => ({ rows: [row('x')], bbox: [0, 0, 0, 0], context, limits: { maxRawRows: 2, maxAcceptedRows: 2, maxCells: 2 } })],
  ['raw row ceiling fails closed', () => ({ rows: [row('x'), row('y')], bbox: [-74.5, 40.5, -74.4, 40.6], context, limits: { maxRawRows: 1, maxAcceptedRows: 1, maxCells: 10 } })],
  ['accepted row ceiling fails closed', () => ({ rows: [row('x'), row('y')], bbox: [-74.5, 40.5, -74.4, 40.6], context, limits: { maxRawRows: 2, maxAcceptedRows: 1, maxCells: 10 } })],
  ['cell ceiling fails closed', () => ({ rows: [row('x')], bbox: [-75, 40, -74, 41], context, limits: { maxRawRows: 2, maxAcceptedRows: 2, maxCells: 10 } })],
] as const) {
  let failed = false
  try { extractOpenCatalogRows(makeInput()) } catch { failed = true }
  assert(failed, message)
}

console.log('✓ open-catalog extraction is bounded, provenance-carrying, deterministic, and exactly reconciled')
