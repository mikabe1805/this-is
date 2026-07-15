import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { validatePilotOperatorReadiness } from './pilot-operator-readiness-core.mjs'

const today = '2026-07-13'
const passing = {
  schemaVersion: 1,
  operator: {
    identityNotice: 'this.is research operator',
    participantContact: 'A reviewed participant support channel',
    languageReviewerRole: 'Research language reviewer',
    incidentOwnerRole: 'Research incident lead',
  },
  researchWindow: {
    startsOn: '2026-07-14', endsOn: '2026-07-28',
    withdrawalDeadline: '2026-07-29', rawDataDeleteBy: '2026-07-30',
  },
  compensationNotice: 'No compensation is offered for this rehearsal cohort.',
  temporaryCapture: {
    systemDescription: 'Access-controlled temporary research worksheet',
    accessRoles: ['Research operator'], deletionOwnerRole: 'Research operator',
    productionDataExcluded: true, deletionRehearsed: true, deletionRehearsedOn: '2026-07-12',
  },
  participantBoundary: {
    adultsOnlyPolicyConfirmed: true, passiveLocationExcluded: true, contactUploadExcluded: true,
    privateChatHistoryExcluded: true, backgroundGoogleEnrichmentExcluded: true,
  },
  review: {
    participantLanguageReviewed: true, reviewedOn: '2026-07-12',
    approvedForContact: true, approvedOn: '2026-07-13',
  },
}

assert.deepEqual(validatePilotOperatorReadiness(passing, today), [])
console.log('✓ completed operator readiness permits participant contact preparation')

const unsafe = structuredClone(passing)
unsafe.operator.participantContact = 'private.person@example.net'
unsafe.participantBoundary.passiveLocationExcluded = false
unsafe.temporaryCapture.deletionRehearsed = false
unsafe.researchWindow.rawDataDeleteBy = '2026-07-20'
unsafe.review.approvedOn = '2026-07-14'
unsafe.unexpectedParticipantNotes = []
const unsafeIssues = validatePilotOperatorReadiness(unsafe, today)
assert(unsafeIssues.length >= 5)
assert(!unsafeIssues.join('|').includes('private.person@example.net'), 'validation output must never echo operator contact values')
console.log('✓ unsafe boundaries, date order, future approval, and unexpected fields fail without echoing values')

const template = JSON.parse(await readFile(new URL('../pilot-operator-readiness.template.json', import.meta.url), 'utf8'))
const templateIssues = validatePilotOperatorReadiness(template, today)
assert(templateIssues.length >= 10)
assert(templateIssues.some(issue => issue.includes('operator.identityNotice')), 'underscore-style replacement tokens must fail explicitly')
console.log('✓ the tracked placeholder template cannot authorize participant contact')
