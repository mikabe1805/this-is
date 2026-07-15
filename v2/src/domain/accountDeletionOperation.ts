const LEGACY_STORAGE_KEY = 'this-is:v2:account-deletion-operation'
const SCOPED_STORAGE_PREFIX = `${LEGACY_STORAGE_KEY}:`
const OPERATION_KEY = /^[A-Za-z0-9_-]{43}$/

export interface DeletionOperationStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function storageKey(uid: string): string {
  if (!uid || uid.length > 128) throw new Error('invalid-account-identity')
  return `${SCOPED_STORAGE_PREFIX}${encodeURIComponent(uid)}`
}

/** One retry capability per exact signed-in account. The unscoped legacy key
 * is deliberately discarded because its owner cannot be established. */
export function getOrCreateDeletionOperationKey(
  storage: DeletionOperationStorage,
  uid: string,
  createKey: () => string,
): string {
  const key = storageKey(uid)
  const current = storage.getItem(key)
  if (current && OPERATION_KEY.test(current)) return current
  if (current) storage.removeItem(key)
  storage.removeItem(LEGACY_STORAGE_KEY)
  const created = createKey()
  if (!OPERATION_KEY.test(created)) throw new Error('invalid-deletion-operation-key')
  storage.setItem(key, created)
  return created
}

/** Clear only the capability that belongs to this UID and exact completed
 * request. A stale component can never clear another account's retry. */
export function clearDeletionOperationKey(
  storage: DeletionOperationStorage,
  uid: string,
  operationKey: string,
): boolean {
  const key = storageKey(uid)
  if (storage.getItem(key) !== operationKey) return false
  storage.removeItem(key)
  return true
}

export function deletionOperationStorageKey(uid: string): string {
  return storageKey(uid)
}

export const legacyDeletionOperationStorageKey = LEGACY_STORAGE_KEY
