import { doc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebaseImpl'
import { requireUid } from '../state/session'

export interface UserDoc {
  onboardedAt?: number
  /** Vibe tags chosen at onboarding — seeds the taste vector before any saves. */
  tasteSeed?: string[]
  homeCity?: string
}

export async function completeOnboarding(
  tasteSeed: string[],
  homeCityKey?: string
): Promise<void> {
  const uid = requireUid()
  await setDoc(
    doc(db, 'users', uid),
    {
      onboardedAt: Date.now(),
      tasteSeed,
      ...(homeCityKey ? { homeCity: homeCityKey } : {}),
    },
    { merge: true }
  )
}
