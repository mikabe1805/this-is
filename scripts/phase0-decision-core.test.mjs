import assert from 'node:assert/strict'
import { evaluatePhase0Decision } from './phase0-decision-core.mjs'

const tier0 = number => ({
  code: `G${String(number).padStart(2, '0')}`,
  materiallyBetterThanDefault: true,
  truthfulReasonNamed: true,
  privacyFailureObserved: false,
})
const tier1 = number => ({
  code: `G${String(number).padStart(2, '0')}`,
  week1UnpromptedSaves: 6,
  week2UnpromptedSaves: 3,
  organizerConcentrationPercent: 60,
  usedAnswerForRealDecision: true,
  beatsDefault: true,
  startedSecondPlanWithoutReminder: number <= 2,
  privacyFailureObserved: false,
})

const passing = evaluatePhase0Decision({
  schemaVersion: 2,
  tier0: [tier0(1), tier0(2), tier0(3)],
  tier1: [tier1(1), tier1(2), tier1(3), tier1(4), tier1(5)],
})
assert.equal(passing.recommendation, 'justify_app_pilot')
assert.equal(passing.metrics.secondPlansWithoutReminder, 2)
assert(!JSON.stringify(passing).includes('G01'))
console.log('✓ passing Phase 0 evidence justifies an app pilot without emitting group codes')

const tier0Failure = evaluatePhase0Decision({
  schemaVersion: 2,
  tier0: [tier0(1), tier0(2), { ...tier0(3), materiallyBetterThanDefault: false, truthfulReasonNamed: false }]
    .map((row, index) => index === 1 ? { ...row, materiallyBetterThanDefault: false } : row),
})
assert.equal(tier0Failure.recommendation, 'revise_thesis')
console.log('✓ a completed Tier 0 that cannot beat the default stops expansion')

const loggingFailure = evaluatePhase0Decision({
  schemaVersion: 2,
  tier0: [tier0(1), tier0(2), tier0(3)],
  tier1: [tier1(1), tier1(2), tier1(3), tier1(4), tier1(5)]
    .map((row, index) => index < 3 ? { ...row, week2UnpromptedSaves: 0 } : row),
})
assert.equal(loggingFailure.recommendation, 'narrow_or_rehome_capture')
console.log('✓ strong answers plus collapsing capture narrows or re-homes the product')

const trickleFailure = evaluatePhase0Decision({
  schemaVersion: 2,
  tier0: [tier0(1), tier0(2), tier0(3)],
  tier1: [tier1(1), tier1(2), tier1(3), tier1(4), tier1(5)]
    .map((row, index) => index < 3 ? { ...row, week1UnpromptedSaves: 8, week2UnpromptedSaves: 1 } : row),
})
assert.equal(trickleFailure.gates.loggingSurvival.pass, false)
assert.equal(trickleFailure.recommendation, 'narrow_or_rehome_capture')
console.log('✓ one week-2 trickle cannot conceal a greater-than-75-percent logging collapse')

const privacyFailure = evaluatePhase0Decision({
  schemaVersion: 2,
  tier0: [{ ...tier0(1), privacyFailureObserved: true }],
})
assert.equal(privacyFailure.recommendation, 'stop_research')
console.log('✓ any observed privacy failure stops the research run')

assert.throws(() => evaluatePhase0Decision({
  schemaVersion: 2,
  tier0: [{ ...tier0(1), name: 'Real family' }],
}), /unsupported field "name"/)
assert.throws(() => evaluatePhase0Decision({
  schemaVersion: 2,
  tier0: [{ ...tier0(1), code: 'person@example.com' }],
}), /anonymous code/)
assert.throws(() => evaluatePhase0Decision({
  schemaVersion: 2,
  tier0: [tier0(1)],
  tier1: [{ ...tier1(1), place: 'Private venue' }],
}), /unsupported field "place"/)
console.log('✓ schema rejects identities, contact details, places, and unknown fields')

assert.throws(() => evaluatePhase0Decision({
  schemaVersion: 1,
  tier0: [tier0(1)],
}), /schemaVersion must be 2/)
assert.throws(() => evaluatePhase0Decision({
  schemaVersion: 2,
  tier0: [tier0(1)],
  tier1: [{ ...tier1(1), week1UnpromptedSaves: undefined, week1Saves: 6 }],
}), /unsupported field "week1Saves"/)
console.log('✓ schema v2 refuses ambiguous legacy save counts that could include seed labor')
