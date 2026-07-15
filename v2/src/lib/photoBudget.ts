/**
 * The photo-media budget. Photo bytes are the one genuinely expensive Google
 * SKU ($7/1K, 1K free/mo — docs/GOOGLE.md) and may never be cached, so the
 * final-three group cards and explicit saved-place closeups fetch them live
 * under a hard server-owned project budget.
 *
 * This is a calendar-day, per-device DOGFOOD guard. It is not a project-wide
 * budget: multiplying a local allowance by many devices can exceed Google's
 * monthly free cap, and browser caching is not a billing guarantee. Public
 * group use requires the server-owned project allowance specified in
 * docs/product-reset/GROUP_DIRECTION.md. The local grant merely prevents one
 * client from creating a render loop while preserving enough media for two
 * three-candidate decisions per day.
 */
const KEY = 'this-is:v2:photo-day'
const MAX_PER_DAY = 6

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
