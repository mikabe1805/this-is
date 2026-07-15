import assert from 'node:assert/strict'
import { validateCutoverEvidence } from './cutover-evidence-core.mjs'

const digest = 'a'.repeat(64)
const passing = {
  schemaVersion: 3,
  projectId: 'this-is-production',
  approval: { approved: true, approvedAt: '2026-07-20T12:00:00Z', cutoverOwner: 'Product lead', rollbackOwner: 'Operations lead' },
  pilot: { decision: 'proceed_private_preview', pairCount: 8, reportSha256: digest, completedAt: '2026-07-18T12:00:00Z', trustFailures: 0 },
  groupPilot: {
    decision: 'proceed_group_private_preview', circleCount: 8, establishedGroupCount: 6,
    pairControlCount: 2, coldComparisonCount: 4, reportSha256: digest,
    completedAt: '2026-07-18T18:00:00Z', trustFailures: 0,
  },
  migration: { intendedAccountCount: 16, reconciledAccountCount: 16, unresolvedManualReview: 0, planSha256: digest, reviewedAt: '2026-07-19T12:00:00Z' },
  liveRules: { rulesetId: 'ruleset-production-42', verifiedAt: '2026-07-19T13:00:00Z', prototypeBackdoorAbsent: true },
  ttl: { policyReviewed: true, reviewedAt: '2026-07-19T14:00:00Z', postDeployVerificationOwner: 'Operations lead', deletionDelayMetricPlanned: true },
  costControls: {
    photoMode: 'budgeted_proxy', monthlyPhotoLimit: 800, serverCounterVerified: true,
    remoteKillSwitchVerified: true, placesQuotaReviewed: true, apiKeyRestrictionsReviewed: true,
    billingAlertsConfigured: true, skuTelemetryVerified: true, reviewedAt: '2026-07-19T14:30:00Z',
  },
  rollback: { hostingReleaseId: 'hosting-release-41', firestoreRulesetId: 'ruleset-production-41', rehearsedAt: '2026-07-19T15:00:00Z' },
  externalArchive: { manifestSha256: digest, preservedAt: '2026-07-19T16:00:00Z', activePathRetired: true },
}
const now = new Date('2026-07-21T00:00:00Z')

assert.deepEqual(validateCutoverEvidence(passing, now), [])
console.log('✓ complete reviewed evidence satisfies every documented production gate')

const placeholder = structuredClone(passing)
placeholder.approval.cutoverOwner = 'TBD'
placeholder.pilot.pairCount = 5
placeholder.groupPilot.circleCount = 7
placeholder.groupPilot.trustFailures = 1
placeholder.migration.reconciledAccountCount = 15
placeholder.liveRules.prototypeBackdoorAbsent = false
placeholder.costControls.remoteKillSwitchVerified = false
placeholder.externalArchive.activePathRetired = false
const placeholderIssues = validateCutoverEvidence(placeholder, now)
assert(placeholderIssues.length >= 5)
console.log('✓ placeholders, partial pilots, unreconciled migration, unsafe rules, and active archive paths fail')

const prematureApproval = structuredClone(passing)
prematureApproval.approval.approvedAt = '2026-07-18T00:00:00Z'
assert(validateCutoverEvidence(prematureApproval, now).some(issue => issue.includes('on or after')))

const futureEvidence = structuredClone(passing)
futureEvidence.ttl.reviewedAt = '2026-07-22T00:00:00Z'
assert(validateCutoverEvidence(futureEvidence, now).some(issue => issue.includes('future')))

const extraPrivateField = structuredClone(passing)
extraPrivateField.migration.userIds = ['private-user']
assert(validateCutoverEvidence(extraPrivateField, now).some(issue => issue.includes('not an allowed evidence field')))

const alertOnly = structuredClone(passing)
alertOnly.costControls.serverCounterVerified = false
assert(validateCutoverEvidence(alertOnly, now).some(issue => issue.includes('serverCounterVerified')))

const freeCapExceeded = structuredClone(passing)
freeCapExceeded.costControls.monthlyPhotoLimit = 1000
assert(validateCutoverEvidence(freeCapExceeded, now).some(issue => issue.includes('between 1 and 999')))

const fallbackOnly = structuredClone(passing)
fallbackOnly.costControls.photoMode = 'fallback_only'
fallbackOnly.costControls.monthlyPhotoLimit = 0
assert.deepEqual(validateCutoverEvidence(fallbackOnly, now), [])
console.log('✓ approval ordering, future dates, and identity-bearing extra fields are rejected')
