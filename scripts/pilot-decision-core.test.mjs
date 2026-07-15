import assert from 'node:assert/strict'
import { evaluatePilotDecision } from './pilot-decision-core.mjs'

const makePair = (number, overrides = {}) => ({
  code: `P${String(number).padStart(2, '0')}`,
  inviteVisibilityAndConsentPredicted: true,
  connectedWithoutRepair: true,
  truthfulCandidate: true,
  createdRealPick: true,
  returnedWithoutReminder: number <= 4,
  falseConsensusObserved: false,
  privateDisclosureObserved: false,
  members: [{ reasonExplained: true }, { reasonExplained: true }],
  ...overrides,
})
const summary = rate => ({ pairOutcomes: { totalPicks: 5, closureWithin14DaysRatePercent: rate } })

const passing = evaluatePilotDecision(
  { schemaVersion: 1, pairs: Array.from({ length: 8 }, (_, index) => makePair(index + 1)) },
  summary(60),
)
assert.equal(passing.recommendation, 'proceed_private_preview')
assert(Object.values(passing.gates).every(gate => gate.pass))
assert.equal(passing.metrics.reasonExplanationRatePercent, 100)
assert(!JSON.stringify(passing).includes('P01'))
console.log('✓ complete threshold evidence recommends a private preview without emitting pair codes')

const partial = evaluatePilotDecision(
  { schemaVersion: 1, pairs: Array.from({ length: 5 }, (_, index) => makePair(index + 1)) },
  summary(100),
)
assert.equal(partial.recommendation, 'continue_pilot')
assert.equal(partial.gates.completeCohort.pass, false)
console.log('✓ five to seven pairs remain diagnostic because the approved proceed thresholds require eight')

const trustFailure = evaluatePilotDecision(
  {
    schemaVersion: 1,
    pairs: Array.from({ length: 8 }, (_, index) => makePair(index + 1,
      index === 0 ? { privateDisclosureObserved: true } : {})),
  },
  summary(100),
)
assert.equal(trustFailure.recommendation, 'stop_rollout')
assert.equal(trustFailure.gates.trustFailures.pass, false)
console.log('✓ any false-consensus or privacy failure stops rollout')

const activationFailure = evaluatePilotDecision(
  {
    schemaVersion: 1,
    pairs: Array.from({ length: 8 }, (_, index) => makePair(index + 1,
      index >= 3 ? { createdRealPick: false } : {})),
  },
  summary(40),
)
assert.equal(activationFailure.recommendation, 'iterate_activation')
console.log('✓ understood promise plus weak decision completion routes to activation iteration')

assert.throws(() => evaluatePilotDecision({
  schemaVersion: 1,
  pairs: [makePair(1, { name: 'A real person' })],
}, summary(100)), /unsupported field "name"/)
assert.throws(() => evaluatePilotDecision({
  schemaVersion: 1,
  pairs: [makePair(1, { code: 'alice@example.com' })],
}, summary(100)), /anonymous code/)
assert.throws(() => evaluatePilotDecision({
  schemaVersion: 1,
  pairs: [makePair(1, { members: [{ reasonExplained: true, note: 'private' }, { reasonExplained: true }] })],
}, summary(100)), /unsupported field "note"/)
assert.throws(() => evaluatePilotDecision({
  schemaVersion: 1,
  pairs: [makePair(1)],
}, { pairOutcomes: { totalPicks: 1, closureWithin14DaysRatePercent: 101 } }), /cannot exceed 100/)
console.log('✓ schema rejects names, contact identifiers, notes, extra fields, and impossible aggregates')
