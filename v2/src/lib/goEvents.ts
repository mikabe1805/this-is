/**
 * GO events — the bridge between "leaving for a place" and "did you make it?".
 * When the user taps a GO / Open-in-Maps hand-off, we remember it locally so
 * the morning-after card can appear the NEXT time the app opens.
 *
 * Deliberately localStorage, not Firestore: a hand-off is device-local intent,
 * it must survive the app being backgrounded for the Maps trip, and it is
 * worthless to sync. The pure `selectMorningAfter` core takes its inputs so it
 * can be tested without a browser.
 */
import type { Pin } from '../data/types'

export type GoEvent = { placeId: string; name: string; at: number }

const GO_KEY = 'this-is:v2:go'
const DISMISS_KEY = 'this-is:v2:go-dismissed'

/** A GO qualifies for the morning-after once it's "later" — a few hours on,
 *  or a new calendar day — and while it's still recent enough to matter. */
const RIPEN_MS = 3 * 60 * 60 * 1000
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function readGo(): GoEvent[] {
  try {
    const raw = localStorage.getItem(GO_KEY)
    return raw ? (JSON.parse(raw) as GoEvent[]) : []
  } catch {
    return []
  }
}

function writeGo(events: GoEvent[]): void {
  try {
    localStorage.setItem(GO_KEY, JSON.stringify(events.slice(-40)))
  } catch {
    /* ignore */
  }
}

function readDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

/** Record a hand-off. One row per place — a fresh GO replaces the stale one. */
export function recordGo(placeId: string, name: string, at = Date.now()): void {
  const events = readGo().filter(e => e.placeId !== placeId)
  events.push({ placeId, name, at })
  writeGo(events)
  // A new GO re-arms the morning-after even if the place was dismissed before.
  try {
    const dismissed = readDismissed()
    if (dismissed.delete(placeId)) {
      localStorage.setItem(DISMISS_KEY, JSON.stringify([...dismissed]))
    }
  } catch {
    /* ignore */
  }
}

/** Stop asking about this place ("Didn't go", or after "Hang it"). */
export function dismissGo(placeId: string): void {
  try {
    const dismissed = readDismissed()
    dismissed.add(placeId)
    localStorage.setItem(DISMISS_KEY, JSON.stringify([...dismissed]))
  } catch {
    /* ignore */
  }
}

/**
 * Pure selection: the single ripe, undismissed GO whose place is still a saved
 * WANT pin (you can only "hang" something you've kept and haven't marked been).
 * Returns the most recent qualifying event, or null.
 */
export function selectMorningAfter(
  events: GoEvent[],
  dismissed: Set<string>,
  pins: Pin[],
  now: number
): GoEvent | null {
  const wantIds = new Set(pins.filter(p => p.status === 'want').map(p => p.id))
  const ripe = events
    .filter(e => !dismissed.has(e.placeId))
    .filter(e => wantIds.has(e.placeId))
    .filter(e => {
      const age = now - e.at
      if (age > MAX_AGE_MS || age < 0) return false
      const laterDay = new Date(e.at).toDateString() !== new Date(now).toDateString()
      return age >= RIPEN_MS || laterDay
    })
    .sort((a, b) => b.at - a.at)
  return ripe[0] ?? null
}

/** The browser-side wrapper: reads storage, then defers to the pure core. */
export function pendingMorningAfter(pins: Pin[], now = Date.now()): GoEvent | null {
  return selectMorningAfter(readGo(), readDismissed(), pins, now)
}
