const PAIR_KEYS = new Set([
  'code',
  'inviteVisibilityAndConsentPredicted',
  'connectedWithoutRepair',
  'truthfulCandidate',
  'createdRealPick',
  'returnedWithoutReminder',
  'falseConsensusObserved',
  'privateDisclosureObserved',
  'members',
])
const MEMBER_KEYS = new Set(['reasonExplained'])

const assertExactKeys = (value, allowed, label) => {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${label} contains unsupported field "${key}".`)
  }
}

const assertBoolean = (value, label) => {
  if (typeof value !== 'boolean') throw new Error(`${label} must be true or false.`)
}

function validateObservations(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Observation input must be a JSON object.')
  }
  assertExactKeys(input, new Set(['schemaVersion', 'pairs']), 'Observation input')
  if (input.schemaVersion !== 1) throw new Error('Observation schemaVersion must be 1.')
  if (!Array.isArray(input.pairs) || input.pairs.length < 1 || input.pairs.length > 8) {
    throw new Error('Observation input must contain between one and eight pairs.')
  }

  const codes = new Set()
  for (const [index, pair] of input.pairs.entries()) {
    const label = `pairs[${index}]`
    if (!pair || typeof pair !== 'object' || Array.isArray(pair)) {
      throw new Error(`${label} must be an object.`)
    }
    assertExactKeys(pair, PAIR_KEYS, label)
    if (typeof pair.code !== 'string' || !/^P\d{2}$/.test(pair.code)) {
      throw new Error(`${label}.code must be an anonymous code such as P01.`)
    }
    if (codes.has(pair.code)) throw new Error(`Pair code ${pair.code} is duplicated.`)
    codes.add(pair.code)

    for (const field of [
      'inviteVisibilityAndConsentPredicted',
      'connectedWithoutRepair',
      'truthfulCandidate',
      'createdRealPick',
      'returnedWithoutReminder',
      'falseConsensusObserved',
      'privateDisclosureObserved',
    ]) assertBoolean(pair[field], `${label}.${field}`)

    if (!Array.isArray(pair.members) || pair.members.length !== 2) {
      throw new Error(`${label}.members must contain exactly two anonymous member observations.`)
    }
    for (const [memberIndex, member] of pair.members.entries()) {
      if (!member || typeof member !== 'object' || Array.isArray(member)) {
        throw new Error(`${label}.members[${memberIndex}] must be an object.`)
      }
      assertExactKeys(member, MEMBER_KEYS, `${label}.members[${memberIndex}]`)
      assertBoolean(member.reasonExplained, `${label}.members[${memberIndex}].reasonExplained`)
    }
  }
  return input.pairs
}

function validatePairOutcomes(summary) {
  const outcomes = summary?.pairOutcomes
  if (!outcomes || typeof outcomes !== 'object' || Array.isArray(outcomes)) {
    throw new Error('Aggregate summary must contain pairOutcomes.')
  }
  for (const field of ['totalPicks', 'closureWithin14DaysRatePercent']) {
    if (typeof outcomes[field] !== 'number' || !Number.isFinite(outcomes[field]) || outcomes[field] < 0) {
      throw new Error(`pairOutcomes.${field} must be a non-negative number.`)
    }
  }
  if (outcomes.closureWithin14DaysRatePercent > 100) {
    throw new Error('pairOutcomes.closureWithin14DaysRatePercent cannot exceed 100.')
  }
  return outcomes
}

const count = (items, predicate) => items.filter(predicate).length
const percent = (numerator, denominator) => denominator
  ? Number(((numerator / denominator) * 100).toFixed(2))
  : 0

export function evaluatePilotDecision(observations, aggregateSummary) {
  const pairs = validateObservations(observations)
  const outcomes = validatePairOutcomes(aggregateSummary)
  const members = pairs.flatMap(pair => pair.members)
  const metrics = {
    observedPairs: pairs.length,
    inviteVisibilityAndConsentPredicted: count(pairs, pair => pair.inviteVisibilityAndConsentPredicted),
    connectedWithoutRepair: count(pairs, pair => pair.connectedWithoutRepair),
    truthfulCandidate: count(pairs, pair => pair.truthfulCandidate),
    createdRealPick: count(pairs, pair => pair.createdRealPick),
    closureWithin14DaysRatePercent: outcomes.closureWithin14DaysRatePercent,
    reasonExplained: count(members, member => member.reasonExplained),
    reasonExplanationRatePercent: percent(
      count(members, member => member.reasonExplained),
      members.length,
    ),
    returnedWithoutReminder: count(pairs, pair => pair.returnedWithoutReminder),
    falseConsensusObserved: count(pairs, pair => pair.falseConsensusObserved),
    privateDisclosureObserved: count(pairs, pair => pair.privateDisclosureObserved),
  }

  const gates = {
    completeCohort: { value: metrics.observedPairs, threshold: 8, pass: metrics.observedPairs === 8 },
    inviteVisibilityAndConsentPredicted: { value: metrics.inviteVisibilityAndConsentPredicted, threshold: 7, pass: metrics.inviteVisibilityAndConsentPredicted >= 7 },
    connectedWithoutRepair: { value: metrics.connectedWithoutRepair, threshold: 6, pass: metrics.connectedWithoutRepair >= 6 },
    truthfulCandidate: { value: metrics.truthfulCandidate, threshold: 5, pass: metrics.truthfulCandidate >= 5 },
    createdRealPick: { value: metrics.createdRealPick, threshold: 4, pass: metrics.createdRealPick >= 4 },
    closureWithin14DaysRatePercent: {
      value: metrics.closureWithin14DaysRatePercent,
      threshold: 60,
      pass: outcomes.totalPicks > 0 && metrics.closureWithin14DaysRatePercent >= 60,
    },
    reasonExplanationRatePercent: {
      value: metrics.reasonExplanationRatePercent,
      threshold: 80,
      pass: metrics.reasonExplanationRatePercent >= 80,
    },
    returnedWithoutReminder: { value: metrics.returnedWithoutReminder, threshold: 4, pass: metrics.returnedWithoutReminder >= 4 },
    trustFailures: {
      value: metrics.falseConsensusObserved + metrics.privateDisclosureObserved,
      threshold: 0,
      pass: metrics.falseConsensusObserved === 0 && metrics.privateDisclosureObserved === 0,
    },
  }

  let recommendation = 'review_thesis'
  if (!gates.trustFailures.pass) recommendation = 'stop_rollout'
  else if (!gates.completeCohort.pass) recommendation = 'continue_pilot'
  else if (Object.values(gates).every(gate => gate.pass)) recommendation = 'proceed_private_preview'
  else if (gates.inviteVisibilityAndConsentPredicted.pass) recommendation = 'iterate_activation'

  return {
    schemaVersion: 1,
    recommendation,
    metrics,
    gates,
    privacy: {
      outputContainsPairCodes: false,
      outputContainsNamesNotesPlacesOrQueries: false,
    },
  }
}
