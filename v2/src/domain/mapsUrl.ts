export type MapsUrlResult =
  | { kind: 'place-id'; placeId: string; query?: string }
  | { kind: 'search'; query: string }
  | { kind: 'short-link'; url: string }
  | { kind: 'invalid'; reason: 'not-a-url' | 'not-google-maps' | 'no-place-identity' | 'too-long' }

const PLACE_ID = /^[A-Za-z0-9_-]{10,255}$/

function isGoogleMapsHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return host === 'google.com'
    || host.endsWith('.google.com')
    || host === 'maps.app.goo.gl'
    || host === 'goo.gl'
}

function clean(value: string | null): string | undefined {
  const result = value?.replace(/\+/g, ' ').trim()
  return result || undefined
}

function placePathLabel(url: URL): string | undefined {
  const encoded = url.pathname.match(/\/maps\/place\/([^/]+)/i)?.[1]
  if (!encoded) return undefined
  try {
    return clean(decodeURIComponent(encoded))
  } catch {
    return undefined
  }
}

/** Parse only identity that Google exposes in a URL. Never infer a place from
 * coordinates, opaque data tokens, or a non-Google host. */
export function parseGoogleMapsUrl(input: string): MapsUrlResult {
  const raw = input.trim()
  if (raw.length > 2048) return { kind: 'invalid', reason: 'too-long' }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { kind: 'invalid', reason: 'not-a-url' }
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    return { kind: 'invalid', reason: 'not-google-maps' }
  }
  if (!isGoogleMapsHost(url.hostname)) return { kind: 'invalid', reason: 'not-google-maps' }

  const host = url.hostname.toLowerCase()
  if (host === 'maps.app.goo.gl' || (host === 'goo.gl' && url.pathname.startsWith('/maps'))) {
    return { kind: 'short-link', url: url.toString() }
  }

  // Long Google share URLs commonly put the human-readable place name in the
  // path and the exact provider identity in an opaque `!1s...` segment. The
  // path label is safe only as an editable confirmation seed; the Place ID is
  // still the sole identity and no coordinates or name matching occur here.
  const query = clean(url.searchParams.get('query') ?? url.searchParams.get('q'))
    ?? placePathLabel(url)
  const explicitId = clean(
    url.searchParams.get('query_place_id')
      ?? url.searchParams.get('destination_place_id')
      ?? url.searchParams.get('place_id')
  )
  if (explicitId && PLACE_ID.test(explicitId)) {
    return { kind: 'place-id', placeId: explicitId, ...(query ? { query } : {}) }
  }

  const embeddedId = url.href.match(/!1s(ChI[A-Za-z0-9_-]{8,250})/i)?.[1]
  if (embeddedId && PLACE_ID.test(embeddedId)) {
    return { kind: 'place-id', placeId: embeddedId, ...(query ? { query } : {}) }
  }

  const destination = clean(url.searchParams.get('destination'))
  if (destination && !/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(destination)) {
    return { kind: 'search', query: destination }
  }
  if (query && !/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(query)) {
    return { kind: 'search', query }
  }

  const label = placePathLabel(url)
  if (label) return { kind: 'search', query: label }

  return { kind: 'invalid', reason: 'no-place-identity' }
}

export function looksLikeGoogleMapsUrl(input: string): boolean {
  return /^https?:\/\/(?:[^/]+\.)?(?:google\.com|goo\.gl)\//i.test(input.trim())
}

export interface SharedPlaceInput {
  title?: string | null
  text?: string | null
  url?: string | null
}

const SHARED_TEXT_LIMIT = 512

function boundedSharedText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, SHARED_TEXT_LIMIT)
}

/** Turn one explicit OS share into an Add-field value. A valid Google Maps URL
 * wins; otherwise retain only a short human-readable prompt for autocomplete.
 * This never resolves a link, calls Places, or saves anything by itself. */
export function sharedPlaceInput(input: SharedPlaceInput): string {
  const directUrl = boundedSharedText(input.url)
  if (directUrl && parseGoogleMapsUrl(directUrl).kind !== 'invalid') return directUrl

  const sharedText = boundedSharedText(input.text)
  const embeddedUrl = sharedText.match(/https?:\/\/[^\s]+/i)?.[0]
  if (embeddedUrl && parseGoogleMapsUrl(embeddedUrl).kind !== 'invalid') return embeddedUrl

  const title = boundedSharedText(input.title)
  return (title || sharedText).slice(0, 160)
}
