const ROOT_KEYS = new Set(['schemaVersion', 'tier0', 'tier1'])
const TIER0_KEYS = new Set([
  'code', 'materiallyBetterThanDefault', 'truthfulReasonNamed', 'privacyFailureObserved',
])
const TIER1_KEYS = new Set([
  'code', 'week1UnpromptedSaves', 'week2UnpromptedSaves', 'organizerConcentrationPercent',
  'usedAnswerForRealDecision', 'beatsDefault', 'startedSecondPlanWithoutReminder',
  'privacyFailureObserved',
])

const assertExactKeys = (value, allowed, label) => {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${label} contains unsupported field "${key}".`)
  }
}

const assertBoolean = (value, label) => {
  if (typeof value !== 'boolean') throw new Error(`${label} must be true or false.`)
}

const assertCount = (value, label) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > 500) {
    throw new Error(`${label} must be an integer from 0 to 500.`)
  }
}

const assertPercent = (value, label) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${label} must be a number from 0 to 100.`)
  }
}

function validateCohort(value, expectedLength, allowedKeys, label, validateRow) {
  if (!Array.isArray(value) || value.length < 1 || value.length > expectedLength) {
    throw new Error(`${label} must contain between one and ${expectedLength} anonymous groups.`)
  }
  const codes = new Set()
  value.forEach((row, index) => {
    const rowLabel = `${label}[${index}]`
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error(`${rowLabel} must be an object.`)
    }
    assertExactKeys(row, allowedKeys, rowLabel)
    if (typeof row.code !== 'string' || !/^G\d{2}$/.test(row.code)) {
      throw new Error(`${rowLabel}.code must be an anonymous code such as G01.`)
    }
    if (codes.has(row.code)) throw new Error(`Group code ${row.code} is duplicated in ${label}.`)
    codes.add(row.code)
    validateRow(row, rowLabel)
  })
  return value
}

function validateEvidence(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Phase 0 evidence must be a JSON object.')
  }
  assertExactKeys(input, ROOT_KEYS, 'Phase 0 evidence')
  if (input.schemaVersion !== 2) throw new Error('Phase 0 schemaVersion must be 2.')
  const tier0 = validateCohort(input.tier0, 3, TIER0_KEYS, 'tier0', (row, label) => {
    assertBoolean(row.materiallyBetterThanDefault, `${label}.materiallyBetterThanDefault`)
    assertBoolean(row.truthfulReasonNamed, `${label}.truthfulReasonNamed`)
    assertBoolean(row.privacyFailureObserved, `${label}.privacyFailureObserved`)
  })
  const tier1 = input.tier1 === undefined
    ? []
    : validateCohort(input.tier1, 5, TIER1_KEYS, 'tier1', (row, label) => {
        assertCount(row.week1UnpromptedSaves, `${label}.week1UnpromptedSaves`)
        assertCount(row.week2UnpromptedSaves, `${label}.week2UnpromptedSaves`)
        assertPercent(row.organizerConcentrationPercent, `${label}.organizerConcentrationPercent`)
        assertBoolean(row.usedAnswerForRealDecision, `${label}.usedAnswerForRealDecision`)
        assertBoolean(row.beatsDefault, `${label}.beatsDefault`)
        assertBoolean(row.startedSecondPlanWithoutReminder, `${label}.startedSecondPlanWithoutReminder`)
        assertBoolean(row.privacyFailureObserved, `${label}.privacyFailureObserved`)
      })
  return { tier0, tier1 }
}

const count = (items, predicate) => items.filter(predicate).length
const loggingSurvived = row => row.week1UnpromptedSaves > 0
  && row.week2UnpromptedSaves > 0
  && row.week2UnpromptedSaves * 4 >= row.week1UnpromptedSaves

export function evaluatePhase0Decision(input) {
  const { tier0, tier1 } = validateEvidence(input)
  const metrics = {
    tier0Groups: tier0.length,
    tier0MateriallyBetter: count(tier0, row => row.materiallyBetterThanDefault),
    tier0TruthfulReason: count(tier0, row => row.truthfulReasonNamed),
    tier1Groups: tier1.length,
    loggingSurvivedWeek2: count(tier1, loggingSurvived),
    distributedContribution: count(tier1, row => row.organizerConcentrationPercent <= 80),
    realDecisionsResolved: count(tier1, row => row.usedAnswerForRealDecision),
    beatsDefault: count(tier1, row => row.beatsDefault),
    secondPlansWithoutReminder: count(tier1, row => row.startedSecondPlanWithoutReminder),
    privacyFailures: count([...tier0, ...tier1], row => row.privacyFailureObserved),
  }
  const gates = {
    noPrivacyFailure: { value: metrics.privacyFailures, threshold: 0, pass: metrics.privacyFailures === 0 },
    tier0Complete: { value: metrics.tier0Groups, threshold: 3, pass: metrics.tier0Groups === 3 },
    tier0Value: { value: metrics.tier0MateriallyBetter, threshold: 2, pass: metrics.tier0MateriallyBetter >= 2 },
    tier0Truth: { value: metrics.tier0TruthfulReason, threshold: 2, pass: metrics.tier0TruthfulReason >= 2 },
    tier1Complete: { value: metrics.tier1Groups, threshold: 5, pass: metrics.tier1Groups === 5 },
    loggingSurvival: {
      value: metrics.loggingSurvivedWeek2,
      threshold: 3,
      withinGroupRule: 'week1 > 0; week2 > 0; week2 >= 25% of week1',
      pass: metrics.loggingSurvivedWeek2 >= 3,
    },
    distributedContribution: { value: metrics.distributedContribution, threshold: 3, pass: metrics.distributedContribution >= 3 },
    realDecisionsResolved: { value: metrics.realDecisionsResolved, threshold: 3, pass: metrics.realDecisionsResolved >= 3 },
    beatsDefault: { value: metrics.beatsDefault, threshold: 3, pass: metrics.beatsDefault >= 3 },
    secondPlansWithoutReminder: { value: metrics.secondPlansWithoutReminder, threshold: 2, pass: metrics.secondPlansWithoutReminder >= 2 },
  }

  let recommendation = 'continue_tier0'
  if (!gates.noPrivacyFailure.pass) recommendation = 'stop_research'
  else if (gates.tier0Complete.pass && (!gates.tier0Value.pass || !gates.tier0Truth.pass)) recommendation = 'revise_thesis'
  else if (!gates.tier0Complete.pass) recommendation = 'continue_tier0'
  else if (!gates.tier1Complete.pass) recommendation = 'proceed_or_continue_tier1'
  else if (gates.loggingSurvival.pass
    && gates.distributedContribution.pass
    && gates.realDecisionsResolved.pass
    && gates.beatsDefault.pass
    && gates.secondPlansWithoutReminder.pass) recommendation = 'justify_app_pilot'
  else if (gates.tier0Value.pass && gates.beatsDefault.pass) recommendation = 'narrow_or_rehome_capture'
  else recommendation = 'revise_thesis'

  return {
    schemaVersion: 2,
    recommendation,
    metrics,
    gates,
    privacy: {
      outputContainsGroupCodes: false,
      outputContainsNamesContactsNotesPlacesOrQueries: false,
    },
  }
}
