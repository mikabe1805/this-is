import { buildFinalGroupShortlist } from './finalShortlist.js'
import type { GroupRecommendation } from './groupRecommendation.js'
import type { OpenDiscoveryCandidate } from './openDiscovery.js'

function equal(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(message)
}

const known = (placeId: string): GroupRecommendation => ({
  save: { id: placeId, uid: 'a', placeId, tag: 'want', visibility: 'circle', ts: 1 },
  reason: 'Known reason', reasonCode: 'broad_support', supportCount: 2, totalMembers: 3,
})
const open = (id: string): OpenDiscoveryCandidate => ({
  place: { id: `o:${id}`, gersId: id, name: id, lat: 0, lng: 0,
    operatingStatus: 'open',
    provenance: { provider: 'overture', releaseId: '2026-06-17.0', schemaVersion: 'v1.17.0',
      licenseLedgerId: 'fixture-ledger', ingestedAt: 1,
      sourceAttributions: [{ dataset: 'fixture', license: 'Apache-2.0' }] } },
  category: 'food', distanceKm: 1, historyFitCount: 2, hintFitCount: 0, totalMembers: 3,
  reason: 'New reason',
  sources: ['Overture open catalog', 'Current group category evidence', 'Explicit plan area'],
})

const mixed = buildFinalGroupShortlist({
  known: [known('g:a'), known('g:b')],
  open: [open('new-a'), open('new-b')],
})
equal(mixed.map(candidate => candidate.source), ['known', 'known', 'open'], 'known evidence must lead and open fills one remaining slot')
equal(buildFinalGroupShortlist({ known: [known('a'), known('b'), known('c')], open: [open('new')] })
  .map(candidate => candidate.source), ['known', 'known', 'known'], 'open suggestions cannot displace three known candidates')
equal(buildFinalGroupShortlist({ known: [], open: [open('a'), open('b'), open('c'), open('d')] }).length,
  3, 'open-only results still obey the shared ceiling')
equal(buildFinalGroupShortlist({ known: [known('same'), known('same')], open: [], limit: 99 }).length,
  1, 'duplicate identities collapse deterministically')
console.log('✓ known and unfamiliar candidates share one three-place shortlist with known evidence first')
