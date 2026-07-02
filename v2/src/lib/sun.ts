/**
 * Civil dusk, computed from the user's real coordinates — the honest source
 * for the TONIGHT eyebrow ("TONIGHT · WED · DUSK 21:42"). Pure: no clock, no
 * storage; caller passes `now`. Returns null when there is no civil dusk that
 * day (polar latitudes) so the eyebrow degrades to date-only.
 *
 * Standard sunrise-equation solve for the sun at −6° (civil twilight),
 * evening branch. Accurate to ~1 minute for populated latitudes — more than
 * enough for a mood-setting timestamp.
 */

// Ported from SunCalc (Vladimir Agafonkin, BSD-2) — the standard, well-tested
// solar-position solve — specialised to the evening civil-twilight branch.
const RAD = Math.PI / 180
const DAY_MS = 86_400_000
const J1970 = 2440588
const J2000 = 2451545
const OBLIQUITY = RAD * 23.4397
const J0 = 0.0009
const H_CIVIL = -6 * RAD // sun 6° below the horizon

function toDays(date: Date): number {
  return date.valueOf() / DAY_MS - 0.5 + J1970 - J2000
}

function solarMeanAnomaly(d: number): number {
  return RAD * (357.5291 + 0.98560028 * d)
}

function eclipticLongitude(m: number): number {
  const c = RAD * (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m))
  return m + c + RAD * 102.9372 + Math.PI
}

function fromJulian(j: number): Date {
  return new Date((j + 0.5 - J1970) * DAY_MS)
}

/**
 * The moment of civil dusk (sun 6° below the horizon, descending) for the
 * given coordinates on the calendar day containing `now`, as a Date, or null
 * when the sun never reaches −6° that day (polar latitudes).
 */
export function civilDusk(lat: number, lng: number, now: Date): Date | null {
  const lw = RAD * -lng
  const phi = RAD * lat
  const d = toDays(now)
  const n = Math.round(d - J0 - lw / (2 * Math.PI))
  const ds = J0 + (0 + lw) / (2 * Math.PI) + n
  const m = solarMeanAnomaly(ds)
  const l = eclipticLongitude(m)
  const dec = Math.asin(Math.sin(OBLIQUITY) * Math.sin(l))

  const cosH =
    (Math.sin(H_CIVIL) - Math.sin(phi) * Math.sin(dec)) /
    (Math.cos(phi) * Math.cos(dec))
  if (cosH < -1 || cosH > 1) return null

  const w = Math.acos(cosH)
  const a = J0 + (w + lw) / (2 * Math.PI) + n
  const jSet = J2000 + a + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * l)
  const date = fromJulian(jSet)
  return Number.isFinite(date.getTime()) ? date : null
}

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

/**
 * The TONIGHT eyebrow text. With coords: "TONIGHT · WED · DUSK 21:42".
 * Without coords, or at polar latitudes: "TONIGHT · WED" — never a fake time.
 */
export function tonightEyebrow(
  coords: { lat: number; lng: number } | null,
  now: Date
): string {
  const day = DAYS[now.getDay()]
  if (!coords) return `TONIGHT · ${day}`
  const dusk = civilDusk(coords.lat, coords.lng, now)
  if (!dusk) return `TONIGHT · ${day}`
  const hh = String(dusk.getHours()).padStart(2, '0')
  const mm = String(dusk.getMinutes()).padStart(2, '0')
  return `TONIGHT · ${day} · DUSK ${hh}:${mm}`
}
