import assert from 'node:assert/strict'
import { evaluateGroupPilotDecision } from './group-pilot-decision-core.mjs'

const members = count => Array.from({ length: count }, () => ({
  knownVsTasteFitDistinguished: true,
  chosenPlaceAcceptable: true,
}))
const makeCircle = (number, overrides = {}) => ({
  code: `G${String(number).padStart(2, '0')}`,
  sizeBand: number <= 2 ? 'pair' : number <= 6 ? '3_4' : '5_6',
  cohortType: number === 3 || number === 4 ? 'family' : number === 5 || number === 6 ? 'friends' : 'dinner',
  establishedGroup: true,
  coldComparisonOutcome: number >= 3 && number <= 6 ? (number === 6 ? 'ordinary_method' : 'materially_additive') : 'not_observed',
  joinedWithoutRepair: true,
  multiplayerParticipation: true,
  acceptableTruthfulCandidate: true,
  resolvedGenuinePlan: true,
  receiptUsedAndUnderstood: true,
  secondPlanWithoutReminder: number <= 4,
  organizerActionShareBand: '51_80',
  falseConsensusObserved: false,
  privateDisclosureObserved: false,
  unexpectedNamedEvidenceObserved: false,
  fingerprintInferenceObserved: false,
  vetoSurpriseObserved: false,
  unauthorizedReadObserved: false,
  failedRevocationObserved: false,
  members: members(number <= 2 ? 2 : number <= 6 ? 3 : 5),
  ...overrides,
})
const passingInput = { schemaVersion: 1, circles: Array.from({ length: 8 }, (_, index) => makeCircle(index + 1)) }
const summary = rate => ({ groupOutcomes: { totalPicks: 10, closureWithin21DaysRatePercent: rate } })

const passing = evaluateGroupPilotDecision(passingInput, summary(60))
assert.equal(passing.recommendation, 'proceed_group_private_preview')
assert(Object.values(passing.gates).every(gate => gate.pass))
assert(!JSON.stringify(passing).includes('G01'))
console.log('✓ complete eight-circle evidence can recommend a group private preview without codes')

const partial = evaluateGroupPilotDecision({ schemaVersion: 1, circles: passingInput.circles.slice(0, 5) }, summary(100))
assert.equal(partial.recommendation, 'continue_pilot')

const trustFailure = structuredClone(passingInput)
trustFailure.circles[0].vetoSurpriseObserved = true
assert.equal(evaluateGroupPilotDecision(trustFailure, summary(100)).recommendation, 'stop_rollout')

const coldLoss = structuredClone(passingInput)
for (const circle of coldLoss.circles) {
  if (circle.coldComparisonOutcome !== 'not_observed') circle.coldComparisonOutcome = 'ordinary_method'
}
assert.equal(evaluateGroupPilotDecision(coldLoss, summary(100)).recommendation, 'narrow_to_established_history')

const activationFailure = structuredClone(passingInput)
for (let index = 0; index < 3; index++) activationFailure.circles[index].multiplayerParticipation = false
assert.equal(evaluateGroupPilotDecision(activationFailure, summary(100)).recommendation, 'iterate_activation')

assert.throws(() => evaluateGroupPilotDecision({
  schemaVersion: 1, circles: [makeCircle(1, { groupId: 'private-id' })],
}, summary(100)), /unsupported field "groupId"/)
assert.throws(() => evaluateGroupPilotDecision({
  schemaVersion: 1, circles: [makeCircle(1, { code: 'family@example.com' })],
}, summary(100)), /anonymous code/)
assert.throws(() => evaluateGroupPilotDecision({
  schemaVersion: 1, circles: [makeCircle(1, { members: [{ knownVsTasteFitDistinguished: true, chosenPlaceAcceptable: true, note: 'private' }, members(2)[1]] })],
}, summary(100)), /unsupported field "note"/)
assert.throws(() => evaluateGroupPilotDecision(passingInput, {
  groupOutcomes: { totalPicks: 1, closureWithin21DaysRatePercent: 101 },
}), /cannot exceed 100/)
console.log('✓ group schema rejects identifiers, notes, extra fields, impossible rates, and trust failures')
