import { collection, doc, getDoc, getDocFromServer, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../lib/firebaseImpl'
import { auth } from '../lib/firebaseImpl'
import {
  buildGroupCircle,
  normalizeGroupSignal,
  normalizeGroupQuickStart,
  normalizeGroupSummary,
  type GroupCircle,
  type GroupSignalProjection,
  type GroupSummary,
  type GroupQuickStartProjection,
} from '../domain/groups'
import type { GroupQuickStartCategory, GroupQuickStartConstraint } from '../domain/groupQuickStart'
import type { GroupAudienceStamp } from '../domain/groupAudience'
import { isPermissionDeniedError } from '../domain/dataState'

export interface GroupInvitePreview {
  groupId: string
  groupName: string
  invitedBy: string
  inviterName: string
  inviterAvatarHex: string
  memberCountAtCreation: number
  status: 'active' | 'accepted'
  acceptedBy?: string
  expiresAt: { toMillis(): number }
}

export class GroupRequestError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code)
  }
}

export function validGroupDocumentId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length >= 1
    && value.length <= 160
    && value === value.trim()
    && value !== '.'
    && value !== '..'
    && !value.includes('/')
    && ![...value].some(character => {
      const code = character.charCodeAt(0)
      return code <= 31 || code === 127
    })
    && !/^__.*__$/.test(value)
}

async function groupPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const user = auth.currentUser
  if (!user) throw new GroupRequestError('authentication-required', 401)
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
    throw new GroupRequestError(
      typeof payload.error === 'string' ? payload.error : 'request-failed',
      response.status,
    )
  }
  return response.json() as Promise<T>
}

export async function createGroup(name: string, creationKey: string): Promise<string> {
  return (await groupPost<{ groupId: string }>('/createGroup', { name, creationKey })).groupId
}

export async function createGroupInvite(groupId: string, creationKey: string): Promise<string> {
  return (await groupPost<{ token: string }>('/createGroupInvite', { groupId, creationKey })).token
}

export interface CreatorGroupInvite {
  token: string
  createdAt: number
  expiresAt: number
}

export async function listGroupInvites(groupId: string): Promise<CreatorGroupInvite[]> {
  return (await groupPost<{ links: CreatorGroupInvite[] }>('/listGroupInvites', { groupId })).links
}

export async function revokeGroupInvite(token: string): Promise<void> {
  await groupPost<{ revoked: true }>('/revokeGroupInvite', { token })
}

/** Watch only the one link currently shown to its creator. Once acceptance or
 * revocation makes the bounded public preview unreadable, remove the stale URL. */
export function watchGroupInviteClosure(token: string, onClosed: () => void): () => void {
  return onSnapshot(doc(db, 'groupInvites', token), snapshot => {
    if (!snapshot.exists() || snapshot.data().status !== 'active') onClosed()
  }, error => {
    if (isPermissionDeniedError(error)) onClosed()
  })
}

export async function fetchGroupInvite(token: string): Promise<GroupInvitePreview | null> {
  const snapshot = await getDoc(doc(db, 'groupInvites', token))
  return snapshot.exists() ? snapshot.data() as GroupInvitePreview : null
}

export async function acceptGroupInvite(token: string): Promise<string> {
  return (await groupPost<{ groupId: string }>('/acceptGroupInvite', { token })).groupId
}

export type SaveGroupQuickStartInput =
  | {
      groupId: string
      categoryHints?: GroupQuickStartCategory[]
      constraintHints?: GroupQuickStartConstraint[]
      action?: 'save'
      audience: GroupAudienceStamp
    }
  | {
      groupId: string
      action: 'remove'
      categoryHints?: never
      constraintHints?: never
      audience?: never
    }

export async function saveGroupQuickStart(input: SaveGroupQuickStartInput): Promise<void> {
  await groupPost<{ saved: boolean }>('/saveGroupQuickStart', input)
}

export type ShareSignalWithGroupInput =
  | {
      groupId: string
      placeId: string
      includeNote?: boolean
      includeObservations?: boolean
      action?: 'share'
      audience: GroupAudienceStamp
    }
  | {
      groupId: string
      placeId: string
      action: 'remove'
      includeNote?: never
      includeObservations?: never
      audience?: never
    }

export async function shareSignalWithGroup(input: ShareSignalWithGroupInput): Promise<boolean> {
  return (await groupPost<{ shared: boolean }>('/shareGroupSignal', input)).shared
}

export interface GroupDraftPass {
  id: string
  draftKey: string
  placeId: string
  actorUid: string
  permissionVersion: number
  createdAt: number
  expiresAt: number
}

export interface GroupDraftPassInput {
  groupId: string
  draftKey: string
  attendeeUids: string[]
  placeId: string
  context: string
  guestCount: 0 | 1
  planArea?: string
  requiredObservation?: string
  action: 'pass' | 'undo'
}

function timestampMillis(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (!value || typeof value !== 'object') return 0
  const toMillis = (value as { toMillis?: unknown }).toMillis
  if (typeof toMillis !== 'function') return 0
  const millis = Number(toMillis.call(value))
  return Number.isFinite(millis) ? millis : 0
}

function normalizeGroupDraftPass(id: string, value: unknown): GroupDraftPass | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  const createdAt = timestampMillis(data.createdAt)
  const expiresAt = timestampMillis(data.expiresAt)
  const permissionVersion = Number(data.permissionVersion)
  if (
    !/^[a-f0-9]{64}$/.test(String(data.draftKey))
    || typeof data.placeId !== 'string' || !data.placeId || data.placeId.length > 512
    || typeof data.actorUid !== 'string' || !data.actorUid || data.actorUid.length > 128
    || !Number.isSafeInteger(permissionVersion) || permissionVersion < 1
    || createdAt <= 0 || expiresAt <= Date.now()
  ) return null
  return {
    id,
    draftKey: String(data.draftKey),
    placeId: data.placeId,
    actorUid: data.actorUid,
    permissionVersion,
    createdAt,
    expiresAt,
  }
}

/** Watch exact deterministic documents rather than listing a private
 * subcollection. The recommendation surface is capped at three candidates,
 * which also caps listeners and reads. */
export function watchGroupDraftPasses(
  groupId: string,
  passIds: string[],
  onValue: (passes: GroupDraftPass[]) => void,
  onError?: (error: unknown) => void,
): () => void {
  const values = new Map<string, GroupDraftPass>()
  const settled = new Set<string>()
  let failed = false
  let expiryTimer: ReturnType<typeof window.setTimeout> | undefined
  const emit = () => {
    if (failed || settled.size !== passIds.length) return
    const now = Date.now()
    values.forEach((pass, passId) => {
      if (pass.expiresAt <= now) values.delete(passId)
    })
    onValue([...values.values()].sort((a, b) => a.createdAt - b.createdAt))
    if (expiryTimer !== undefined) window.clearTimeout(expiryTimer)
    const nextExpiry = Math.min(...[...values.values()].map(pass => pass.expiresAt))
    if (Number.isFinite(nextExpiry)) {
      expiryTimer = window.setTimeout(emit, Math.min(nextExpiry - now + 25, 2_147_483_647))
    }
  }
  if (passIds.length === 0) {
    emit()
    return () => undefined
  }
  const unsubscribes = passIds.map(passId => onSnapshot(
    doc(db, 'groups', groupId, 'draftPasses', passId),
    snapshot => {
      const pass = snapshot.exists() ? normalizeGroupDraftPass(snapshot.id, snapshot.data()) : null
      if (pass) values.set(passId, pass)
      else values.delete(passId)
      settled.add(passId)
      emit()
    },
    error => {
      failed = true
      values.delete(passId)
      onError?.(error)
    },
  ))
  return () => {
    if (expiryTimer !== undefined) window.clearTimeout(expiryTimer)
    unsubscribes.forEach(unsubscribe => unsubscribe())
  }
}

export async function updateGroupDraftPass(input: GroupDraftPassInput): Promise<void> {
  await groupPost<Record<string, unknown>>('/updateGroupDraftPass', { ...input })
}

export async function leaveGroup(groupId: string): Promise<void> {
  await groupPost<{ left: true }>('/leaveGroup', { groupId })
}

export interface GroupSignalShareState {
  groupId: string
  includeNote: boolean
  includeObservations: boolean
}

export async function fetchGroupSignalShareStates(
  groupIds: string[],
  uid: string,
  placeId: string,
): Promise<GroupSignalShareState[]> {
  const reads = await Promise.all(groupIds.map(async groupId => ({
    groupId,
    snapshot: await getDoc(doc(db, 'groups', groupId, 'signals', `${uid}__${placeId}`)),
  })))
  return reads.flatMap(read => {
    if (!read.snapshot.exists()) return []
    const data = read.snapshot.data()
    return [{
      groupId: read.groupId,
      includeNote: data.includeNote === true,
      includeObservations: data.includeObservations === true,
    }]
  })
}

export async function fetchGroups(uid: string): Promise<GroupSummary[]> {
  const snapshot = await getDocs(query(
    collection(db, 'groups'),
    where('memberUids', 'array-contains', uid),
    where('status', 'in', ['forming', 'active']),
  ))
  return snapshot.docs
    .map(item => normalizeGroupSummary(item.id, item.data()))
    .filter((group): group is GroupSummary => Boolean(group))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Read only the server-owned envelope needed to name and authorize an Add
 * audience. Taste projections and Quick start preferences stay unread. */
export async function fetchGroupAudience(groupId: string, uid: string): Promise<GroupSummary | null> {
  if (!validGroupDocumentId(groupId)) return null
  const snapshot = await getDoc(doc(db, 'groups', groupId))
  if (!snapshot.exists()) return null
  const group = normalizeGroupSummary(snapshot.id, snapshot.data())
  return group?.memberUids.includes(uid) ? group : null
}

/** Bypass the local cache only when recovering from an `audience-changed`
 * response. This keeps ordinary loading cache-friendly while ensuring a new
 * confirmation names the authoritative current members. No taste collection
 * is read. */
export async function fetchGroupAudienceFromServer(
  groupId: string,
  uid: string,
): Promise<GroupSummary | null> {
  if (!validGroupDocumentId(groupId)) return null
  const snapshot = await getDocFromServer(doc(db, 'groups', groupId))
  if (!snapshot.exists()) return null
  const group = normalizeGroupSummary(snapshot.id, snapshot.data())
  return group?.memberUids.includes(uid) ? group : null
}

export async function fetchGroup(groupId: string): Promise<GroupCircle | null> {
  const groupSnapshot = await getDoc(doc(db, 'groups', groupId))
  if (!groupSnapshot.exists()) return null
  const group = normalizeGroupSummary(groupSnapshot.id, groupSnapshot.data())
  if (!group) return null
  if (group.status === 'forming') return buildGroupCircle(group, [])
  const [signalsSnapshot, preferencesSnapshot] = await Promise.all([
    getDocs(query(
      collection(db, 'groups', groupId, 'signals'),
      where('permissionVersion', '==', group.permissionVersion),
    )),
    getDocs(query(
      collection(db, 'groups', groupId, 'preferences'),
      where('permissionVersion', '==', group.permissionVersion),
    )),
  ])
  const signals = signalsSnapshot.docs
    .map(item => normalizeGroupSignal(item.id, item.data()))
    .filter((signal): signal is GroupSignalProjection => Boolean(signal))
  const preferences = preferencesSnapshot.docs
    .map(item => normalizeGroupQuickStart(item.data()))
    .filter((preference): preference is GroupQuickStartProjection => Boolean(preference))
  return buildGroupCircle(group, signals, preferences)
}
