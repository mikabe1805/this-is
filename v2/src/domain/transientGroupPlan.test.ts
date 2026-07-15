import {
  currentTransientGroupPlanDraft,
  normalizeTransientGroupPlanDraft,
  transientGroupPlanReducer,
  type TransientGroupPlanDraftInput,
} from './transientGroupPlan.js'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

const input: TransientGroupPlanDraftInput = {
  groupId: 'family-table',
  memberUid: 'mika',
  permissionVersion: 4,
  memberUids: ['mika', 'vivian', 'ari'],
  attendeeUids: ['ari', 'mika'],
  guestIncluded: true,
  context: 'Food',
  planArea: '  Cresskill,   NJ ',
  requiredObservation: 'family_friendly',
}

const normalized = normalizeTransientGroupPlanDraft(input)
assert(normalized?.planArea === 'Cresskill, NJ', 'temporary area is bounded and normalized in memory')
assert(normalized?.attendeeUids.join('|') === 'mika|ari', 'attendees return in authoritative group order')
assert(normalized?.guestIncluded && normalized.context === 'Food', 'guest and explicit plan context survive')

assert(normalizeTransientGroupPlanDraft({ ...input, attendeeUids: ['mika'] }) === null,
  'a restored group plan still requires at least two selected members')
assert(normalizeTransientGroupPlanDraft({ ...input, attendeeUids: ['mika', 'outsider'] }) === null,
  'an attendee outside the captured audience fails closed')
assert(normalizeTransientGroupPlanDraft({ ...input, context: 'Activity' }) === null,
  'an unsupported planning context fails closed')
assert(normalizeTransientGroupPlanDraft({ ...input, requiredObservation: 'worth_a_drive' }) === null,
  'a non-planner observation cannot become a practical requirement')

const currentEvidence = {
  groupId: 'family-table',
  memberUid: 'mika',
  permissionVersion: 4,
  memberUids: ['mika', 'vivian', 'ari'],
}
assert(currentTransientGroupPlanDraft(normalized, currentEvidence)?.planArea === 'Cresskill, NJ',
  'the exact current member and permission boundary can restore the draft')
assert(currentTransientGroupPlanDraft(normalized, { ...currentEvidence, memberUid: 'vivian' }) === null,
  'a different signed-in member cannot inherit the draft')
assert(currentTransientGroupPlanDraft(normalized, { ...currentEvidence, permissionVersion: 5 }) === null,
  'an audience-version change invalidates the draft')
assert(currentTransientGroupPlanDraft(normalized, {
  ...currentEvidence,
  memberUids: ['mika', 'vivian', 'noa'],
}) === null, 'a changed member audience invalidates the draft even if a version is malformed upstream')

const remembered = transientGroupPlanReducer(null, { type: 'remember', draft: input })
assert(Boolean(remembered), 'a valid draft occupies the single in-memory slot')
assert(transientGroupPlanReducer(remembered, { type: 'clear', groupId: 'another-group' }) === remembered,
  'a group-scoped clear cannot discard another group draft')
assert(transientGroupPlanReducer(remembered, { type: 'clear', groupId: 'family-table' }) === null,
  'the owning group can clear its draft')
assert(transientGroupPlanReducer(remembered, { type: 'remember', draft: { ...input, memberUid: '' } }) === null,
  'invalid replacement clears stale plan state instead of retaining it')

console.log('PASS transient group plans stay memory-only, normalized, clearable, and stale-safe')
