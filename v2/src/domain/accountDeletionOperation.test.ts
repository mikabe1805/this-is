import {
  clearDeletionOperationKey,
  deletionOperationStorageKey,
  getOrCreateDeletionOperationKey,
  legacyDeletionOperationStorageKey,
  type DeletionOperationStorage,
} from './accountDeletionOperation.js'

function equal(actual: unknown, expected: unknown, message = 'values differ') {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`)
}

class MemoryStorage implements DeletionOperationStorage {
  readonly values = new Map<string, string>()

  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

const storage = new MemoryStorage()
const firstKey = 'A'.repeat(43)
const secondKey = 'B'.repeat(43)
let created = 0
const create = () => [firstKey, secondKey][created++] ?? 'C'.repeat(43)

storage.setItem(legacyDeletionOperationStorageKey, 'L'.repeat(43))
equal(getOrCreateDeletionOperationKey(storage, 'account-a', create), firstKey,
  'an unowned legacy key must never become account A\'s retry capability')
equal(storage.getItem(legacyDeletionOperationStorageKey), null,
  'the unsafe legacy key is removed when an account-scoped key is created')
equal(getOrCreateDeletionOperationKey(storage, 'account-a', create), firstKey,
  'the same account reuses one stable session operation key')
equal(created, 1, 'a stable account retry must not mint another key')

equal(getOrCreateDeletionOperationKey(storage, 'account-b', create), secondKey,
  'a second account in the same tab receives a distinct operation key')
equal(getOrCreateDeletionOperationKey(storage, 'account-a', create), firstKey,
  'switching back cannot expose the second account\'s key to the first')
equal(created, 2)

equal(clearDeletionOperationKey(storage, 'account-a', secondKey), false,
  'a mismatched key cannot clear account A\'s retry')
equal(storage.getItem(deletionOperationStorageKey('account-a')), firstKey)
equal(clearDeletionOperationKey(storage, 'account-b', firstKey), false,
  'a stale account/key pair cannot clear account B\'s retry')
equal(storage.getItem(deletionOperationStorageKey('account-b')), secondKey)
equal(clearDeletionOperationKey(storage, 'account-a', firstKey), true)
equal(storage.getItem(deletionOperationStorageKey('account-a')), null)
equal(storage.getItem(deletionOperationStorageKey('account-b')), secondKey,
  'clearing account A leaves account B\'s exact retry intact')

console.log('✓ account deletion retries are stable, UID-scoped, legacy-safe, and exact-clear only')
