/**
 * The hours seam — the ONLY way TONIGHT learns whether a place is open.
 *
 * Ruling condition from the blueprint: hours come only from a 24h-cached
 * Cloud callable (≤10 candidates per session), and **if the callable isn't
 * live, the app ships with no open-now claim at all** — honest absence beats a
 * placebo. So this module defaults OFF (VITE_HOURS_ENABLED !== 'true'): it
 * makes zero network calls and returns {}, and the TONIGHT rail simply omits
 * the open/closed line. The getHours Cloud Function (functions/src/getHours.ts)
 * lights this up once deployed and the flag is flipped.
 *
 * firebase/functions is imported dynamically so it never enters the graph when
 * the feature is off.
 */

const HOURS_ON = import.meta.env.VITE_HOURS_ENABLED === 'true'

export const hoursEnabled = HOURS_ON

export type HoursInfo = {
  /** Verified open right now. Absence ≠ closed; it means "unknown". */
  openNow: boolean
  /** Local "HH:MM" the place closes today, when the callable could derive it. */
  closesAt?: string
  /** True when Google gave hours but not a same-day close → "LIKELY OPEN". */
  likely?: boolean
}

/** Map of `g:{pid}` → hours. Missing keys mean "unknown", never "closed". */
export type HoursMap = Record<string, HoursInfo>

export async function getHours(placeIds: string[]): Promise<HoursMap> {
  if (!HOURS_ON || placeIds.length === 0) return {}
  try {
    const [{ getFunctions, httpsCallable }, { default: app }] = await Promise.all([
      import('firebase/functions'),
      import('./firebaseImpl'),
    ])
    const call = httpsCallable<{ placeIds: string[] }, HoursMap>(
      getFunctions(app),
      'getHours'
    )
    const res = await call({ placeIds: placeIds.slice(0, 10) })
    return res.data ?? {}
  } catch {
    // Any failure degrades to honest silence — never a fabricated claim.
    return {}
  }
}

/** The vitals line for a card, or null when there's nothing honest to say. */
export function openLabel(info: HoursInfo | undefined): string | null {
  if (!info) return null
  if (info.openNow && info.closesAt) return `OPEN TILL ${info.closesAt}`
  if (info.openNow) return 'OPEN NOW'
  if (info.likely) return 'LIKELY OPEN'
  return null
}
