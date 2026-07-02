/**
 * The feed's honesty contract. Transparent, deterministic, client-scored:
 *
 *   score = taste·Wt + proximity·Wp + freshness·Wf + dormant·Wd − diversity·Wx
 *
 * Weights live in ONE exported const, tunable in a lunch break. Every ranked
 * card carries its TOP-scoring factor as a ≤6-word reason line — if the reason
 * can't be stated in six words, we don't ship the card without one. Pure over
 * its inputs so the whole thing is unit-testable headless.
 *
 * TONIGHT (data/tonight.ts) is the proximity-cranked, hard-gated instance of
 * the same idea; this is the general Home feed scorer.
 */
import { vibesFor, typeLabel } from './vibes'
import { walkMinutesBetween, type Coords } from '../lib/geo'
import type { Pin } from './types'
import type { Taste } from './taste'

export const FEED_WEIGHTS = {
  taste: 3,
  proximity: 4,
  freshness: 1,
  dormant: 1,
  diversity: 1,
} as const

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_MS = 24 * 60 * 60 * 1000
const DORMANT_MS = 60 * DAY_MS

export type Factor = 'taste' | 'proximity' | 'freshness' | 'dormant'

export interface ScoredPin {
  pin: Pin
  score: number
  factor: Factor
  /** The italic six-word line the card must print. */
  reason: string
}

/** "wine_bar" → "wine bars" for the taste reason line. */
function categoryPlural(primaryType?: string): string {
  const label = typeLabel(primaryType)
  if (!label) return 'places like this'
  const lower = label.toLowerCase()
  return lower.endsWith('s') ? lower : `${lower}s`
}

export function rankPins(
  pins: Pin[],
  taste: Taste,
  coords: Coords | null,
  now = Date.now()
): ScoredPin[] {
  const catCount: Record<string, number> = {}
  for (const p of pins) {
    const c = p.snapshot.primaryType ?? '_'
    catCount[c] = (catCount[c] ?? 0) + 1
  }
  const total = Math.max(1, pins.length)

  const scored = pins.map<ScoredPin>(pin => {
    const tags = vibesFor(pin.snapshot.primaryType)

    // taste: strongest matching tag weight
    let tasteScore = 0
    for (const t of tags) tasteScore = Math.max(tasteScore, taste[t] ?? 0)

    // proximity: closer = higher, 0 when unknown (honest absence)
    const walk = coords
      ? walkMinutesBetween(coords, pin.snapshot.lat, pin.snapshot.lng, pin.snapshot.coordsAt)
      : null
    const proximity = walk === null ? 0 : 1 - Math.min(walk, 60) / 60

    // freshness: recency of the save, decaying over ~30 days
    const ageDays = (now - pin.savedAt) / DAY_MS
    const freshness = Math.max(0, 1 - ageDays / 30)

    // dormant: an untouched Want pin earns a resurface bump
    const dormant =
      pin.status === 'want' && now - pin.lastTouchedAt > DORMANT_MS ? 1 : 0

    // diversity: common categories are gently demoted so rarer saves surface
    const cat = pin.snapshot.primaryType ?? '_'
    const diversity = (catCount[cat] - 1) / total

    const contrib: Record<Factor, number> = {
      taste: tasteScore * FEED_WEIGHTS.taste,
      proximity: proximity * FEED_WEIGHTS.proximity,
      freshness: freshness * FEED_WEIGHTS.freshness,
      dormant: dormant * FEED_WEIGHTS.dormant,
    }
    const score =
      contrib.taste +
      contrib.proximity +
      contrib.freshness +
      contrib.dormant -
      diversity * FEED_WEIGHTS.diversity

    // Top positive factor drives the reason; freshness is the honest fallback.
    const ranked = (Object.entries(contrib) as [Factor, number][])
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
    const factor: Factor = ranked[0]?.[0] ?? 'freshness'

    const month = MONTHS[new Date(pin.savedAt).getMonth()]
    let reason: string
    switch (factor) {
      case 'taste':
        reason = `because you save ${categoryPlural(pin.snapshot.primaryType)}`
        break
      case 'proximity':
        reason = walk !== null && walk < 1 ? 'right around the corner' : `${walk} min away`
        break
      case 'dormant':
        reason = `you saved this in ${month}`
        break
      default:
        reason = ageDays < 2 ? 'just saved' : `saved back in ${month}`
    }

    return { pin, score, factor, reason }
  })

  scored.sort((a, b) => b.score - a.score || b.pin.lastTouchedAt - a.pin.lastTouchedAt)
  return scored
}
