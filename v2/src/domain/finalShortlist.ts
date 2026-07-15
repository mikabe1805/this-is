import type { GroupRecommendation } from './groupRecommendation.js'
import type { OpenDiscoveryCandidate } from './openDiscovery.js'

export type FinalGroupCandidate =
  | { source: 'known'; known: GroupRecommendation }
  | { source: 'open'; open: OpenDiscoveryCandidate }

/** Known exact-place evidence leads; unfamiliar taste-fit candidates only fill
 * remaining slots. Both sources share the same hard three-candidate ceiling. */
export function buildFinalGroupShortlist(input: {
  known: GroupRecommendation[]
  open: OpenDiscoveryCandidate[]
  limit?: number
}): FinalGroupCandidate[] {
  const limit = Math.max(0, Math.min(input.limit ?? 3, 3))
  const seen = new Set<string>()
  const result: FinalGroupCandidate[] = []
  for (const candidate of input.known) {
    if (result.length >= limit || seen.has(candidate.save.placeId)) continue
    seen.add(candidate.save.placeId)
    result.push({ source: 'known', known: candidate })
  }
  for (const candidate of input.open) {
    if (result.length >= limit || seen.has(candidate.place.id)) continue
    seen.add(candidate.place.id)
    result.push({ source: 'open', open: candidate })
  }
  return result
}
