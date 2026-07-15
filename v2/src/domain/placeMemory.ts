export const USER_PLACE_CATEGORIES = ['food', 'drinks', 'coffee', 'activity', 'other'] as const
export type UserPlaceCategory = (typeof USER_PLACE_CATEGORIES)[number]

export const GOOGLE_CONTENT_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000

const CATEGORY_HEX: Record<UserPlaceCategory, string> = {
  food: '#704739',
  drinks: '#633C48',
  coffee: '#5A463C',
  activity: '#46525A',
  other: '#4A3A43',
}

export interface DurablePlaceMemory {
  placeId: string
  label: string
  category: UserPlaceCategory
  area?: string
  hex: string
  provenance: 'user_confirmed'
}

export function categoryPrimaryType(category: UserPlaceCategory): string | undefined {
  if (category === 'food') return 'restaurant'
  if (category === 'drinks') return 'bar'
  if (category === 'coffee') return 'cafe'
  if (category === 'activity') return 'activity'
  return undefined
}

export function isDurablePlaceMemory(value: unknown): value is DurablePlaceMemory {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  const normalized = buildDurablePlaceMemory({
    placeId: data.placeId,
    userLabel: data.label,
    category: data.category,
    userArea: data.area,
  })
  return Boolean(normalized
    && data.provenance === 'user_confirmed'
    && data.hex === normalized.hex
    && data.area === normalized.area)
}

export interface EphemeralGoogleSnapshot {
  placeId: string
  name?: string
  formattedAddress?: string
  primaryType?: string
  lat?: number
  lng?: number
  fetchedAt: number
  expiresAt: number
  provenance: 'google_places'
}

function boundedText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().replace(/\s+/g, ' ')
  return trimmed && trimmed.length <= max ? trimmed : null
}

export function buildDurablePlaceMemory(input: {
  placeId: unknown
  userLabel: unknown
  category: unknown
  userArea?: unknown
}): DurablePlaceMemory | null {
  const placeId = boundedText(input.placeId, 260)
  const label = boundedText(input.userLabel, 120)
  if (!placeId || !label || !USER_PLACE_CATEGORIES.includes(input.category as UserPlaceCategory)) return null
  const category = input.category as UserPlaceCategory
  const area = input.userArea === undefined || input.userArea === ''
    ? undefined
    : boundedText(input.userArea, 80)
  if (input.userArea !== undefined && input.userArea !== '' && !area) return null
  return {
    placeId,
    label,
    category,
    ...(area ? { area } : {}),
    hex: CATEGORY_HEX[category],
    provenance: 'user_confirmed',
  }
}

export function buildEphemeralGoogleSnapshot(input: {
  placeId: unknown
  name?: unknown
  formattedAddress?: unknown
  primaryType?: unknown
  lat?: unknown
  lng?: unknown
  fetchedAt: number
}): EphemeralGoogleSnapshot | null {
  const placeId = boundedText(input.placeId, 260)
  if (!placeId || !Number.isSafeInteger(input.fetchedAt) || input.fetchedAt < 0) return null
  const name = boundedText(input.name, 160) ?? undefined
  const formattedAddress = boundedText(input.formattedAddress, 240) ?? undefined
  const primaryType = boundedText(input.primaryType, 80) ?? undefined
  const coordinates = typeof input.lat === 'number' && Number.isFinite(input.lat)
    && typeof input.lng === 'number' && Number.isFinite(input.lng)
    && input.lat >= -90 && input.lat <= 90 && input.lng >= -180 && input.lng <= 180
      ? { lat: input.lat, lng: input.lng }
      : {}
  return {
    placeId,
    ...(name ? { name } : {}),
    ...(formattedAddress ? { formattedAddress } : {}),
    ...(primaryType ? { primaryType } : {}),
    ...coordinates,
    fetchedAt: input.fetchedAt,
    expiresAt: input.fetchedAt + GOOGLE_CONTENT_LIFETIME_MS,
    provenance: 'google_places',
  }
}

export function isLiveGoogleSnapshot(
  snapshot: Pick<EphemeralGoogleSnapshot, 'fetchedAt' | 'expiresAt'>,
  now = Date.now(),
): boolean {
  return snapshot.expiresAt === snapshot.fetchedAt + GOOGLE_CONTENT_LIFETIME_MS
    && now < snapshot.expiresAt
}

export type LegacyPlaceMigration =
  | { status: 'ready'; memory: DurablePlaceMemory }
  | { status: 'needs_user_confirmation'; placeId: string }
  | { status: 'invalid' }

/** Google-derived legacy names/categories never become user-authored by inference. */
export function planLegacyPlaceMigration(input: {
  placeId: unknown
  confirmedLabel?: unknown
  confirmedCategory?: unknown
  confirmedArea?: unknown
}): LegacyPlaceMigration {
  const placeId = boundedText(input.placeId, 260)
  if (!placeId) return { status: 'invalid' }
  const memory = buildDurablePlaceMemory({
    placeId,
    userLabel: input.confirmedLabel,
    category: input.confirmedCategory,
    userArea: input.confirmedArea,
  })
  return memory
    ? { status: 'ready', memory }
    : { status: 'needs_user_confirmation', placeId }
}
