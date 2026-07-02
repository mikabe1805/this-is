/**
 * Google Places API (New) — the trimmed v2 surface.
 *
 * Ported from v1's placesNew.ts and cut down to exactly what v2 is allowed to
 * do: autocomplete (session-tokened), details-on-explicit-user-action, photo
 * URLs, and the Google Maps hand-off deep link. The self-serializing request
 * queue is gone (Google never required it); searchText/searchNearby are gone
 * (the feed reads Firestore, not Google).
 *
 * Cost + ToS rules encoded here:
 *  - Autocomplete always runs inside a session token; the matching getDetails
 *    call closes the session so Google bills it as one autocomplete session.
 *  - getDetails is ONLY called on explicit user action (tapping a suggestion,
 *    opening a closeup). Never in a render loop.
 *  - Photo resource names are never cached (ToS); photos render only where an
 *    explicit user action earned them (the closeup), always with attribution.
 *    photoUrl() is additionally gated by VITE_PLACES_PHOTOS_ENABLED; the W3
 *    feed adds a per-session photo budget counter on top.
 */

import { cachedCoords } from './geo'

const API = 'https://places.googleapis.com/v1'
const KEY = import.meta.env.VITE_PLACES_NEW_KEY as string
const PLACES_ON = import.meta.env.VITE_PLACES_ENABLED === 'true'
const PHOTOS_ON = import.meta.env.VITE_PLACES_PHOTOS_ENABLED === 'true'

/* Global-first: the app works in any city on earth. Language follows the
   device; results are biased toward (never restricted to) the user's cached
   coords, so the same query does the right thing in Piscataway or Tokyo. */
const LANG = (typeof navigator !== 'undefined' && navigator.language) || 'en'

/* THE MASK SPLIT (docs/GOOGLE.md, decision 2): displayName/primaryType are
   Pro-tier fields ($17/1K); id + photos.* are the FREE IDs-Only tier. So the
   full mask runs only where it must — saving (terminates the autocomplete
   session, refreshes the snapshot) and deep-links to unsaved places. Saved-pin
   closeups render name/type from the snapshot and fetch only photo refs. */
const DETAIL_FIELD_MASK =
  'id,displayName,formattedAddress,location,primaryType,photos.name,photos.authorAttributions'
const PHOTO_REF_FIELD_MASK = 'id,photos.name,photos.authorAttributions'

/** Honest absence: surfaces hide Google lanes entirely when the flag is off. */
export const placesEnabled = PLACES_ON

export type Suggestion = { placeId: string; text: string }

export type PlaceDetails = {
  id: string
  name: string
  address?: string
  lat?: number
  lng?: number
  primaryType?: string
  photoResourceName?: string
  photoAttribution?: string
}

function headers(fieldMask?: string): Headers {
  const h = new Headers({ 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY })
  if (fieldMask) h.set('X-Goog-FieldMask', fieldMask)
  return h
}

/** One token per typing session; pass the same token to getDetails to close it. */
export function newSessionToken(): string {
  return crypto.randomUUID()
}

export async function autocomplete(input: string, sessionToken: string): Promise<Suggestion[]> {
  if (!PLACES_ON || !input.trim()) return []
  const me = cachedCoords()
  const body: Record<string, unknown> = { input, sessionToken, languageCode: LANG }
  if (me) {
    body.locationBias = {
      circle: { center: { latitude: me.lat, longitude: me.lng }, radius: 20_000 },
    }
  }
  const res = await fetch(`${API}/places:autocomplete`, {
    method: 'POST',
    headers: headers('suggestions.placePrediction.placeId,suggestions.placePrediction.text'),
    body: JSON.stringify(body),
  })
  if (!res.ok) return []
  const json = await res.json()
  return (json.suggestions ?? [])
    .map((s: any) => ({
      placeId: s.placePrediction?.placeId,
      text: s.placePrediction?.text?.text,
    }))
    .filter((x: any): x is Suggestion => Boolean(x.placeId && x.text))
}

export async function getDetails(
  placeId: string,
  sessionToken?: string
): Promise<PlaceDetails | null> {
  if (!PLACES_ON) return null
  const url = new URL(`${API}/places/${placeId}`)
  url.searchParams.set('languageCode', LANG)
  if (sessionToken) url.searchParams.set('sessionToken', sessionToken)
  const res = await fetch(url, { headers: headers(DETAIL_FIELD_MASK) })
  if (!res.ok) return null
  const p = await res.json()
  const photo = p.photos?.[0]
  return {
    id: p.id,
    name: p.displayName?.text ?? '',
    address: p.formattedAddress,
    lat: p.location?.latitude,
    lng: p.location?.longitude,
    primaryType: p.primaryType,
    photoResourceName: photo?.name,
    photoAttribution: photo?.authorAttributions?.[0]?.displayName,
  }
}

/** Photo refs only — bills in the FREE IDs-Only tier. For saved pins, whose
 *  name/type/coords already live in the snapshot. */
export async function getPhotoRef(
  placeId: string
): Promise<Pick<PlaceDetails, 'photoResourceName' | 'photoAttribution'> | null> {
  if (!PLACES_ON) return null
  const url = new URL(`${API}/places/${placeId}`)
  url.searchParams.set('languageCode', LANG)
  const res = await fetch(url, { headers: headers(PHOTO_REF_FIELD_MASK) })
  if (!res.ok) return null
  const p = await res.json()
  const photo = p.photos?.[0]
  return {
    photoResourceName: photo?.name,
    photoAttribution: photo?.authorAttributions?.[0]?.displayName,
  }
}

export function photoUrl(resourceName: string, px = 640): string {
  if (!PHOTOS_ON) return ''
  const u = new URL(`https://places.googleapis.com/v1/${resourceName}/media`)
  u.searchParams.set('maxWidthPx', String(px))
  u.searchParams.set('key', KEY)
  return u.toString()
}

/** The one outbound door: we curate, Google navigates. */
export function mapsDeepLink(name: string, googlePlaceId: string): string {
  const u = new URL('https://www.google.com/maps/search/')
  u.searchParams.set('api', '1')
  u.searchParams.set('query', name)
  u.searchParams.set('query_place_id', googlePlaceId)
  return u.toString()
}
