import { collection, getDocs, query, where } from 'firebase/firestore'
import { auth, db } from '../lib/firebaseImpl'
import { requireUid } from '../state/session'

export interface ConnectionDoc {
  id: string
  memberUids: [string, string]
  invitedBy: string
  acceptedBy: string
  inviteToken: string
  status: 'active' | 'migrated'
  migratedGroupId?: string
  createdAt?: unknown
}

/** Existing active pairs remain readable only so their members can migrate them. */
export async function fetchConnections(uid: string): Promise<ConnectionDoc[]> {
  const snap = await getDocs(query(
    collection(db, 'connections'),
    where('memberUids', 'array-contains', uid),
  ))
  return snap.docs
    .map(item => ({ id: item.id, ...(item.data() as Omit<ConnectionDoc, 'id'>) }))
    .filter(connection => connection.status === 'active')
}

export function otherConnectionUids(connections: ConnectionDoc[], uid: string): string[] {
  return connections.flatMap(connection => connection.memberUids.filter(member => member !== uid))
}

export async function migratePairToGroup(otherUid: string): Promise<string> {
  const uid = requireUid()
  if (!otherUid || otherUid === uid) throw new Error('invalid-pair')
  const user = auth.currentUser
  if (!user) throw new Error('authentication-required')
  const response = await fetch('/migratePairToGroup', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${await user.getIdToken(true)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ otherUid }),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: unknown }
    throw new Error(typeof payload.error === 'string' ? payload.error : 'migration-failed')
  }
  const payload = await response.json() as { groupId?: unknown }
  if (typeof payload.groupId !== 'string' || !payload.groupId) throw new Error('migration-failed')
  return payload.groupId
}
