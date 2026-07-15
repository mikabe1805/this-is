import { readFile } from 'node:fs/promises'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setLogLevel,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'

setLogLevel('silent')

const projectId = 'demo-this-is-v2'
const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8')
const testEnv = await initializeTestEnvironment({
  projectId,
  firestore: { host: '127.0.0.1', port: 8180, rules },
})

const alice = testEnv.authenticatedContext('alice').firestore()
const bob = testEnv.authenticatedContext('bob').firestore()
const charlie = testEnv.authenticatedContext('charlie').firestore()
const dana = testEnv.authenticatedContext('dana').firestore()
const erin = testEnv.authenticatedContext('erin').firestore()
const guest = testEnv.unauthenticatedContext().firestore()

const memory = (placeId, label = 'Place Two', category = 'other') => ({
  placeId,
  label,
  category,
  hex: {
    food: '#704739', drinks: '#633C48', coffee: '#5A463C', activity: '#46525A', other: '#4A3A43',
  }[category],
  provenance: 'user_confirmed',
})

const validPick = (id, overrides = {}) => ({
  id,
  createdBy: 'alice',
  memberUids: ['alice', 'bob'],
  withUid: 'bob',
  withName: 'Bob',
  placeId: 'g:place-1',
  place: { name: 'Place One', primaryType: 'restaurant', hex: '#4A3038' },
  reasonCode: 'both_want',
  reason: 'You both want this.',
  context: 'Anything',
  status: 'selected',
  createdAt: 100,
  updatedAt: 100,
  ...overrides,
})

async function check(name, assertion) {
  await assertion()
  console.log(`✓ ${name}`)
}

try {
  await testEnv.withSecurityRulesDisabled(async context => {
    const admin = context.firestore()
    await setDoc(doc(admin, 'users', 'alice'), { following: [] })
    await setDoc(doc(admin, 'users', 'bob'), { following: [] })
    await setDoc(doc(admin, 'users', 'charlie'), { following: [] })
    await setDoc(doc(admin, 'users', 'dana'), { following: [], deleting: true })
    await setDoc(doc(admin, 'saves', 'bob__g:place-1'), {
      uid: 'bob',
      placeId: 'g:place-1',
      tag: 'loved',
      visibility: 'circle',
      ts: 100,
      memory: memory('g:place-1', 'Place One', 'food'),
    })
    await setDoc(doc(admin, 'saves', 'bob__g:private'), {
      uid: 'bob',
      placeId: 'g:private',
      tag: 'want',
      visibility: 'private',
      ts: 101,
      place: { name: 'Private Place', hex: '#3A2B31' },
    })
    await setDoc(doc(admin, 'saves', 'charlie__g:migrated'), {
      uid: 'charlie', placeId: 'g:migrated', tag: 'loved', visibility: 'circle', ts: 102,
      place: { name: 'Migrated Place', hex: '#49352F' },
    })
    await setDoc(doc(admin, 'connections', 'alice__charlie'), {
      memberUids: ['alice', 'charlie'], invitedBy: 'alice', acceptedBy: 'charlie',
      inviteToken: 'old-token', status: 'migrated', migratedGroupId: 'pair-proof',
      createdAt: 1, migratedAt: 2,
    })
    await setDoc(doc(admin, 'connections', 'alice__bob'), {
      memberUids: ['alice', 'bob'], invitedBy: 'alice', acceptedBy: 'bob',
      inviteToken: 'historical-token', status: 'active', createdAt: 1,
    })
    await setDoc(doc(admin, 'picks', 'valid'), validPick('valid'))
    await setDoc(doc(admin, 'picks', 'immutable'), validPick('immutable'))
    await setDoc(doc(admin, 'picks', 'terminal'), validPick('terminal'))
    await setDoc(doc(admin, 'picks', 'delete-me'), validPick('delete-me'))
    await setDoc(doc(admin, 'places', 'g:place-1'), {
      name: 'Place One',
      photoHex: '#4A3038',
    })
    await setDoc(doc(admin, 'placeAliases', 'a'.repeat(64)), {
      schemaVersion: 1, status: 'confirmed', ownedPlaceIds: ['o:place-1'], confirmedAt: 1,
    })
    await setDoc(doc(admin, 'shares', 'legacy-public-board'), { title: 'Old board' })
    await setDoc(doc(admin, 'curated', 'legacy-editorial-place'), { name: 'Old catalog place' })
    await setDoc(doc(admin, 'cities', '40.5_-74.5', 'candidates', 'g:seeded'), { name: 'Seeded place' })
    await setDoc(doc(admin, 'invites', 'expired-token'), {
      inviterUid: 'alice',
      status: 'active',
      createdAt: Timestamp.fromMillis(Date.now() - 20_000),
      expiresAt: Timestamp.fromMillis(Date.now() - 10_000),
    })
    await setDoc(doc(admin, 'groups', 'friday-table'), {
      name: 'Friday Table',
      status: 'active',
      memberUids: ['alice', 'bob'],
      members: [
        { uid: 'alice', displayName: 'Alice', avatarHex: '#8E5A6B' },
        { uid: 'bob', displayName: 'Bob', avatarHex: '#5A6B8E' },
      ],
      membershipLocked: true,
      permissionVersion: 2,
      projectionCount: 2,
    })
    await setDoc(doc(admin, 'groups', 'former-member-table'), {
      name: 'Former Member Table',
      status: 'active',
      memberUids: ['alice'],
      members: [
        { uid: 'alice', displayName: 'Alice', avatarHex: '#8E5A6B' },
      ],
      membershipLocked: true,
      permissionVersion: 3,
      projectionCount: 0,
    })
    await setDoc(doc(admin, 'groups', 'friday-table', 'signals', 'alice__g:place-1'), {
      uid: 'alice',
      placeId: 'g:place-1',
      tag: 'want',
      visibility: 'circle',
      ts: 100,
      place: { name: 'Place One', hex: '#4A3038' },
      permissionVersion: 2,
    })
    await setDoc(doc(admin, 'groups', 'friday-table', 'signals', 'bob__g:stale'), {
      uid: 'bob',
      placeId: 'g:stale',
      tag: 'loved',
      visibility: 'circle',
      ts: 90,
      place: { name: 'Stale Place', hex: '#3A2B31' },
      permissionVersion: 1,
    })
    await setDoc(doc(admin, 'groups', 'friday-table', 'preferences', 'alice'), {
      uid: 'alice', categoryHints: ['coffee'], constraintHints: ['quiet'], permissionVersion: 2,
    })
    await setDoc(doc(admin, 'groups', 'friday-table', 'preferences', 'bob'), {
      uid: 'bob', categoryHints: ['food'], constraintHints: ['casual'], permissionVersion: 1,
    })
    await setDoc(doc(admin, 'groups', 'friday-table', 'draftPasses', 'current-pass'), {
      draftKey: 'a'.repeat(64), placeId: 'g:place-1', actorUid: 'alice', permissionVersion: 2,
      createdAt: Timestamp.fromMillis(Date.now()),
      expiresAt: Timestamp.fromMillis(Date.now() + 6 * 60 * 60 * 1000),
    })
    await setDoc(doc(admin, 'groups', 'friday-table', 'draftPasses', 'stale-pass'), {
      draftKey: 'b'.repeat(64), placeId: 'g:stale', actorUid: 'bob', permissionVersion: 1,
      createdAt: Timestamp.fromMillis(Date.now()),
      expiresAt: Timestamp.fromMillis(Date.now() + 6 * 60 * 60 * 1000),
    })
    await setDoc(doc(admin, 'groups', 'friday-table', 'draftPasses', 'expired-pass'), {
      draftKey: 'c'.repeat(64), placeId: 'g:place-1', actorUid: 'alice', permissionVersion: 2,
      createdAt: Timestamp.fromMillis(Date.now() - 7 * 60 * 60 * 1000),
      expiresAt: Timestamp.fromMillis(Date.now() - 60 * 60 * 1000),
    })
    await setDoc(doc(admin, 'groupInvites', 'group-token'), {
      groupId: 'friday-table', groupName: 'Friday Table', invitedBy: 'alice',
      inviterName: 'Alice', inviterAvatarHex: '#8E5A6B', memberCountAtCreation: 2,
      status: 'active', createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + 60_000),
    })
    await setDoc(doc(admin, 'groupInvites', 'accepted-group-token'), {
      groupId: 'friday-table', groupName: 'Friday Table', invitedBy: 'alice',
      inviterName: 'Alice', inviterAvatarHex: '#8E5A6B', memberCountAtCreation: 1,
      status: 'accepted', acceptedBy: 'bob', acceptedAt: Timestamp.now(),
      createdAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() + 60_000),
    })
    await setDoc(doc(admin, 'groupInvites', 'former-member-token'), {
      groupId: 'former-member-table', groupName: 'Former Member Table', invitedBy: 'alice',
      inviterName: 'Alice', inviterAvatarHex: '#8E5A6B', memberCountAtCreation: 1,
      status: 'accepted', acceptedBy: 'bob', acceptedAt: Timestamp.now(),
      createdAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() + 60_000),
    })
    await setDoc(doc(admin, 'picks', 'group-pick'), {
      kind: 'group', id: 'group-pick', groupId: 'friday-table', groupName: 'Friday Table',
      groupPermissionVersion: 2, createdBy: 'alice', memberUids: ['alice', 'bob'],
      attendeeUids: ['alice', 'bob'],
      attendees: [
        { uid: 'alice', displayName: 'Alice', avatarHex: '#8E5A6B' },
        { uid: 'bob', displayName: 'Bob', avatarHex: '#5A6B8E' },
      ],
      placeId: 'g:place-1', memory: memory('g:place-1', 'Place One', 'food'),
      reasonCode: 'everyone_wants', reason: 'All 2 want this.', context: 'Anything',
      status: 'selected', createdAt: 1, updatedAt: 1,
    })
    await setDoc(doc(admin, 'pickReceipts', 'receiptTokenProof123'), {
      placeId: 'g:place-1', placeName: 'Place One', reason: 'All 2 want this.',
      context: 'Anything', attendeeCount: 2, status: 'selected',
      createdAt: 1, expiresAt: Date.now() + 60_000,
    })
    await setDoc(doc(admin, 'accountDeletionOps', 'deletionOperationProof123'), {
      status: 'complete', completedAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + 60_000),
    })
  })

  await check('retired public board snapshots are no longer readable', () =>
    assertFails(getDoc(doc(guest, 'shares', 'legacy-public-board'))))

  await check('retired editorial catalog documents are no longer public', () =>
    assertFails(getDoc(doc(guest, 'curated', 'legacy-editorial-place'))))

  await check('retired Google-seeded candidate pools are no longer readable', () =>
    assertFails(getDoc(doc(guest, 'cities', '40.5_-74.5', 'candidates', 'g:seeded'))))

  await check('server-owned place aliases are not publicly readable', () =>
    assertFails(getDoc(doc(guest, 'placeAliases', 'a'.repeat(64)))))

  await check('a signed-in client cannot read or enumerate server-owned place aliases', async () => {
    await assertFails(getDoc(doc(alice, 'placeAliases', 'a'.repeat(64))))
    await assertFails(getDocs(collection(alice, 'placeAliases')))
  })

  await check('a signed-in client cannot forge a provider alias', () =>
    assertFails(setDoc(doc(alice, 'placeAliases', 'b'.repeat(64)), {
      schemaVersion: 1, status: 'confirmed', ownedPlaceIds: ['o:forged'], confirmedAt: 2,
    })))

  const validEvent = {
    name: 'pair_opened',
    properties: { sharedCount: 2, candidateCount: 3 },
    schemaVersion: 1,
    ts: Timestamp.fromMillis(100),
    expiresAt: Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000),
  }

  await check('a person can write a privacy-minimal product event', () =>
    assertSucceeds(setDoc(doc(alice, 'users', 'alice', 'events', 'valid'), validEvent)))

  await check('product events are unreadable even to their owner', () =>
    assertFails(getDoc(doc(alice, 'users', 'alice', 'events', 'valid'))))

  await check('a person cannot write analytics under another account', () =>
    assertFails(setDoc(doc(bob, 'users', 'alice', 'events', 'other-writer'), validEvent)))

  await check('event properties cannot carry a place identifier', () =>
    assertFails(setDoc(doc(alice, 'users', 'alice', 'events', 'sensitive'), {
      ...validEvent,
      properties: { ...validEvent.properties, placeId: 'g:secret-place' },
    })))

  await check('an allowed event field cannot smuggle arbitrary text', () =>
    assertFails(setDoc(doc(alice, 'users', 'alice', 'events', 'text-smuggle'), {
      ...validEvent,
      properties: { context: 'Meet Jane at g:secret-place' },
    })))

  await check('aggregate event counts are strictly bounded', () =>
    assertFails(setDoc(doc(alice, 'users', 'alice', 'events', 'count-smuggle'), {
      ...validEvent,
      properties: { candidateCount: 999 },
    })))

  await check('product events require an explicit retention timestamp', () => {
    const { expiresAt: _expiresAt, ...withoutExpiry } = validEvent
    return assertFails(setDoc(doc(alice, 'users', 'alice', 'events', 'missing-expiry'), withoutExpiry))
  })

  await check('product events cannot extend raw retention beyond 31 days', () =>
    assertFails(setDoc(doc(alice, 'users', 'alice', 'events', 'long-expiry'), {
      ...validEvent,
      expiresAt: Timestamp.fromMillis(Date.now() + 90 * 24 * 60 * 60 * 1000),
    })))

  await check('product events cannot be rewritten', () =>
    assertFails(updateDoc(doc(alice, 'users', 'alice', 'events', 'valid'), {
      properties: { sharedCount: 99 },
    })))

  await check('product events cannot be client-deleted', () =>
    assertFails(deleteDoc(doc(alice, 'users', 'alice', 'events', 'valid'))))

  await check('clients cannot create retired pair invitations', () =>
    assertFails(setDoc(doc(alice, 'invites', 'alice-token'), {
      inviterUid: 'alice',
      inviterName: 'Alice',
      inviterAvatarHex: '#8E5A6B',
      status: 'active',
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })))

  await check('historical pair invitation tokens are no longer public', () =>
    assertFails(getDoc(doc(guest, 'invites', 'expired-token'))))

  await check('clients cannot create new pair connections', () =>
    assertFails(setDoc(doc(bob, 'connections', 'alice__bob'), {
      memberUids: ['alice', 'bob'],
      invitedBy: 'alice',
      acceptedBy: 'bob',
      inviteToken: 'alice-token',
      status: 'active',
      createdAt: 60,
    })))

  await check('a connection outsider cannot read the pair', () =>
    assertFails(getDoc(doc(charlie, 'connections', 'alice__bob'))))

  await check('an accepted member can read their recurring group', () =>
    assertSucceeds(getDoc(doc(alice, 'groups', 'friday-table'))))

  await check('an outsider cannot read a recurring group', () =>
    assertFails(getDoc(doc(charlie, 'groups', 'friday-table'))))

  await check('a member can query only groups containing their uid', () =>
    assertSucceeds(getDocs(query(
      collection(alice, 'groups'),
      where('memberUids', 'array-contains', 'alice'),
      where('status', 'in', ['forming', 'active'])
    ))))

  await check('a broad group query that could expose other groups is rejected', () =>
    assertFails(getDocs(collection(alice, 'groups'))))

  await check('a member can read a current server-owned group signal', () =>
    assertSucceeds(getDoc(doc(alice, 'groups', 'friday-table', 'signals', 'alice__g:place-1'))))

  await check('a member can check their own missing group projection before explicit sharing', () =>
    assertSucceeds(getDoc(doc(alice, 'groups', 'friday-table', 'signals', 'alice__g:not-shared-yet'))))

  await check('a member cannot probe another member\u2019s missing group projection id', () =>
    assertFails(getDoc(doc(alice, 'groups', 'friday-table', 'signals', 'bob__g:not-shared-yet'))))

  await check('a stale permission-version signal is denied to current members', () =>
    assertFails(getDoc(doc(alice, 'groups', 'friday-table', 'signals', 'bob__g:stale'))))

  await check('a group outsider cannot read projected taste evidence', () =>
    assertFails(getDoc(doc(charlie, 'groups', 'friday-table', 'signals', 'alice__g:place-1'))))

  await check('a member can read a current bounded Quick start hint', () =>
    assertSucceeds(getDoc(doc(bob, 'groups', 'friday-table', 'preferences', 'alice'))))

  await check('a stale Quick start hint is denied after an audience change', () =>
    assertFails(getDoc(doc(alice, 'groups', 'friday-table', 'preferences', 'bob'))))

  await check('an outsider cannot read category-level Quick start taste', () =>
    assertFails(getDoc(doc(charlie, 'groups', 'friday-table', 'preferences', 'alice'))))

  await check('clients cannot forge Quick start hints', () =>
    assertFails(setDoc(doc(alice, 'groups', 'friday-table', 'preferences', 'alice'), {
      uid: 'alice', categoryHints: ['food'], constraintHints: [], permissionVersion: 2,
    })))

  await check('a current member can read one unexpired server-owned draft pass', () =>
    assertSucceeds(getDoc(doc(bob, 'groups', 'friday-table', 'draftPasses', 'current-pass'))))

  await check('a current member can watch an exact candidate with no draft pass yet', () =>
    assertSucceeds(getDoc(doc(bob, 'groups', 'friday-table', 'draftPasses', 'missing-pass'))))

  await check('a stale permission-version draft pass is denied', () =>
    assertFails(getDoc(doc(alice, 'groups', 'friday-table', 'draftPasses', 'stale-pass'))))

  await check('an expired draft pass is denied while TTL cleanup catches up', () =>
    assertFails(getDoc(doc(alice, 'groups', 'friday-table', 'draftPasses', 'expired-pass'))))

  await check('an outsider cannot read a group draft pass', () =>
    assertFails(getDoc(doc(charlie, 'groups', 'friday-table', 'draftPasses', 'current-pass'))))

  await check('clients cannot forge or overwrite attributed draft passes', () =>
    assertFails(setDoc(doc(alice, 'groups', 'friday-table', 'draftPasses', 'forged-pass'), {
      draftKey: 'd'.repeat(64), placeId: 'g:place-1', actorUid: 'alice', permissionVersion: 2,
      createdAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() + 6 * 60 * 60 * 1000),
    })))

  await check('clients cannot create group documents', () =>
    assertFails(setDoc(doc(alice, 'groups', 'forged-group'), {
      name: 'Forged', status: 'active', memberUids: ['alice', 'charlie'], permissionVersion: 1,
    })))

  await check('clients cannot forge group signal projections', () =>
    assertFails(setDoc(doc(alice, 'groups', 'friday-table', 'signals', 'alice__g:forged'), {
      uid: 'alice', placeId: 'g:forged', tag: 'loved', visibility: 'circle', ts: 1,
      place: { name: 'Forged', hex: '#000000' }, permissionVersion: 2,
    })))

  await check('a bounded active group invite can be previewed before sign-in', () =>
    assertSucceeds(getDoc(doc(guest, 'groupInvites', 'group-token'))))

  await check('an accepted recipient who remains a member can recover that exact invite', () =>
    assertSucceeds(getDoc(doc(bob, 'groupInvites', 'accepted-group-token'))))

  await check('an accepted invite stays hidden from guests and other signed-in people', async () => {
    await assertFails(getDoc(doc(guest, 'groupInvites', 'accepted-group-token')))
    await assertFails(getDoc(doc(charlie, 'groupInvites', 'accepted-group-token')))
  })

  await check('an accepted invite becomes hidden when its recipient leaves the group', () =>
    assertFails(getDoc(doc(bob, 'groupInvites', 'former-member-token'))))

  await check('opaque group invites cannot be enumerated even with an active-status query', () =>
    assertFails(getDocs(query(collection(guest, 'groupInvites'), where('status', '==', 'active')))))

  await check('clients cannot forge group invitation snapshots', () =>
    assertFails(setDoc(doc(alice, 'groupInvites', 'forged-group-token'), {
      groupId: 'friday-table', groupName: 'Friday Table', invitedBy: 'alice',
      inviterName: 'Alice', inviterAvatarHex: '#8E5A6B', memberCountAtCreation: 2,
      status: 'active', createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + 60_000),
    })))

  await check('public Pick receipt documents cannot be read directly', () =>
    assertFails(getDoc(doc(guest, 'pickReceipts', 'receiptTokenProof123'))))

  await check('group members cannot rewrite public Pick receipts', () =>
    assertFails(updateDoc(doc(alice, 'pickReceipts', 'receiptTokenProof123'), { attendeeCount: 6 })))

  await check('account deletion operation tombstones cannot be read or enumerated by clients', async () => {
    await assertFails(getDoc(doc(guest, 'accountDeletionOps', 'deletionOperationProof123')))
    await assertFails(getDoc(doc(alice, 'accountDeletionOps', 'deletionOperationProof123')))
    await assertFails(getDocs(collection(alice, 'accountDeletionOps')))
  })

  await check('clients cannot forge an account deletion operation', () =>
    assertFails(setDoc(doc(alice, 'accountDeletionOps', 'forgedDeletionOperation'), {
      status: 'complete', expiresAt: Timestamp.fromMillis(Date.now() + 60_000),
    })))

  await check('a current group member can read a server-owned group Pick', () =>
    assertSucceeds(getDoc(doc(bob, 'picks', 'group-pick'))))

  await check('a group outsider cannot read a group Pick', () =>
    assertFails(getDoc(doc(charlie, 'picks', 'group-pick'))))

  await check('clients cannot rewrite a server-owned group Pick', () =>
    assertFails(updateDoc(doc(bob, 'picks', 'group-pick'), { status: 'visited', updatedAt: 2 })))

  await check('clients cannot forge a group Pick', () =>
    assertFails(setDoc(doc(alice, 'picks', 'forged-group-pick'), {
      kind: 'group', id: 'forged-group-pick', groupId: 'friday-table', groupName: 'Friday Table',
      createdBy: 'alice', memberUids: ['alice', 'bob'], attendeeUids: ['alice', 'bob'],
      placeId: 'g:place-1', place: { name: 'Place One', hex: '#4A3038' },
      reasonCode: 'everyone_wants', reason: 'All 2 want this.', context: 'Anything',
      status: 'selected', createdAt: 1, updatedAt: 1,
    })))

  await check('a person cannot mutate another profile to force a follow', () =>
    assertFails(updateDoc(doc(bob, 'users', 'alice'), { following: ['bob'] })))

  await check('a new account can create only its bounded profile', () =>
    assertSucceeds(setDoc(doc(erin, 'users', 'erin'), {
      displayName: 'Erin',
      handle: '@erin',
      avatarHex: '#5A6B8E',
    })))

  await check('a profile cannot carry arbitrary private data', () =>
    assertFails(updateDoc(doc(alice, 'users', 'alice'), { secretArchive: 'not-profile-data' })))

  await check('a client cannot mark an account as deleting', () =>
    assertFails(updateDoc(doc(alice, 'users', 'alice'), { deleting: true })))

  await check('a client cannot directly delete its profile and orphan subcollections', () =>
    assertFails(deleteDoc(doc(alice, 'users', 'alice'))))

  await check('the server-side deletion lock blocks new signals', () =>
    assertFails(setDoc(doc(dana, 'saves', 'dana__g:locked'), {
      uid: 'dana',
      placeId: 'g:locked',
      tag: 'want',
      visibility: 'private',
      ts: 1,
      memory: memory('g:locked', 'Locked'),
    })))

  await check('the server-side deletion lock blocks new invitations', () =>
    assertFails(setDoc(doc(dana, 'invites', 'locked-token'), {
      inviterUid: 'dana',
      status: 'active',
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000),
    })))

  await check('clients cannot create new pair Picks', () =>
    assertFails(setDoc(doc(alice, 'picks', 'new-pair-pick'), validPick('new-pair-pick'))))

  await check('the other member can read the Pick', () =>
    assertSucceeds(getDoc(doc(bob, 'picks', 'valid'))))

  await check('an outsider cannot read the Pick', () =>
    assertFails(getDoc(doc(charlie, 'picks', 'valid'))))

  await check('a self-Pick is rejected', () =>
    assertFails(setDoc(doc(alice, 'picks', 'self'), validPick('self', {
      memberUids: ['alice', 'alice'],
      withUid: 'alice',
    }))))

  await check('a creator outside the member list is rejected', () =>
    assertFails(setDoc(doc(alice, 'picks', 'outside'), validPick('outside', {
      memberUids: ['bob', 'charlie'],
      withUid: 'bob',
    }))))

  await check('a Pick cannot name a person outside the creator’s connections', () =>
    assertFails(setDoc(doc(alice, 'picks', 'not-connected'), validPick('not-connected', {
      memberUids: ['alice', 'charlie'],
      withUid: 'charlie',
      withName: 'Charlie',
    }))))

  await check('a Pick cannot carry arbitrary extra fields', () =>
    assertFails(setDoc(doc(alice, 'picks', 'extra-field'), validPick('extra-field', {
      privateHistory: 'should never be stored here',
    }))))

  await check('a Pick reason is bounded', () =>
    assertFails(setDoc(doc(alice, 'picks', 'long-reason'), validPick('long-reason', {
      reason: 'x'.repeat(181),
    }))))

  await check('a member cannot rewrite the original reason or evidence', () =>
    assertFails(updateDoc(doc(bob, 'picks', 'immutable'), {
      reason: 'The algorithm said so.',
      updatedAt: 101,
    })))

  await check('the other member can close a selected Pick as visited', () =>
    assertSucceeds(updateDoc(doc(bob, 'picks', 'terminal'), {
      status: 'visited',
      updatedAt: 101,
    })))

  await check('a terminal Pick cannot flip from visited to dismissed', () =>
    assertFails(updateDoc(doc(alice, 'picks', 'terminal'), {
      status: 'dismissed',
      updatedAt: 102,
    })))

  await check('an outsider cannot delete a Pick', () =>
    assertFails(deleteDoc(doc(charlie, 'picks', 'delete-me'))))
  await check('the creator can delete their Pick', () =>
    assertSucceeds(deleteDoc(doc(alice, 'picks', 'delete-me'))))

  await check('a person can read a save from their intentional circle', () =>
    assertSucceeds(getDoc(doc(alice, 'saves', 'bob__g:place-1'))))

  await check('a migrated pair no longer grants legacy circle visibility', () =>
    assertFails(getDoc(doc(alice, 'saves', 'charlie__g:migrated'))))

  await check('clients cannot delete the server migration marker', () =>
    assertFails(deleteDoc(doc(alice, 'connections', 'alice__charlie'))))

  await check('an outsider cannot read that save', () =>
    assertFails(getDoc(doc(charlie, 'saves', 'bob__g:place-1'))))

  await check('an owner can read their private signal', () =>
    assertSucceeds(getDoc(doc(bob, 'saves', 'bob__g:private'))))

  await check('an owner can read their own missing save before an idempotent create', () =>
    assertSucceeds(getDoc(doc(alice, 'saves', 'alice__g:first-save'))))

  await check('a person cannot probe another owner’s missing save id', () =>
    assertFails(getDoc(doc(alice, 'saves', 'bob__g:not-there'))))

  await check('a connection cannot read a private signal', () =>
    assertFails(getDoc(doc(alice, 'saves', 'bob__g:private'))))

  await check('a connection can query only explicitly shared signals', () =>
    assertSucceeds(getDocs(query(
      collection(alice, 'saves'),
      where('uid', '==', 'bob'),
      where('visibility', '==', 'circle')
    ))))

  await check('a broad connection query that could include private signals is rejected', () =>
    assertFails(getDocs(query(collection(alice, 'saves'), where('uid', '==', 'bob')))))

  await check('a person can write their own signal', () =>
    assertSucceeds(setDoc(doc(alice, 'saves', 'alice__g:place-2'), {
      uid: 'alice',
      placeId: 'g:place-2',
      tag: 'want',
      visibility: 'circle',
      ts: 200,
      memory: memory('g:place-2'),
    })))

  await check('a person can add one bounded user-confirmed place area', () =>
    assertSucceeds(setDoc(doc(alice, 'saves', 'alice__g:place-area'), {
      uid: 'alice', placeId: 'g:place-area', tag: 'want', visibility: 'private', ts: 200,
      memory: { ...memory('g:place-area'), area: 'Cresskill, NJ' },
    })))

  await check('an unbounded place area is rejected', () =>
    assertFails(setDoc(doc(alice, 'saves', 'alice__g:long-area'), {
      uid: 'alice', placeId: 'g:long-area', tag: 'want', visibility: 'private', ts: 200,
      memory: { ...memory('g:long-area'), area: 'x'.repeat(81) },
    })))

  await check('a person can add bounded private user-authored observations', () =>
    assertSucceeds(setDoc(doc(alice, 'saves', 'alice__g:observed'), {
      uid: 'alice', placeId: 'g:observed', tag: 'loved', visibility: 'private', ts: 200,
      memory: memory('g:observed'),
      observations: {
        quiet: { value: 'yes', observedAt: 200, audience: 'private', source: 'user_authored' },
        easy_parking: { value: 'no', observedAt: 201, audience: 'private', source: 'user_authored' },
      },
    })))

  await check('a client cannot label provider-inferred content as an observation', () =>
    assertFails(setDoc(doc(alice, 'saves', 'alice__g:provider-observation'), {
      uid: 'alice', placeId: 'g:provider-observation', tag: 'want', visibility: 'private', ts: 200,
      memory: memory('g:provider-observation'),
      observations: { quiet: { value: 'yes', observedAt: 200, audience: 'private', source: 'google' } },
    })))

  await check('a client cannot make a canonical observation group-visible directly', () =>
    assertFails(setDoc(doc(alice, 'saves', 'alice__g:group-observation'), {
      uid: 'alice', placeId: 'g:group-observation', tag: 'want', visibility: 'private', ts: 200,
      memory: memory('g:group-observation'),
      observations: { quiet: { value: 'yes', observedAt: 200, audience: 'group', source: 'user_authored' } },
    })))

  await check('unsupported safety claims cannot enter the observation schema', () =>
    assertFails(setDoc(doc(alice, 'saves', 'alice__g:safety-observation'), {
      uid: 'alice', placeId: 'g:safety-observation', tag: 'want', visibility: 'private', ts: 200,
      memory: memory('g:safety-observation'),
      observations: { allergen_safe: { value: 'yes', observedAt: 200, audience: 'private', source: 'user_authored' } },
    })))

  await check('a memory cannot point at a different place id', () =>
    assertFails(setDoc(doc(alice, 'saves', 'alice__g:mismatch'), {
      uid: 'alice', placeId: 'g:mismatch', tag: 'want', visibility: 'private', ts: 200,
      memory: memory('g:somewhere-else'),
    })))

  await check('a provider-derived label cannot claim user-confirmed provenance', () =>
    assertFails(setDoc(doc(alice, 'saves', 'alice__g:provider-memory'), {
      uid: 'alice', placeId: 'g:provider-memory', tag: 'want', visibility: 'private', ts: 200,
      memory: { ...memory('g:provider-memory'), provenance: 'google_places' },
    })))

  await check('category color is deterministic rather than client-authored metadata', () =>
    assertFails(setDoc(doc(alice, 'saves', 'alice__g:wrong-color'), {
      uid: 'alice', placeId: 'g:wrong-color', tag: 'want', visibility: 'private', ts: 200,
      memory: { ...memory('g:wrong-color', 'Wrong color', 'coffee'), hex: '#000000' },
    })))

  await check('a person cannot write a signal for someone else', () =>
    assertFails(setDoc(doc(alice, 'saves', 'bob__g:place-2'), {
      uid: 'bob',
      placeId: 'g:place-2',
      tag: 'loved',
      visibility: 'circle',
      ts: 200,
      memory: memory('g:place-2'),
    })))

  await check('a person cannot change someone else’s signal visibility', () =>
    assertFails(updateDoc(doc(alice, 'saves', 'bob__g:place-1'), { visibility: 'private' })))

  await check('a new legacy provider snapshot is rejected even with explicit visibility', () =>
    assertFails(setDoc(doc(alice, 'saves', 'alice__g:legacy'), {
      uid: 'alice',
      placeId: 'g:legacy',
      tag: 'want',
      visibility: 'circle',
      ts: 201,
      place: { name: 'Legacy', hex: '#3A2B31' },
    })))

  await check('a signal cannot carry an unbounded note', () =>
    assertFails(setDoc(doc(alice, 'saves', 'alice__g:long-note'), {
      uid: 'alice',
      placeId: 'g:long-note',
      tag: 'want',
      visibility: 'private',
      ts: 202,
      note: 'x'.repeat(281),
      memory: memory('g:long-note', 'Long Note'),
    })))

  await check('legacy provider-derived place facts are no longer publicly readable', () =>
    assertFails(getDoc(doc(guest, 'places', 'g:place-1'))))

  await check('a signed-in client cannot overwrite canonical place facts', () =>
    assertFails(updateDoc(doc(alice, 'places', 'g:place-1'), { name: 'Tampered' })))

  await check('a signed-in client cannot create canonical place facts', () =>
    assertFails(setDoc(doc(alice, 'places', 'g:forged'), { name: 'Forged', photoHex: '#000000' })))

  await check('either member can disconnect the pair', () =>
    assertSucceeds(deleteDoc(doc(alice, 'connections', 'alice__bob'))))

  await check('disconnection immediately removes circle access', () =>
    assertFails(getDoc(doc(alice, 'saves', 'bob__g:place-1'))))

  console.log('Firestore authorization suite passed.')
} finally {
  await testEnv.cleanup()
}
