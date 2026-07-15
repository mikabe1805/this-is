import {
  deriveGroupCandidate,
  normalizeGroupPickPlanArea,
  validGroupAttendees,
  type ProjectedSignal,
} from './group-pick.js'

function equal(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`)
  }
}

const members = [
  { uid: 'mika', displayName: 'Mika', avatarHex: '#8E5A6B' },
  { uid: 'vivian', displayName: 'Vivian', avatarHex: '#5A6B8E' },
  { uid: 'ari', displayName: 'Ari', avatarHex: '#6B8E5A' },
]
const signal = (uid: string, tag: 'want' | 'loved', placeId = 'radio'): ProjectedSignal => ({
  uid, placeId, tag, ts: 1, permissionVersion: 2,
  memory: { placeId, label: 'Radio Bakery', category: 'coffee', hex: '#5A463C', provenance: 'user_confirmed' },
})

equal(validGroupAttendees(members.map(member => member.uid), ['mika', 'ari'], 'mika'), true, 'accepted subset')
equal(validGroupAttendees(members.map(member => member.uid), ['vivian', 'ari'], 'mika'), false, 'creator absent')

const two = deriveGroupCandidate({
  placeId: 'radio', context: 'Coffee', permissionVersion: 2,
  attendeeUids: ['mika', 'vivian'], members,
  signals: [signal('mika', 'want'), signal('vivian', 'want'), signal('ari', 'loved')],
})
equal(two?.reason, 'All 2 want this.', 'non-attendee evidence does not change the denominator')
equal(deriveGroupCandidate({
  placeId: 'radio', context: 'Coffee', permissionVersion: 2,
  attendeeUids: ['mika', 'vivian'], members,
  signals: [signal('mika', 'want'), signal('vivian', 'want')],
  excludedPlaceIds: ['radio'],
}), null, 'the server candidate boundary suppresses the current Last Pick')

const withGuest = deriveGroupCandidate({
  placeId: 'radio', context: 'Coffee', permissionVersion: 2,
  attendeeUids: ['mika', 'vivian'], members, guestCount: 1,
  signals: [signal('mika', 'want'), signal('vivian', 'want')],
})
equal(withGuest?.reason, '2 of 3 want or love this.', 'an unnamed guest stays unknown in the denominator')

const intro = deriveGroupCandidate({
  placeId: 'radio', context: 'Anything', permissionVersion: 2,
  attendeeUids: ['mika', 'vivian', 'ari'], members,
  signals: [signal('vivian', 'loved')],
})
equal(intro?.reasonCode, 'trusted_introduction', 'one explicit Love can introduce the attendees')

const stale = deriveGroupCandidate({
  placeId: 'radio', context: 'Anything', permissionVersion: 3,
  attendeeUids: ['mika', 'vivian'], members,
  signals: [signal('mika', 'want'), signal('vivian', 'want')],
})
equal(stale, null, 'stale evidence cannot create a Pick')
const quickFit = deriveGroupCandidate({
  placeId: 'radio', context: 'Coffee', permissionVersion: 2,
  attendeeUids: ['mika', 'vivian'], members,
  signals: [signal('mika', 'want')],
  preferences: [{ uid: 'vivian', categoryHints: ['coffee'], constraintHints: ['quiet'], permissionVersion: 2 }],
})
equal(quickFit?.reasonCode, 'quick_start_fit', 'one exact Want plus an independent hint forms a weak fit')
equal(quickFit?.reason, "Mika wants this; it fits Vivian's coffee hint.", 'weak fit does not claim a second Want')
const contextualSignal = {
  ...signal('mika', 'loved'),
  memory: { ...signal('mika', 'loved').memory, area: 'Cresskill, NJ' },
  observations: {
    quiet: { value: 'yes', observedAt: 2, audience: 'group', source: 'user_authored' },
    easy_parking: { value: 'no', observedAt: 2, audience: 'group', source: 'user_authored' },
  },
} satisfies ProjectedSignal
const contextual = deriveGroupCandidate({
  placeId: 'radio', context: 'Coffee', permissionVersion: 2,
  attendeeUids: ['mika', 'vivian'], members,
  signals: [signal('vivian', 'want'), contextualSignal],
  planArea: '  Cresskill  ', requiredObservation: 'quiet',
})
equal(contextual?.memory.area, 'Cresskill, NJ', 'attendee order determines the same representative memory as the client')
equal(deriveGroupCandidate({
  placeId: 'radio', context: 'Coffee', permissionVersion: 2,
  attendeeUids: ['mika', 'vivian'], members, signals: [contextualSignal, signal('vivian', 'want')],
  planArea: 'Piscataway', requiredObservation: 'quiet',
}), null, 'a Pick cannot retain a plan area its current candidate evidence does not match')
equal(deriveGroupCandidate({
  placeId: 'radio', context: 'Coffee', permissionVersion: 2,
  attendeeUids: ['mika', 'vivian'], members, signals: [contextualSignal, signal('vivian', 'want')],
  planArea: 'Cresskill', requiredObservation: 'easy_parking',
}), null, 'an attributed group-shared No prevents a practical need from entering the Pick')
equal(deriveGroupCandidate({
  placeId: 'radio', context: 'Coffee', permissionVersion: 2,
  attendeeUids: ['mika', 'vivian'], members, signals: [contextualSignal, signal('vivian', 'want')],
  requiredObservation: 'outdoors',
}), null, 'missing useful-detail evidence cannot become Pick context')
equal(normalizeGroupPickPlanArea('  東京   港区 '), '東京 港区', 'explicit Pick geography stays bounded and Unicode-safe')
equal(normalizeGroupPickPlanArea('x'.repeat(81)), null, 'overlong Pick geography fails closed')
console.log('✓ group Pick reasons are server-derived from current attendee evidence')
