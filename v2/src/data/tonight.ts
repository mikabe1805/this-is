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

/* Two proximity tiers: walkable city blocks, or the short suburban drive.
   Piscataway is car country — a walk-only gate would leave TONIGHT
   permanently empty there. Drive time is estimated from straight-line
   distance at ~36 km/h and always labeled with ≈. */
const MAX_WALK_MIN = 25
const MAX_DRIVE_MIN = 18
const DRIVE_FACTOR = 7.5 // walking minutes per driving minute (80 vs 600 m/min)

export type Mood = 'cozy-dinner' | 'drinks' | 'quick-bite' | 'something-new'

export const MOODS: { key: Mood; label: string; tags: string[] | null }[] = [
  { key: 'cozy-dinner', label: 'COZY DINNER', tags: ['dinner', 'cozy'] },
  { key: 'drinks', label: 'DRINKS', tags: ['drinks'] },
  { key: 'quick-bite', label: 'QUICK BITE', tags: ['quick-bite'] },
  { key: 'something-new', label: 'SOMETHING NEW', tags: null },
]

export type TonightCard = {
  pin: Pin
  /** Minutes in the given mode. */
  minutes: number
  mode: 'walk' | 'drive'
}

/** The vitals fragment: "8 MIN WALK" or "≈6 MIN DRIVE". */
export function proximityLabel(card: TonightCard): string {
  return card.mode === 'walk' ? `${card.minutes} MIN WALK` : `≈${card.minutes} MIN DRIVE`
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
    const walkMin = walkMinutesBetween(coords, lat, lng, coordsAt)
    if (walkMin === null) continue
    if (walkMin <= MAX_WALK_MIN) {
      cards.push({ pin, minutes: walkMin, mode: 'walk' })
    } else {
      const driveMin = Math.max(1, Math.round(walkMin / DRIVE_FACTOR))
      if (driveMin <= MAX_DRIVE_MIN) cards.push({ pin, minutes: driveMin, mode: 'drive' })
    }
  }
  // Walkable first, then closest within each tier; recency breaks ties.
  cards.sort(
    (a, b) =>
      (a.mode === 'walk' ? 0 : 1) - (b.mode === 'walk' ? 0 : 1) ||
      a.minutes - b.minutes ||
      b.pin.lastTouchedAt - a.pin.lastTouchedAt
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
