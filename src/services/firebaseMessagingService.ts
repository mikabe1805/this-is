import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit as fsLimit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import type { User } from '../types'
import { firebaseDataService } from './firebaseDataService'

export interface DirectMessage {
  id: string
  senderId: string
  text: string
  createdAt: string
}

export interface MessageThread {
  id: string
  participants: string[]
  lastMessage?: string
  lastMessageAt?: string
  lastSenderId?: string
  /** Hydrated on read — the *other* participant from the viewer's POV. */
  otherUser?: User | null
}

/**
 * Deterministic 1:1 thread id from a pair of user ids. Sorting guarantees
 * (alice, bob) and (bob, alice) collapse to the same thread. This avoids
 * the "two ghost threads exist for the same conversation" race that pops
 * up when both users open each other's profile at once.
 */
function threadIdFor(a: string, b: string): string {
  return [a, b].sort().join('__')
}

class FirebaseMessagingService {
  /**
   * Find or create a 1:1 thread between two users. Idempotent — calling
   * twice returns the same thread id. Doesn't write a message, just makes
   * the thread row exist so the inbox can display it.
   */
  async getOrCreateThread(currentUserId: string, otherUserId: string): Promise<string | null> {
    if (!currentUserId || !otherUserId || currentUserId === otherUserId) return null
    const id = threadIdFor(currentUserId, otherUserId)
    const ref = doc(db, 'threads', id)
    try {
      const snap = await getDoc(ref)
      if (!snap.exists()) {
        await setDoc(ref, {
          id,
          participants: [currentUserId, otherUserId].sort(),
          createdAt: Timestamp.now(),
          // Seed lastMessageAt so the new thread is visible in the inbox query
          // (which orders by lastMessageAt and would otherwise EXCLUDE a doc
          // missing the field — making freshly-started conversations vanish
          // from the list until the first message).
          lastMessageAt: Timestamp.now(),
        })
      }
      return id
    } catch (e) {
      console.error('[messaging] getOrCreateThread failed', e, '(if permission-denied: check Firebase Auth session; if failed-precondition: deploy the threads composite index — npm run db:deploy-indexes)')
      return null
    }
  }

  /**
   * Send a text message in a thread. Updates the thread doc's lastMessage
   * pointer in the same atomic-ish flow so the inbox sort stays correct.
   */
  async sendMessage(threadId: string, senderId: string, text: string): Promise<DirectMessage | null> {
    const trimmed = text.trim()
    if (!threadId || !senderId || !trimmed) return null
    try {
      const messagesRef = collection(db, 'threads', threadId, 'messages')
      const created = await addDoc(messagesRef, {
        senderId,
        text: trimmed,
        createdAt: serverTimestamp(),
      })
      // Update the thread's denormalized "last message" fields so the inbox
      // can render previews without having to load each thread's messages.
      try {
        await updateDoc(doc(db, 'threads', threadId), {
          lastMessage: trimmed.slice(0, 240),
          lastMessageAt: Timestamp.now(),
          lastSenderId: senderId,
        })
      } catch (e) {
        console.warn('[messaging] thread metadata update failed', e)
      }
      return {
        id: created.id,
        senderId,
        text: trimmed,
        createdAt: new Date().toISOString(),
      }
    } catch (e) {
      // Surface the Firestore error code so failures are diagnosable instead
      // of a generic "couldn't send" (permission-denied = auth/rules,
      // not-found = thread missing, failed-precondition = missing index).
      console.error('[messaging] sendMessage failed:', (e as { code?: string })?.code || e)
      return null
    }
  }

  /**
   * Inbox list — every thread the user is a participant in, newest first.
   * Hydrates `otherUser` so the list can show avatar + name without N+1.
   */
  private mapThreadDoc(d: { id: string; data: () => Record<string, unknown> }): MessageThread {
    const data = d.data()
    const participants = Array.isArray(data.participants) ? (data.participants as string[]) : []
    const lastMessageAtRaw = data.lastMessageAt as { toDate?: () => Date } | string | undefined
    const lastMessageAt = lastMessageAtRaw && typeof (lastMessageAtRaw as { toDate?: () => Date }).toDate === 'function'
      ? (lastMessageAtRaw as { toDate: () => Date }).toDate().toISOString()
      : (typeof lastMessageAtRaw === 'string' ? lastMessageAtRaw : undefined)
    return {
      id: d.id,
      participants,
      lastMessage: data.lastMessage as string | undefined,
      lastMessageAt,
      lastSenderId: data.lastSenderId as string | undefined,
    } as MessageThread
  }

  // Hydrate the "other user" for each thread so the UI can render it without a
  // per-row fetch. Threads with only the current user get otherUser = null.
  private async hydrateOtherUsers(rows: MessageThread[], currentUserId: string): Promise<MessageThread[]> {
    const otherIds = Array.from(new Set(
      rows.flatMap(t => t.participants.filter(uid => uid !== currentUserId))
    ))
    const users = await Promise.all(
      otherIds.map(uid => firebaseDataService.getCurrentUser(uid).catch(() => null))
    )
    const userById = new Map<string, User | null>()
    otherIds.forEach((uid, i) => userById.set(uid, users[i]))
    return rows.map(t => {
      const otherId = t.participants.find(uid => uid !== currentUserId)
      return { ...t, otherUser: otherId ? userById.get(otherId) || null : null }
    })
  }

  async listMyThreads(currentUserId: string): Promise<MessageThread[]> {
    if (!currentUserId) return []
    try {
      const q = query(
        collection(db, 'threads'),
        where('participants', 'array-contains', currentUserId),
        orderBy('lastMessageAt', 'desc'),
        fsLimit(50),
      )
      const snap = await getDocs(q)
      const rows = snap.docs.map(d => this.mapThreadDoc(d))
      return this.hydrateOtherUsers(rows, currentUserId)
    } catch (e) {
      // Most likely a missing composite index — log loudly so the dev sees
      // the auto-create link in the console, then return empty so the UI
      // falls back to its empty state instead of throwing.
      console.error('[messaging] listMyThreads failed (often: missing index)', e)
      return []
    }
  }

  /**
   * Live inbox. Mirrors listMyThreads but via onSnapshot so the thread list,
   * last-message previews, and ordering update the instant a message is sent
   * or received — instead of going stale until the user navigates away and
   * back. Returns an unsubscribe fn for the caller's effect cleanup.
   */
  subscribeMyThreads(currentUserId: string, onChange: (threads: MessageThread[]) => void): () => void {
    if (!currentUserId) return () => {}
    const q = query(
      collection(db, 'threads'),
      where('participants', 'array-contains', currentUserId),
      orderBy('lastMessageAt', 'desc'),
      fsLimit(50),
    )
    // Latest-snapshot-wins guard: async hydration means an older snapshot's
    // resolve could land after a newer one. Drop stale results.
    let seq = 0
    return onSnapshot(q, async snap => {
      const mySeq = ++seq
      const rows = snap.docs.map(d => this.mapThreadDoc(d))
      const hydrated = await this.hydrateOtherUsers(rows, currentUserId)
      if (mySeq === seq) onChange(hydrated)
    }, e => {
      console.error('[messaging] subscribeMyThreads failed (often: missing index)', e)
    })
  }

  /**
   * Live-subscribe to messages in a thread. Returns an unsubscribe fn the
   * caller stores in a ref / cleanup. Order is oldest → newest so the UI
   * can append at the bottom.
   */
  subscribeMessages(threadId: string, onChange: (messages: DirectMessage[]) => void): () => void {
    if (!threadId) return () => {}
    const q = query(
      collection(db, 'threads', threadId, 'messages'),
      orderBy('createdAt', 'asc'),
    )
    return onSnapshot(q, snap => {
      const messages = snap.docs.map(d => {
        const data = d.data() as Record<string, unknown>
        const ts = data.createdAt as { toDate?: () => Date } | undefined
        const createdAt = ts && typeof ts.toDate === 'function'
          ? ts.toDate().toISOString()
          : new Date().toISOString()
        return {
          id: d.id,
          senderId: (data.senderId as string) || '',
          text: (data.text as string) || '',
          createdAt,
        } as DirectMessage
      })
      onChange(messages)
    }, e => {
      // Don't blank the conversation on a transient listener error — keep
      // whatever was last rendered. A permission-denied here usually means the
      // auth session lapsed; failed-precondition means a missing index.
      console.error('[messaging] subscribeMessages failed', (e as { code?: string })?.code || e)
    })
  }

  threadIdFor(a: string, b: string): string {
    return threadIdFor(a, b)
  }
}

export const firebaseMessagingService = new FirebaseMessagingService()
