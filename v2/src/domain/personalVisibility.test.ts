import { nextPersonalVisibility } from './personalVisibility.js'

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`)
}

assertEqual(nextPersonalVisibility(undefined), 'private', 'a new personal memory defaults private')
assertEqual(nextPersonalVisibility('private'), 'private', 'an existing private memory stays private')
assertEqual(nextPersonalVisibility('circle'), 'circle', 'legacy circle state is preserved until explicit cleanup')
assertEqual(nextPersonalVisibility('public'), 'private', 'unknown audience values fail closed')

console.log('✓ personal place visibility defaults private and preserves only known legacy state')
