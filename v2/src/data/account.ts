import { auth } from '../lib/firebaseImpl'
import {
  clearDeletionOperationKey,
  getOrCreateDeletionOperationKey,
} from '../domain/accountDeletionOperation'

export class AccountRequestError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code)
  }
}

async function ownerPost(path: string, body: Record<string, unknown> = {}): Promise<Response> {
  const user = auth.currentUser
  if (!user) throw new AccountRequestError('authentication-required', 401)
  const token = await user.getIdToken(true)
  return fetch(path, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

const volatileDeletionOperationKeys = new Map<string, string>()

function newDeletionOperationKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function accountDeletionOperationKey(uid: string): string {
  let candidate = volatileDeletionOperationKeys.get(uid)
  const createKey = () => {
    candidate ??= newDeletionOperationKey()
    return candidate
  }
  try {
    const operationKey = getOrCreateDeletionOperationKey(window.sessionStorage, uid, createKey)
    volatileDeletionOperationKeys.set(uid, operationKey)
    return operationKey
  } catch {
    const operationKey = createKey()
    volatileDeletionOperationKeys.set(uid, operationKey)
    return operationKey
  }
}

export function clearAccountDeletionOperation(uid: string, operationKey: string): void {
  try { clearDeletionOperationKey(window.sessionStorage, uid, operationKey) } catch { /* best effort after confirmation */ }
  if (volatileDeletionOperationKeys.get(uid) === operationKey) {
    volatileDeletionOperationKeys.delete(uid)
  }
}

/** A late deletion response may outlive the Settings session that started it.
 * Read Firebase Auth directly so an access-checking replacement account is
 * protected even when the public session store intentionally hides its UID. */
export function deletionCompletionStillBelongsTo(uid: string): boolean {
  const currentUser = auth.currentUser
  return currentUser === null || currentUser.uid === uid
}

async function errorFrom(response: Response): Promise<AccountRequestError> {
  const payload = await response.json().catch(() => ({})) as { error?: unknown }
  return new AccountRequestError(
    typeof payload.error === 'string' ? payload.error : 'request-failed',
    response.status,
  )
}

export async function exportMyData(): Promise<Record<string, unknown>> {
  const response = await ownerPost('/exportMyData')
  if (!response.ok) throw await errorFrom(response)
  return response.json() as Promise<Record<string, unknown>>
}

export async function deleteMyAccount(operationKey: string, expectedUid: string): Promise<void> {
  let token: string | null = null
  const userBeforeToken = auth.currentUser
  if (userBeforeToken && userBeforeToken.uid !== expectedUid) {
    throw new AccountRequestError('account-changed', 409)
  }
  try { token = await userBeforeToken?.getIdToken(true) ?? null } catch { /* the operation key can confirm a completed deletion */ }
  const userAfterToken = auth.currentUser
  if (userAfterToken && userAfterToken.uid !== expectedUid) {
    throw new AccountRequestError('account-changed', 409)
  }
  const response = await fetch('/deleteMyAccount', {
    method: 'POST',
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ confirmation: 'DELETE', operationKey }),
  })
  if (!response.ok) throw await errorFrom(response)
}
