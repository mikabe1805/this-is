/** Write-only, privacy-minimal product evidence. Events contain no place ids,
 * notes, search text, invite tokens, names, or other-person identifiers. */
import { addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from '../lib/firebaseImpl'
import { isPairPrototype } from '../lib/prototypeMode'
import { getSession } from '../state/session'

export type ProductEventName =
  | 'onboarding_completed'
  | 'signal_saved'
  | 'invite_created'
  | 'connection_accepted'
  | 'pair_opened'
  | 'plan_viewed'
  | 'pick_created'
  | 'pick_closed'

export interface ProductEventProperties {
  signalCount?: number
  candidateCount?: number
  sharedCount?: number
  context?: 'Anything' | 'Food' | 'Drinks' | 'Coffee'
  status?: 'visited' | 'dismissed'
  tag?: 'want' | 'tried' | 'loved'
}

export const PRODUCT_EVENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

export function track(name: ProductEventName, properties: ProductEventProperties = {}): void {
  if (isPairPrototype()) return
  const session = getSession()
  if (session.status !== 'signed-in') return
  void addDoc(collection(db, 'users', session.user.uid, 'events'), {
    name,
    properties,
    schemaVersion: 1,
    ts: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + PRODUCT_EVENT_RETENTION_MS),
  }).catch(() => {
    // Evidence must never block or alter the product flow.
  })
}
