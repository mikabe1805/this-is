export interface NormalizedGooglePlaceDetails {
  id: string
  name: string
  address?: string
  lat?: number
  lng?: number
  primaryType?: string
}

/** This is this.is's current safe Firestore document/path contract, not a
 * claim about provider validity. Google Place IDs have no documented maximum
 * length, so autocomplete must retain nonempty IDs that fall outside it and
 * present them as unsupported instead of silently dropping the result. */
export function isGooglePlaceIdSupportedForStorage(value: unknown): boolean {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{10,255}$/.test(value)
}

interface GooglePlaceSuggestionBase {
  text: string
  name: string
}

export interface SupportedGooglePlaceSuggestion extends GooglePlaceSuggestionBase {
  support: 'supported'
  placeId: string
}

export interface UnsupportedGooglePlaceSuggestion extends GooglePlaceSuggestionBase {
  support: 'unsupported'
  reason: 'storage-contract'
}

export type GooglePlaceSuggestion =
  | SupportedGooglePlaceSuggestion
  | UnsupportedGooglePlaceSuggestion

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function boundedText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text || text.length > maxLength || [...text].some(character => {
    const code = character.charCodeAt(0)
    return code <= 31 || code === 127
  })) return null
  return text
}

/** Parse only renderable autocomplete predictions. A prediction with a
 * nonempty provider ID is always represented: IDs outside the app's current
 * storage contract become an explicit unsupported suggestion rather than
 * disappearing from search. The raw unsupported ID itself is discarded so an
 * unbounded provider string does not enter React state. */
export function normalizeGoogleAutocompleteSuggestions(value: unknown): GooglePlaceSuggestion[] {
  const data = record(value)
  if (!data || !Array.isArray(data.suggestions)) return []
  return data.suggestions.flatMap<GooglePlaceSuggestion>(rawSuggestion => {
    const suggestion = record(rawSuggestion)
    const prediction = record(suggestion?.placePrediction)
    const providerPlaceId = typeof prediction?.placeId === 'string'
      && prediction.placeId.trim()
      ? prediction.placeId
      : null
    const text = boundedText(record(prediction?.text)?.text, 500)
    const structured = record(prediction?.structuredFormat)
    const mainText = boundedText(record(structured?.mainText)?.text, 200)
    const name = mainText ?? boundedText(text, 200)
    if (!providerPlaceId || !text || !name) return []
    if (isGooglePlaceIdSupportedForStorage(providerPlaceId)) {
      return [{ support: 'supported' as const, placeId: providerPlaceId, text, name }]
    }
    return [{ support: 'unsupported' as const, reason: 'storage-contract', text, name }]
  })
}

function optionalText(
  data: Record<string, unknown>,
  key: string,
  maxLength: number,
): { valid: boolean; value?: string } {
  if (!(key in data)) return { valid: true }
  const value = boundedText(data[key], maxLength)
  return value ? { valid: true, value } : { valid: false }
}

function optionalLocation(data: Record<string, unknown>): {
  valid: boolean
  lat?: number
  lng?: number
} {
  if (!('location' in data)) return { valid: true }
  const location = record(data.location)
  const lat = location?.latitude
  const lng = location?.longitude
  if (
    !location || typeof lat !== 'number' || typeof lng !== 'number'
    || !Number.isFinite(lat) || !Number.isFinite(lng)
    || lat < -90 || lat > 90 || lng < -180 || lng > 180
  ) return { valid: false }
  return { valid: true, lat, lng }
}

function baseDetails(value: unknown, requestedId: string): {
  data: Record<string, unknown>
  id: string
  address?: string
  lat?: number
  lng?: number
} | null {
  const data = record(value)
  const id = isGooglePlaceIdSupportedForStorage(requestedId) ? requestedId : null
  if (!data || !id || data.id !== id) return null
  const address = optionalText(data, 'formattedAddress', 500)
  const location = optionalLocation(data)
  if (!address.valid || !location.valid) return null
  return {
    data,
    id,
    ...(address.value ? { address: address.value } : {}),
    ...(location.lat !== undefined && location.lng !== undefined
      ? { lat: location.lat, lng: location.lng }
      : {}),
  }
}

/** Normalize the Essentials-only response that terminates autocomplete. The
 * selected suggestion supplies the name; Google must return the exact ID. */
export function normalizeCapturePlaceDetails(
  value: unknown,
  requestedId: string,
  selectedName: string,
): NormalizedGooglePlaceDetails | null {
  const base = baseDetails(value, requestedId)
  const name = boundedText(selectedName, 200)
  if (!base || !name) return null
  let primaryType: string | undefined
  if ('types' in base.data) {
    if (!Array.isArray(base.data.types) || base.data.types.length > 32) return null
    const types = base.data.types.map(type => boundedText(type, 100))
    if (types.some(type => !type)) return null
    primaryType = types[0] ?? undefined
  }
  return {
    id: base.id,
    name,
    ...(base.address ? { address: base.address } : {}),
    ...(base.lat !== undefined && base.lng !== undefined ? { lat: base.lat, lng: base.lng } : {}),
    ...(primaryType ? { primaryType } : {}),
  }
}

/** Normalize explicit non-session Details without allowing a missing or
 * mismatched provider identity to enter durable user memory. */
export function normalizePlaceDetails(
  value: unknown,
  requestedId: string,
): NormalizedGooglePlaceDetails | null {
  const base = baseDetails(value, requestedId)
  const displayName = record(base?.data.displayName)
  const name = boundedText(displayName?.text, 200)
  if (!base || !displayName || !name) return null
  const primaryType = optionalText(base.data, 'primaryType', 100)
  if (!primaryType.valid) return null
  return {
    id: base.id,
    name,
    ...(base.address ? { address: base.address } : {}),
    ...(base.lat !== undefined && base.lng !== undefined ? { lat: base.lat, lng: base.lng } : {}),
    ...(primaryType.value ? { primaryType: primaryType.value } : {}),
  }
}
