import type { PlanContext } from './recommendation.js'
import { SHARED_PLACE_NOTE_MAX_LENGTH, type FriendSave } from './signals.js'
import {
  GROUP_QUICK_START_CATEGORIES,
  type GroupQuickStartCategory,
  type GroupQuickStartPreference,
} from './groupQuickStart.js'
import {
  PLACE_OBSERVATION_KEYS,
  PLACE_OBSERVATION_LABELS,
  type PlaceObservationKey,
} from './placeObservations.js'
import { matchesExplicitPlanArea } from './planArea.js'

export interface GroupMemberTaste {
  uid: string
  name: string
  saves: FriendSave[]
  quickStart?: GroupQuickStartPreference
  vetoPlaceIds?: string[]
}

export type GroupRecommendationReason =
  | 'everyone_wants'
  | 'everyone_supports'
  | 'broad_support'
  | 'trusted_introduction'
  | 'quick_start_fit'

export interface GroupRecommendation {
  save: FriendSave
  reason: string
  reasonCode: GroupRecommendationReason
  supportCount: number
  totalMembers: number
  sharedNote?: { authorName: string; text: string }
  sharedObservations?: GroupObservationEvidence[]
}

export interface GroupObservationEvidence {
  key: PlaceObservationKey
  label: string
  yesNames: string[]
  noNames: string[]
}

export type SparseGroupRecovery =
  | {
      kind: 'answerable_want'
      placeId: string
      placeLabel: string
      authorName: string
      category: GroupQuickStartCategory
    }
  | {
      kind: 'own_want' | 'other_want'
      placeId: string
      placeLabel: string
      authorName: string
      category?: GroupQuickStartCategory
    }
  | { kind: 'memory_only' }
  | { kind: 'generic' }

type CandidateEvidence = {
  save: FriendSave
  supporters: Array<{ member: GroupMemberTaste; save: FriendSave }>
  observers: Array<{ member: GroupMemberTaste; save: FriendSave }>
  wantCount: number
  lovedCount: number
  newestAt: number
  hintMatches: GroupMemberTaste[]
}

function evidenceStrength(evidence: CandidateEvidence): number {
  if (evidence.supporters.length >= 2 || evidence.lovedCount >= 1) return 2
  if (evidence.hintMatches.length >= 1) return 1
  return 0
}

function categoryLabel(category: string): string {
  if (category === 'food') return 'food'
  if (category === 'coffee') return 'coffee'
  return 'activity'
}

function sharedNoteFor(evidence: CandidateEvidence): GroupRecommendation['sharedNote'] {
  const source = [...evidence.supporters]
    .filter(item => Boolean(item.save.note?.trim()))
    .sort((a, b) => {
      const loved = Number(b.save.tag === 'loved') - Number(a.save.tag === 'loved')
      return loved || b.save.ts - a.save.ts || a.member.uid.localeCompare(b.member.uid)
    })[0]
  if (!source?.save.note) return undefined
  const normalized = source.save.note.trim().replace(/\s+/g, ' ')
  const text = normalized.length > SHARED_PLACE_NOTE_MAX_LENGTH
    ? `${normalized.slice(0, SHARED_PLACE_NOTE_MAX_LENGTH - 1).trimEnd()}…`
    : normalized
  return {
    authorName: source.member.name.split(/\s+/)[0] ?? 'Someone',
    text,
  }
}

function sharedObservationsFor(
  evidence: CandidateEvidence,
  requiredObservation?: PlaceObservationKey,
): GroupObservationEvidence[] {
  return PLACE_OBSERVATION_KEYS.flatMap(key => {
    const yesNames: string[] = []
    const noNames: string[] = []
    for (const { member, save } of evidence.observers) {
      const observation = save.observations?.[key]
      if (!observation || observation.audience !== 'group' || observation.source !== 'user_authored') continue
      const name = member.name.split(/\s+/)[0] ?? 'Someone'
      if (observation.value === 'yes') yesNames.push(name)
      else noNames.push(name)
    }
    return yesNames.length + noNames.length > 0
      ? [{ key, label: PLACE_OBSERVATION_LABELS[key], yesNames, noNames }]
      : []
  }).sort((a, b) => {
    const required = Number(b.key === requiredObservation) - Number(a.key === requiredObservation)
    if (required) return required
    const disagreement = Number(b.yesNames.length > 0 && b.noNames.length > 0)
      - Number(a.yesNames.length > 0 && a.noNames.length > 0)
    return disagreement || (b.yesNames.length + b.noNames.length) - (a.yesNames.length + a.noNames.length)
  }).slice(0, 3)
}

function satisfiesRequiredObservation(
  evidence: CandidateEvidence,
  requiredObservation?: PlaceObservationKey,
): boolean {
  if (!requiredObservation) return true
  let confirmedYes = false
  for (const { save } of evidence.observers) {
    const observation = save.observations?.[requiredObservation]
    if (!observation || observation.audience !== 'group' || observation.source !== 'user_authored') continue
    if (observation.value === 'no') return false
    confirmedYes = true
  }
  return confirmedYes
}

function latestVisibleByPlace(saves: FriendSave[]): Map<string, FriendSave> {
  const latest = new Map<string, FriendSave>()
  for (const save of saves) {
    if (save.visibility !== 'circle' || !save.memory) continue
    const current = latest.get(save.placeId)
    if (!current || save.ts > current.ts) latest.set(save.placeId, save)
  }
  return latest
}

/**
 * Returns only broad hints that this member could use to corroborate another
 * member's otherwise unsupported Want. It deliberately excludes the member's
 * own Wants, Loves, vetoed places, recent Picks, and already-saved hints.
 */
export function quickStartRecoveryCategories({
  members,
  memberUid,
  excludePlaceIds = [],
}: {
  members: GroupMemberTaste[]
  memberUid: string
  excludePlaceIds?: readonly string[]
}): GroupQuickStartCategory[] {
  const member = members.find(item => item.uid === memberUid)
  if (!member) return []
  const vetoes = new Set(members.flatMap(item => item.vetoPlaceIds ?? []))
  const exclusions = new Set(excludePlaceIds)
  const supportByPlace = new Map<string, Array<{ member: GroupMemberTaste; save: FriendSave }>>()

  for (const item of members) {
    for (const save of latestVisibleByPlace(item.saves).values()) {
      if (exclusions.has(save.placeId) || vetoes.has(save.placeId) || !['want', 'loved'].includes(save.tag)) continue
      const support = supportByPlace.get(save.placeId) ?? []
      support.push({ member: item, save })
      supportByPlace.set(save.placeId, support)
    }
  }

  const existingHints = new Set(member.quickStart?.categoryHints ?? [])
  const useful = new Set<GroupQuickStartCategory>()
  for (const support of supportByPlace.values()) {
    if (support.length !== 1 || support[0].member.uid === memberUid || support[0].save.tag !== 'want') continue
    const category = support[0].save.memory?.category
    if (GROUP_QUICK_START_CATEGORIES.includes(category as GroupQuickStartCategory)
      && !existingHints.has(category as GroupQuickStartCategory)) {
      useful.add(category as GroupQuickStartCategory)
    }
  }
  return GROUP_QUICK_START_CATEGORIES.filter(category => useful.has(category))
}

/** Explains a sparse, nonempty group without treating Tried as support or
 * nudging someone to agree with another member. The selected row is stable. */
export function sparseGroupRecovery({
  members,
  memberUid,
  excludePlaceIds = [],
}: {
  members: GroupMemberTaste[]
  memberUid: string
  excludePlaceIds?: readonly string[]
}): SparseGroupRecovery {
  if (!members.some(member => member.uid === memberUid)) return { kind: 'generic' }
  const exclusions = new Set(excludePlaceIds)
  const vetoes = new Set(members.flatMap(member => member.vetoPlaceIds ?? []))
  const supportByPlace = new Map<string, Array<{ member: GroupMemberTaste; save: FriendSave }>>()
  let consideredSaveCount = 0

  for (const member of members) {
    for (const save of latestVisibleByPlace(member.saves).values()) {
      if (exclusions.has(save.placeId) || vetoes.has(save.placeId)) continue
      consideredSaveCount++
      if (!['want', 'loved'].includes(save.tag)) continue
      const support = supportByPlace.get(save.placeId) ?? []
      support.push({ member, save })
      supportByPlace.set(save.placeId, support)
    }
  }

  const loneWants = [...supportByPlace.values()]
    .filter(support => support.length === 1 && support[0]?.save.tag === 'want' && support[0].save.memory)
    .map(support => support[0])
    .sort((a, b) => b.save.ts - a.save.ts || a.save.placeId.localeCompare(b.save.placeId))
  const answerableCategories = new Set(quickStartRecoveryCategories({ members, memberUid, excludePlaceIds }))
  const answerable = loneWants.find(({ member, save }) => member.uid !== memberUid
    && answerableCategories.has(save.memory?.category as GroupQuickStartCategory))
  if (answerable?.save.memory) {
    return {
      kind: 'answerable_want',
      placeId: answerable.save.placeId,
      placeLabel: answerable.save.memory.label,
      authorName: answerable.member.name.split(/\s+/)[0] ?? 'Someone',
      category: answerable.save.memory.category as GroupQuickStartCategory,
    }
  }

  const own = loneWants.find(({ member }) => member.uid === memberUid)
  if (own?.save.memory) {
    const category = GROUP_QUICK_START_CATEGORIES.includes(own.save.memory.category as GroupQuickStartCategory)
      ? own.save.memory.category as GroupQuickStartCategory
      : undefined
    return {
      kind: 'own_want',
      placeId: own.save.placeId,
      placeLabel: own.save.memory.label,
      authorName: 'You',
      ...(category ? { category } : {}),
    }
  }

  const other = loneWants[0]
  if (other?.save.memory) {
    const category = GROUP_QUICK_START_CATEGORIES.includes(other.save.memory.category as GroupQuickStartCategory)
      ? other.save.memory.category as GroupQuickStartCategory
      : undefined
    return {
      kind: 'other_want',
      placeId: other.save.placeId,
      placeLabel: other.save.memory.label,
      authorName: other.member.name.split(/\s+/)[0] ?? 'Someone',
      ...(category ? { category } : {}),
    }
  }
  return consideredSaveCount > 0 && supportByPlace.size === 0 ? { kind: 'memory_only' } : { kind: 'generic' }
}

function fitsGroupPlanContext(save: FriendSave, context: PlanContext): boolean {
  if (context === 'Anything') return true
  if (context === 'Food') return save.memory?.category === 'food'
  if (context === 'Drinks') return save.memory?.category === 'drinks'
  return save.memory?.category === 'coffee'
}

function reasonFor(evidence: CandidateEvidence, members: GroupMemberTaste[], guestCount: 0 | 1): {
  reason: string
  reasonCode: GroupRecommendationReason
} {
  const total = members.length + guestCount
  const support = evidence.supporters.length
  if (evidence.wantCount === total) {
    return { reason: `All ${total} want this.`, reasonCode: 'everyone_wants' }
  }
  if (support === total) {
    return { reason: 'Everyone has a reason to go.', reasonCode: 'everyone_supports' }
  }
  if (support >= 2) {
    return {
      reason: `${support} of ${total} want or love this.`,
      reasonCode: 'broad_support',
    }
  }
  if (evidence.lovedCount === 0 && evidence.hintMatches.length > 0 && evidence.supporters[0]) {
    const supporter = evidence.supporters[0].member.name.split(/\s+/)[0] ?? 'Someone'
    const category = evidence.save.memory?.category ?? 'place'
    const hint = evidence.hintMatches[0].name.split(/\s+/)[0] ?? 'someone'
    return {
      reason: `${supporter} ${evidence.supporters[0].save.tag === 'loved' ? 'loved' : 'wants'} this; it fits ${hint}'s ${categoryLabel(category)} hint.`,
      reasonCode: 'quick_start_fit',
    }
  }
  const introducer = evidence.supporters.find(item => item.save.tag === 'loved')?.member.name.split(/\s+/)[0] ?? 'Someone'
  const unknown = total - support
  if (evidence.lovedCount === 0) throw new Error('ineligible-group-evidence')
  return {
    reason: `${introducer} loved this; ${unknown} ${unknown === 1 ? 'person hasn’t' : 'people haven’t'} weighed in.`,
    reasonCode: 'trusted_introduction',
  }
}

/**
 * Deterministic recommendations for one intentional group of 2–6 people.
 * Missing evidence stays unknown, and any explicit veto removes the place.
 * Geography is deliberately absent: neighborhood/coordinates are display and
 * logistics facts, never taste features or silent ranking inputs.
 */
export function buildGroupRecommendations({
  members,
  context = 'Anything',
  limit = 3,
  guestCount = 0,
  explicitPlanArea = '',
  requiredObservation,
  excludePlaceIds = [],
}: {
  members: GroupMemberTaste[]
  context?: PlanContext
  limit?: number
  guestCount?: 0 | 1
  explicitPlanArea?: string
  requiredObservation?: PlaceObservationKey
  excludePlaceIds?: readonly string[]
}): GroupRecommendation[] {
  if (members.length < 2 || members.length > 6) {
    throw new Error('Group recommendations support 2–6 people.')
  }
  const memberIds = new Set(members.map(member => member.uid))
  if (memberIds.size !== members.length) throw new Error('Group members must be unique.')
  if (guestCount !== 0 && guestCount !== 1) throw new Error('A plan supports at most one guest.')

  const vetoes = new Set(members.flatMap(member => member.vetoPlaceIds ?? []))
  const exclusions = new Set(excludePlaceIds)
  const candidates = new Map<string, CandidateEvidence>()
  for (const member of members) {
    for (const save of latestVisibleByPlace(member.saves).values()) {
      if (exclusions.has(save.placeId) || vetoes.has(save.placeId) || !['want', 'loved'].includes(save.tag)) continue
      const current = candidates.get(save.placeId) ?? {
        save,
        supporters: [],
        observers: [],
        wantCount: 0,
        lovedCount: 0,
        newestAt: save.ts,
        hintMatches: [],
      }
      current.supporters.push({ member, save })
      current.wantCount += save.tag === 'want' ? 1 : 0
      current.lovedCount += save.tag === 'loved' ? 1 : 0
      current.newestAt = Math.max(current.newestAt, save.ts)
      candidates.set(save.placeId, current)
    }
  }

  // Tried is neutral recommendation evidence, but a person who actually went
  // may still contribute explicitly shared useful details to a place that a
  // Want/Love made eligible. Observers never affect support, ranking, or the
  // unknown denominator.
  for (const member of members) {
    for (const save of latestVisibleByPlace(member.saves).values()) {
      const evidence = candidates.get(save.placeId)
      if (evidence && save.observations) evidence.observers.push({ member, save })
    }
  }

  for (const evidence of candidates.values()) {
    const category = evidence.save.memory?.category
    if (!category || !['food', 'coffee', 'activity'].includes(category)) continue
    const supporterUids = new Set(evidence.supporters.map(item => item.member.uid))
    evidence.hintMatches = members.filter(member =>
      !supporterUids.has(member.uid)
      && member.quickStart?.categoryHints.includes(category as 'food' | 'coffee' | 'activity'))
  }

  const ranked = [...candidates.values()]
    .filter(evidence => evidence.supporters.length >= 2
      || evidence.lovedCount >= 1
      || (evidence.wantCount >= 1 && evidence.hintMatches.length >= 1))
    .filter(evidence => fitsGroupPlanContext(evidence.save, context))
    .filter(evidence => matchesExplicitPlanArea(evidence.save.memory?.area, explicitPlanArea))
    .filter(evidence => satisfiesRequiredObservation(evidence, requiredObservation))
    .sort((a, b) => {
      const strength = evidenceStrength(b) - evidenceStrength(a)
      if (strength) return strength
      const breadth = b.supporters.length - a.supporters.length
      if (breadth) return breadth
      const intent = b.wantCount * 4 + b.lovedCount * 3 - (a.wantCount * 4 + a.lovedCount * 3)
      return intent || b.newestAt - a.newestAt || a.save.placeId.localeCompare(b.save.placeId)
    })

  return ranked.slice(0, Math.max(0, limit))
    .map(evidence => {
      const sharedNote = sharedNoteFor(evidence)
      const sharedObservations = sharedObservationsFor(evidence, requiredObservation)
      return {
        save: evidence.save,
        ...reasonFor(evidence, members, guestCount),
        supportCount: evidence.supporters.length,
        totalMembers: members.length + guestCount,
        ...(sharedNote ? { sharedNote } : {}),
        ...(sharedObservations.length > 0 ? { sharedObservations } : {}),
      }
    })
}
