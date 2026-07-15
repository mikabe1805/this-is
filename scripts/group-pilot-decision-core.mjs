const CIRCLE_KEYS = new Set([
  'code', 'sizeBand', 'cohortType', 'establishedGroup', 'coldComparisonOutcome',
  'joinedWithoutRepair', 'multiplayerParticipation', 'acceptableTruthfulCandidate',
  'resolvedGenuinePlan', 'receiptUsedAndUnderstood', 'secondPlanWithoutReminder',
  'organizerActionShareBand', 'falseConsensusObserved', 'privateDisclosureObserved',
  'unexpectedNamedEvidenceObserved', 'fingerprintInferenceObserved', 'vetoSurpriseObserved',
  'unauthorizedReadObserved', 'failedRevocationObserved', 'members',
])
const MEMBER_KEYS = new Set(['knownVsTasteFitDistinguished', 'chosenPlaceAcceptable'])
const SIZE_BANDS = new Set(['pair', '3_4', '5_6'])
const COHORT_TYPES = new Set(['family', 'friends', 'dinner', 'other'])
const COLD_OUTCOMES = new Set(['this_is', 'materially_additive', 'ordinary_method', 'not_observed'])
const ORGANIZER_BANDS = new Set(['0_50', '51_80', 'over_80'])

const assertExactKeys = (value, allowed, label) => {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${label} contains unsupported field "${key}".`)
  }
  for (const key of allowed) {
    if (!(key in value)) throw new Error(`${label}.${key} is required.`)
  }
}

const assertBoolean = (value, label) => {
  if (typeof value !== 'boolean') throw new Error(`${label} must be true or false.`)
}

function validateObservations(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Group observation input must be a JSON object.')
  }
  assertExactKeys(input, new Set(['schemaVersion', 'circles']), 'Observation input')
  if (input.schemaVersion !== 1) throw new Error('Group observation schemaVersion must be 1.')
  if (!Array.isArray(input.circles) || input.circles.length < 1 || input.circles.length > 8) {
    throw new Error('Group observation input must contain between one and eight circles.')
  }
  const codes = new Set()
  for (const [index, circle] of input.circles.entries()) {
    const label = `circles[${index}]`
    if (!circle || typeof circle !== 'object' || Array.isArray(circle)) throw new Error(`${label} must be an object.`)
    assertExactKeys(circle, CIRCLE_KEYS, label)
    if (typeof circle.code !== 'string' || !/^G\d{2}$/.test(circle.code)) {
      throw new Error(`${label}.code must be an anonymous code such as G01.`)
    }
    if (codes.has(circle.code)) throw new Error(`Circle code ${circle.code} is duplicated.`)
    codes.add(circle.code)
    if (!SIZE_BANDS.has(circle.sizeBand)) throw new Error(`${label}.sizeBand is invalid.`)
    if (!COHORT_TYPES.has(circle.cohortType)) throw new Error(`${label}.cohortType is invalid.`)
    if (!COLD_OUTCOMES.has(circle.coldComparisonOutcome)) throw new Error(`${label}.coldComparisonOutcome is invalid.`)
    if (!ORGANIZER_BANDS.has(circle.organizerActionShareBand)) throw new Error(`${label}.organizerActionShareBand is invalid.`)
    for (const field of [
      'establishedGroup', 'joinedWithoutRepair', 'multiplayerParticipation',
      'acceptableTruthfulCandidate', 'resolvedGenuinePlan', 'receiptUsedAndUnderstood',
      'secondPlanWithoutReminder', 'falseConsensusObserved', 'privateDisclosureObserved',
      'unexpectedNamedEvidenceObserved', 'fingerprintInferenceObserved', 'vetoSurpriseObserved',
      'unauthorizedReadObserved', 'failedRevocationObserved',
    ]) assertBoolean(circle[field], `${label}.${field}`)

    const memberRange = circle.sizeBand === 'pair' ? [2, 2] : circle.sizeBand === '3_4' ? [3, 4] : [5, 6]
    if (!Array.isArray(circle.members)
      || circle.members.length < memberRange[0] || circle.members.length > memberRange[1]) {
      throw new Error(`${label}.members does not match its anonymous size band.`)
    }
    for (const [memberIndex, member] of circle.members.entries()) {
      const memberLabel = `${label}.members[${memberIndex}]`
      if (!member || typeof member !== 'object' || Array.isArray(member)) throw new Error(`${memberLabel} must be an object.`)
      assertExactKeys(member, MEMBER_KEYS, memberLabel)
      for (const field of MEMBER_KEYS) assertBoolean(member[field], `${memberLabel}.${field}`)
    }
  }
  return input.circles
}

function validateGroupOutcomes(summary) {
  const outcomes = summary?.groupOutcomes
  if (!outcomes || typeof outcomes !== 'object' || Array.isArray(outcomes)) {
    throw new Error('Aggregate summary must contain groupOutcomes.')
  }
  const allowed = new Set(['totalPicks', 'closureWithin21DaysRatePercent'])
  assertExactKeys(outcomes, allowed, 'groupOutcomes')
  for (const field of allowed) {
    if (typeof outcomes[field] !== 'number' || !Number.isFinite(outcomes[field]) || outcomes[field] < 0) {
      throw new Error(`groupOutcomes.${field} must be a non-negative number.`)
    }
  }
  if (!Number.isInteger(outcomes.totalPicks)) throw new Error('groupOutcomes.totalPicks must be an integer.')
  if (outcomes.closureWithin21DaysRatePercent > 100) {
    throw new Error('groupOutcomes.closureWithin21DaysRatePercent cannot exceed 100.')
  }
  return outcomes
}

const count = (items, predicate) => items.filter(predicate).length
const percent = (numerator, denominator) => denominator
  ? Number(((numerator / denominator) * 100).toFixed(2))
  : 0

export function evaluateGroupPilotDecision(observations, aggregateSummary) {
  const circles = validateObservations(observations)
  const outcomes = validateGroupOutcomes(aggregateSummary)
  const members = circles.flatMap(circle => circle.members)
  const coldObserved = circles.filter(circle => circle.coldComparisonOutcome !== 'not_observed')
  const coldPositive = count(coldObserved, circle => ['this_is', 'materially_additive'].includes(circle.coldComparisonOutcome))
  const trustFields = [
    'falseConsensusObserved', 'privateDisclosureObserved', 'unexpectedNamedEvidenceObserved',
    'fingerprintInferenceObserved', 'vetoSurpriseObserved', 'unauthorizedReadObserved',
    'failedRevocationObserved',
  ]
  const trustFailures = circles.reduce((total, circle) =>
    total + trustFields.filter(field => circle[field]).length, 0)
  const groupSized = circles.filter(circle => circle.sizeBand !== 'pair')
  const metrics = {
    observedCircles: circles.length,
    groupSizedCircles: groupSized.length,
    pairControls: count(circles, circle => circle.sizeBand === 'pair'),
    establishedGroupSizedCircles: count(groupSized, circle => circle.establishedGroup),
    familyGroups: count(groupSized, circle => circle.cohortType === 'family'),
    friendsOrDinnerGroups: count(groupSized, circle => ['friends', 'dinner'].includes(circle.cohortType)),
    joinedWithoutRepair: count(circles, circle => circle.joinedWithoutRepair),
    multiplayerParticipation: count(circles, circle => circle.multiplayerParticipation),
    acceptableTruthfulCandidate: count(circles, circle => circle.acceptableTruthfulCandidate),
    resolvedGenuinePlan: count(circles, circle => circle.resolvedGenuinePlan),
    receiptUsedAndUnderstood: count(circles, circle => circle.receiptUsedAndUnderstood),
    secondPlanWithoutReminder: count(circles, circle => circle.secondPlanWithoutReminder),
    coldComparisonsObserved: coldObserved.length,
    coldPreferencePositive: coldPositive,
    knownVsTasteFitDistinguishedRatePercent: percent(
      count(members, member => member.knownVsTasteFitDistinguished), members.length),
    chosenPlaceAcceptableRatePercent: percent(
      count(members, member => member.chosenPlaceAcceptable), members.length),
    organizerOver80Percent: count(circles, circle => circle.organizerActionShareBand === 'over_80'),
    totalPicks: outcomes.totalPicks,
    closureWithin21DaysRatePercent: outcomes.closureWithin21DaysRatePercent,
    trustFailures,
  }
  const gates = {
    completeCohort: { value: metrics.observedCircles, threshold: 8, pass: metrics.observedCircles === 8 },
    groupSizedCohort: { value: metrics.groupSizedCircles, threshold: 6, pass: metrics.groupSizedCircles === 6 },
    pairControls: { value: metrics.pairControls, threshold: 2, pass: metrics.pairControls === 2 },
    establishedGroups: { value: metrics.establishedGroupSizedCircles, threshold: 6, pass: metrics.establishedGroupSizedCircles === 6 },
    familyGroups: { value: metrics.familyGroups, threshold: 2, pass: metrics.familyGroups >= 2 },
    friendsOrDinnerGroups: { value: metrics.friendsOrDinnerGroups, threshold: 2, pass: metrics.friendsOrDinnerGroups >= 2 },
    joinedWithoutRepair: { value: metrics.joinedWithoutRepair, threshold: 6, pass: metrics.joinedWithoutRepair >= 6 },
    multiplayerParticipation: { value: metrics.multiplayerParticipation, threshold: 6, pass: metrics.multiplayerParticipation >= 6 },
    acceptableTruthfulCandidate: { value: metrics.acceptableTruthfulCandidate, threshold: 5, pass: metrics.acceptableTruthfulCandidate >= 5 },
    resolvedGenuinePlan: { value: metrics.resolvedGenuinePlan, threshold: 5, pass: metrics.resolvedGenuinePlan >= 5 },
    receiptUsedAndUnderstood: { value: metrics.receiptUsedAndUnderstood, threshold: 5, pass: metrics.receiptUsedAndUnderstood >= 5 },
    secondPlanWithoutReminder: { value: metrics.secondPlanWithoutReminder, threshold: 4, pass: metrics.secondPlanWithoutReminder >= 4 },
    coldComparisonComplete: { value: metrics.coldComparisonsObserved, threshold: 4, pass: metrics.coldComparisonsObserved === 4 },
    coldPreferencePositive: { value: metrics.coldPreferencePositive, threshold: 3, pass: metrics.coldPreferencePositive >= 3 },
    reasonComprehension: { value: metrics.knownVsTasteFitDistinguishedRatePercent, threshold: 80, pass: metrics.knownVsTasteFitDistinguishedRatePercent >= 80 },
    closureWithin21Days: { value: metrics.closureWithin21DaysRatePercent, threshold: 60,
      pass: outcomes.totalPicks > 0 && metrics.closureWithin21DaysRatePercent >= 60 },
    organizerConcentration: { value: metrics.organizerOver80Percent, threshold: 2, pass: metrics.organizerOver80Percent <= 2 },
    trustFailures: { value: metrics.trustFailures, threshold: 0, pass: metrics.trustFailures === 0 },
  }

  let recommendation = 'review_thesis'
  if (!gates.trustFailures.pass) recommendation = 'stop_rollout'
  else if (!gates.completeCohort.pass || !gates.groupSizedCohort.pass || !gates.pairControls.pass) recommendation = 'continue_pilot'
  else if (Object.values(gates).every(gate => gate.pass)) recommendation = 'proceed_group_private_preview'
  else if (gates.coldComparisonComplete.pass && !gates.coldPreferencePositive.pass) recommendation = 'narrow_to_established_history'
  else if (gates.joinedWithoutRepair.pass && !gates.multiplayerParticipation.pass) recommendation = 'iterate_activation'
  else if (gates.multiplayerParticipation.pass && !gates.resolvedGenuinePlan.pass) recommendation = 'iterate_decision_ux'

  return {
    schemaVersion: 1,
    recommendation,
    metrics,
    gates,
    privacy: {
      outputContainsCircleCodes: false,
      outputContainsNamesIdsPlacesNotesChatQueriesOrRawVetoes: false,
    },
  }
}
