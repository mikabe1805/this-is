export const PLACE_OBSERVATION_KEYS = [
  'family_friendly',
  'quiet',
  'easy_parking',
  'worth_a_drive',
  'casual',
  'special_occasion',
  'outdoors',
] as const

export type PlaceObservationKey = (typeof PLACE_OBSERVATION_KEYS)[number]
export type PlaceObservationValue = 'yes' | 'no'
export type PlaceObservationAudience = 'private' | 'group'
export type PracticalNeedAnswer = PlaceObservationValue | 'not_sure'

export interface PlaceObservationPatch {
  key: PlaceObservationKey
  value: PlaceObservationValue
  observedAt: number
}

export interface PlaceObservation {
  value: PlaceObservationValue
  observedAt: number
  audience: PlaceObservationAudience
  source: 'user_authored'
}

export type PlaceObservations = Partial<Record<PlaceObservationKey, PlaceObservation>>

export const PLACE_OBSERVATION_LABELS: Record<PlaceObservationKey, string> = {
  family_friendly: 'Good with family',
  quiet: 'Quiet enough to talk',
  easy_parking: 'Easy parking',
  worth_a_drive: 'Worth a drive',
  casual: 'Casual',
  special_occasion: 'Special occasion',
  outdoors: 'Works outdoors',
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

export function normalizePlaceObservations(
  value: unknown,
  audience: PlaceObservationAudience,
): PlaceObservations | null {
  const data = record(value)
  if (!data || Object.keys(data).length > PLACE_OBSERVATION_KEYS.length
    || Object.keys(data).some(key => !PLACE_OBSERVATION_KEYS.includes(key as PlaceObservationKey))) {
    return null
  }
  const normalized: PlaceObservations = {}
  for (const key of PLACE_OBSERVATION_KEYS) {
    if (!(key in data)) continue
    const item = record(data[key])
    if (!item || Object.keys(item).sort().join('|') !== 'audience|observedAt|source|value'
      || !['yes', 'no'].includes(String(item.value))
      || !Number.isSafeInteger(item.observedAt) || Number(item.observedAt) <= 0
      || item.audience !== audience || item.source !== 'user_authored') {
      return null
    }
    normalized[key] = {
      value: item.value as PlaceObservationValue,
      observedAt: Number(item.observedAt),
      audience,
      source: 'user_authored',
    }
  }
  return normalized
}

export function setPlaceObservation(
  current: PlaceObservations,
  key: PlaceObservationKey,
  value: PlaceObservationValue | null,
  observedAt = Date.now(),
): PlaceObservations {
  const next = { ...current }
  if (value === null) delete next[key]
  else next[key] = { value, observedAt, audience: 'private', source: 'user_authored' }
  return next
}

/** Turn one explicit answer about the active plan into a bounded private
 * observation. "Not sure" deliberately produces no evidence. */
export function practicalNeedObservationPatch(
  key: PlaceObservationKey,
  answer: PracticalNeedAnswer,
  observedAt = Date.now(),
): PlaceObservationPatch | null {
  if (answer === 'not_sure') return null
  return { key, value: answer, observedAt }
}

export function observationsForGroup(value: PlaceObservations): PlaceObservations {
  return Object.fromEntries(Object.entries(value).map(([key, observation]) => [
    key,
    { ...observation, audience: 'group' as const },
  ])) as PlaceObservations
}
