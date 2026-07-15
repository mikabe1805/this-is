import type { GroupRecommendationReason } from './groupRecommendation.js'
import type { UserPlaceCategory } from './placeMemory.js'
import type { PlanContext } from './recommendation.js'
import type { OpenDiscoveryCandidate } from './openDiscovery.js'

export type CandidateEvidenceKind = 'known_match' | 'member_introduction' | 'weak_fit' | 'taste_fit'

export interface CandidateCardPresentation {
  kind: CandidateEvidenceKind
  evidenceLabel: string
  categoryLabel: string
  summary: string
  areaLabel?: string
  contextLabel?: string
  verificationNote: string
  fallbackMaterial: 'ember' | 'coffee' | 'wine' | 'slate' | 'smoke'
  sources: Array<{ label: string; value: string }>
}

const CATEGORY_LABEL: Record<UserPlaceCategory, string> = {
  food: 'Food place',
  drinks: 'Drinks place',
  coffee: 'Coffee place',
  activity: 'Activity',
  other: 'Place',
}

const CATEGORY_SUMMARY: Record<UserPlaceCategory, string> = {
  food: 'A food place someone in this group deliberately kept.',
  drinks: 'A drinks place someone in this group deliberately kept.',
  coffee: 'A coffee place someone in this group deliberately kept.',
  activity: 'Something to do that a group member deliberately kept.',
  other: 'A place someone in this group deliberately kept.',
}

const FALLBACK: Record<UserPlaceCategory, CandidateCardPresentation['fallbackMaterial']> = {
  food: 'ember', drinks: 'wine', coffee: 'coffee', activity: 'slate', other: 'smoke',
}

export function buildCandidateCardPresentation(input: {
  reasonCode: GroupRecommendationReason
  category: UserPlaceCategory
  context: PlanContext
  supportCount: number
  totalMembers: number
  area?: string
}): CandidateCardPresentation {
  const boundedSupport = Math.max(0, Math.min(input.supportCount, input.totalMembers))
  const kind: CandidateEvidenceKind = input.reasonCode === 'quick_start_fit'
    ? 'weak_fit'
    : input.reasonCode === 'trusted_introduction'
      ? 'member_introduction'
      : 'known_match'
  const evidenceLabel = kind === 'weak_fit'
    ? 'WEAK FIT · 1 EXACT SIGNAL + 1 HINT'
    : kind === 'member_introduction'
      ? `MEMBER INTRODUCTION · ${boundedSupport} OF ${input.totalMembers}`
      : `KNOWN MATCH · ${boundedSupport} OF ${input.totalMembers}`
  const reasonSource = kind === 'weak_fit'
    ? 'Exact group signal + optional Quick start'
    : kind === 'member_introduction'
      ? 'Named member Love'
      : 'Current exact group signals'
  const contextLabel = input.context === 'Anything' ? undefined : `Fits ${input.context}`
  const areaLabel = input.area?.trim().slice(0, 80) || undefined

  return {
    kind,
    evidenceLabel,
    categoryLabel: CATEGORY_LABEL[input.category],
    summary: CATEGORY_SUMMARY[input.category],
    ...(areaLabel ? { areaLabel } : {}),
    ...(contextLabel ? { contextLabel } : {}),
    verificationNote: 'Hours, price, accessibility, and group fit are not verified here.',
    fallbackMaterial: FALLBACK[input.category],
    sources: [
      { label: 'Label', value: 'Confirmed by a group member' },
      { label: 'Type', value: 'Member-chosen category' },
      { label: 'Reason', value: reasonSource },
      ...(areaLabel ? [{ label: 'Area', value: 'Confirmed by a group member' }] : []),
    ],
  }
}

export function buildOpenCandidateCardPresentation(
  candidate: OpenDiscoveryCandidate,
  areaLabel: string,
): CandidateCardPresentation {
  const safeArea = areaLabel.trim().slice(0, 120)
  return {
    kind: 'taste_fit',
    evidenceLabel: 'NEW TO THIS GROUP · TASTE-FIT',
    categoryLabel: CATEGORY_LABEL[candidate.category],
    summary: `An open-catalog ${candidate.category} candidate${safeArea ? ` in ${safeArea}` : ''}.`,
    verificationNote: 'Hours, price, accessibility, and exact group fit are not verified here.',
    fallbackMaterial: FALLBACK[candidate.category],
    sources: [
      { label: 'Label', value: 'Overture open place data' },
      { label: 'Type', value: 'Overture taxonomy' },
      { label: 'Reason', value: 'Current group category evidence' },
      { label: 'Area', value: 'Explicit for this plan only' },
    ],
  }
}
