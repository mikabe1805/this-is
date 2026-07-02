/**
 * The photo-media budget. Photo bytes are the one genuinely expensive Google
 * SKU ($7/1K, 1K free/mo — docs/GOOGLE.md) and may never be cached, so the
 * discovery grid fetches them live under a hard per-session cap. At 8/session
 * a heavy dogfooder stays around ~250 media requests a month — inside the
 * free allowance with margin.
 *
 * Grants are idempotent per place id (module-level memo): StrictMode's
 * double-mounted effects and re-renders re-ask for the same place and get the
 * same answer instead of draining the budget.
 */
const KEY = 'this-is:v2:photo-slots'
const MAX_PER_SESSION = 8

const granted = new Map<string, boolean>()

export function takePhotoSlot(placeId: string): boolean {
  const prior = granted.get(placeId)
  if (prior !== undefined) return prior
  let ok = false
  try {
    const used = Number(sessionStorage.getItem(KEY) ?? '0')
    ok = used < MAX_PER_SESSION
    if (ok) sessionStorage.setItem(KEY, String(used + 1))
  } catch {
    ok = false
  }
  granted.set(placeId, ok)
  return ok
}
