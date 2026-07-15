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
 *  - Autocomplete capture closes with an Essentials-only Details request.
 *    Google's current pricing bills a Pro-or-higher terminating request as
 *    Enterprise + Atmosphere regardless of the requested Pro field.
 *  - getDetails is ONLY called on explicit user action (tapping a suggestion,
 *    opening a closeup). Never in a render loop.
 *  - Photo resource names are never cached (ToS); photos render only where an
 *    explicit user action earned them (the closeup), always with attribution.
 *  - Photo media never uses the browser key. Canonical saved/group imagery is
 *    streamed by the authenticated server proxy under one project allowance.
 */

import {
  isGooglePlaceIdSupportedForStorage,
  normalizeCapturePlaceDetails,
  normalizeGoogleAutocompleteSuggestions,
  normalizePlaceDetails,
  type GooglePlaceSuggestion,
  type NormalizedGooglePlaceDetails,
} from '../domain/googlePlaceDetails'

const GOOGLE_API = 'https://places.googleapis.com/v1'
const KEY = import.meta.env.VITE_PLACES_NEW_KEY as string
// Emulator-backed production builds must never spend Places quota or turn
// invented verification IDs into Google network errors. The explicit stub
// flag sends requests only to the current preview origin, where the browser
// verifier owns the response; an absent verifier therefore fails as a local
// 404 instead of ever reaching Google.
const EMULATOR_BUILD = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'
const EMULATOR_PLACES_STUB = EMULATOR_BUILD
  && import.meta.env.VITE_EMULATOR_PLACES_STUB === 'true'
const API = EMULATOR_PLACES_STUB
  ? '/__this_is_emulator_places/v1'
  : GOOGLE_API
const PLACES_ON = EMULATOR_PLACES_STUB
  || (!EMULATOR_BUILD && import.meta.env.VITE_PLACES_ENABLED === 'true')

/* Global-first: the app works in any city on earth. Language follows the
   device; geography comes only from what the person explicitly types. */
const LANG = (typeof navigator !== 'undefined' && navigator.language) || 'en'

/* THE MASK SPLIT (docs/GOOGLE.md): the autocomplete-terminating request stays
   Essentials-only. Explicit non-session Details may request Pro fields.
   Saved-pin closeups render owned/cached context and fetch only photo refs. */
const CAPTURE_FIELD_MASK = 'id,formattedAddress,location,types'
const DETAIL_FIELD_MASK = 'id,displayName,formattedAddress,location,primaryType'

/** Honest absence: surfaces hide Google lanes entirely when the flag is off. */
export const placesEnabled = PLACES_ON

export type Suggestion = GooglePlaceSuggestion

export type PlaceDetails = NormalizedGooglePlaceDetails

function headers(fieldMask?: string): Headers {
  const h = new Headers({ 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY })
  if (fieldMask) h.set('X-Goog-FieldMask', fieldMask)
  return h
}

function apiUrl(path: string): URL {
  return new URL(`${API}${path}`, window.location.origin)
}

/** One token per typing session; pass the same token to getDetails to close it. */
export function newSessionToken(): string {
  return crypto.randomUUID()
}

export async function autocomplete(input: string, sessionToken: string): Promise<Suggestion[]> {
  if (!PLACES_ON || !input.trim()) return []
  const body: Record<string, unknown> = { input, sessionToken, languageCode: LANG }
  try {
    const res = await fetch(apiUrl('/places:autocomplete'), {
      method: 'POST',
      headers: headers(
        'suggestions.placePrediction.placeId,suggestions.placePrediction.text,' +
        'suggestions.placePrediction.structuredFormat.mainText'
      ),
      body: JSON.stringify(body),
    })
    if (!res.ok) return []
    return normalizeGoogleAutocompleteSuggestions(await res.json())
  } catch {
    return []
  }
}

/** Close an Autocomplete session without promoting it to the E+A discovery
 * SKU. The selected suggestion supplies the user-visible label; the response
 * supplies only Essentials location/address/type data. Persisting Google place
 * facts remains blocked from external use pending the owned-catalog redesign. */
export async function getCaptureDetails(
  placeId: string,
  sessionToken: string,
  selectedName: string
): Promise<PlaceDetails | null> {
  if (!PLACES_ON || !isGooglePlaceIdSupportedForStorage(placeId)) return null
  const url = apiUrl(`/places/${placeId}`)
  url.searchParams.set('languageCode', LANG)
  url.searchParams.set('sessionToken', sessionToken)
  try {
    const res = await fetch(url, { headers: headers(CAPTURE_FIELD_MASK) })
    if (!res.ok) return null
    return normalizeCapturePlaceDetails(await res.json(), placeId, selectedName)
  } catch {
    return null
  }
}

export async function getDetails(
  placeId: string,
  sessionToken?: string
): Promise<PlaceDetails | null> {
  if (!PLACES_ON || !isGooglePlaceIdSupportedForStorage(placeId)) return null
  const url = apiUrl(`/places/${placeId}`)
  url.searchParams.set('languageCode', LANG)
  if (sessionToken) url.searchParams.set('sessionToken', sessionToken)
  try {
    const res = await fetch(url, { headers: headers(DETAIL_FIELD_MASK) })
    if (!res.ok) return null
    return normalizePlaceDetails(await res.json(), placeId)
  } catch {
    return null
  }
}

/** The one outbound door: we curate, Google navigates. */
export function mapsDeepLink(name: string, googlePlaceId: string): string {
  const u = new URL('https://www.google.com/maps/search/')
  u.searchParams.set('api', '1')
  u.searchParams.set('query', name)
  u.searchParams.set('query_place_id', googlePlaceId)
  return u.toString()
}
