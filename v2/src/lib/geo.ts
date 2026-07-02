/**
 * Location without the wait.
 *
 * v1 awaited fresh geolocation (up to a 4s timeout) before painting anything.
 * v2 law: render immediately from the cached last-known coordinates and
 * refresh in the background. If there's no cache, walk-time chips are simply
 * hidden — honest absence beats a spinner.
 */

const COORDS_KEY = 'this-is:v2:coords'
/** Cached user coords older than this are treated as absent. */
const MAX_COORDS_AGE_MS = 24 * 60 * 60 * 1000
/** Average urban walking pace. */
const WALK_METERS_PER_MIN = 80

export type Coords = { lat: number; lng: number; at: number }

export function cachedCoords(): Coords | null {
  try {
    const raw = localStorage.getItem(COORDS_KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as Coords
    if (typeof c.lat !== 'number' || typeof c.lng !== 'number') return null
    if (Date.now() - c.at > MAX_COORDS_AGE_MS) return null
    return c
  } catch {
    return null
  }
}

let refreshing = false

/** Fire-and-forget background refresh; never blocks a render. */
export function refreshCoords(): void {
  if (refreshing || typeof navigator === 'undefined' || !navigator.geolocation) return
  refreshing = true
  navigator.geolocation.getCurrentPosition(
    pos => {
      refreshing = false
      const c: Coords = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        at: Date.now(),
      }
      try { localStorage.setItem(COORDS_KEY, JSON.stringify(c)) } catch { /* ignore */ }
    },
    () => { refreshing = false },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
  )
}

function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371e3
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/**
 * Walking minutes between an explicit origin and a place — the pure numeric
 * core, honest-absence-aware (place coords missing, or fetched more than 30
 * days ago → null). Callers that hold coords (ranking, TONIGHT) use this
 * directly; the localStorage convenience wrapper is below.
 */
export function walkMinutesBetween(
  me: Coords,
  placeLat?: number,
  placeLng?: number,
  coordsFetchedAt?: number
): number | null {
  if (typeof placeLat !== 'number' || typeof placeLng !== 'number') return null
  if (coordsFetchedAt && Date.now() - coordsFetchedAt > 30 * 24 * 60 * 60 * 1000) return null
  return Math.round(haversineMeters(me.lat, me.lng, placeLat, placeLng) / WALK_METERS_PER_MIN)
}

/** Walking minutes from the cached user location, or null on honest absence. */
export function walkMinutes(
  placeLat?: number,
  placeLng?: number,
  coordsFetchedAt?: number
): number | null {
  const me = cachedCoords()
  if (!me) return null
  return walkMinutesBetween(me, placeLat, placeLng, coordsFetchedAt)
}

/** The mono walk-time chip text ("8 MIN WALK"), or null on honest absence. */
export function walkChip(
  placeLat?: number,
  placeLng?: number,
  coordsFetchedAt?: number
): string | null {
  const mins = walkMinutes(placeLat, placeLng, coordsFetchedAt)
  if (mins === null) return null
  if (mins < 1) return 'RIGHT HERE'
  if (mins > 90) return null
  return `${mins} MIN WALK`
}
