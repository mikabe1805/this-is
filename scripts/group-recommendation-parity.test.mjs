import { strict as assert } from 'node:assert'

import { buildGroupRecommendations } from '../v2/.domain-test/domain/groupRecommendation.js'
import { deriveGroupCandidate } from '../v2-functions/lib/group-pick.js'

const PLACE_ID = 'parity-place'
const PERMISSION_VERSION = 2
const PEOPLE = {
  mika: 'Mika Lane',
  vivian: 'Vivian Reed',
  ari: 'Ari Chen',
}

function memoryFor(testCase) {
  return {
    placeId: PLACE_ID,
    label: 'Parity Place',
    category: testCase.category ?? 'coffee',
    ...(testCase.area ? { area: testCase.area } : {}),
    hex: '#5A463C',
    provenance: 'user_confirmed',
  }
}

function evaluate(testCase) {
  const memberIds = testCase.memberIds ?? ['mika', 'vivian']
  const memory = memoryFor(testCase)
  const evidence = testCase.evidence ?? []
  const clientMembers = memberIds.map(uid => {
    const categoryHints = testCase.hints?.[uid] ?? []
    return {
      uid,
      name: PEOPLE[uid],
      saves: evidence.filter(item => item.uid === uid).map((item, index) => ({
        id: `${uid}__${PLACE_ID}`,
        uid,
        placeId: PLACE_ID,
        tag: item.tag,
        visibility: 'circle',
        ts: index + 1,
        memory,
        ...(item.observations ? { observations: item.observations } : {}),
      })),
      ...(categoryHints.length > 0 ? {
        quickStart: {
          uid,
          categoryHints,
          constraintHints: [],
          permissionVersion: PERMISSION_VERSION,
        },
      } : {}),
    }
  })

  const client = buildGroupRecommendations({
    members: clientMembers,
    context: testCase.context ?? 'Anything',
    guestCount: testCase.guestCount ?? 0,
    explicitPlanArea: testCase.planArea ?? '',
    requiredObservation: testCase.requiredObservation,
    excludePlaceIds: testCase.excluded ? [PLACE_ID] : [],
  })[0] ?? null

  const server = deriveGroupCandidate({
    placeId: PLACE_ID,
    context: testCase.context ?? 'Anything',
    permissionVersion: PERMISSION_VERSION,
    attendeeUids: memberIds,
    members: memberIds.map(uid => ({ uid, displayName: PEOPLE[uid], avatarHex: '#704739' })),
    signals: evidence.map((item, index) => ({
      uid: item.uid,
      placeId: PLACE_ID,
      tag: item.tag,
      ts: index + 1,
      memory,
      permissionVersion: PERMISSION_VERSION,
      ...(item.observations ? { observations: item.observations } : {}),
    })),
    preferences: Object.entries(testCase.hints ?? {}).map(([uid, categoryHints]) => ({
      uid,
      categoryHints,
      constraintHints: [],
      permissionVersion: PERMISSION_VERSION,
    })),
    guestCount: testCase.guestCount ?? 0,
    planArea: testCase.planArea ?? '',
    requiredObservation: testCase.requiredObservation,
    excludedPlaceIds: testCase.excluded ? [PLACE_ID] : [],
  })

  const summarize = candidate => candidate === null ? null : {
    reasonCode: candidate.reasonCode,
    reason: candidate.reason,
  }
  return { client: summarize(client), server: summarize(server) }
}

const sharedYes = {
  quiet: { value: 'yes', observedAt: 10, audience: 'group', source: 'user_authored' },
}
const sharedNo = {
  quiet: { value: 'no', observedAt: 11, audience: 'group', source: 'user_authored' },
}

const cases = [
  {
    name: 'all exact Wants',
    evidence: [{ uid: 'mika', tag: 'want' }, { uid: 'vivian', tag: 'want' }],
    expectedReason: 'everyone_wants',
  },
  {
    name: 'mixed support from everyone',
    evidence: [{ uid: 'mika', tag: 'want' }, { uid: 'vivian', tag: 'loved' }],
    expectedReason: 'everyone_supports',
  },
  {
    name: 'broad support with one unknown member',
    memberIds: ['mika', 'vivian', 'ari'],
    evidence: [{ uid: 'mika', tag: 'want' }, { uid: 'vivian', tag: 'loved' }],
    expectedReason: 'broad_support',
  },
  {
    name: 'guest remains unknown',
    evidence: [{ uid: 'mika', tag: 'want' }, { uid: 'vivian', tag: 'want' }],
    guestCount: 1,
    expectedReason: 'broad_support',
  },
  {
    name: 'one Love introduces a place',
    memberIds: ['mika', 'vivian', 'ari'],
    evidence: [{ uid: 'vivian', tag: 'loved' }],
    expectedReason: 'trusted_introduction',
  },
  {
    name: 'one Want plus another member hint',
    evidence: [{ uid: 'mika', tag: 'want' }],
    hints: { vivian: ['coffee'] },
    expectedReason: 'quick_start_fit',
  },
  {
    name: 'one unsupported Want stays ineligible',
    evidence: [{ uid: 'mika', tag: 'want' }],
    expectedReason: null,
  },
  {
    name: 'a supporter cannot corroborate their own Want',
    evidence: [{ uid: 'mika', tag: 'want' }],
    hints: { mika: ['coffee'] },
    expectedReason: null,
  },
  {
    name: 'Tried alone stays neutral',
    evidence: [{ uid: 'mika', tag: 'tried' }],
    expectedReason: null,
  },
  {
    name: 'explicit context rejects the wrong category',
    evidence: [{ uid: 'mika', tag: 'loved' }],
    context: 'Food',
    expectedReason: null,
  },
  {
    name: 'explicit plan area admits a matching place',
    evidence: [{ uid: 'mika', tag: 'loved' }],
    area: 'Cresskill, NJ',
    planArea: 'Cresskill',
    expectedReason: 'trusted_introduction',
  },
  {
    name: 'explicit plan area rejects a different place area',
    evidence: [{ uid: 'mika', tag: 'loved' }],
    area: 'Piscataway, NJ',
    planArea: 'Cresskill',
    expectedReason: null,
  },
  {
    name: 'attributed Yes satisfies a practical requirement',
    evidence: [{ uid: 'mika', tag: 'loved', observations: sharedYes }],
    requiredObservation: 'quiet',
    expectedReason: 'trusted_introduction',
  },
  {
    name: 'any attributed No fails a practical requirement closed',
    evidence: [
      { uid: 'mika', tag: 'loved', observations: sharedYes },
      { uid: 'vivian', tag: 'tried', observations: sharedNo },
    ],
    requiredObservation: 'quiet',
    expectedReason: null,
  },
  {
    name: 'missing practical evidence stays unknown',
    evidence: [{ uid: 'mika', tag: 'loved' }],
    requiredObservation: 'quiet',
    expectedReason: null,
  },
  {
    name: 'the previous Pick is excluded',
    evidence: [{ uid: 'mika', tag: 'loved' }],
    excluded: true,
    expectedReason: null,
  },
]

for (const testCase of cases) {
  const { client, server } = evaluate(testCase)
  assert.deepEqual(client, server, `${testCase.name}: client and server recommendation contracts diverged`)
  assert.equal(client?.reasonCode ?? null, testCase.expectedReason, `${testCase.name}: unexpected eligibility or reason`)
}

console.log(`✓ ${cases.length} recommendation cases agree across the client shortlist and Pick server`)
