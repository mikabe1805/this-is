import {
  buildGroupRecommendations,
  quickStartRecoveryCategories,
  sparseGroupRecovery,
  type GroupMemberTaste,
} from './groupRecommendation.js'
import { SHARED_PLACE_NOTE_MAX_LENGTH, type FriendSave, type Tag } from './signals.js'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

function signal(uid: string, placeId: string, tag: Tag, ts = 1): FriendSave {
  return {
    id: `${uid}__${placeId}`,
    uid,
    placeId,
    tag,
    visibility: 'circle',
    ts,
    memory: { placeId, label: placeId, category: 'food', hex: '#704739', provenance: 'user_confirmed' },
    place: { name: placeId, primaryType: 'restaurant', hex: '#49352f' },
  }
}

const members: GroupMemberTaste[] = [
  { uid: 'a', name: 'Ari', saves: [signal('a', 'shared', 'want'), signal('a', 'intro', 'loved')] },
  { uid: 'b', name: 'Bo', saves: [signal('b', 'shared', 'want')] },
  { uid: 'c', name: 'Cam', saves: [signal('c', 'shared', 'want')] },
  { uid: 'd', name: 'Dev', saves: [] },
]

const result = buildGroupRecommendations({ members })
assert(result[0]?.save.placeId === 'shared', 'broad group support leads')
assert(result[0]?.reason === '3 of 4 want or love this.', 'reason states exact support rather than consensus')
assert(result[1]?.reason.includes('3 people haven’t weighed in'), 'single Love exposes missing evidence')
const withoutRecent = buildGroupRecommendations({ members, excludePlaceIds: ['shared'] })
assert(!withoutRecent.some(candidate => candidate.save.placeId === 'shared'),
  'a recent Pick is suppressed from the next bounded shortlist')
assert(withoutRecent[0]?.save.placeId === 'intro', 'recent-Pick suppression preserves the next truthful candidate')

const singleWant = buildGroupRecommendations({
  members: [
    { uid: 'a', name: 'Ari', saves: [signal('a', 'suggested', 'want')] },
    { uid: 'b', name: 'Bo', saves: [] },
  ],
})
assert(singleWant.length === 0, 'one Want without independent support cannot become a group candidate')

assert(quickStartRecoveryCategories({
  memberUid: 'a',
  members: [
    { uid: 'a', name: 'Ari', saves: [signal('a', 'own-want', 'want')] },
    { uid: 'b', name: 'Bo', saves: [] },
  ],
}).length === 0, 'Quick start never pretends a person can corroborate their own Want')
assert(quickStartRecoveryCategories({
  memberUid: 'b',
  members: [
    { uid: 'a', name: 'Ari', saves: [signal('a', 'other-want', 'want')] },
    { uid: 'b', name: 'Bo', saves: [] },
  ],
}).join() === 'food', 'Quick start recovery appears when this member can help another member’s lone Want')
assert(quickStartRecoveryCategories({
  memberUid: 'b',
  members: [
    { uid: 'a', name: 'Ari', saves: [signal('a', 'recent-want', 'want')] },
    { uid: 'b', name: 'Bo', saves: [] },
  ],
  excludePlaceIds: ['recent-want'],
}).length === 0, 'Quick start recovery cannot revive the recent Pick')
assert(quickStartRecoveryCategories({
  memberUid: 'b',
  members: [
    { uid: 'a', name: 'Ari', saves: [signal('a', 'vetoed-want', 'want')] },
    { uid: 'b', name: 'Bo', saves: [], vetoPlaceIds: ['vetoed-want'] },
  ],
}).length === 0, 'Quick start recovery cannot bypass an explicit veto')

const answerableRecovery = sparseGroupRecovery({
  memberUid: 'b',
  members: [
    { uid: 'a', name: 'Ari Lane', saves: [{
      ...signal('a', 'coffee-want', 'want', 4),
      memory: { ...signal('a', 'coffee-want', 'want').memory!, label: 'Nightjar', category: 'coffee' },
    }] },
    { uid: 'b', name: 'Bo', saves: [] },
  ],
})
assert(answerableRecovery.kind === 'answerable_want'
  && answerableRecovery.authorName === 'Ari'
  && answerableRecovery.placeLabel === 'Nightjar'
  && answerableRecovery.category === 'coffee',
'another memberâ€™s lone Want becomes one explicit, independently answerable recovery')
const ownRecovery = sparseGroupRecovery({
  memberUid: 'a',
  members: [
    { uid: 'a', name: 'Ari', saves: [signal('a', 'own-want', 'want')] },
    { uid: 'b', name: 'Bo', saves: [] },
  ],
})
assert(ownRecovery.kind === 'own_want' && ownRecovery.placeLabel === 'own-want',
'a person is asked to review rather than corroborate their own Want')
assert(sparseGroupRecovery({
  memberUid: 'b',
  members: [
    { uid: 'a', name: 'Ari', saves: [signal('a', 'tried-only', 'tried')] },
    { uid: 'b', name: 'Bo', saves: [] },
  ],
}).kind === 'memory_only', 'Tried-only sharing is explained as memory rather than recommendation support')
assert(sparseGroupRecovery({
  memberUid: 'b',
  members: [
    { uid: 'a', name: 'Ari', saves: [signal('a', 'recent-want', 'want')] },
    { uid: 'b', name: 'Bo', saves: [] },
  ],
  excludePlaceIds: ['recent-want'],
}).kind === 'generic', 'a recent Pick never becomes a sparse recovery target or a false Tried-only explanation')

const memoryOnlySignal = signal('a', 'canonical-only', 'loved')
delete memoryOnlySignal.place
const memoryOnlyResult = buildGroupRecommendations({
  members: [
    { uid: 'a', name: 'Ari', saves: [memoryOnlySignal] },
    { uid: 'b', name: 'Bo', saves: [] },
  ],
})
assert(memoryOnlyResult[0]?.save.memory?.label === 'canonical-only',
  'canonical group memory remains eligible without a compatibility place snapshot')

const areaResult = buildGroupRecommendations({
  members: [
    { uid: 'a', name: 'Ari', saves: [
      { ...signal('a', 'cresskill', 'loved', 2), memory: { ...signal('a', 'cresskill', 'loved').memory!, area: 'Cresskill, NJ' } },
      { ...signal('a', 'piscataway', 'loved', 3), memory: { ...signal('a', 'piscataway', 'loved').memory!, area: 'Piscataway, NJ' } },
      signal('a', 'unknown-area', 'loved', 4),
    ] },
    { uid: 'b', name: 'Bo', saves: [] },
  ],
  explicitPlanArea: 'cresskill nj',
})
assert(areaResult.length === 1 && areaResult[0]?.save.placeId === 'cresskill',
  'an explicit plan area admits only matching user-confirmed place geography')

const noteResult = buildGroupRecommendations({
  members: [
    { uid: 'a', name: 'Ari Lane', saves: [{ ...signal('a', 'noted', 'loved', 2), note: '  Quiet enough\n to actually talk.  ' }] },
    { uid: 'b', name: 'Bo', saves: [{ ...signal('b', 'noted', 'want', 3), note: 'Bo only wants this.' }] },
  ],
})
assert(noteResult[0]?.sharedNote?.authorName === 'Ari', 'a shared candidate note is attributed by member first name')
assert(noteResult[0]?.sharedNote?.text === 'Quiet enough to actually talk.', 'shared note whitespace is bounded for display')
const longNoteResult = buildGroupRecommendations({ members: [
  { uid: 'a', name: 'Ari', saves: [{ ...signal('a', 'long-note', 'loved'), note: 'x'.repeat(280) }] },
  { uid: 'b', name: 'Bo', saves: [] },
] })
assert(longNoteResult[0]?.sharedNote?.text.length === SHARED_PLACE_NOTE_MAX_LENGTH
  && longNoteResult[0]?.sharedNote?.text.endsWith('…'),
'a longer private note becomes one explicitly bounded candidate detail')

const observationResult = buildGroupRecommendations({
  members: [
    { uid: 'a', name: 'Ari Lane', saves: [{ ...signal('a', 'observed', 'loved'), observations: {
      quiet: { value: 'yes', observedAt: 10, audience: 'group', source: 'user_authored' },
      easy_parking: { value: 'yes', observedAt: 11, audience: 'group', source: 'user_authored' },
    } }] },
    { uid: 'b', name: 'Bo Reed', saves: [{ ...signal('b', 'observed', 'tried'), observations: {
      quiet: { value: 'no', observedAt: 12, audience: 'group', source: 'user_authored' },
    } }] },
  ],
})
const quietObservation = observationResult[0]?.sharedObservations?.[0]
assert(quietObservation?.label === 'Quiet enough to talk', 'group-shared observations enrich a known candidate')
assert(quietObservation?.yesNames.join() === 'Ari' && quietObservation.noNames.join() === 'Bo',
  'conflicting member observations remain attributed disagreement')
assert(observationResult[0]?.supportCount === 1 && observationResult[0]?.reason.includes('1 person hasn’t weighed in'),
  'a Tried observer enriches detail without becoming recommendation support')
const parkingRequired = buildGroupRecommendations({
  members: [
    { uid: 'a', name: 'Ari Lane', saves: [{ ...signal('a', 'observed', 'loved'), observations: {
      quiet: { value: 'yes', observedAt: 10, audience: 'group', source: 'user_authored' },
      easy_parking: { value: 'yes', observedAt: 11, audience: 'group', source: 'user_authored' },
    } }] },
    { uid: 'b', name: 'Bo Reed', saves: [{ ...signal('b', 'observed', 'tried'), observations: {
      quiet: { value: 'no', observedAt: 12, audience: 'group', source: 'user_authored' },
    } }] },
  ],
  requiredObservation: 'easy_parking',
})
assert(parkingRequired.length === 1 && parkingRequired[0]?.sharedObservations?.[0]?.key === 'easy_parking',
  'a requirement with one attributed yes and no conflicting no qualifies and remains visible first')
assert(buildGroupRecommendations({
  members: [
    { uid: 'a', name: 'Ari', saves: [{ ...signal('a', 'observed', 'loved'), observations: {
      quiet: { value: 'yes', observedAt: 10, audience: 'group', source: 'user_authored' },
    } }] },
    { uid: 'b', name: 'Bo', saves: [{ ...signal('b', 'observed', 'tried'), observations: {
      quiet: { value: 'no', observedAt: 12, audience: 'group', source: 'user_authored' },
    } }] },
  ],
  requiredObservation: 'quiet',
}).length === 0, 'an explicit no makes a practical requirement fail closed instead of averaging disagreement')
assert(buildGroupRecommendations({
  members: [
    { uid: 'a', name: 'Ari', saves: [signal('a', 'missing-detail', 'loved')] },
    { uid: 'b', name: 'Bo', saves: [] },
  ],
  requiredObservation: 'outdoors',
}).length === 0, 'missing useful-detail evidence never satisfies a plan requirement')
assert(buildGroupRecommendations({ members: [
  { uid: 'a', name: 'Ari', saves: [{ ...signal('a', 'tried-only', 'tried'), observations: {
    quiet: { value: 'yes', observedAt: 12, audience: 'group', source: 'user_authored' },
  } }] },
  { uid: 'b', name: 'Bo', saves: [] },
] }).length === 0, 'Tried observations alone cannot manufacture an eligible candidate')

const plainSuggestion = {
  ...signal('a', 'plain', 'want', 100),
  memory: { ...signal('a', 'plain', 'want').memory!, category: 'activity' as const },
  place: { name: 'plain', primaryType: 'activity', hex: '#49352f' },
}
const hintedSuggestion = signal('a', 'hinted', 'want', 1)
const hintStrength = buildGroupRecommendations({
  members: [
    { uid: 'a', name: 'Ari', saves: [plainSuggestion, hintedSuggestion] },
    { uid: 'b', name: 'Bo', saves: [], quickStart: {
      uid: 'b', categoryHints: ['food'], constraintHints: [], permissionVersion: 1,
    } },
  ],
})
assert(hintStrength[0]?.save.placeId === 'hinted' && hintStrength[0]?.reasonCode === 'quick_start_fit',
  'one exact signal plus another member hint admits the supported weak fit')
assert(hintStrength.length === 1, 'a newer lone Want remains ineligible beside an admitted weak fit')

const withGuest = buildGroupRecommendations({ members, guestCount: 1 })
assert(withGuest[0]?.reason === '3 of 5 want or love this.', 'one guest is counted as unknown rather than support')
assert(withGuest[0]?.totalMembers === 5, 'guest enters the plan denominator without becoming a member')

const vetoed = buildGroupRecommendations({
  members: members.map(member => member.uid === 'd' ? { ...member, vetoPlaceIds: ['shared'] } : member),
})
assert(!vetoed.some(candidate => candidate.save.placeId === 'shared'), 'one explicit veto removes a place')

const unanimous = buildGroupRecommendations({
  members: members.map(member => ({ ...member, saves: [signal(member.uid, 'all', 'want')] })),
})
assert(unanimous[0]?.reason === 'All 4 want this.', 'unanimity is named only when everyone supplied it')

const many = buildGroupRecommendations({
  members: members.map(member => ({
    ...member,
    saves: ['a', 'b', 'c', 'd'].map((place, index) => signal(member.uid, place, 'want', index)),
  })),
})
assert(many.length === 3, 'group result is capped at three')

let rejected = false
try {
  buildGroupRecommendations({ members: [members[0]] })
} catch {
  rejected = true
}
assert(rejected, 'unsupported group sizes fail explicitly')

let oversizedRejected = false
try {
  buildGroupRecommendations({
    members: Array.from({ length: 7 }, (_, index) => ({ uid: `u${index}`, name: `U${index}`, saves: [] })),
  })
} catch {
  oversizedRejected = true
}
assert(oversizedRejected, 'groups larger than six fail explicitly')

let duplicateRejected = false
try {
  buildGroupRecommendations({ members: [members[0], { ...members[1], uid: members[0].uid }] })
} catch {
  duplicateRejected = true
}
assert(duplicateRejected, 'duplicate members fail explicitly')

const privateSignal = { ...signal('a', 'private-place', 'loved'), visibility: 'private' as const, note: 'Secret context' }
const privateResult = buildGroupRecommendations({
  members: [
    { uid: 'a', name: 'Ari', saves: [privateSignal] },
    { uid: 'b', name: 'Bo', saves: [signal('b', 'private-place', 'want')] },
  ],
})
assert(privateResult.length === 0, 'private evidence cannot supply the independent support a lone group Want needs')

const quickFit = buildGroupRecommendations({
  members: [
    { uid: 'a', name: 'Ari', saves: [signal('a', 'hint-fit', 'want')] },
    { uid: 'b', name: 'Bo', saves: [], quickStart: {
      uid: 'b', categoryHints: ['food'], constraintHints: ['casual'], permissionVersion: 1,
    } },
  ],
})
assert(quickFit[0]?.reasonCode === 'quick_start_fit', 'one exact Want plus an independent broad hint can form a weak fit')
assert(quickFit[0]?.reason === "Ari wants this; it fits Bo's food hint.", 'weak fit names the real signal and the non-signal hint')
assert(buildGroupRecommendations({
  members: [
    { uid: 'a', name: 'Ari', saves: [] },
    { uid: 'b', name: 'Bo', saves: [], quickStart: {
      uid: 'b', categoryHints: ['food'], constraintHints: [], permissionVersion: 1,
    } },
  ],
}).length === 0, 'a Quick start hint alone cannot invent a place or support')

const legacyProviderSignal = { ...signal('a', 'legacy', 'loved') }
delete legacyProviderSignal.memory
const legacyResult = buildGroupRecommendations({
  members: [
    { uid: 'a', name: 'Ari', saves: [legacyProviderSignal] },
    { uid: 'b', name: 'Bo', saves: [signal('b', 'legacy', 'want')] },
  ],
})
assert(legacyResult.length === 0, 'unconfirmed legacy provider data cannot supply the independent support a lone Want needs')

const coffee = {
  ...signal('a', 'coffee', 'want'),
  memory: { ...signal('a', 'coffee', 'want').memory!, category: 'coffee' as const, hex: '#5A463C' },
  place: { name: 'coffee', primaryType: 'coffee_shop', hex: '#49352f' },
}
const contextResult = buildGroupRecommendations({
  members: [
    { uid: 'a', name: 'Ari', saves: [coffee, signal('a', 'dinner', 'want')] },
    { uid: 'b', name: 'Bo', saves: [{ ...coffee, uid: 'b', id: 'b__coffee' }, signal('b', 'dinner', 'want')] },
  ],
  context: 'Coffee',
})
assert(contextResult.length === 1 && contextResult[0]?.save.placeId === 'coffee', 'context filtering is explicit')

const intentOrder = buildGroupRecommendations({
  members: [
    { uid: 'a', name: 'Ari', saves: [signal('a', 'wanted', 'want'), signal('a', 'loved', 'loved')] },
    { uid: 'b', name: 'Bo', saves: [signal('b', 'wanted', 'want'), signal('b', 'loved', 'loved')] },
  ],
})
assert(intentOrder[0]?.save.placeId === 'wanted', 'current Want intent leads Loved when breadth ties')

const tied = buildGroupRecommendations({
  members: [
    { uid: 'a', name: 'Ari', saves: [signal('a', 'z-place', 'want'), signal('a', 'a-place', 'want')] },
    { uid: 'b', name: 'Bo', saves: [signal('b', 'z-place', 'want'), signal('b', 'a-place', 'want')] },
  ],
})
assert(tied.map(candidate => candidate.save.placeId).join(',') === 'a-place,z-place', 'ties are deterministic')

const relocated = members.map((member, memberIndex) => ({
  ...member,
  saves: member.saves.map((save, saveIndex) => ({
    ...save,
    place: save.place ? {
      ...save.place,
      neighborhood: memberIndex % 2 ? 'Cresskill' : 'Piscataway',
      lat: 40 + memberIndex,
      lng: -74 - saveIndex,
    } : undefined,
  })),
}))
const relocatedResult = buildGroupRecommendations({ members: relocated })
assert(
  relocatedResult.map(candidate => `${candidate.save.placeId}:${candidate.reason}`).join('|')
    === result.map(candidate => `${candidate.save.placeId}:${candidate.reason}`).join('|'),
  'neighborhood and coordinates never alter group ranking or explanations',
)

console.log('✓ group recommendations preserve support, uncertainty, vetoes, location neutrality, and the three-place limit')
