import { buildCandidateCardPresentation, buildOpenCandidateCardPresentation } from './candidateCard.js'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const known = buildCandidateCardPresentation({
  reasonCode: 'broad_support', category: 'food', context: 'Food', supportCount: 3, totalMembers: 5,
  area: 'Cresskill, NJ',
})
assert(known.kind === 'known_match' && known.evidenceLabel === 'KNOWN MATCH · 3 OF 5',
  'exact support is labeled as a known match')
assert(known.contextLabel === 'Fits Food', 'current context becomes a bounded verified chip')
assert(known.areaLabel === 'Cresskill, NJ', 'a user-confirmed area becomes a compact card fact')
assert(known.sources.length === 4 && known.sources[3]?.label === 'Area', 'every visible factual layer names its source class')

const weak = buildCandidateCardPresentation({
  reasonCode: 'quick_start_fit', category: 'coffee', context: 'Anything', supportCount: 1, totalMembers: 4,
})
assert(weak.kind === 'weak_fit', 'Quick start evidence is visually distinct from known evidence')
assert(weak.evidenceLabel.includes('1 EXACT SIGNAL + 1 HINT'), 'weak fit states its actual evidence ingredients')
assert(weak.sources[2]?.value.includes('Quick start'), 'weak-fit provenance names Quick start')
assert(!weak.summary.toLowerCase().includes('cozy'), 'deterministic copy does not invent atmosphere')
assert(weak.verificationNote.includes('not verified'), 'unknown constraints stay visibly unknown')

const intro = buildCandidateCardPresentation({
  reasonCode: 'trusted_introduction', category: 'activity', context: 'Anything', supportCount: 1, totalMembers: 2,
})
assert(intro.kind === 'member_introduction', 'one Love is a named introduction rather than consensus')
assert(intro.fallbackMaterial === 'slate', 'every category has a designed fallback material')

const open = buildOpenCandidateCardPresentation({
  place: { id: 'o:new', gersId: 'new', name: 'New Place', lat: 40, lng: -74,
    operatingStatus: 'open',
    provenance: { provider: 'overture', releaseId: '2026-06-17.0', schemaVersion: 'v1.17.0',
      licenseLedgerId: 'fixture-ledger', ingestedAt: 1,
      sourceAttributions: [{ dataset: 'open', license: 'Apache-2.0' }] } },
  category: 'food', distanceKm: 1, historyFitCount: 2, hintFitCount: 0, totalMembers: 3,
  reason: 'New to this group · matches food history from 2 of 3.',
  sources: ['Overture open catalog', 'Current group category evidence', 'Explicit plan area'],
}, 'the area we chose')
assert(open.kind === 'taste_fit' && open.evidenceLabel.includes('NEW TO THIS GROUP'),
  'unfamiliar evidence never looks like exact agreement')
assert(open.sources.some(source => source.value === 'Explicit for this plan only'),
  'temporary logistics are sourced rather than becoming personalization')
assert(open.verificationNote.includes('exact group fit'), 'predicted category fit remains explicitly uncertain')

console.log('✓ candidate cards separate evidence modes, provenance, fallbacks, and unknown facts')
