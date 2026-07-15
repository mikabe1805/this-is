import { isPermissionDeniedError } from './dataState.js'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

assert(isPermissionDeniedError({ code: 'permission-denied' }), 'accepts Firestore code')
assert(isPermissionDeniedError({ code: 'firestore/permission-denied' }), 'accepts namespaced code')
assert(!isPermissionDeniedError({ code: 'unavailable' }), 'does not confuse outage with privacy')
assert(!isPermissionDeniedError(new Error('permission denied')), 'does not infer privacy from prose')

console.log('✓ backend permission failures map to the privacy recovery state')
