/**
 * The taste vector — computed client-side from what you keep, so ranking is
 * transparent and needs no server. (The blueprint's atomic-increment/decay
 * server trigger is a later optimization; the signal is identical — how often
 * you save each kind of place — just cheaper to derive here from pins already
 * in memory.)
 *
 * Onboarding-picked vibes seed the vector so the first feed is personalized
 * before you've saved anything. Been pins count double: acting on a save is a
 * stronger signal than wanting.
 */
import { vibesFor } from './vibes'
import type { FriendSave } from './social'

export type Taste = Record<string, number>

/** Your taste from your Want/Tried/Loved — Loved counts most, Want least,
 *  plus your onboarding-picked vibes so the scaffold is personalized early. */
export function tasteFromSaves(saves: FriendSave[], seed: string[] = []): Taste {
  const raw: Record<string, number> = {}
  for (const tag of seed) raw[tag] = (raw[tag] ?? 0) + 2 // explicit onboarding signal
  for (const s of saves) {
    const weight = s.tag === 'loved' ? 3 : s.tag === 'tried' ? 2 : 1
    for (const tag of vibesFor(s.place?.primaryType)) {
      raw[tag] = (raw[tag] ?? 0) + weight
    }
  }
  const max = Math.max(1, ...Object.values(raw))
  const out: Taste = {}
  for (const [tag, count] of Object.entries(raw)) out[tag] = count / max
  return out
}

/** The single strongest taste tag (drives "because you save …"), or null. */
export function topTasteTag(taste: Taste): string | null {
  let best: string | null = null
  let bestVal = 0
  for (const [tag, val] of Object.entries(taste)) {
    if (val > bestVal) {
      best = tag
      bestVal = val
    }
  }
  return best
}
