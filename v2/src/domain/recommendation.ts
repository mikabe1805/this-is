import type { FriendSave, Tag } from './signals.js'

export const PLAN_CONTEXTS = ['Anything', 'Food', 'Drinks', 'Coffee'] as const
export type PlanContext = (typeof PLAN_CONTEXTS)[number]

export type SharedEvidence = {
  mine: FriendSave
  their: FriendSave
}

export type PairEvidence = {
  shared: SharedEvidence[]
  theirIntroductions: FriendSave[]
  myIntroductions: FriendSave[]
}

export type PairRecommendationReason =
  | 'both_want'
  | 'their_love_my_want'
  | 'my_love_their_want'
  | 'shared_intent'
  | 'their_love'
  | 'my_love'

export type PairRecommendation = {
  save: FriendSave
  reason: string
  reasonCode: PairRecommendationReason
  source: 'shared' | 'theirs' | 'mine'
}

const TAG_RANK: Record<Tag, number> = { loved: 0, tried: 1, want: 2 }

function latestByPlace(saves: FriendSave[]): Map<string, FriendSave> {
  const result = new Map<string, FriendSave>()
  for (const save of saves) {
    if (save.visibility !== 'circle') continue
    const current = result.get(save.placeId)
    if (!current || save.ts > current.ts) result.set(save.placeId, save)
  }
  return result
}

function withPlaceFallback(primary: FriendSave, fallback: FriendSave): FriendSave {
  return primary.place ? primary : { ...primary, place: fallback.place }
}

/** Relationship evidence is computed, never stored. Missing signals stay
 * unknown: a place only becomes shared when both people explicitly kept it. */
export function buildPairEvidence(mine: FriendSave[], theirs: FriendSave[]): PairEvidence {
  const myByPlace = latestByPlace(mine)
  const theirByPlace = latestByPlace(theirs)

  const shared = [...theirByPlace.values()]
    .flatMap(their => {
      const my = myByPlace.get(their.placeId)
      return my ? [{ their: withPlaceFallback(their, my), mine: my }] : []
    })
    .sort((a, b) => {
      const tagDifference =
        TAG_RANK[a.their.tag] + TAG_RANK[a.mine.tag] -
        TAG_RANK[b.their.tag] - TAG_RANK[b.mine.tag]
      return tagDifference || Math.max(b.their.ts, b.mine.ts) - Math.max(a.their.ts, a.mine.ts)
    })

  const theirIntroductions = [...theirByPlace.values()]
    .filter(save => save.tag === 'loved' && !myByPlace.has(save.placeId) && save.place)
    .sort((a, b) => b.ts - a.ts)

  const myIntroductions = [...myByPlace.values()]
    .filter(save => save.tag === 'loved' && !theirByPlace.has(save.placeId) && save.place)
    .sort((a, b) => b.ts - a.ts)

  return { shared, theirIntroductions, myIntroductions }
}

export function fitsPlanContext(save: FriendSave, context: PlanContext): boolean {
  if (context === 'Anything') return true
  const searchable = `${save.place?.primaryType ?? ''} ${save.place?.name ?? ''}`.toLowerCase()
  if (context === 'Food') return /restaurant|food|pizza|bakery|dining|diner/.test(searchable)
  if (context === 'Drinks') return /bar|pub|wine|cocktail|brewery|taproom/.test(searchable)
  return /cafe|coffee|bakery|espresso|tea_house/.test(searchable)
}

function sharedRecommendation(pair: SharedEvidence, friendName: string): PairRecommendation | null {
  const { mine, their } = pair
  if (mine.tag !== 'want' && their.tag !== 'want') return null

  if (mine.tag === 'want' && their.tag === 'want') {
    return { save: their, reason: 'You both want this.', reasonCode: 'both_want', source: 'shared' }
  }
  if (mine.tag === 'want' && their.tag === 'loved') {
    return {
      save: their,
      reason: `${friendName} loved this, and you want to go.`,
      reasonCode: 'their_love_my_want',
      source: 'shared',
    }
  }
  if (mine.tag === 'loved' && their.tag === 'want') {
    return {
      save: their,
      reason: `${friendName} wants this, and you loved it.`,
      reasonCode: 'my_love_their_want',
      source: 'shared',
    }
  }
  return {
    save: their,
    reason: 'You both kept this, and one of you wants to go.',
    reasonCode: 'shared_intent',
    source: 'shared',
  }
}

function interleaveIntroductions(
  theirs: PairRecommendation[],
  mine: PairRecommendation[]
): PairRecommendation[] {
  const result: PairRecommendation[] = []
  const first = (theirs[0]?.save.ts ?? -1) >= (mine[0]?.save.ts ?? -1) ? theirs : mine
  const second = first === theirs ? mine : theirs
  const length = Math.max(first.length, second.length)
  for (let index = 0; index < length; index += 1) {
    if (first[index]) result.push(first[index])
    if (second[index]) result.push(second[index])
  }
  return result
}

/** Produce a compact, explainable pair result. Shared future intent always
 * leads. Introductions then alternate by person so one taste does not dominate. */
export function buildPairRecommendations({
  mine,
  theirs,
  friendName,
  context = 'Anything',
  limit = 3,
}: {
  mine: FriendSave[]
  theirs: FriendSave[]
  friendName: string
  context?: PlanContext
  limit?: number
}): PairRecommendation[] {
  const evidence = buildPairEvidence(mine, theirs)
  const shared = evidence.shared
    .map(pair => sharedRecommendation(pair, friendName))
    .filter((candidate): candidate is PairRecommendation => Boolean(candidate?.save.place))

  const theirIntroductions: PairRecommendation[] = evidence.theirIntroductions.map(save => ({
    save,
    reason: `${friendName} loved this.`,
    reasonCode: 'their_love',
    source: 'theirs',
  }))
  const myIntroductions: PairRecommendation[] = evidence.myIntroductions.map(save => ({
    save,
    reason: `Your turn to introduce ${friendName}.`,
    reasonCode: 'my_love',
    source: 'mine',
  }))

  const seen = new Set<string>()
  return [...shared, ...interleaveIntroductions(theirIntroductions, myIntroductions)]
    .filter(candidate => fitsPlanContext(candidate.save, context))
    .filter(candidate => !seen.has(candidate.save.placeId) && seen.add(candidate.save.placeId))
    .slice(0, Math.max(0, limit))
}
