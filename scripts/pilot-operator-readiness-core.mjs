const ROOT_KEYS = ['schemaVersion', 'operator', 'researchWindow', 'compensationNotice', 'temporaryCapture', 'participantBoundary', 'review']
const OPERATOR_KEYS = ['identityNotice', 'participantContact', 'languageReviewerRole', 'incidentOwnerRole']
const WINDOW_KEYS = ['startsOn', 'endsOn', 'withdrawalDeadline', 'rawDataDeleteBy']
const CAPTURE_KEYS = ['systemDescription', 'accessRoles', 'deletionOwnerRole', 'productionDataExcluded', 'deletionRehearsed', 'deletionRehearsedOn']
const BOUNDARY_KEYS = ['adultsOnlyPolicyConfirmed', 'passiveLocationExcluded', 'contactUploadExcluded', 'privateChatHistoryExcluded', 'backgroundGoogleEnrichmentExcluded']
const REVIEW_KEYS = ['participantLanguageReviewed', 'reviewedOn', 'approvedForContact', 'approvedOn']
const DATE = /^\d{4}-\d{2}-\d{2}$/
const PLACEHOLDER = /(?:\[|(?:required|replace|tbd|todo)(?:_|\b)|yyyy-mm-dd|example\.com)/i

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function exactKeys(value, keys, label, issues) {
  const data = record(value)
  if (!data) {
    issues.push(`${label} must be an object.`)
    return null
  }
  const expected = [...keys].sort().join('|')
  const actual = Object.keys(data).sort().join('|')
  if (actual !== expected) issues.push(`${label} must contain exactly: ${keys.join(', ')}.`)
  return data
}

function usableText(value, label, issues, max = 240) {
  if (typeof value !== 'string' || value.trim().length < 2 || value.length > max || PLACEHOLDER.test(value)) {
    issues.push(`${label} must be completed with reviewed, non-placeholder text.`)
    return false
  }
  return true
}

function dateValue(value, label, issues) {
  if (typeof value !== 'string' || !DATE.test(value)) {
    issues.push(`${label} must be a real date in YYYY-MM-DD form.`)
    return null
  }
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    issues.push(`${label} must be a real date in YYYY-MM-DD form.`)
    return null
  }
  return value
}

function requireTrue(value, label, issues) {
  if (value !== true) issues.push(`${label} must be explicitly true before participant contact.`)
}

export function validatePilotOperatorReadiness(input, today = new Date().toISOString().slice(0, 10)) {
  const issues = []
  const root = exactKeys(input, ROOT_KEYS, 'readiness', issues)
  if (!root) return issues
  if (root.schemaVersion !== 1) issues.push('readiness.schemaVersion must equal 1.')

  const operator = exactKeys(root.operator, OPERATOR_KEYS, 'readiness.operator', issues)
  if (operator) {
    usableText(operator.identityNotice, 'readiness.operator.identityNotice', issues)
    usableText(operator.participantContact, 'readiness.operator.participantContact', issues)
    usableText(operator.languageReviewerRole, 'readiness.operator.languageReviewerRole', issues, 120)
    usableText(operator.incidentOwnerRole, 'readiness.operator.incidentOwnerRole', issues, 120)
  }
  usableText(root.compensationNotice, 'readiness.compensationNotice', issues)

  const window = exactKeys(root.researchWindow, WINDOW_KEYS, 'readiness.researchWindow', issues)
  const dates = {}
  if (window) {
    for (const key of WINDOW_KEYS) dates[key] = dateValue(window[key], `readiness.researchWindow.${key}`, issues)
    if (dates.startsOn && dates.startsOn < today) issues.push('readiness.researchWindow.startsOn cannot be before the preflight date.')
    if (dates.startsOn && dates.endsOn && dates.startsOn > dates.endsOn) issues.push('readiness.researchWindow.startsOn must not be after endsOn.')
    if (dates.endsOn && dates.withdrawalDeadline && dates.endsOn > dates.withdrawalDeadline) issues.push('readiness.researchWindow.withdrawalDeadline must be on or after endsOn.')
    if (dates.endsOn && dates.rawDataDeleteBy && dates.endsOn > dates.rawDataDeleteBy) issues.push('readiness.researchWindow.rawDataDeleteBy must be on or after endsOn.')
    if (dates.withdrawalDeadline && dates.rawDataDeleteBy && dates.withdrawalDeadline > dates.rawDataDeleteBy) issues.push('readiness.researchWindow.rawDataDeleteBy must be on or after withdrawalDeadline.')
  }

  const capture = exactKeys(root.temporaryCapture, CAPTURE_KEYS, 'readiness.temporaryCapture', issues)
  let rehearsalOn = null
  if (capture) {
    usableText(capture.systemDescription, 'readiness.temporaryCapture.systemDescription', issues)
    usableText(capture.deletionOwnerRole, 'readiness.temporaryCapture.deletionOwnerRole', issues, 120)
    if (!Array.isArray(capture.accessRoles) || capture.accessRoles.length < 1 || capture.accessRoles.length > 6) {
      issues.push('readiness.temporaryCapture.accessRoles must contain one to six reviewed roles.')
    } else {
      capture.accessRoles.forEach((role, index) => usableText(role, `readiness.temporaryCapture.accessRoles[${index}]`, issues, 120))
      if (new Set(capture.accessRoles).size !== capture.accessRoles.length) issues.push('readiness.temporaryCapture.accessRoles must be unique.')
    }
    requireTrue(capture.productionDataExcluded, 'readiness.temporaryCapture.productionDataExcluded', issues)
    requireTrue(capture.deletionRehearsed, 'readiness.temporaryCapture.deletionRehearsed', issues)
    rehearsalOn = dateValue(capture.deletionRehearsedOn, 'readiness.temporaryCapture.deletionRehearsedOn', issues)
    if (rehearsalOn && rehearsalOn > today) issues.push('readiness.temporaryCapture.deletionRehearsedOn cannot be in the future.')
  }

  const boundary = exactKeys(root.participantBoundary, BOUNDARY_KEYS, 'readiness.participantBoundary', issues)
  if (boundary) for (const key of BOUNDARY_KEYS) requireTrue(boundary[key], `readiness.participantBoundary.${key}`, issues)

  const review = exactKeys(root.review, REVIEW_KEYS, 'readiness.review', issues)
  if (review) {
    requireTrue(review.participantLanguageReviewed, 'readiness.review.participantLanguageReviewed', issues)
    requireTrue(review.approvedForContact, 'readiness.review.approvedForContact', issues)
    const reviewedOn = dateValue(review.reviewedOn, 'readiness.review.reviewedOn', issues)
    const approvedOn = dateValue(review.approvedOn, 'readiness.review.approvedOn', issues)
    if (reviewedOn && reviewedOn > today) issues.push('readiness.review.reviewedOn cannot be in the future.')
    if (approvedOn && approvedOn > today) issues.push('readiness.review.approvedOn cannot be in the future.')
    if (reviewedOn && approvedOn && reviewedOn > approvedOn) issues.push('readiness.review.approvedOn must be on or after reviewedOn.')
    if (rehearsalOn && approvedOn && rehearsalOn > approvedOn) issues.push('readiness.review.approvedOn must be on or after deletionRehearsedOn.')
    if (approvedOn && dates.startsOn && approvedOn > dates.startsOn) issues.push('readiness.review.approvedOn must be on or before the research start.')
  }
  return issues
}
