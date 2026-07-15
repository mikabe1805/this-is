import { buildOpenCatalogArtifact, serializeOpenCatalogArtifact } from './openCatalogArtifact.js'
import { extractOpenCatalogRows } from './openCatalogExtraction.js'
import type { OpenCatalogIngestionContext, RawOverturePlace } from './openCatalog.js'

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message)
}

const context: OpenCatalogIngestionContext = {
  releaseId: '2026-06-17.0',
  schemaVersion: 'v1.17.0',
  licenseLedgerId: 'overture-reviewed-2026-06-17',
  ingestedAt: 1,
}
const bbox = [-74.5, 40.5, -74.4, 40.6] as const
const row = (id: string, lat: number, lng: number): RawOverturePlace => ({
  id,
  geometry: { type: 'Point', coordinates: [lng, lat] },
  names: { primary: `Place ${id}` },
  operating_status: 'open',
  basic_category: 'restaurant',
  taxonomy: { primary: 'restaurant', alternates: [], hierarchy: ['food_and_drink'] },
  websites: [`https://example.com/${id}`],
  confidence: 0.8,
  sources: [{ dataset: 'fixture-open', license: 'Apache-2.0' }],
  google_place_id: 'must-be-discarded-before-artifact',
})

const extraction = extractOpenCatalogRows({
  rows: [row('b', 40.551, -74.451), row('a', 40.55, -74.45), row('c', 40.59, -74.41)],
  bbox,
  context,
  limits: { maxRawRows: 10, maxAcceptedRows: 10, maxCells: 10 },
})
const artifact = buildOpenCatalogArtifact({ extraction, bbox, context })
const serialized = serializeOpenCatalogArtifact(artifact)
assert(artifact.cells.flatMap(cell => cell.places).map(place => place.id).join(',') === 'o:a,o:b,o:c',
  'artifact retains stable cell and identity ordering')
assert(!serialized.includes('google_place_id') && !serialized.includes('gersId')
  && !serialized.includes('ingestedAt') && !serialized.includes('operatingStatus'),
  'artifact carries only the compact server contract')
assert(serialized.includes('Apache-2.0'), 'per-source license evidence survives the compact artifact')
assert(serialized === serializeOpenCatalogArtifact(buildOpenCatalogArtifact({ extraction, bbox, context })),
  'identical extraction produces byte-identical JSON')

const wrongProvenance = structuredClone(extraction)
wrongProvenance.cells[0].places[0].provenance.releaseId = '2026-07-01.0'
let failed = false
try { buildOpenCatalogArtifact({ extraction: wrongProvenance, bbox, context }) } catch { failed = true }
assert(failed, 'context drift fails closed')

const wrongCell = structuredClone(extraction)
wrongCell.cells[0].places[0].lat = 40.59
failed = false
try { buildOpenCatalogArtifact({ extraction: wrongCell, bbox, context }) } catch { failed = true }
assert(failed, 'mis-celled coordinates fail closed')

const zero = extractOpenCatalogRows({
  rows: [{ ...row('closed', 40.55, -74.45), operating_status: 'temporarily_closed' }],
  bbox,
  context,
  limits: { maxRawRows: 10, maxAcceptedRows: 10, maxCells: 10 },
})
failed = false
try { buildOpenCatalogArtifact({ extraction: zero, bbox, context }) } catch { failed = true }
assert(failed, 'an empty extraction cannot masquerade as a serving artifact')

console.log('✓ open-catalog artifact generation is compact, deterministic, reconciled, and provenance-bound')
