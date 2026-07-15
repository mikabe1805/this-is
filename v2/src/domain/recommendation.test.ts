import type { FriendSave, Tag } from './signals.js'
import {
  buildPairEvidence,
  buildPairRecommendations,
  fitsPlanContext,
} from './recommendation.js'

function save(
  uid: string,
  placeId: string,
  tag: Tag,
  ts: number,
  primaryType = 'restaurant'
): FriendSave {
  return {
    id: `${uid}__${placeId}`,
    uid,
    placeId,
    tag,
    visibility: 'circle',
    ts,
    place: { name: placeId, primaryType, hex: '#4A3038' },
  }
}

function equal<T>(actual: T, expected: T, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nexpected ${JSON.stringify(expected)}\nreceived ${JSON.stringify(actual)}`)
  }
}

function test(name: string, run: () => void) {
  run()
  console.log(`✓ ${name}`)
}

test('shared future intent leads reciprocal introductions', () => {
  const mine = [save('me', 'shared', 'want', 1), save('me', 'mine-love', 'loved', 8)]
  const theirs = [save('friend', 'shared', 'want', 2), save('friend', 'their-love', 'loved', 9)]
  const result = buildPairRecommendations({ mine, theirs, friendName: 'Vivian' })
  equal(result.map(item => item.save.placeId), ['shared', 'their-love', 'mine-love'], 'candidate order')
  equal(result.map(item => item.reasonCode), ['both_want', 'their_love', 'my_love'], 'reason codes')
})

test('a Love plus a Want produces the specific true reason', () => {
  const result = buildPairRecommendations({
    mine: [save('me', 'bistro', 'want', 1)],
    theirs: [save('friend', 'bistro', 'loved', 2)],
    friendName: 'Vivian',
  })
  equal(result[0]?.reason, 'Vivian loved this, and you want to go.', 'specific explanation')
})

test('missing data stays unknown rather than becoming shared evidence', () => {
  const evidence = buildPairEvidence([], [save('friend', 'solo-want', 'want', 1)])
  equal(evidence.shared.length, 0, 'no false overlap')
  equal(
    buildPairRecommendations({ mine: [], theirs: [save('friend', 'solo-want', 'want', 1)], friendName: 'Vivian' }),
    [],
    'a lone Want is not consensus or a trusted introduction'
  )
})

test('private signals never become pair evidence', () => {
  const privateSave = { ...save('friend', 'secret', 'loved', 2), visibility: 'private' as const }
  const evidence = buildPairEvidence([save('me', 'secret', 'want', 1)], [privateSave])
  equal(evidence.shared.length, 0, 'private overlap is excluded')
  equal(evidence.theirIntroductions.length, 0, 'private introduction is excluded')
})

test('context filtering uses type and keeps bakery useful for food and coffee', () => {
  const bakery = save('me', 'bakery', 'loved', 1, 'bakery')
  equal(fitsPlanContext(bakery, 'Food'), true, 'bakery is food')
  equal(fitsPlanContext(bakery, 'Coffee'), true, 'bakery is coffee-adjacent')
  equal(fitsPlanContext(bakery, 'Drinks'), false, 'bakery is not drinks')
})

test('duplicate saves collapse to the newest explicit signal', () => {
  const evidence = buildPairEvidence(
    [save('me', 'duplicate', 'want', 1), save('me', 'duplicate', 'loved', 3)],
    [save('friend', 'duplicate', 'want', 2)]
  )
  equal(evidence.shared.length, 1, 'one shared place')
  equal(evidence.shared[0]?.mine.tag, 'loved', 'newest state wins')
})

test('limit is an explicit product constraint', () => {
  const mine = ['a', 'b', 'c', 'd'].map((id, index) => save('me', id, 'want', index))
  const theirs = ['a', 'b', 'c', 'd'].map((id, index) => save('friend', id, 'want', index))
  equal(buildPairRecommendations({ mine, theirs, friendName: 'Vivian', limit: 3 }).length, 3, 'three max')
})
