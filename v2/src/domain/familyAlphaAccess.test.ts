import {
  familyAlphaGateState,
  hasFamilyAlphaAccess,
  isFamilyAlphaRelease,
} from './familyAlphaAccess.js'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

assert(isFamilyAlphaRelease('family-alpha'), 'recognizes only the reviewed release channel')
for (const channel of [undefined, '', 'emulator', 'production', 'family-alpha-preview']) {
  assert(!isFamilyAlphaRelease(channel), `does not treat ${String(channel)} as family alpha`)
}

assert(hasFamilyAlphaAccess({ familyAlpha: true }), 'the exact boolean claim admits access')
for (const claims of [
  undefined,
  {},
  { familyAlpha: false },
  { familyAlpha: 'true' },
  { familyAlpha: 1 },
  { familyalpha: true },
]) {
  assert(!hasFamilyAlphaAccess(claims), 'missing or non-boolean claims fail closed')
}
const inheritedClaim = Object.create({ familyAlpha: true }) as Record<string, unknown>
assert(!hasFamilyAlphaAccess(inheritedClaim), 'an inherited property cannot impersonate the claim')

for (const channel of [undefined, 'emulator', 'production']) {
  for (const status of ['unknown', 'access-checking', 'access-pending', 'signed-out', 'signed-in'] as const) {
    assert(familyAlphaGateState(channel, status) === null, `${String(channel)} never renders the alpha gate`)
  }
}
assert(familyAlphaGateState('family-alpha', 'unknown') === 'checking', 'alpha starts closed')
assert(familyAlphaGateState('family-alpha', 'access-checking') === 'checking', 'claim refresh stays closed')
assert(familyAlphaGateState('family-alpha', 'access-pending') === 'pending', 'unclaimed users see pending')
assert(familyAlphaGateState('family-alpha', 'signed-out') === null, 'signed-out users can reach sign-in')
assert(familyAlphaGateState('family-alpha', 'signed-in') === null, 'approved users reach the app')

console.log('✓ family-alpha access is exact, fail-closed, and release-isolated')
