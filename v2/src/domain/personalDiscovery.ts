import type { UserPlaceCategory } from './placeMemory.js'

export type PersonalDiscoveryCategory = Extract<UserPlaceCategory, 'food' | 'drinks' | 'coffee' | 'activity'>

export interface PersonalDiscoveryPrompt {
  category: PersonalDiscoveryCategory
  label: string
  detail: string
  evidenceCount: number
}

export interface PersonalDiscoveryContinuation {
  category: PersonalDiscoveryCategory
  area: string
}

interface PersonalDiscoverySave {
  tag: 'want' | 'tried' | 'loved'
  memory?: { category: UserPlaceCategory }
}

const DEFAULT_ORDER: PersonalDiscoveryCategory[] = ['coffee', 'food', 'activity', 'drinks']

const LABELS: Record<PersonalDiscoveryCategory, string> = {
  coffee: 'Coffee',
  food: 'Food',
  activity: 'Things to do',
  drinks: 'Drinks',
}

const SEARCH_TERMS: Record<PersonalDiscoveryCategory, string> = {
  coffee: 'coffee shops',
  food: 'restaurants',
  activity: 'things to do',
  drinks: 'bars',
}

/**
 * A local, disposable taste ordering—not a stored fingerprint. Loved is strong,
 * Want is weak, and Tried remains neutral visit history. Every category stays
 * available so existing taste can guide discovery without trapping the person.
 */
export function personalDiscoveryPrompts(saves: readonly PersonalDiscoverySave[]): PersonalDiscoveryPrompt[] {
  const evidence = new Map(DEFAULT_ORDER.map(category => [category, { loved: 0, want: 0 }]))
  for (const save of saves) {
    const category = save.memory?.category
    if (!category || !evidence.has(category as PersonalDiscoveryCategory)) continue
    const counts = evidence.get(category as PersonalDiscoveryCategory)!
    if (save.tag === 'loved') counts.loved += 1
    if (save.tag === 'want') counts.want += 1
  }

  const ranked = DEFAULT_ORDER.map((category, fallbackIndex) => {
    const counts = evidence.get(category)!
    const evidenceCount = counts.loved + counts.want
    const detail = counts.loved > 0
      ? `${counts.loved} Loved in your Keep`
      : counts.want > 0
        ? `${counts.want} Want${counts.want === 1 ? '' : 's'} in your Keep`
        : 'Try a different direction'
    return {
      category,
      label: LABELS[category],
      detail,
      evidenceCount,
      score: counts.loved * 3 + counts.want,
      fallbackIndex,
    }
  }).sort((a, b) => b.score - a.score || a.fallbackIndex - b.fallbackIndex)
  return ranked.map(item => ({
    category: item.category,
    label: item.label,
    detail: item.detail,
    evidenceCount: item.evidenceCount,
  }))
}

export function personalDiscoveryQuery(category: PersonalDiscoveryCategory, area: string): string | null {
  const normalizedArea = area.trim().replace(/\s+/g, ' ')
  if (normalizedArea.length < 2 || normalizedArea.length > 80) return null
  return `${SEARCH_TERMS[category]} in ${normalizedArea}`
}

/** Component-memory-only context for one deliberate follow-up search. */
export function personalDiscoveryContinuation(
  category: PersonalDiscoveryCategory | null,
  area: string,
): PersonalDiscoveryContinuation | null {
  if (!category || !personalDiscoveryQuery(category, area)) return null
  return { category, area: area.trim().replace(/\s+/g, ' ') }
}

/** A zero-API handoff for builds where in-app Places search is deliberately
 * disabled. Google Maps receives only the explicit category/area query; this.is
 * receives no result until the person shares or pastes one exact place back. */
export function personalDiscoveryMapsUrl(query: string): string | null {
  const normalizedQuery = query.trim().replace(/\s+/g, ' ')
  if (normalizedQuery.length < 2 || normalizedQuery.length > 120) return null
  const url = new URL('https://www.google.com/maps/search/')
  url.searchParams.set('api', '1')
  url.searchParams.set('query', normalizedQuery)
  return url.toString()
}
