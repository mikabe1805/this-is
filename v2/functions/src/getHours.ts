/**
 * getHours — the ONLY source of open/closed truth for the TONIGHT rail.
 *
 * READY TO DEPLOY, NOT YET LIVE. Until this is deployed AND the client flag
 * VITE_HOURS_ENABLED=true is set, the app makes no hours call and shows no
 * open-now claim (honest absence). See ../../src/lib/hours.ts.
 *
 * Contract:
 *  - Callable, auth required. Input { placeIds: string[] } (`g:{pid}`, ≤10).
 *  - For each place: serve a fresh (<24h) `places/{id}.hoursCache` if present;
 *    otherwise fetch Google Places `currentOpeningHours` server-side (with the
 *    IP-restricted GOOGLE_PLACES_NEW_KEY — never the client key) and write the
 *    cache back. This is the ONLY server caller of Places hours.
 *  - Returns { [id]: { openNow, closesAt?, likely? } }. Places we couldn't
 *    resolve are simply omitted — the client treats "missing" as "unknown",
 *    never as "closed".
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { initializeApp, getApps } from 'firebase-admin/app'

if (getApps().length === 0) initializeApp()
const db = getFirestore()

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const FIELD_MASK = 'currentOpeningHours.openNow,currentOpeningHours.periods'

type HoursInfo = { openNow: boolean; closesAt?: string; likely?: boolean }

/** Today's close "HH:MM" from Places periods, if a same-day close exists. */
function closesAtFrom(current: any): { closesAt?: string; likely: boolean } {
  const periods = current?.periods
  if (!Array.isArray(periods)) return { likely: true }
  const dow = new Date().getDay()
  for (const p of periods) {
    if (p?.open?.day === dow && p?.close?.hour != null) {
      const hh = String(p.close.hour).padStart(2, '0')
      const mm = String(p.close.minute ?? 0).padStart(2, '0')
      return { closesAt: `${hh}:${mm}`, likely: false }
    }
  }
  return { likely: true }
}

async function fetchHours(rawPid: string): Promise<HoursInfo | null> {
  const key = process.env.GOOGLE_PLACES_NEW_KEY
  if (!key) throw new HttpsError('failed-precondition', 'Server Places key not configured')
  const res = await fetch(`https://places.googleapis.com/v1/places/${rawPid}`, {
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELD_MASK },
  })
  if (!res.ok) return null
  const p = (await res.json()) as any
  const current = p.currentOpeningHours
  if (current?.openNow == null) return null
  const { closesAt, likely } = closesAtFrom(current)
  return { openNow: Boolean(current.openNow), ...(closesAt ? { closesAt } : {}), ...(likely ? { likely: true } : {}) }
}

export const getHours = onCall(
  { region: 'us-central1', secrets: ['GOOGLE_PLACES_NEW_KEY'] },
  async request => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
    const placeIds: string[] = Array.isArray(request.data?.placeIds)
      ? request.data.placeIds.slice(0, 10)
      : []
    const now = Date.now()
    const out: Record<string, HoursInfo> = {}

    await Promise.all(
      placeIds.map(async id => {
        const ref = db.collection('places').doc(id)
        const snap = await ref.get()
        const cache = snap.get('hoursCache') as
          | { at: number; info: HoursInfo }
          | undefined
        if (cache && now - cache.at < CACHE_TTL_MS) {
          out[id] = cache.info
          return
        }
        const rawPid = id.startsWith('g:') ? id.slice(2) : id
        const info = await fetchHours(rawPid).catch(() => null)
        if (!info) return
        out[id] = info
        await ref.set(
          { hoursCache: { at: now, info }, hoursFetchedAt: FieldValue.serverTimestamp() },
          { merge: true }
        )
      })
    )

    return out
  }
)
