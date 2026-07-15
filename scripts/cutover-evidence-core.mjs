const exactKeys = (value, expected, label, issues) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    issues.push(`${label} must be an object.`)
    return false
  }
  for (const key of Object.keys(value)) {
    if (!expected.includes(key)) issues.push(`${label}.${key} is not an allowed evidence field.`)
  }
  for (const key of expected) {
    if (!(key in value)) issues.push(`${label}.${key} is required.`)
  }
  return true
}

const usableLabel = value => typeof value === 'string'
  && value.trim().length >= 2
  && !/^(?:replace|tbd|todo|unknown|null|none|n\/a)/i.test(value.trim())
const sha256 = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value)
const nonNegativeInteger = value => Number.isInteger(value) && value >= 0

function validPastDate(value, label, now, issues) {
  if (typeof value !== 'string') {
    issues.push(`${label} must be an ISO date-time string.`)
    return null
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    issues.push(`${label} must be a valid ISO date-time string.`)
    return null
  }
  if (date > now) issues.push(`${label} cannot be in the future.`)
  return date
}

export function validateCutoverEvidence(evidence, now = new Date()) {
  const issues = []
  if (!exactKeys(evidence, [
    'schemaVersion', 'projectId', 'approval', 'pilot', 'groupPilot', 'migration', 'liveRules', 'ttl', 'costControls', 'rollback', 'externalArchive',
  ], 'evidence', issues)) return issues
  if (evidence.schemaVersion !== 3) issues.push('evidence.schemaVersion must be 3.')
  if (typeof evidence.projectId !== 'string' || !/^[a-z0-9][a-z0-9-]{4,62}$/.test(evidence.projectId)) {
    issues.push('evidence.projectId must be a concrete Firebase project id.')
  }

  const dates = []
  if (exactKeys(evidence.approval, ['approved', 'approvedAt', 'cutoverOwner', 'rollbackOwner'], 'approval', issues)) {
    if (evidence.approval.approved !== true) issues.push('approval.approved must be true.')
    dates.push(['approval.approvedAt', validPastDate(evidence.approval.approvedAt, 'approval.approvedAt', now, issues)])
    if (!usableLabel(evidence.approval.cutoverOwner)) issues.push('approval.cutoverOwner must name a real accountable person or role.')
    if (!usableLabel(evidence.approval.rollbackOwner)) issues.push('approval.rollbackOwner must name a real accountable person or role.')
  }

  if (exactKeys(evidence.pilot, ['decision', 'pairCount', 'reportSha256', 'completedAt', 'trustFailures'], 'pilot', issues)) {
    if (evidence.pilot.decision !== 'proceed_private_preview') issues.push('pilot.decision must be proceed_private_preview.')
    if (evidence.pilot.pairCount !== 8) issues.push('pilot.pairCount must be 8.')
    if (!sha256(evidence.pilot.reportSha256)) issues.push('pilot.reportSha256 must be a SHA-256 digest.')
    if (evidence.pilot.trustFailures !== 0) issues.push('pilot.trustFailures must be 0.')
    dates.push(['pilot.completedAt', validPastDate(evidence.pilot.completedAt, 'pilot.completedAt', now, issues)])
  }

  if (exactKeys(evidence.groupPilot, [
    'decision', 'circleCount', 'establishedGroupCount', 'pairControlCount',
    'coldComparisonCount', 'reportSha256', 'completedAt', 'trustFailures',
  ], 'groupPilot', issues)) {
    if (evidence.groupPilot.decision !== 'proceed_group_private_preview') {
      issues.push('groupPilot.decision must be proceed_group_private_preview.')
    }
    if (evidence.groupPilot.circleCount !== 8) issues.push('groupPilot.circleCount must be 8.')
    if (evidence.groupPilot.establishedGroupCount !== 6) issues.push('groupPilot.establishedGroupCount must be 6.')
    if (evidence.groupPilot.pairControlCount !== 2) issues.push('groupPilot.pairControlCount must be 2.')
    if (evidence.groupPilot.coldComparisonCount !== 4) issues.push('groupPilot.coldComparisonCount must be 4.')
    if (!sha256(evidence.groupPilot.reportSha256)) issues.push('groupPilot.reportSha256 must be a SHA-256 digest.')
    if (evidence.groupPilot.trustFailures !== 0) issues.push('groupPilot.trustFailures must be 0.')
    dates.push(['groupPilot.completedAt', validPastDate(evidence.groupPilot.completedAt, 'groupPilot.completedAt', now, issues)])
  }

  if (exactKeys(evidence.migration, [
    'intendedAccountCount', 'reconciledAccountCount', 'unresolvedManualReview', 'planSha256', 'reviewedAt',
  ], 'migration', issues)) {
    if (!Number.isInteger(evidence.migration.intendedAccountCount) || evidence.migration.intendedAccountCount < 1) {
      issues.push('migration.intendedAccountCount must be a positive integer.')
    }
    if (evidence.migration.reconciledAccountCount !== evidence.migration.intendedAccountCount) {
      issues.push('migration.reconciledAccountCount must equal intendedAccountCount.')
    }
    if (evidence.migration.unresolvedManualReview !== 0) issues.push('migration.unresolvedManualReview must be 0.')
    if (!sha256(evidence.migration.planSha256)) issues.push('migration.planSha256 must be a SHA-256 digest.')
    dates.push(['migration.reviewedAt', validPastDate(evidence.migration.reviewedAt, 'migration.reviewedAt', now, issues)])
  }

  if (exactKeys(evidence.liveRules, ['rulesetId', 'verifiedAt', 'prototypeBackdoorAbsent'], 'liveRules', issues)) {
    if (!usableLabel(evidence.liveRules.rulesetId)) issues.push('liveRules.rulesetId must identify the reviewed deployed ruleset.')
    if (evidence.liveRules.prototypeBackdoorAbsent !== true) issues.push('liveRules.prototypeBackdoorAbsent must be true.')
    dates.push(['liveRules.verifiedAt', validPastDate(evidence.liveRules.verifiedAt, 'liveRules.verifiedAt', now, issues)])
  }

  if (exactKeys(evidence.ttl, [
    'policyReviewed', 'reviewedAt', 'postDeployVerificationOwner', 'deletionDelayMetricPlanned',
  ], 'ttl', issues)) {
    if (evidence.ttl.policyReviewed !== true) issues.push('ttl.policyReviewed must be true.')
    if (!usableLabel(evidence.ttl.postDeployVerificationOwner)) issues.push('ttl.postDeployVerificationOwner must name an accountable verifier.')
    if (evidence.ttl.deletionDelayMetricPlanned !== true) issues.push('ttl.deletionDelayMetricPlanned must be true.')
    dates.push(['ttl.reviewedAt', validPastDate(evidence.ttl.reviewedAt, 'ttl.reviewedAt', now, issues)])
  }

  if (exactKeys(evidence.costControls, [
    'photoMode', 'monthlyPhotoLimit', 'serverCounterVerified', 'remoteKillSwitchVerified',
    'placesQuotaReviewed', 'apiKeyRestrictionsReviewed', 'billingAlertsConfigured',
    'skuTelemetryVerified', 'reviewedAt',
  ], 'costControls', issues)) {
    if (!['fallback_only', 'budgeted_proxy'].includes(evidence.costControls.photoMode)) {
      issues.push('costControls.photoMode must be fallback_only or budgeted_proxy.')
    }
    if (!nonNegativeInteger(evidence.costControls.monthlyPhotoLimit)) {
      issues.push('costControls.monthlyPhotoLimit must be a non-negative integer.')
    } else if (evidence.costControls.photoMode === 'fallback_only' && evidence.costControls.monthlyPhotoLimit !== 0) {
      issues.push('costControls.monthlyPhotoLimit must be 0 in fallback_only mode.')
    } else if (evidence.costControls.photoMode === 'budgeted_proxy'
      && (evidence.costControls.monthlyPhotoLimit < 1 || evidence.costControls.monthlyPhotoLimit >= 1000)) {
      issues.push('costControls.monthlyPhotoLimit must stay between 1 and 999 in budgeted_proxy mode.')
    }
    for (const field of [
      'serverCounterVerified', 'remoteKillSwitchVerified', 'placesQuotaReviewed',
      'apiKeyRestrictionsReviewed', 'billingAlertsConfigured', 'skuTelemetryVerified',
    ]) {
      if (evidence.costControls[field] !== true) issues.push(`costControls.${field} must be true.`)
    }
    dates.push(['costControls.reviewedAt', validPastDate(evidence.costControls.reviewedAt, 'costControls.reviewedAt', now, issues)])
  }

  if (exactKeys(evidence.rollback, ['hostingReleaseId', 'firestoreRulesetId', 'rehearsedAt'], 'rollback', issues)) {
    if (!usableLabel(evidence.rollback.hostingReleaseId)) issues.push('rollback.hostingReleaseId must identify the retained release.')
    if (!usableLabel(evidence.rollback.firestoreRulesetId)) issues.push('rollback.firestoreRulesetId must identify the retained ruleset.')
    dates.push(['rollback.rehearsedAt', validPastDate(evidence.rollback.rehearsedAt, 'rollback.rehearsedAt', now, issues)])
  }

  if (exactKeys(evidence.externalArchive, ['manifestSha256', 'preservedAt', 'activePathRetired'], 'externalArchive', issues)) {
    if (!sha256(evidence.externalArchive.manifestSha256)) issues.push('externalArchive.manifestSha256 must be a SHA-256 digest.')
    if (evidence.externalArchive.activePathRetired !== true) issues.push('externalArchive.activePathRetired must be true.')
    dates.push(['externalArchive.preservedAt', validPastDate(evidence.externalArchive.preservedAt, 'externalArchive.preservedAt', now, issues)])
  }

  const approvalDate = dates.find(([label]) => label === 'approval.approvedAt')?.[1]
  if (approvalDate) {
    for (const [label, date] of dates) {
      if (label !== 'approval.approvedAt' && date && approvalDate < date) {
        issues.push('approval.approvedAt must be on or after every reviewed evidence timestamp.')
        break
      }
    }
  }
  return issues
}
