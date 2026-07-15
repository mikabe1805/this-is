import {
  CANONICAL_EXPORT_SECTIONS,
  hasRecentAuthentication,
  portable,
} from './account-data.js'

function equal(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`)
  }
}

equal(hasRecentAuthentication(800, 1_000), true, 'recent authentication accepted')
equal(hasRecentAuthentication(699, 1_000), false, 'stale authentication rejected')
equal(hasRecentAuthentication(1_001, 1_000), false, 'future authentication rejected')
console.log('✓ destructive actions require authentication from the last five minutes')

equal(portable({ ts: { toDate: () => new Date('2026-07-11T00:00:00.000Z') }, nested: [1, true] }), {
  ts: '2026-07-11T00:00:00.000Z', nested: [1, true],
}, 'portable export')
console.log('✓ Firestore timestamp-like values become portable ISO JSON')

equal(CANONICAL_EXPORT_SECTIONS, [
  'profile', 'saves', 'connections', 'groups', 'groupSignals', 'groupPreferences', 'groupInvites', 'picks', 'pickReceipts', 'invites', 'events',
], 'canonical export coverage')
console.log('✓ export coverage names every canonical personal-data surface')
