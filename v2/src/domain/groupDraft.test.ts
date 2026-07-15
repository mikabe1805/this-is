import { canonicalGroupDraft, groupDraftKey, groupDraftPassId } from './groupDraft.js'

function equal(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`)
}

const identity = {
  permissionVersion: 3,
  evidenceUpdatedAt: 1_789_000_000_000,
  attendeeUids: ['ari', 'mika', 'vivian'],
  guestCount: 1 as const,
  context: 'Coffee' as const,
  planArea: 'Cresskill, NJ',
  requiredObservation: 'quiet' as const,
  recentPlaceId: 'o:last',
}
equal(canonicalGroupDraft(identity), '[1,3,1789000000000,["ari","mika","vivian"],1,"Coffee","Cresskill, NJ","quiet","o:last"]', 'canonical identity')
equal(await groupDraftKey(identity), '5c21e88588e0b55d0bd6d98d21986e50996541af512272e645a4693742b84812', 'shared draft hash')
equal(await groupDraftPassId(
  '5c21e88588e0b55d0bd6d98d21986e50996541af512272e645a4693742b84812',
  'o:place',
), '742a93bd5bf6504b6afe7b99523feab5e27a49e9998125e57f5cea6df646d67e', 'deterministic pass id')

console.log('✓ client and server share one opaque group-draft identity')
