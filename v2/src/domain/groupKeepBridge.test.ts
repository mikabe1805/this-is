import {
  createGroupKeepShareHandoff,
  groupKeepBridgeCandidates,
  readGroupKeepShareHandoff,
  type GroupKeepBridgeSave,
} from './groupKeepBridge.js'

function equal(actual: unknown, expected: unknown, message = 'values differ') {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`)
}

function deepEqual(actual: unknown, expected: unknown, message = 'values differ') {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(message)
}

const save = (
  placeId: string,
  tag: GroupKeepBridgeSave['tag'],
  ts: number,
  category: 'food' | 'drinks' | 'coffee' | 'activity' | 'other' = 'coffee',
  area?: string,
): GroupKeepBridgeSave => ({
  placeId,
  tag,
  visibility: 'private',
  ts,
  memory: { placeId, label: placeId, category, ...(area ? { area } : {}) },
})

const ranked = groupKeepBridgeCandidates([
  save('want-newest', 'want', 100),
  save('love-older', 'loved', 10),
  save('love-newer', 'loved', 20),
  save('want-older', 'want', 90),
])
deepEqual(ranked.map(item => item.placeId), ['love-newer', 'love-older', 'want-newest'],
  'Loved must lead Want, with newest first inside each state and a hard three-place cap')

const tied = groupKeepBridgeCandidates([
  save('first-input', 'loved', 10),
  save('second-input', 'loved', 10),
  save('third-input', 'loved', 10),
])
deepEqual(tied.map(item => item.placeId), ['first-input', 'second-input', 'third-input'],
  'an exact rank tie must preserve stable input order')

const ignored = groupKeepBridgeCandidates([
  save('tried', 'tried', 500),
  { ...save('older-circle', 'loved', 450), visibility: 'circle' },
  { ...save('missing-memory', 'loved', 400), memory: undefined },
  save('wanted', 'want', 1),
])
deepEqual(ignored.map(item => item.placeId), ['wanted'],
  'Tried, older circle-visible saves, and unresolved memory cannot enter the private bridge')

const fitted = groupKeepBridgeCandidates([
  save('exact', 'loved', 1, 'coffee', 'Cresskill, NJ'),
  save('wrong-kind', 'loved', 9, 'food', 'Cresskill, NJ'),
  save('wrong-area', 'loved', 8, 'coffee', 'Piscataway, NJ'),
  save('unknown-area', 'loved', 7, 'coffee'),
], { category: 'coffee', area: 'Cresskill NJ' })
deepEqual(fitted.map(item => item.placeId), ['exact'],
  'explicit category and area must both match known memory; missing area remains unknown')

equal(groupKeepBridgeCandidates([
  save('any-known-memory', 'want', 1, 'activity'),
], {}).length, 1, 'without explicit plan category or area, any Want/Loved memory may be offered')
equal(groupKeepBridgeCandidates([save('invalid-plan', 'loved', 1)], { area: 'x'.repeat(81) }).length, 0,
  'an invalid explicit area must fail closed')

deepEqual(createGroupKeepShareHandoff('family-sunday'), {
  checkGroupShare: 'family-sunday', returnToGroup: 'family-sunday',
})
equal(createGroupKeepShareHandoff('nested/group'), null)
deepEqual(readGroupKeepShareHandoff({
  checkGroupShare: 'family-sunday', returnToGroup: 'family-sunday', extra: 'ignored',
}), { checkGroupShare: 'family-sunday', returnToGroup: 'family-sunday' })
equal(readGroupKeepShareHandoff({ checkGroupShare: 'family-sunday', returnToGroup: 'other-group' }), null,
  'a mismatched browser return target must fail closed')
equal(readGroupKeepShareHandoff({ checkGroupShare: 'family-sunday', returnToGroup: '../family-sunday' }), null)

console.log('✓ private Keep group bridge is fit-filtered, Loved-first, stable, capped, and return-bounded')
