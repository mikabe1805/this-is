import { normalizeGroupQuickStartPreference } from './groupQuickStart.js'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const preference = normalizeGroupQuickStartPreference({
  uid: 'mika', categoryHints: ['coffee'], constraintHints: ['quiet'], permissionVersion: 2,
})
assert(preference?.categoryHints[0] === 'coffee', 'bounded quick-start hints normalize')
assert(!normalizeGroupQuickStartPreference({
  uid: 'mika', categoryHints: ['drinks'], constraintHints: [], permissionVersion: 2,
}), 'sensitive nightlife hints are excluded from quick start')
assert(!normalizeGroupQuickStartPreference({
  uid: 'mika', categoryHints: [], constraintHints: [], permissionVersion: 2,
}), 'empty quick start does not manufacture evidence')
assert(!normalizeGroupQuickStartPreference({
  uid: 'mika', categoryHints: ['coffee', 'coffee'], constraintHints: [], permissionVersion: 2,
}), 'duplicate hints fail closed')

console.log('✓ group Quick start stays bounded, non-sensitive, and distinct from place signals')
