import {
  doc,
  getDoc,
  getDocFromServer,
  onSnapshot,
  runTransaction,
  type Unsubscribe,
} from 'firebase/firestore'
import {
  canTransitionPickStatus,
  isGroupPick,
  type GroupPick,
  type NewGroupPick,
  type Pick,
  type PickStatus,
} from '../domain/picks'
import { db } from '../lib/firebaseImpl'
import { auth } from '../lib/firebaseImpl'
import { isPairPrototype } from '../lib/prototypeMode'
import { requireUid } from '../state/session'

const prototypePickKey = (id: string) => `__this_is_pick:${id}`
const PICK_DOCUMENT_ID = /^[A-Za-z0-9_-]{1,200}$/

export class PickRequestError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code)
  }
}

export interface PickStatusUpdateResult {
  status: PickStatus
  changed: boolean
}

export interface PickSnapshotUpdate {
  pick: Pick | null
  /** False means Firestore served a local cached snapshot while it checks the
   * server or the snapshot still includes a pending client write. Cached or
   * locally pending data may support display, but never unlocks Pick actions. */
  serverAuthoritative: boolean
}

function storePrototypePick(pick: Pick): void {
  window.sessionStorage.setItem(prototypePickKey(pick.id), JSON.stringify(pick))
}

export function validPickDocumentId(id: string | null | undefined): id is string {
  return typeof id === 'string' && PICK_DOCUMENT_ID.test(id)
}

async function pickPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const user = auth.currentUser
  if (!user) throw new PickRequestError('authentication-required', 401)
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${await user.getIdToken(true)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: unknown }
    throw new PickRequestError(
      typeof payload.error === 'string' ? payload.error : 'request-failed',
      response.status,
    )
  }
  return response.json() as Promise<T>
}

export async function fetchPick(id: string): Promise<Pick | null> {
  if (isPairPrototype()) {
    const value = window.sessionStorage.getItem(prototypePickKey(id))
    return value ? JSON.parse(value) as Pick : null
  }
  if (!validPickDocumentId(id)) throw new PickRequestError('invalid-pick-id', 422)
  const snapshot = await getDoc(doc(db, 'picks', id))
  return snapshot.exists() ? snapshot.data() as Pick : null
}

/** Mount/focus fallback for Pick routes. Unlike getDoc, this never treats an
 * IndexedDB snapshot as current server authority. */
export async function fetchPickFromServer(id: string): Promise<Pick | null> {
  if (isPairPrototype()) return fetchPick(id)
  if (!validPickDocumentId(id)) throw new PickRequestError('invalid-pick-id', 422)
  const snapshot = await getDocFromServer(doc(db, 'picks', id))
  return snapshot.exists() ? snapshot.data() as Pick : null
}

/** One exact Pick listener. It never lists Pick history or polls. Snapshot
 * metadata lets the caller keep cached terminal context display-only until the
 * server confirms that the current member still has access. */
export function watchPick(
  id: string,
  onUpdate: (update: PickSnapshotUpdate) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  if (isPairPrototype()) return () => undefined
  if (!validPickDocumentId(id)) {
    queueMicrotask(() => onError(new PickRequestError('invalid-pick-id', 422)))
    return () => undefined
  }
  try {
    return onSnapshot(doc(db, 'picks', id), { includeMetadataChanges: true }, snapshot => {
      onUpdate({
        pick: snapshot.exists() ? snapshot.data() as Pick : null,
        serverAuthoritative: !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites,
      })
    }, onError)
  } catch (error) {
    // Malformed route input and SDK argument errors must enter the same
    // recoverable fail-closed boundary as an asynchronous listener failure.
    queueMicrotask(() => onError(error))
    return () => undefined
  }
}

export async function createGroupPick(
  input: NewGroupPick,
  prototypeValue?: Omit<GroupPick, 'id' | 'createdBy' | 'status' | 'createdAt' | 'updatedAt'>,
): Promise<GroupPick> {
  const uid = requireUid()
  if (isPairPrototype()) {
    if (!prototypeValue) throw new Error('Missing prototype group Pick evidence.')
    const now = Date.now()
    const pick: GroupPick = {
      ...prototypeValue,
      id: `prototype-group-pick-${input.placeId}`,
      createdBy: uid,
      shareToken: `prototype-receipt-${input.placeId.replace(/[^A-Za-z0-9_-]/g, '-')}`,
      status: 'selected',
      createdAt: now,
      updatedAt: now,
    }
    storePrototypePick(pick)
    return pick
  }
  return pickPost<GroupPick>('/createGroupPick', { ...input })
}

export async function updatePickStatus(id: string, status: PickStatus): Promise<PickStatusUpdateResult> {
  if (isPairPrototype()) {
    const pick = await fetchPick(id)
    if (!pick) throw new Error('Pick not found.')
    if (pick.status === status) return { status, changed: false }
    if (!canTransitionPickStatus(pick.status, status)) throw new PickRequestError('pick-outcome-conflict', 409)
    storePrototypePick({
      ...pick,
      status,
      updatedAt: Date.now(),
      ...(status === 'dismissed' && isGroupPick(pick) ? { shareToken: undefined } : {}),
    })
    return { status, changed: true }
  }
  const ref = doc(db, 'picks', id)
  const initial = await getDoc(ref)
  if (!initial.exists()) throw new Error('Pick not found.')
  const current = initial.data() as Pick
  if (isGroupPick(current)) {
    if (current.status === status) return { status, changed: false }
    if (!canTransitionPickStatus(current.status, status)) throw new PickRequestError('pick-outcome-conflict', 409)
    return pickPost<PickStatusUpdateResult>('/closeGroupPick', { pickId: id, status })
  }
  const changed = await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists()) throw new Error('Pick not found.')
    const pick = snapshot.data() as Pick
    if (pick.status === status) return false
    if (!canTransitionPickStatus(pick.status, status)) throw new PickRequestError('pick-outcome-conflict', 409)
    transaction.update(ref, { status, updatedAt: Date.now() })
    return true
  })
  return { status, changed }
}

export function pickReceiptUrl(shareToken: string): string {
  return `${window.location.origin}/pick/${encodeURIComponent(shareToken)}`
}

export async function revokePickReceipt(pickId: string): Promise<void> {
  if (isPairPrototype()) {
    const pick = await fetchPick(pickId)
    if (!pick || !isGroupPick(pick)) throw new Error('receipt-unavailable')
    if (!pick.shareToken) return
    storePrototypePick({ ...pick, shareToken: undefined, updatedAt: Date.now() })
    return
  }
  await pickPost('/revokePickReceipt', { pickId })
}
