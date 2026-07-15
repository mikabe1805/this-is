import { isDeepStrictEqual } from 'node:util'

import {
  groupSignalProjection,
  normalizePlaceObservations,
  validUserPlaceMemory,
  type CanonicalSignal,
  type GroupLifecycleState,
} from './group-lifecycle.js'

type ProjectionSyncPlan =
  | { action: 'none' }
  | { action: 'delete' }
  | { action: 'update'; value: Record<string, unknown> }

interface TimestampParts {
  seconds: number
  nanoseconds: number
}

function timestampParts(value: unknown): TimestampParts | null {
  if (!value || typeof value !== 'object') return null
  const seconds = Number((value as { seconds?: unknown }).seconds)
  const nanoseconds = Number((value as { nanoseconds?: unknown }).nanoseconds)
  if (
    !Number.isSafeInteger(seconds) || !Number.isSafeInteger(nanoseconds)
    || nanoseconds < 0 || nanoseconds >= 1_000_000_000
  ) return null
  return { seconds, nanoseconds }
}

/** A projection is explicit consent for the current save lifetime only when
 * it was written no earlier than that save document was created. */
export function projectionBelongsToSaveLifetime(
  projectionUpdatedAt: unknown,
  saveCreatedAt: unknown,
): boolean {
  const projection = timestampParts(projectionUpdatedAt)
  const save = timestampParts(saveCreatedAt)
  if (!projection || !save) return false
  return projection.seconds > save.seconds
    || (projection.seconds === save.seconds && projection.nanoseconds >= save.nanoseconds)
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

export function canonicalSignalFromSave(
  value: unknown,
  uid: string,
  placeId: string,
): CanonicalSignal | null {
  const data = record(value)
  const observations = data?.observations === undefined
    ? undefined
    : normalizePlaceObservations(data.observations, 'private')
  if (
    !data || data.uid !== uid || data.placeId !== placeId
    || !['want', 'tried', 'loved'].includes(String(data.tag))
    || !validUserPlaceMemory(data.memory, placeId)
    || (data.observations !== undefined && !observations)
  ) return null
  return {
    uid,
    placeId,
    tag: data.tag as CanonicalSignal['tag'],
    ts: Number.isFinite(Number(data.ts)) ? Number(data.ts) : 0,
    memory: data.memory as CanonicalSignal['memory'],
    ...(typeof data.note === 'string' && data.note.trim() ? { note: data.note.trim() } : {}),
    ...(observations ? { observations } : {}),
  }
}

export function planProjectionSync(input: {
  canonical: CanonicalSignal | null
  group: GroupLifecycleState | null
  projection: unknown
}): ProjectionSyncPlan {
  const projection = record(input.projection)
  if (!projection) return { action: 'none' }
  if (
    !input.canonical || !input.group || input.group.status !== 'active'
    || !input.group.memberUids.includes(input.canonical.uid)
    || projection.uid !== input.canonical.uid
    || projection.placeId !== input.canonical.placeId
  ) return { action: 'delete' }
  const includeNote = projection.includeNote === true
    || (projection.includeNote === undefined
      && typeof projection.note === 'string'
      && projection.note.trim().length > 0)
  const legacyObservations = projection.includeObservations === undefined
    ? normalizePlaceObservations(projection.observations, 'group')
    : null
  const includeObservations = projection.includeObservations === true
    || (projection.includeObservations === undefined
      && legacyObservations !== null
      && Object.keys(legacyObservations).length > 0)
  const desired = groupSignalProjection(
    input.canonical,
    input.group.permissionVersion,
    includeNote,
    includeObservations,
  )
  if (isDeepStrictEqual(projection, desired)) return { action: 'none' }
  return {
    action: 'update',
    value: desired,
  }
}
