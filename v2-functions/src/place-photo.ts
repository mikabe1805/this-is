export interface PlacePhotoBudgetConfig {
  enabled: boolean
  monthlyLimit: number
}

export interface GooglePhotoPayload {
  bytes: Uint8Array
  contentType: string
  attribution?: string
  sourceUri?: string
}

export type PhotoFetch = (input: string | URL, init?: RequestInit) => Promise<Response>

const MAX_MONTHLY_PHOTOS = 999
const MAX_PHOTO_BYTES = 5 * 1024 * 1024

export function normalizePlacePhotoBudget(value: unknown): PlacePhotoBudgetConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { enabled: false, monthlyLimit: 0 }
  }
  const data = value as Record<string, unknown>
  const monthlyLimit = Number(data.monthlyLimit)
  if (data.enabled !== true || !Number.isSafeInteger(monthlyLimit)
    || monthlyLimit < 1 || monthlyLimit > MAX_MONTHLY_PHOTOS) {
    return { enabled: false, monthlyLimit: 0 }
  }
  return { enabled: true, monthlyLimit }
}

export function photoUsageMonth(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

export function canReservePlacePhoto(config: PlacePhotoBudgetConfig, used: unknown): boolean {
  return config.enabled && Number.isSafeInteger(used) && Number(used) >= 0 && Number(used) < config.monthlyLimit
}

export function validGooglePlaceId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{10,255}$/.test(value)
}

function safePhotoSource(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2048) return undefined
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    return url.protocol === 'https:' && (host === 'google.com' || host.endsWith('.google.com'))
      ? url.toString()
      : undefined
  } catch {
    return undefined
  }
}

/** Fetches one current photo without exposing the server key or a reusable
 * Google media URL. Callers must reserve project budget before invoking it. */
export async function fetchGooglePlacePhoto(
  placeId: string,
  apiKey: string,
  fetcher: PhotoFetch = fetch,
): Promise<GooglePhotoPayload | null> {
  if (!validGooglePlaceId(placeId) || !apiKey) return null
  const detailsUrl = new URL(`https://places.googleapis.com/v1/places/${placeId}`)
  detailsUrl.searchParams.set('languageCode', 'en')
  const details = await fetcher(detailsUrl, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'photos.name,photos.authorAttributions,photos.googleMapsUri',
    },
  })
  if (!details.ok) return null
  const body = await details.json() as {
    photos?: Array<{
      name?: unknown
      authorAttributions?: Array<{ displayName?: unknown }>
      googleMapsUri?: unknown
    }>
  }
  const photo = body.photos?.[0]
  const expectedPrefix = `places/${placeId}/photos/`
  if (typeof photo?.name !== 'string' || !photo.name.startsWith(expectedPrefix) || photo.name.length > 2048) {
    return null
  }
  const mediaUrl = new URL(`https://places.googleapis.com/v1/${photo.name}/media`)
  mediaUrl.searchParams.set('maxWidthPx', '640')
  const media = await fetcher(mediaUrl, { headers: { 'X-Goog-Api-Key': apiKey }, redirect: 'follow' })
  if (!media.ok) return null
  const contentType = media.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? ''
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(contentType)) return null
  const declaredSize = Number(media.headers.get('content-length') ?? 0)
  if (declaredSize > MAX_PHOTO_BYTES) return null
  const bytes = new Uint8Array(await media.arrayBuffer())
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PHOTO_BYTES) return null
  const attribution = photo.authorAttributions?.[0]?.displayName
  const sourceUri = safePhotoSource(photo.googleMapsUri)
  if (!sourceUri) return null
  return {
    bytes,
    contentType,
    ...(typeof attribution === 'string' && attribution.trim()
      ? { attribution: attribution.trim().slice(0, 200) }
      : {}),
    sourceUri,
  }
}
