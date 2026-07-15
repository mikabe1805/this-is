import assert from 'node:assert/strict'
import {
  GROUP_DRAFT_PASS_LIFETIME_MS,
  canonicalGroupDraft,
  groupDraftKey,
  groupDraftPassId,
  validGroupDraftPass,
} from './group-draft.js'

const identity = {
  permissionVersion: 3,
  evidenceUpdatedAt: 1_789_000_000_000,
  attendeeUids: ['ari', 'mika', 'vivian'],
  guestCount: 1 as const,
  context: 'Coffee' as const,
  planArea: 'Cresskill, NJ',
  requiredObservation: 'quiet',
  recentPlaceId: 'o:last',
}
assert.equal(canonicalGroupDraft(identity), '[1,3,1789000000000,["ari","mika","vivian"],1,"Coffee","Cresskill, NJ","quiet","o:last"]')
assert.equal(groupDraftKey(identity), '5c21e88588e0b55d0bd6d98d21986e50996541af512272e645a4693742b84812')
assert.match(groupDraftPassId(groupDraftKey(identity), 'o:coffee'), /^[a-f0-9]{64}$/)
const now = 1_789_000_010_000
assert.equal(validGroupDraftPass({
  draftKey: groupDraftKey(identity), placeId: 'o:coffee', actorUid: 'mika', permissionVersion: 3,
  createdAt: now, expiresAt: now + GROUP_DRAFT_PASS_LIFETIME_MS,
}, now), true)
assert.equal(validGroupDraftPass({
  draftKey: groupDraftKey(identity), placeId: 'o:coffee', actorUid: 'mika', permissionVersion: 3,
  createdAt: now, expiresAt: now,
}, now), false)

console.log('✓ shared draft identity is deterministic, area-opaque at rest, bounded, and expiring')
