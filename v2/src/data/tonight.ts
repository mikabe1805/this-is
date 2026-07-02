/**
 * TONIGHT candidate selection — the evening hang.
 *
 * Reuses the feed's honesty contract with hard gates and proximity cranked:
 * only your own WANT pins, never released, must have honest coords, must be
 * within a walkable radius. Open/closed gating happens later in the rail once
 * the hours seam resolves (a known-closed place is dropped; unknown stays,
 * with no open claim). Pure over its inputs so it can be tested headless.
 */
import { walkMinutesBetween, type Coords } from '../lib/geo'
import { vibesFor } from './vibes'
import type { Pin } from './types'

// TONIGHT is the proximity-cranked, hard-gated instance of the shared feed
// scorer; the weights live canonically with the Home feed.
export { FEED_WEIGHTS } from './ranking'

const MAX_WALK_MIN = 25

export type Mood = 'cozy-dinner' | 'drinks' | 'quick-bite' | 'something-new'

export const MOODS: { key: Mood; label: string; tags: string[] | null }[] = [
  { key: 'cozy-dinner', label: 'COZY DINNER', tags: ['dinner', 'cozy'] },
  { key: 'drinks', label: 'DRINKS', tags: ['drinks'] },
  { key: 'quick-bite', label: 'QUICK BITE', tags: ['quick-bite'] },
  { key: 'something-new', label: 'SOMETHING NEW', tags: null },
]

export type TonightCard = {
  pin: Pin
  walkMin: number
}

/**
 * The ranked TONIGHT list from your saves. Empty when there are no cached
 * coords (proximity is the whole point — no coords, no rail: honest absence)
 * or nothing walkable qualifies. Capped so the hours callable stays ≤10/session.
 */
export function tonightCandidates(pins: Pin[], coords: Coords | null): TonightCard[] {
  if (!coords) return []
  const cards: TonightCard[] = []
  for (const pin of pins) {
    if (pin.status !== 'want') continue
    const { lat, lng, coordsAt } = pin.snapshot
    const mins = walkMinutesBetween(coords, lat, lng, coordsAt)
    if (mins === null || mins > MAX_WALK_MIN) continue
    cards.push({ pin, walkMin: mins })
  }
  // Proximity-cranked, freshness as the tie-break: closest first, then the
  // pin you touched most recently.
  cards.sort(
    (a, b) => a.walkMin - b.walkMin || b.pin.lastTouchedAt - a.pin.lastTouchedAt
  )
  return cards.slice(0, 10)
}

/** Filter a TONIGHT list by a mood chip. `something-new` is the pass-through. */
export function filterByMood(cards: TonightCard[], mood: Mood | null): TonightCard[] {
  if (!mood) return cards
  const spec = MOODS.find(m => m.key === mood)
  if (!spec || !spec.tags) return cards
  return cards.filter(c => {
    const tags = vibesFor(c.pin.snapshot.primaryType)
    return spec.tags!.some(t => tags.includes(t))
  })
}
