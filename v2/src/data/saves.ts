/**
 * THE save pipeline (v2/FRIENDS.md). One code path: setting your Want / Tried /
 * Loved on a place writes one document to the flat `saves` collection, keyed
 * `{uid}__{g:pid}` so it's idempotent (one save per person per place). Each
 * save denormalizes a minimal place snapshot so the feed, the friend graph,
 * and your Wall all render with zero joins.
 */
import { deleteField, doc, runTransaction } from 'firebase/firestore'
import { db } from '../lib/firebaseImpl'
import {
  isPairPrototype,
  prototypeSignalStorageKey,
  prototypeSignalVisibilityStorageKey,
} from '../lib/prototypeMode'
import { requireUid } from '../state/session'
import type { SignalVisibility, Tag } from './social'
import { isDurablePlaceMemory, type DurablePlaceMemory } from '../domain/placeMemory'
import {
  PLACE_OBSERVATION_KEYS,
  normalizePlaceObservations,
  setPlaceObservation,
  type PlaceObservationPatch,
  type PlaceObservations,
} from '../domain/placeObservations'
import { nextPersonalVisibility } from '../domain/personalVisibility'
import { PRIVATE_PLACE_NOTE_MAX_LENGTH } from '../domain/signals'

export interface SaveablePlace {
  id: string
  memory: DurablePlaceMemory
}

const saveId = (uid: string, placeId: string) => `${uid}__${placeId}`

function sameMemory(value: unknown, memory: DurablePlaceMemory): boolean {
  if (!isDurablePlaceMemory(value)) return false
  return value.placeId === memory.placeId
    && value.label === memory.label
    && value.category === memory.category
    && value.area === memory.area
    && value.hex === memory.hex
    && value.provenance === memory.provenance
}

function sameObservations(value: unknown, observations: PlaceObservations): boolean {
  const desiredKeys = Object.keys(observations).sort()
  if (desiredKeys.length === 0) return value === undefined
  const current = normalizePlaceObservations(value, 'private')
  if (!current) return false
  const currentKeys = Object.keys(current).sort()
  if (currentKeys.join('|') !== desiredKeys.join('|')) return false
  return desiredKeys.every(key => {
    const desired = observations[key as keyof PlaceObservations]
    const existing = current[key as keyof PlaceObservations]
    return Boolean(desired && existing
      && desired.value === existing.value
      && desired.observedAt === existing.observedAt
      && desired.audience === existing.audience
      && desired.source === existing.source)
  })
}

function observationsWithPatch(value: unknown, patch: PlaceObservationPatch): PlaceObservations {
  if (!PLACE_OBSERVATION_KEYS.includes(patch.key)
    || !['yes', 'no'].includes(patch.value)
    || !Number.isSafeInteger(patch.observedAt)
    || patch.observedAt <= 0) {
    throw new Error('invalid-place-observation')
  }
  const current = value === undefined ? {} : normalizePlaceObservations(value, 'private')
  if (!current) throw new Error('invalid-place-observations')
  return setPlaceObservation(current, patch.key, patch.value, patch.observedAt)
}

interface SetSaveOptions {
  note?: string
  /** Capture surfaces promise a private canonical record even when the exact
   * provider ID collides with a legacy connection-visible save. */
  privateOnly?: boolean
  /** One explicit private observation captured during the same reviewed save.
   * Group projection remains a separate consented operation. */
  observation?: PlaceObservationPatch
}

/** Set (or change) your tag on a place. Idempotent per user+place. */
export async function setSave(place: SaveablePlace, tag: Tag, options: SetSaveOptions = {}): Promise<void> {
  const uid = requireUid()
  const trimmedNote = options.note?.trim()
  if (trimmedNote && trimmedNote.length > PRIVATE_PLACE_NOTE_MAX_LENGTH) throw new Error('note-too-long')
  if (isPairPrototype()) {
    const key = prototypeSignalStorageKey(uid, place.id)
    const stored = window.sessionStorage.getItem(key)
    const current = stored ? JSON.parse(stored) as Record<string, unknown> : undefined
    const visibilityOverride = window.sessionStorage.getItem(
      prototypeSignalVisibilityStorageKey(uid, place.id)
    )
    const visibility = options.privateOnly
      ? 'private'
      : nextPersonalVisibility(visibilityOverride ?? current?.visibility)
    const observations = options.observation
      ? observationsWithPatch(current?.observations, options.observation)
      : undefined
    const unchanged = Boolean(current
      && current.uid === uid
      && current.placeId === place.id
      && current.tag === tag
      && current.visibility === visibility
      && sameMemory(current.memory, place.memory)
      && !('place' in current)
      && (trimmedNote === undefined || current.note === trimmedNote)
      && (observations === undefined || sameObservations(current.observations, observations)))
    if (unchanged) return
    window.sessionStorage.setItem(key, JSON.stringify({
      ...current,
      id: saveId(uid, place.id),
      uid,
      placeId: place.id,
      tag,
      visibility,
      ts: Date.now(),
      memory: place.memory,
      ...(trimmedNote !== undefined ? { note: trimmedNote } : {}),
      ...(observations !== undefined ? { observations } : {}),
    }))
    return
  }
  const ref = doc(db, 'saves', saveId(uid, place.id))
  await runTransaction(db, async transaction => {
    const current = await transaction.get(ref)
    if (current.exists() && current.data().uid !== uid) throw new Error('Save is not owned by caller')
    const data = current.exists() ? current.data() : undefined
    const visibility: SignalVisibility = options.privateOnly
      ? 'private'
      : nextPersonalVisibility(data?.visibility)
    const observations = options.observation
      ? observationsWithPatch(data?.observations, options.observation)
      : undefined
    const unchanged = Boolean(data
      && data.placeId === place.id
      && data.tag === tag
      && data.visibility === visibility
      && sameMemory(data.memory, place.memory)
      && data.place === undefined
      && (trimmedNote === undefined || data.note === trimmedNote)
      && (observations === undefined || sameObservations(data.observations, observations)))
    if (unchanged) return
    transaction.set(ref, {
      uid,
      placeId: place.id,
      tag,
      visibility,
      ts: Date.now(),
      memory: place.memory,
      place: deleteField(),
      ...(trimmedNote !== undefined ? { note: trimmedNote } : {}),
      ...(observations !== undefined ? { observations } : {}),
    }, { merge: true })
  })
}

/** Remove a place from your Wall entirely. */
export async function clearSave(placeId: string): Promise<void> {
  const uid = requireUid()
  if (isPairPrototype()) {
    window.sessionStorage.removeItem(prototypeSignalStorageKey(uid, placeId))
    window.sessionStorage.removeItem(prototypeSignalVisibilityStorageKey(uid, placeId))
    return
  }
  const ref = doc(db, 'saves', saveId(uid, placeId))
  await runTransaction(db, async transaction => {
    const current = await transaction.get(ref)
    if (!current.exists()) return
    if (current.data().uid !== uid) throw new Error('Save is not owned by caller')
    transaction.delete(ref)
  })
}

/** Correct only the person's durable place facts. Taste status, timestamp,
 * note, observations, visibility, and existing group consent stay unchanged. */
export async function setSaveMemory(placeId: string, memory: DurablePlaceMemory): Promise<void> {
  const uid = requireUid()
  if (memory.placeId !== placeId || !isDurablePlaceMemory(memory)) throw new Error('invalid-place-memory')
  if (isPairPrototype()) {
    const key = prototypeSignalStorageKey(uid, placeId)
    const value = window.sessionStorage.getItem(key)
    if (!value) throw new Error('signal-unavailable')
    const save = JSON.parse(value) as Record<string, unknown>
    if (sameMemory(save.memory, memory)) return
    window.sessionStorage.setItem(key, JSON.stringify({ ...save, memory }))
    return
  }
  const ref = doc(db, 'saves', saveId(uid, placeId))
  await runTransaction(db, async transaction => {
    const current = await transaction.get(ref)
    if (!current.exists() || current.data().uid !== uid) throw new Error('Save no longer exists')
    if (sameMemory(current.data().memory, memory)) return
    transaction.update(ref, { memory })
  })
}

/** Update just the note on an existing save (doesn't bump ts). */
export async function setSaveNote(placeId: string, note: string): Promise<void> {
  const uid = requireUid()
  const trimmed = note.trim()
  if (trimmed.length > PRIVATE_PLACE_NOTE_MAX_LENGTH) throw new Error('note-too-long')
  if (isPairPrototype()) {
    const key = prototypeSignalStorageKey(uid, placeId)
    const value = window.sessionStorage.getItem(key)
    if (!value) throw new Error('Save no longer exists')
    const save = JSON.parse(value) as Record<string, unknown>
    const visibility = save.visibility === 'circle' ? 'circle' : 'private'
    if (save.note === trimmed && save.visibility === visibility) return
    window.sessionStorage.setItem(key, JSON.stringify({ ...save, visibility, note: trimmed }))
    return
  }
  const ref = doc(db, 'saves', saveId(uid, placeId))
  await runTransaction(db, async transaction => {
    const current = await transaction.get(ref)
    if (!current.exists() || current.data().uid !== uid) throw new Error('Save no longer exists')
    const visibility = current.data().visibility === 'circle' ? 'circle' : 'private'
    if (current.data().note === trimmed && current.data().visibility === visibility) return
    transaction.set(ref, {
      note: trimmed,
      visibility,
    }, { merge: true })
  })
}

/** Replace the caller's bounded, private structured observations. Group
 * projections receive them only through a separate explicit consent flag. */
export async function setSaveObservations(
  placeId: string,
  observations: PlaceObservations,
): Promise<void> {
  const uid = requireUid()
  if (isPairPrototype()) {
    const key = prototypeSignalStorageKey(uid, placeId)
    const value = window.sessionStorage.getItem(key)
    if (!value) throw new Error('Save no longer exists')
    const save = JSON.parse(value) as Record<string, unknown>
    if (sameObservations(save.observations, observations)) return
    const next = { ...save }
    if (Object.keys(observations).length > 0) next.observations = observations
    else delete next.observations
    window.sessionStorage.setItem(key, JSON.stringify(next))
    return
  }
  const ref = doc(db, 'saves', saveId(uid, placeId))
  await runTransaction(db, async transaction => {
    const current = await transaction.get(ref)
    if (!current.exists() || current.data().uid !== uid) throw new Error('Save no longer exists')
    if (sameObservations(current.data().observations, observations)) return
    transaction.update(ref, {
      observations: Object.keys(observations).length > 0 ? observations : deleteField(),
    })
  })
}

/** Choose whether a saved signal is evidence for your connections or only you. */
export async function setSaveVisibility(
  placeId: string,
  visibility: SignalVisibility
): Promise<void> {
  const uid = requireUid()
  if (isPairPrototype()) {
    const key = prototypeSignalStorageKey(uid, placeId)
    const value = window.sessionStorage.getItem(key)
    if (value) {
      const save = JSON.parse(value) as Record<string, unknown>
      if (save.visibility !== visibility) {
        window.sessionStorage.setItem(key, JSON.stringify({ ...save, visibility }))
      }
    }
    const visibilityKey = prototypeSignalVisibilityStorageKey(uid, placeId)
    if (window.sessionStorage.getItem(visibilityKey) !== visibility) {
      window.sessionStorage.setItem(visibilityKey, visibility)
    }
    return
  }
  const ref = doc(db, 'saves', saveId(uid, placeId))
  await runTransaction(db, async transaction => {
    const current = await transaction.get(ref)
    if (!current.exists() || current.data().uid !== uid) throw new Error('Save no longer exists')
    if (current.data().visibility === visibility) return
    transaction.update(ref, { visibility })
  })
}
