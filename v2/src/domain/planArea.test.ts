import { EXPLICIT_PLAN_AREA_MAX_LENGTH, matchesExplicitPlanArea, normalizeExplicitPlanArea } from './planArea.js'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

assert(normalizeExplicitPlanArea('  Cresskill,   NJ ') === 'Cresskill, NJ',
  'temporary area text is whitespace-normalized')
assert(matchesExplicitPlanArea('Cresskill, NJ', 'cresskill nj'),
  'punctuation and case do not prevent an explicit confirmed-area match')
assert(matchesExplicitPlanArea('Downtown Cresskill, NJ', 'Cresskill'),
  'a narrower explicit area can match a more specific confirmed place area')
assert(matchesExplicitPlanArea('東京都 渋谷区', '渋谷区'),
  'global-first matching preserves non-Latin place words')
assert(!matchesExplicitPlanArea('Piscataway, NJ', 'Cresskill'),
  'one city never silently matches another')
assert(!matchesExplicitPlanArea(undefined, 'Cresskill'),
  'missing place geography stays unknown under an active area filter')
assert(matchesExplicitPlanArea(undefined, '   '),
  'a blank draft area does not exclude candidates')
assert(normalizeExplicitPlanArea('x'.repeat(EXPLICIT_PLAN_AREA_MAX_LENGTH + 1)) === null,
  'unbounded draft geography fails closed')

console.log('✓ explicit plan area is temporary, bounded, and matched only to user-confirmed place facts')
