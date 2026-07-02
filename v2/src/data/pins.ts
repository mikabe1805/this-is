/**
 * THE save pipeline. One code path, one batched write, everywhere.
 *
 * v1 re-implemented saving 5+ times and wrote one fact to 6–7 locations
 * non-transactionally. v2 law: every save in the app goes through savePin();
 * every undo through undoSave(). Fan-out beyond these docs (taste vector,
 * candidate pool) belongs to the onPinWrite Cloud Function trigger — never
 * the client hot path. Counters here are best-effort denormalizations the
 * trigger will own later.
 */
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  increment,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../lib/firebaseImpl'
import { requireUid } from '../state/session'
import { gid, type Board, type Pin, type PinStatus, type SaveablePlace } from './types'
import { DEFAULT_BOARD_NAME, listBoards, pickLikelyBoard } from './boards'
import { hexFor, neighborhoodFrom, vibesFor } from './vibes'

export interface SaveReceipt {
  pinId: string
  boardId: string
  boardName: string
  status: 'want' | 'been'
  /** True when this save touched an already-saved pin. */
  previouslySaved: boolean
  /** The pre-save pin, so undo can restore instead of delete. */
  restore: Pin | null
}

export interface SaveOptions {
  place: SaveablePlace
  /** Explicit board (long-press / picker); otherwise the likely-board guess. */
  boardId?: string
  status?: 'want' | 'been'
  note?: string
}

export async function savePin(opts: SaveOptions): Promise<SaveReceipt> {
  const uid = requireUid()
  const id = gid(opts.place.id)
  const pinRef = doc(db, 'users', uid, 'pins', id)
  const placeRef = doc(db, 'places', id)

  const [pinSnap, boards] = await Promise.all([getDoc(pinRef), listBoards(uid)])
  const existing = pinSnap.exists() ? ({ id, ...(pinSnap.data() as Omit<Pin, 'id'>) }) : null

  const vibeTags = vibesFor(opts.place.primaryType)
  const hex = hexFor(opts.place.primaryType)
  const neighborhood = opts.place.neighborhood ?? neighborhoodFrom(opts.place.address)
  const now = Date.now()
  const batch = writeBatch(db)

  // ── Board: explicit > pin's current home > likely guess > new "Saved" ──
  let boardId = opts.boardId ?? existing?.boardIds[0]
  let boardName: string
  let boardIsNew = false
  if (boardId) {
    boardName = boards.find(b => b.id === boardId)?.name ?? DEFAULT_BOARD_NAME
  } else {
    const likely = pickLikelyBoard(boards, vibeTags)
    if (likely) {
      boardId = likely.id
      boardName = likely.name
    } else {
      const newRef = doc(collection(db, 'users', uid, 'boards'))
      boardId = newRef.id
      boardName = DEFAULT_BOARD_NAME
      boardIsNew = true
      const board: Omit<Board, 'id'> = {
        name: DEFAULT_BOARD_NAME,
        coverHex: hex,
        vibeTags,
        pinCount: 1,
        createdAt: now,
        lastUsedAt: now,
      }
      batch.set(newRef, board)
    }
  }

  // ── The pin (id-keyed → idempotent) ──
  const status: PinStatus = opts.status ?? existing?.status ?? 'want'
  const note = opts.note ?? existing?.note
  const merged = existing ? [...new Set([boardId, ...existing.boardIds])] : [boardId]
  const boardIds = merged.slice(0, 3)
  const droppedBoards = merged.slice(3)
  // Re-saves refine the snapshot, never degrade it: new values win, but
  // fields the fresh place data lacks fall back to what the pin already knew.
  const prev = existing?.snapshot
  const hasCoords = typeof opts.place.lat === 'number' && typeof opts.place.lng === 'number'
  const pin: Omit<Pin, 'id'> = {
    boardIds,
    status,
    ...(note ? { note } : {}),
    ...(existing?.sixWordNote ? { sixWordNote: existing.sixWordNote } : {}),
    savedAt: existing?.savedAt ?? now,
    lastTouchedAt: now,
    ...(status === 'been' || existing?.visitedAt
      ? { visitedAt: existing?.visitedAt ?? now }
      : {}),
    ...(existing?.userPhotoPath ? { userPhotoPath: existing.userPhotoPath } : {}),
    snapshot: {
      name: opts.place.name || prev?.name || '',
      hex,
      ...(opts.place.primaryType || prev?.primaryType
        ? { primaryType: opts.place.primaryType ?? prev?.primaryType }
        : {}),
      ...(neighborhood || prev?.neighborhood
        ? { neighborhood: neighborhood ?? prev?.neighborhood }
        : {}),
      ...(hasCoords
        ? { lat: opts.place.lat, lng: opts.place.lng, coordsAt: now }
        : typeof prev?.lat === 'number'
          ? { lat: prev.lat, lng: prev.lng, ...(prev.coordsAt ? { coordsAt: prev.coordsAt } : {}) }
          : {}),
    },
  }
  batch.set(pinRef, pin)

  // A pin holds ≤3 boards; anything pushed off the end stops counting it.
  for (const dropped of droppedBoards) {
    batch.set(
      doc(db, 'users', uid, 'boards', dropped),
      { pinCount: increment(-1) },
      { merge: true }
    )
  }

  // ── The place doc — created only inside the save batch; browsing never writes ──
  batch.set(
    placeRef,
    {
      name: opts.place.name,
      vibeTags,
      photoHex: hex,
      ...(opts.place.primaryType ? { primaryType: opts.place.primaryType } : {}),
      ...(neighborhood ? { neighborhood } : {}),
      ...(typeof opts.place.lat === 'number' && typeof opts.place.lng === 'number'
        ? { lat: opts.place.lat, lng: opts.place.lng, coordsFetchedAt: now }
        : {}),
      ...(existing ? {} : { savedCount: increment(1) }),
    },
    { merge: true }
  )

  // ── Touch the board (unless it was created above, already fully formed) ──
  if (!boardIsNew) {
    const alreadyOnBoard = existing?.boardIds.includes(boardId) ?? false
    batch.set(
      doc(db, 'users', uid, 'boards', boardId),
      {
        lastUsedAt: now,
        ...(alreadyOnBoard ? {} : { pinCount: increment(1) }),
        ...(vibeTags.length ? { vibeTags: arrayUnion(...vibeTags) } : {}),
      },
      { merge: true }
    )
  }

  await batch.commit()
  return {
    pinId: id,
    boardId,
    boardName,
    status: status === 'been' ? 'been' : 'want',
    previouslySaved: Boolean(existing),
    restore: existing,
  }
}

/**
 * Undo from the save toast: restore what was, or remove what wasn't.
 * Board counters reconcile against the pin's LIVE boardIds (the user may have
 * re-filed via "Change" between save and undo), never the receipt's guess.
 */
export async function undoSave(receipt: SaveReceipt): Promise<void> {
  const uid = requireUid()
  const pinRef = doc(db, 'users', uid, 'pins', receipt.pinId)
  const snap = await getDoc(pinRef)
  const liveBoards: string[] = snap.exists()
    ? ((snap.data() as Omit<Pin, 'id'>).boardIds ?? [])
    : [receipt.boardId]
  const batch = writeBatch(db)
  const bump = (boardId: string, by: 1 | -1) =>
    batch.set(
      doc(db, 'users', uid, 'boards', boardId),
      { pinCount: increment(by) },
      { merge: true }
    )
  if (receipt.restore) {
    const { id: _id, ...data } = receipt.restore
    batch.set(pinRef, data)
    for (const b of liveBoards) if (!receipt.restore.boardIds.includes(b)) bump(b, -1)
    for (const b of receipt.restore.boardIds) if (!liveBoards.includes(b)) bump(b, 1)
  } else {
    batch.delete(pinRef)
    batch.set(doc(db, 'places', receipt.pinId), { savedCount: increment(-1) }, { merge: true })
    for (const b of liveBoards) bump(b, -1)
  }
  await batch.commit()
}

/** Move a pin to a different board (the toast's "Change" / the picker). */
export async function refilePin(pinId: string, toBoardId: string): Promise<void> {
  const uid = requireUid()
  const pinRef = doc(db, 'users', uid, 'pins', pinId)
  const snap = await getDoc(pinRef)
  if (!snap.exists()) return
  const pin = snap.data() as Omit<Pin, 'id'>
  if (pin.boardIds.length === 1 && pin.boardIds[0] === toBoardId) return
  const now = Date.now()
  const batch = writeBatch(db)
  batch.set(pinRef, { ...pin, boardIds: [toBoardId], lastTouchedAt: now })
  for (const old of pin.boardIds) {
    if (old !== toBoardId) {
      batch.set(
        doc(db, 'users', uid, 'boards', old),
        { pinCount: increment(-1) },
        { merge: true }
      )
    }
  }
  if (!pin.boardIds.includes(toBoardId)) {
    batch.set(
      doc(db, 'users', uid, 'boards', toBoardId),
      { pinCount: increment(1), lastUsedAt: now },
      { merge: true }
    )
  }
  await batch.commit()
}

/** Want ⇄ Been (⇄ released, from the resurface card). */
export async function setPinStatus(pinId: string, status: PinStatus): Promise<void> {
  const uid = requireUid()
  const pinRef = doc(db, 'users', uid, 'pins', pinId)
  const snap = await getDoc(pinRef)
  if (!snap.exists()) return
  const pin = snap.data() as Omit<Pin, 'id'>
  const now = Date.now()
  await writeBatch(db)
    .set(pinRef, {
      ...pin,
      status,
      lastTouchedAt: now,
      ...(status === 'been' ? { visitedAt: pin.visitedAt ?? now } : {}),
    })
    .commit()
}

/**
 * Refresh a pin's snapshot from a fresh full-mask Details response — the
 * snapshot is a refreshable cache of Google data, not an archive
 * (docs/GOOGLE.md, decision 5). Called by the closeup when the snapshot has
 * aged past the refresh window.
 */
export async function refreshPinSnapshot(
  pinId: string,
  place: SaveablePlace
): Promise<void> {
  const uid = requireUid()
  const pinRef = doc(db, 'users', uid, 'pins', pinId)
  const snap = await getDoc(pinRef)
  if (!snap.exists()) return
  const pin = snap.data() as Omit<Pin, 'id'>
  const now = Date.now()
  const neighborhood = neighborhoodFrom(place.address)
  const hasCoords = typeof place.lat === 'number' && typeof place.lng === 'number'
  await writeBatch(db)
    .set(pinRef, {
      ...pin,
      snapshot: {
        ...pin.snapshot,
        name: place.name || pin.snapshot.name,
        ...(place.primaryType ? { primaryType: place.primaryType } : {}),
        ...(neighborhood ? { neighborhood } : {}),
        ...(hasCoords ? { lat: place.lat, lng: place.lng, coordsAt: now } : {}),
      },
    })
    .commit()
}

/** Update the free-text note from the closeup. */
export async function setPinNote(pinId: string, note: string): Promise<void> {
  const uid = requireUid()
  const pinRef = doc(db, 'users', uid, 'pins', pinId)
  const snap = await getDoc(pinRef)
  if (!snap.exists()) return
  const pin = snap.data() as Omit<Pin, 'id'>
  const trimmed = note.trim()
  const { note: _oldNote, ...rest } = pin
  await writeBatch(db)
    .set(pinRef, {
      ...rest,
      ...(trimmed ? { note: trimmed } : {}),
      lastTouchedAt: Date.now(),
    })
    .commit()
}
