/**
 * The photo-media budget. Photo bytes are the one genuinely expensive Google
 * SKU ($7/1K, 1K free/mo — docs/GOOGLE.md) and may never be cached, so the
 * discovery grid fetches them live under a hard budget.
 *
 * The window is a calendar DAY, not a tab session — a per-session cap made
 * the second Home visit of the day render photo-less (the "it looks bad"
 * bug). Grants are persisted per place id for the day, so the same places
 * keep their photos across reloads (and the browser's HTTP cache serves the
 * repeat media bytes without re-billing). 25/day ≈ 750/mo worst case, inside
 * the 1,000 free allowance with margin.
 */
const KEY = 'this-is:v2:photo-day'
const MAX_PER_DAY = 25

type DayState = { d: string; ids: string[] }

function today(): string {
  const n = new Date()
  return `${n.getFullYear()}-${n.getMonth() + 1}-${n.getDate()}`
}

function read(): DayState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw) as DayState
      if (s.d === today() && Array.isArray(s.ids)) return s
    }
  } catch {
    /* ignore */
  }
  return { d: today(), ids: [] }
}

export function takePhotoSlot(placeId: string): boolean {
  const s = read()
  if (s.ids.includes(placeId)) return true // already granted today
  if (s.ids.length >= MAX_PER_DAY) return false
  s.ids.push(placeId)
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
  return true
}
