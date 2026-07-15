import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const projectId = 'demo-this-is-v2'
initializeApp({ projectId })
const db = getFirestore()
const { syncGroupSignalProjections } = await import('../v2-functions/lib/index.js')
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST
if (!authHost || !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Run through Firebase auth + Firestore emulators.')
}

async function signup(email) {
  const response = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'correct-horse-battery', returnSecureToken: true }),
  })
  assert.equal(response.status, 200)
  return response.json()
}

const owner = await signup('group-owner@example.test')
const member = await signup('group-member@example.test')
const outsider = await signup('group-outsider@example.test')
const intruder = await signup('group-intruder@example.test')
const overflow = await signup('group-overflow@example.test')
const pairOwner = await signup('pair-owner@example.test')
const pairMember = await signup('pair-member@example.test')
await Promise.all([
  db.collection('users').doc(owner.localId).set({ displayName: 'Mika', avatarHex: '#8E5A6B', onboardedAt: 1 }),
  db.collection('users').doc(member.localId).set({ displayName: 'Vivian', avatarHex: '#5A6B8E', onboardedAt: 1 }),
  db.collection('users').doc(outsider.localId).set({ displayName: 'Ari', avatarHex: '#6B8E5A', onboardedAt: 1 }),
  db.collection('users').doc(intruder.localId).set({ displayName: 'Noah', avatarHex: '#8E7A5A', onboardedAt: 1 }),
  db.collection('users').doc(overflow.localId).set({ displayName: 'Remy', avatarHex: '#7A5A8E', onboardedAt: 1 }),
  db.collection('users').doc(pairOwner.localId).set({ displayName: 'June', avatarHex: '#8E5A6B', onboardedAt: 1 }),
  db.collection('users').doc(pairMember.localId).set({ displayName: 'Sol', avatarHex: '#5A6B8E', onboardedAt: 1 }),
])

const origin = `http://127.0.0.1:5001/${projectId}/us-central1`
async function post(path, token, body) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < 10_000) {
    const response = await fetch(`${origin}/${path}`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const text = await response.text()
    // emulators:exec can release the test process just before every exported
    // function is registered. Retry only that exact startup response; a real
    // function-level 404 is JSON and must remain observable to the test.
    if (response.status === 404 && /^Function .+ does not exist, valid functions are:/.test(text)) {
      await new Promise(resolve => setTimeout(resolve, 100))
      continue
    }
    let payload
    try {
      payload = JSON.parse(text)
    } catch {
      throw new Error(`${path} returned non-JSON HTTP ${response.status}: ${text.slice(0, 200)}`)
    }
    return { response, payload }
  }
  throw new Error(`Timed out waiting for the ${path} emulator function to register.`)
}

async function currentGroupAudience(groupId) {
  const group = await db.collection('groups').doc(groupId).get()
  const permissionVersion = group.data()?.permissionVersion
  const memberUids = group.data()?.memberUids
  assert.equal(group.exists, true, 'A reviewed group write requires a current group document.')
  assert.equal(Number.isSafeInteger(permissionVersion) && permissionVersion > 0, true)
  assert.equal(Array.isArray(memberUids) && memberUids.length >= 2 && memberUids.length <= 6, true)
  return { permissionVersion, memberUids: [...memberUids].sort() }
}

async function postReviewedGroupWrite(path, token, body) {
  assert.equal(['saveGroupQuickStart', 'shareGroupSignal'].includes(path), true)
  assert.notEqual(body.action, 'remove', 'Removal deliberately omits an audience review.')
  return post(path, token, { ...body, audience: await currentGroupAudience(body.groupId) })
}

async function waitUntil(label, probe, predicate, timeoutMs = 10_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const value = await probe()
    if (predicate(value)) return value
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for ${label}.`)
}

const eventSnapshot = (value) => value === null
  ? { exists: false, data: () => undefined }
  : { exists: true, data: () => value }

async function runProjectionSyncEvent(saveId, before, after) {
  await syncGroupSignalProjections.run({
    params: { saveId },
    data: { before: eventSnapshot(before), after: eventSnapshot(after) },
  })
}

const memory = (placeId, label, category = 'other', area) => ({
  placeId,
  label,
  category,
  ...(area ? { area } : {}),
  hex: { food: '#704739', drinks: '#633C48', coffee: '#5A463C', activity: '#46525A', other: '#4A3A43' }[category],
  provenance: 'user_confirmed',
})

const pairMemberUids = [pairOwner.localId, pairMember.localId].sort()
const pairConnectionId = pairMemberUids.join('__')
await Promise.all([
  db.collection('connections').doc(pairConnectionId).set({
    memberUids: pairMemberUids, invitedBy: pairOwner.localId, acceptedBy: pairMember.localId,
    inviteToken: 'legacy-pair-token', status: 'active', createdAt: 1,
  }),
  db.collection('saves').doc(`${pairOwner.localId}__o:pair-proof`).set({
    uid: pairOwner.localId, placeId: 'o:pair-proof', tag: 'loved', visibility: 'circle', ts: 1,
    note: 'Pair-only note', memory: memory('o:pair-proof', 'Pair Proof'),
  }),
  db.collection('saves').doc(`${pairMember.localId}__o:pair-private`).set({
    uid: pairMember.localId, placeId: 'o:pair-private', tag: 'want', visibility: 'private', ts: 2,
    place: { name: 'Private Pair Proof', hex: '#3A2B31' },
  }),
  db.collection('picks').doc('legacy-pair-pick').set({
    id: 'legacy-pair-pick', createdBy: pairOwner.localId, memberUids: pairMemberUids,
    withUid: pairMember.localId, withName: 'Sol', placeId: 'o:pair-proof',
    place: { name: 'Legacy provider name', hex: '#49352F' },
    memory: memory('o:pair-proof', 'Pair Proof'), reasonCode: 'my_love',
    reason: 'Your turn to introduce Sol.', context: 'Anything', status: 'selected',
    createdAt: 1, updatedAt: 1,
  }),
  db.collection('picks').doc('legacy-pair-pick-older').set({
    id: 'legacy-pair-pick-older', createdBy: pairOwner.localId, memberUids: pairMemberUids,
    withUid: pairMember.localId, withName: 'Sol', placeId: 'o:pair-proof',
    memory: memory('o:pair-proof', 'Older Pair Proof'), reasonCode: 'both_want',
    reason: 'Both want this.', context: 'Anything', status: 'selected',
    createdAt: 0, updatedAt: 0,
  }),
])
const deniedPairMigration = await post('migratePairToGroup', intruder.idToken, { otherUid: pairMember.localId })
assert.equal(deniedPairMigration.response.status, 409)
const migratedPair = await post('migratePairToGroup', pairOwner.idToken, { otherUid: pairMember.localId })
assert.equal(migratedPair.response.status, 200)
assert.equal(migratedPair.payload.migrated, true)
const migratedGroupId = migratedPair.payload.groupId
const [migratedGroup, migratedProjection, privateProjection, migratedConnection, migratedPick, olderMigratedPick] = await Promise.all([
  db.collection('groups').doc(migratedGroupId).get(),
  db.collection('groups').doc(migratedGroupId).collection('signals').doc(`${pairOwner.localId}__o:pair-proof`).get(),
  db.collection('groups').doc(migratedGroupId).collection('signals').doc(`${pairMember.localId}__o:pair-private`).get(),
  db.collection('connections').doc(pairConnectionId).get(),
  db.collection('picks').doc('legacy-pair-pick').get(),
  db.collection('picks').doc('legacy-pair-pick-older').get(),
])
assert.deepEqual(migratedGroup.data()?.memberUids, pairMemberUids)
assert.equal(migratedGroup.data()?.membershipLocked, true)
assert.equal(migratedGroup.data()?.activePick?.id, 'legacy-pair-pick')
assert.equal(migratedGroup.data()?.activePick?.label, 'Pair Proof')
assert.equal(migratedProjection.exists, true)
assert.equal('note' in migratedProjection.data(), false)
assert.equal('place' in migratedProjection.data(), false)
assert.equal(migratedProjection.data()?.memory?.label, 'Pair Proof')
assert.equal(privateProjection.exists, false)
assert.equal(migratedConnection.data()?.status, 'migrated')
assert.equal(migratedPick.data()?.kind, 'group')
assert.equal('withUid' in migratedPick.data(), false)
assert.equal('place' in migratedPick.data(), false)
assert.equal(migratedPick.data()?.memory?.label, 'Pair Proof')
assert.equal(olderMigratedPick.data()?.status, 'dismissed')
const migrationUpdateTimes = {
  group: migratedGroup.updateTime.toMillis(),
  projection: migratedProjection.updateTime.toMillis(),
  connection: migratedConnection.updateTime.toMillis(),
  pick: migratedPick.updateTime.toMillis(),
  olderPick: olderMigratedPick.updateTime.toMillis(),
}
const migrationRetry = await post('migratePairToGroup', pairMember.idToken, { otherUid: pairOwner.localId })
assert.equal(migrationRetry.response.status, 200)
assert.equal(migrationRetry.payload.groupId, migratedGroupId)
assert.equal(migrationRetry.payload.migrated, false)
const [replayedPairGroup, replayedPairProjection, replayedPairConnection, replayedPairPick, replayedOlderPairPick] = await Promise.all([
  db.collection('groups').doc(migratedGroupId).get(),
  db.collection('groups').doc(migratedGroupId).collection('signals').doc(`${pairOwner.localId}__o:pair-proof`).get(),
  db.collection('connections').doc(pairConnectionId).get(),
  db.collection('picks').doc('legacy-pair-pick').get(),
  db.collection('picks').doc('legacy-pair-pick-older').get(),
])
assert.deepEqual({
  group: replayedPairGroup.updateTime.toMillis(),
  projection: replayedPairProjection.updateTime.toMillis(),
  connection: replayedPairConnection.updateTime.toMillis(),
  pick: replayedPairPick.updateTime.toMillis(),
  olderPick: replayedOlderPairPick.updateTime.toMillis(),
}, migrationUpdateTimes)
console.log('PASS accepted pairs migrate idempotently without rewriting the audience, projections, Picks, or private notes')

const anonymous = await post('createGroup', null, { name: 'Friday Table' })
assert.equal(anonymous.response.status, 401)
console.log('PASS group creation requires a verified identity')

const missingCreationKey = await post('createGroup', owner.idToken, { name: 'Friday Table' })
assert.equal(missingCreationKey.response.status, 422)
const invalidCreationKey = await post('createGroup', owner.idToken, { name: 'Friday Table', creationKey: 'too-short' })
assert.equal(invalidCreationKey.response.status, 422)

const creationKey = 'group-create-operation-0001'
const created = await post('createGroup', owner.idToken, { name: '  Friday   Table  ', creationKey })
assert.equal(created.response.status, 201)
const groupId = created.payload.groupId
let group = await db.collection('groups').doc(groupId).get()
assert.equal(group.data()?.name, 'Friday Table')
assert.equal(group.data()?.status, 'forming')
assert.deepEqual(group.data()?.memberUids, [owner.localId])
const creationRetry = await post('createGroup', owner.idToken, { name: 'Friday Table', creationKey })
assert.equal(creationRetry.response.status, 200)
assert.equal(creationRetry.payload.groupId, groupId)
const ownerGroups = await db.collection('groups').where('createdBy', '==', owner.localId).get()
assert.equal(ownerGroups.docs.filter(document => document.data().name === 'Friday Table').length, 1)
console.log('PASS creation is authenticated and idempotent across an ambiguous response retry')

const missingInviteCreationKey = await post('createGroupInvite', owner.idToken, { groupId })
assert.equal(missingInviteCreationKey.response.status, 422)
const inviteCreationKey = 'invite-create-operation-primary'
const invite = await post('createGroupInvite', owner.idToken, { groupId, creationKey: inviteCreationKey })
assert.equal(invite.response.status, 201)
const token = invite.payload.token
const preview = await db.collection('groupInvites').doc(token).get()
assert.deepEqual(
  Object.keys(preview.data()).sort(),
  ['createdAt', 'expiresAt', 'groupId', 'groupName', 'invitedBy', 'inviterAvatarHex', 'inviterName', 'memberCountAtCreation', 'status'].sort(),
)
const inviteRetry = await post('createGroupInvite', owner.idToken, { groupId, creationKey: inviteCreationKey })
assert.equal(inviteRetry.response.status, 200)
assert.equal(inviteRetry.payload.token, token)
assert.equal((await db.collection('groupInvites').where('groupId', '==', groupId).get()).size, 1)
console.log('PASS invite creation is idempotent and its preview contains bounded context only')

const concurrentInvite = await post('createGroupInvite', owner.idToken, {
  groupId, creationKey: 'invite-create-operation-concurrent',
})
assert.equal(concurrentInvite.response.status, 201)
const concurrentPreview = await db.collection('groupInvites').doc(concurrentInvite.payload.token).get()
assert.equal(concurrentPreview.data()?.memberCountAtCreation, 1)
const unjoinedInviteList = await post('listGroupInvites', member.idToken, { groupId })
assert.equal(unjoinedInviteList.response.status, 409)
const initialInviteList = await post('listGroupInvites', owner.idToken, { groupId })
assert.equal(initialInviteList.response.status, 200)
assert.deepEqual(new Set(initialInviteList.payload.links.map(link => link.token)), new Set([
  token, concurrentInvite.payload.token,
]))

const accepted = await post('acceptGroupInvite', member.idToken, { token })
assert.equal(accepted.response.status, 200)
assert.equal(accepted.payload.groupId, groupId)
group = await db.collection('groups').doc(groupId).get()
assert.equal(group.data()?.status, 'active')
assert.deepEqual(group.data()?.memberUids, [owner.localId, member.localId])
const acceptedRetry = await post('acceptGroupInvite', member.idToken, { token })
assert.equal(acceptedRetry.response.status, 200)
assert.equal(acceptedRetry.payload.groupId, groupId)
group = await db.collection('groups').doc(groupId).get()
assert.equal(group.data()?.memberUids.filter(uid => uid === member.localId).length, 1)
const replay = await post('acceptGroupInvite', outsider.idToken, { token })
assert.equal(replay.response.status, 409)
const remainingInviteList = await post('listGroupInvites', owner.idToken, { groupId })
assert.deepEqual(remainingInviteList.payload.links.map(link => link.token), [concurrentInvite.payload.token])
const historicalPreview = await db.collection('groupInvites').doc(concurrentInvite.payload.token).get()
assert.equal(historicalPreview.data()?.memberCountAtCreation, 1)
console.log('PASS acceptance replay recovers the same member while other recipients remain denied')
console.log('PASS concurrent invite snapshots stay historical after another recipient joins')
const thirdAccepted = await post('acceptGroupInvite', outsider.idToken, { token: concurrentInvite.payload.token })
assert.equal(thirdAccepted.response.status, 200)
group = await db.collection('groups').doc(groupId).get()
assert.deepEqual(group.data()?.memberUids, [owner.localId, member.localId, outsider.localId])
assert.deepEqual((await post('listGroupInvites', owner.idToken, { groupId })).payload.links, [])
console.log('PASS creator invite recovery is authenticated, bounded, and follows concurrent acceptance')

assert.equal((await post('searchPlanAreas', null, { groupId, query: 'Cresskill' })).response.status, 401)
assert.equal((await post('searchPlanAreas', owner.idToken, { groupId, query: 'x' })).response.status, 422)
assert.equal((await post('searchPlanAreas', intruder.idToken, { groupId, query: 'Cresskill' })).response.status, 403)
const unavailableAreaSearch = await post('searchPlanAreas', owner.idToken, { groupId, query: 'Cresskill' })
assert.equal(unavailableAreaSearch.response.status, 503)
assert.equal(unavailableAreaSearch.payload.error, 'area-search-unavailable')
assert.equal((await db.collection('serviceUsage').where('kind', '==', 'area_gazetteer_search').get()).empty, true)
console.log('PASS unfamiliar area search is authenticated, group-scoped, bounded, and disabled without a reviewed artifact')

const manualInvite = await post('createGroupInvite', owner.idToken, {
  groupId, creationKey: 'invite-create-operation-manual-revoke',
})
assert.equal(manualInvite.response.status, 201)
const nonCreatorRevoke = await post('revokeGroupInvite', outsider.idToken, { token: manualInvite.payload.token })
assert.equal(nonCreatorRevoke.response.status, 409)
const creatorRevoke = await post('revokeGroupInvite', owner.idToken, { token: manualInvite.payload.token })
assert.equal(creatorRevoke.response.status, 200)
const manuallyRevoked = await db.collection('groupInvites').doc(manualInvite.payload.token).get()
assert.equal(manuallyRevoked.data()?.status, 'revoked')
assert.equal(manuallyRevoked.data()?.revokedReason, 'creator-revoked')
const manuallyRevokedAt = manuallyRevoked.data()?.revokedAt.toMillis()
const creatorRevokeReplay = await post('revokeGroupInvite', owner.idToken, { token: manualInvite.payload.token })
assert.equal(creatorRevokeReplay.response.status, 200)
const replayedManualRevocation = await db.collection('groupInvites').doc(manualInvite.payload.token).get()
assert.equal(replayedManualRevocation.data()?.status, 'revoked')
assert.equal(replayedManualRevocation.data()?.revokedAt.toMillis(), manuallyRevokedAt)
const nonCreatorRevokeReplay = await post('revokeGroupInvite', outsider.idToken, { token: manualInvite.payload.token })
assert.equal(nonCreatorRevokeReplay.response.status, 409)
const manualRevokeAcceptance = await post('acceptGroupInvite', intruder.idToken, { token: manualInvite.payload.token })
assert.equal(manualRevokeAcceptance.response.status, 409)
assert.deepEqual((await post('listGroupInvites', owner.idToken, { groupId })).payload.links, [])
console.log('PASS only the link creator can revoke an unused invite, exact retry cannot rewrite it, and it becomes immediately unjoinable')

const fullCreated = await post('createGroup', owner.idToken, {
  name: 'Six Seats', creationKey: 'group-create-operation-six-seats',
})
assert.equal(fullCreated.response.status, 201)
const fullGroupId = fullCreated.payload.groupId
const fullInvites = []
for (let index = 0; index < 5; index++) {
  const createdInvite = await post('createGroupInvite', owner.idToken, {
    groupId: fullGroupId, creationKey: `invite-create-operation-six-seat-${index}`,
  })
  assert.equal(createdInvite.response.status, 201)
  fullInvites.push(createdInvite.payload.token)
}
const overReservedInvite = await post('createGroupInvite', owner.idToken, {
  groupId: fullGroupId, creationKey: 'invite-create-operation-over-capacity',
})
assert.equal(overReservedInvite.response.status, 409)
assert.equal(overReservedInvite.payload.error, 'invite-capacity-reserved')
const surplusInviteRef = db.collection('groupInvites').doc('seeded-surplus-capacity-proof')
await surplusInviteRef.set({
  groupId: fullGroupId,
  groupName: 'Six Seats',
  invitedBy: owner.localId,
  inviterName: 'Mika',
  inviterAvatarHex: '#8E5A6B',
  memberCountAtCreation: 1,
  status: 'active',
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
})
const fullJoiners = [member, outsider, intruder, pairOwner, pairMember]
for (let index = 0; index < fullJoiners.length; index++) {
  const joined = await post('acceptGroupInvite', fullJoiners[index].idToken, { token: fullInvites[index] })
  assert.equal(joined.response.status, 200)
}
const fullGroup = await db.collection('groups').doc(fullGroupId).get()
assert.equal(fullGroup.data()?.memberUids.length, 6)
const surplusInvite = await waitUntil(
  'surplus invite revocation when the group reaches six',
  () => surplusInviteRef.get(),
  snapshot => snapshot.data()?.status === 'revoked',
)
assert.equal(surplusInvite.data()?.revokedReason, 'group-full')
const overflowAcceptance = await post('acceptGroupInvite', overflow.idToken, { token: surplusInviteRef.id })
assert.equal(overflowAcceptance.response.status, 409)
assert.equal(overflowAcceptance.payload.error, 'invite-unavailable')
console.log('PASS active links cannot over-reserve six seats, and the sixth member revokes any surplus invite')

const acceptFirstGroup = await post('createGroup', owner.idToken, {
  name: 'Accept First', creationKey: 'group-create-audience-accept-first',
})
assert.equal(acceptFirstGroup.response.status, 201)
const acceptFirstGroupId = acceptFirstGroup.payload.groupId
const acceptFirstInvites = []
for (const suffix of ['member', 'late-member', 'still-open']) {
  const createdInvite = await post('createGroupInvite', owner.idToken, {
    groupId: acceptFirstGroupId,
    creationKey: `invite-create-audience-accept-first-${suffix}`,
  })
  assert.equal(createdInvite.response.status, 201)
  acceptFirstInvites.push(createdInvite.payload.token)
}
assert.equal((await post('acceptGroupInvite', member.idToken, {
  token: acceptFirstInvites[0],
})).response.status, 200)
const acceptFirstReviewedAudience = await currentGroupAudience(acceptFirstGroupId)
const acceptFirstPlaceId = 'o:audience-accept-first'
const acceptFirstProjectionRef = db.collection('groups').doc(acceptFirstGroupId).collection('signals')
  .doc(`${owner.localId}__${acceptFirstPlaceId}`)
const acceptFirstPreferenceRef = db.collection('groups').doc(acceptFirstGroupId).collection('preferences')
  .doc(owner.localId)
await db.collection('saves').doc(`${owner.localId}__${acceptFirstPlaceId}`).set({
  uid: owner.localId, placeId: acceptFirstPlaceId, tag: 'want', visibility: 'private', ts: 1,
  memory: memory(acceptFirstPlaceId, 'Audience Accept First', 'food'),
})
const invalidAudienceGroupBefore = await db.collection('groups').doc(acceptFirstGroupId).get()
const invalidAudienceInviteBefore = await db.collection('groupInvites').doc(acceptFirstInvites[2]).get()
const missingQuickStartAudience = await post('saveGroupQuickStart', owner.idToken, {
  groupId: acceptFirstGroupId, categoryHints: ['food'], constraintHints: ['casual'],
})
assert.equal(missingQuickStartAudience.response.status, 422)
assert.equal(missingQuickStartAudience.payload.error, 'invalid-audience-review')
const expandedQuickStartAudience = await post('saveGroupQuickStart', owner.idToken, {
  groupId: acceptFirstGroupId, categoryHints: ['food'], constraintHints: ['casual'],
  audience: { ...acceptFirstReviewedAudience, reviewedAt: 1 },
})
assert.equal(expandedQuickStartAudience.response.status, 422)
assert.equal(expandedQuickStartAudience.payload.error, 'invalid-audience-review')
const missingShareAudience = await post('shareGroupSignal', owner.idToken, {
  groupId: acceptFirstGroupId, placeId: acceptFirstPlaceId, includeNote: false,
})
assert.equal(missingShareAudience.response.status, 422)
assert.equal(missingShareAudience.payload.error, 'invalid-audience-review')
const stringVersionShareAudience = await post('shareGroupSignal', owner.idToken, {
  groupId: acceptFirstGroupId, placeId: acceptFirstPlaceId, includeNote: false,
  audience: { ...acceptFirstReviewedAudience, permissionVersion: '1' },
})
assert.equal(stringVersionShareAudience.response.status, 422)
assert.equal(stringVersionShareAudience.payload.error, 'invalid-audience-review')
const reviewedRemoval = await post('shareGroupSignal', owner.idToken, {
  groupId: acceptFirstGroupId, placeId: acceptFirstPlaceId, action: 'remove',
  audience: acceptFirstReviewedAudience,
})
assert.equal(reviewedRemoval.response.status, 422)
assert.equal(reviewedRemoval.payload.error, 'invalid-audience-review')
assert.equal((await acceptFirstPreferenceRef.get()).exists, false)
assert.equal((await acceptFirstProjectionRef.get()).exists, false)
assert.equal((await db.collection('groups').doc(acceptFirstGroupId).get()).updateTime.toMillis(),
  invalidAudienceGroupBefore.updateTime.toMillis())
assert.equal((await db.collection('groupInvites').doc(acceptFirstInvites[2]).get()).updateTime.toMillis(),
  invalidAudienceInviteBefore.updateTime.toMillis())

assert.equal((await post('acceptGroupInvite', outsider.idToken, {
  token: acceptFirstInvites[1],
})).response.status, 200)
const groupAfterLateAcceptance = await db.collection('groups').doc(acceptFirstGroupId).get()
const openInviteAfterLateAcceptance = await db.collection('groupInvites').doc(acceptFirstInvites[2]).get()
const staleQuickStart = await post('saveGroupQuickStart', owner.idToken, {
  groupId: acceptFirstGroupId, categoryHints: ['food'], constraintHints: ['casual'],
  audience: acceptFirstReviewedAudience,
})
assert.equal(staleQuickStart.response.status, 409)
assert.equal(staleQuickStart.payload.error, 'audience-changed')
const staleShare = await post('shareGroupSignal', owner.idToken, {
  groupId: acceptFirstGroupId, placeId: acceptFirstPlaceId, includeNote: false,
  audience: acceptFirstReviewedAudience,
})
assert.equal(staleShare.response.status, 409)
assert.equal(staleShare.payload.error, 'audience-changed')
const nonMemberStaleShare = await post('shareGroupSignal', overflow.idToken, {
  groupId: acceptFirstGroupId, placeId: acceptFirstPlaceId, includeNote: false,
  audience: acceptFirstReviewedAudience,
})
assert.equal(nonMemberStaleShare.response.status, 409)
assert.equal(nonMemberStaleShare.payload.error, 'group-unavailable')
const acceptFirstAfterStaleWrites = await db.collection('groups').doc(acceptFirstGroupId).get()
assert.equal(acceptFirstAfterStaleWrites.data()?.membershipLocked, false)
assert.equal(acceptFirstAfterStaleWrites.data()?.permissionVersion, 1)
assert.deepEqual(acceptFirstAfterStaleWrites.data()?.memberUids,
  [owner.localId, member.localId, outsider.localId])
assert.equal(acceptFirstAfterStaleWrites.updateTime.toMillis(), groupAfterLateAcceptance.updateTime.toMillis())
assert.equal((await acceptFirstPreferenceRef.get()).exists, false)
assert.equal((await acceptFirstProjectionRef.get()).exists, false)
const unchangedOpenInvite = await db.collection('groupInvites').doc(acceptFirstInvites[2]).get()
assert.equal(unchangedOpenInvite.data()?.status, 'active')
assert.equal(unchangedOpenInvite.updateTime.toMillis(), openInviteAfterLateAcceptance.updateTime.toMillis())
console.log('PASS invalid and accept-first audience reviews fail before writes, preserve invites, and do not leak audience changes to outsiders')

const shareFirstGroup = await post('createGroup', owner.idToken, {
  name: 'Share First', creationKey: 'group-create-audience-share-first',
})
assert.equal(shareFirstGroup.response.status, 201)
const shareFirstGroupId = shareFirstGroup.payload.groupId
const shareFirstMemberInvite = await post('createGroupInvite', owner.idToken, {
  groupId: shareFirstGroupId, creationKey: 'invite-create-audience-share-first-member',
})
const shareFirstLateInvite = await post('createGroupInvite', owner.idToken, {
  groupId: shareFirstGroupId, creationKey: 'invite-create-audience-share-first-late',
})
assert.equal(shareFirstMemberInvite.response.status, 201)
assert.equal(shareFirstLateInvite.response.status, 201)
assert.equal((await post('acceptGroupInvite', member.idToken, {
  token: shareFirstMemberInvite.payload.token,
})).response.status, 200)
const shareFirstAudience = await currentGroupAudience(shareFirstGroupId)
const shareFirstPlaceId = 'o:audience-share-first'
const shareFirstProjectionRef = db.collection('groups').doc(shareFirstGroupId).collection('signals')
  .doc(`${owner.localId}__${shareFirstPlaceId}`)
await db.collection('saves').doc(`${owner.localId}__${shareFirstPlaceId}`).set({
  uid: owner.localId, placeId: shareFirstPlaceId, tag: 'loved', visibility: 'private', ts: 1,
  memory: memory(shareFirstPlaceId, 'Audience Share First', 'coffee'),
})
const shareFirstInput = {
  groupId: shareFirstGroupId, placeId: shareFirstPlaceId, includeNote: false,
  audience: shareFirstAudience,
}
assert.equal((await post('shareGroupSignal', owner.idToken, shareFirstInput)).response.status, 200)
const shareFirstProjection = await shareFirstProjectionRef.get()
const shareFirstLockedGroup = await db.collection('groups').doc(shareFirstGroupId).get()
assert.equal(shareFirstProjection.exists, true)
assert.equal(shareFirstLockedGroup.data()?.membershipLocked, true)
assert.equal(shareFirstLockedGroup.data()?.permissionVersion, 1)
const shareFirstProjectionData = shareFirstProjection.data()
await shareFirstProjectionRef.set(Object.fromEntries(Object.entries(shareFirstProjectionData).reverse()))
const reorderedShareFirstProjection = await shareFirstProjectionRef.get()
assert.deepEqual(reorderedShareFirstProjection.data(), shareFirstProjectionData)
assert.equal((await post('shareGroupSignal', owner.idToken, shareFirstInput)).response.status, 200)
assert.equal((await shareFirstProjectionRef.get()).updateTime.toMillis(), reorderedShareFirstProjection.updateTime.toMillis())
assert.equal((await db.collection('groups').doc(shareFirstGroupId).get()).updateTime.toMillis(),
  shareFirstLockedGroup.updateTime.toMillis())
assert.equal((await post('acceptGroupInvite', outsider.idToken, {
  token: shareFirstLateInvite.payload.token,
})).response.status, 409)
const shareFirstRevokedInvite = await waitUntil(
  'share-first invite revocation',
  () => db.collection('groupInvites').doc(shareFirstLateInvite.payload.token).get(),
  snapshot => snapshot.data()?.status === 'revoked',
)
assert.equal(shareFirstRevokedInvite.data()?.revokedReason, 'audience-locked')
assert.deepEqual((await db.collection('groups').doc(shareFirstGroupId).get()).data()?.memberUids,
  [owner.localId, member.localId])
console.log('PASS share-first audience review locks exactly two members, rejects late acceptance, and exact replay does not rewrite')

const concurrentAudienceGroup = await post('createGroup', owner.idToken, {
  name: 'Audience Race', creationKey: 'group-create-audience-race-proof',
})
assert.equal(concurrentAudienceGroup.response.status, 201)
const concurrentAudienceGroupId = concurrentAudienceGroup.payload.groupId
const concurrentAudienceMemberInvite = await post('createGroupInvite', owner.idToken, {
  groupId: concurrentAudienceGroupId, creationKey: 'invite-create-audience-race-member',
})
const concurrentAudienceRaceInvite = await post('createGroupInvite', owner.idToken, {
  groupId: concurrentAudienceGroupId, creationKey: 'invite-create-audience-race-late',
})
const concurrentAudienceSpareInvite = await post('createGroupInvite', owner.idToken, {
  groupId: concurrentAudienceGroupId, creationKey: 'invite-create-audience-race-spare',
})
assert.equal(concurrentAudienceMemberInvite.response.status, 201)
assert.equal(concurrentAudienceRaceInvite.response.status, 201)
assert.equal(concurrentAudienceSpareInvite.response.status, 201)
assert.equal((await post('acceptGroupInvite', member.idToken, {
  token: concurrentAudienceMemberInvite.payload.token,
})).response.status, 200)
const concurrentAudience = await currentGroupAudience(concurrentAudienceGroupId)
const concurrentAudiencePlaceId = 'o:audience-race-proof'
const concurrentAudienceProjectionRef = db.collection('groups').doc(concurrentAudienceGroupId)
  .collection('signals').doc(`${owner.localId}__${concurrentAudiencePlaceId}`)
await db.collection('saves').doc(`${owner.localId}__${concurrentAudiencePlaceId}`).set({
  uid: owner.localId, placeId: concurrentAudiencePlaceId, tag: 'want', visibility: 'private', ts: 1,
  memory: memory(concurrentAudiencePlaceId, 'Audience Race Proof', 'activity'),
})
const concurrentAudienceShareInput = {
  groupId: concurrentAudienceGroupId, placeId: concurrentAudiencePlaceId, includeNote: false,
  audience: concurrentAudience,
}
const concurrentSpareBefore = await db.collection('groupInvites')
  .doc(concurrentAudienceSpareInvite.payload.token).get()
const [concurrentShare, concurrentAcceptance] = await Promise.all([
  post('shareGroupSignal', owner.idToken, concurrentAudienceShareInput),
  post('acceptGroupInvite', outsider.idToken, { token: concurrentAudienceRaceInvite.payload.token }),
])
assert.deepEqual([concurrentShare.response.status, concurrentAcceptance.response.status].sort(), [200, 409])
const concurrentGroupAfter = await db.collection('groups').doc(concurrentAudienceGroupId).get()
const concurrentProjectionAfter = await concurrentAudienceProjectionRef.get()
if (concurrentShare.response.status === 200) {
  assert.equal(concurrentAcceptance.response.status, 409)
  assert.equal(concurrentGroupAfter.data()?.membershipLocked, true)
  assert.deepEqual(concurrentGroupAfter.data()?.memberUids, [owner.localId, member.localId])
  assert.equal(concurrentProjectionAfter.exists, true)
  await waitUntil(
    'concurrent share-winner invite revocation',
    () => db.collection('groupInvites').doc(concurrentAudienceSpareInvite.payload.token).get(),
    snapshot => snapshot.data()?.status === 'revoked',
  )
  assert.equal((await db.collection('groupInvites').doc(concurrentAudienceRaceInvite.payload.token).get())
    .data()?.status, 'revoked')
  const concurrentGroupBeforeReplay = await db.collection('groups').doc(concurrentAudienceGroupId).get()
  const concurrentProjectionBeforeReplay = await concurrentAudienceProjectionRef.get()
  assert.equal((await post('shareGroupSignal', owner.idToken, concurrentAudienceShareInput)).response.status, 200)
  assert.equal((await db.collection('groups').doc(concurrentAudienceGroupId).get()).updateTime.toMillis(),
    concurrentGroupBeforeReplay.updateTime.toMillis())
  assert.equal((await concurrentAudienceProjectionRef.get()).updateTime.toMillis(),
    concurrentProjectionBeforeReplay.updateTime.toMillis())
} else {
  assert.equal(concurrentShare.response.status, 409)
  assert.equal(concurrentShare.payload.error, 'audience-changed')
  assert.equal(concurrentAcceptance.response.status, 200)
  assert.equal(concurrentGroupAfter.data()?.membershipLocked, false)
  assert.deepEqual(concurrentGroupAfter.data()?.memberUids,
    [owner.localId, member.localId, outsider.localId])
  assert.equal(concurrentProjectionAfter.exists, false)
  assert.equal((await db.collection('groupInvites').doc(concurrentAudienceRaceInvite.payload.token).get())
    .data()?.acceptedBy, outsider.localId)
  const concurrentSpareAfter = await db.collection('groupInvites')
    .doc(concurrentAudienceSpareInvite.payload.token).get()
  assert.equal(concurrentSpareAfter.data()?.status, 'active')
  assert.equal(concurrentSpareAfter.updateTime.toMillis(), concurrentSpareBefore.updateTime.toMillis())
}
assert.equal(concurrentGroupAfter.data()?.permissionVersion, 1)
console.log('PASS concurrent acceptance and first sharing serialize to one winner without partial writes or permission-version changes')
if (process.env.AUDIENCE_REVIEW_ONLY === '1') {
  console.log('PASS focused audience-review integration proof completed')
  process.exit(0)
}

const intruderQuickStart = await postReviewedGroupWrite('saveGroupQuickStart', intruder.idToken, {
  groupId, categoryHints: ['food'], constraintHints: ['casual'],
})
assert.equal(intruderQuickStart.response.status, 409)
const preLockInvite = await post('createGroupInvite', owner.idToken, {
  groupId, creationKey: 'invite-create-operation-before-lock',
})
assert.equal(preLockInvite.response.status, 201)
const malformedQuickStartAction = await post('saveGroupQuickStart', member.idToken, {
  groupId, action: 'remvoe', categoryHints: ['food'], constraintHints: ['casual'],
})
assert.equal(malformedQuickStartAction.response.status, 422)
assert.equal(malformedQuickStartAction.payload.error, 'invalid-quick-start-action')
assert.equal((await db.collection('groups').doc(groupId).collection('preferences').doc(member.localId).get()).exists, false)
assert.equal((await db.collection('groups').doc(groupId).get()).data()?.membershipLocked, false)
assert.equal((await db.collection('groupInvites').doc(preLockInvite.payload.token).get()).data()?.status, 'active')
const malformedQuickStartTarget = await post('saveGroupQuickStart', member.idToken, {
  groupId: `${groupId}/nested`, categoryHints: ['food'], constraintHints: ['casual'],
})
assert.equal(malformedQuickStartTarget.response.status, 422)
assert.equal(malformedQuickStartTarget.payload.error, 'invalid-quick-start-target')
const sensitiveQuickStart = await postReviewedGroupWrite('saveGroupQuickStart', member.idToken, {
  groupId, categoryHints: ['drinks'], constraintHints: [],
})
assert.equal(sensitiveQuickStart.response.status, 409)
const quickStart = await postReviewedGroupWrite('saveGroupQuickStart', member.idToken, {
  groupId, categoryHints: ['food'], constraintHints: ['casual', 'family_friendly'],
})
assert.equal(quickStart.response.status, 200)
const storedQuickStart = await db.collection('groups').doc(groupId).collection('preferences').doc(member.localId).get()
assert.deepEqual(storedQuickStart.data()?.categoryHints, ['food'])
assert.equal(storedQuickStart.data()?.permissionVersion, 1)
const quickStartReplay = await postReviewedGroupWrite('saveGroupQuickStart', member.idToken, {
  groupId, categoryHints: ['food'], constraintHints: ['casual', 'family_friendly'],
})
assert.equal(quickStartReplay.response.status, 200)
const replayedQuickStart = await db.collection('groups').doc(groupId).collection('preferences').doc(member.localId).get()
assert.equal(replayedQuickStart.updateTime.toMillis(), storedQuickStart.updateTime.toMillis())
group = await db.collection('groups').doc(groupId).get()
assert.equal(group.data()?.membershipLocked, true)
const revokedInvite = await waitUntil(
  'outstanding invite revocation after audience lock',
  () => db.collection('groupInvites').doc(preLockInvite.payload.token).get(),
  snapshot => snapshot.data()?.status === 'revoked',
)
assert.equal(revokedInvite.data()?.revokedReason, 'audience-locked')
const revokedAcceptance = await post('acceptGroupInvite', intruder.idToken, { token: preLockInvite.payload.token })
assert.equal(revokedAcceptance.response.status, 409)
assert.equal(revokedAcceptance.payload.error, 'invite-unavailable')
console.log('PASS Quick start fixes the audience and revokes every outstanding invite before it can add a late member')

const quickPlaceId = 'o:quick-fit-proof'
await db.collection('saves').doc(`${owner.localId}__${quickPlaceId}`).set({
  uid: owner.localId, placeId: quickPlaceId, tag: 'want', visibility: 'private', ts: 1,
  memory: memory(quickPlaceId, 'Quick Fit Proof', 'food'),
})
const quickShared = await postReviewedGroupWrite(
  'shareGroupSignal', owner.idToken, { groupId, placeId: quickPlaceId, includeNote: false },
)
assert.equal(quickShared.response.status, 200)
const draftGroup = await db.collection('groups').doc(groupId).get()
const draftGroupData = draftGroup.data()
const draftEvidenceUpdatedAt = typeof draftGroupData.updatedAt === 'number'
  ? draftGroupData.updatedAt
  : draftGroupData.updatedAt.toMillis()
const draftKey = createHash('sha256').update(JSON.stringify([
  1,
  draftGroupData.permissionVersion,
  draftEvidenceUpdatedAt,
  draftGroupData.memberUids.filter(uid => [owner.localId, member.localId].includes(uid)),
  0,
  'Food',
  '',
  '',
  '',
])).digest('hex')
const draftPassInput = {
  action: 'pass', groupId, draftKey, attendeeUids: [owner.localId, member.localId],
  placeId: quickPlaceId, context: 'Food', guestCount: 0,
}
assert.equal((await post('updateGroupDraftPass', null, draftPassInput)).response.status, 401)
const invalidDraftActor = await post('updateGroupDraftPass', owner.idToken, {
  ...draftPassInput, attendeeUids: [member.localId, outsider.localId],
})
assert.equal(invalidDraftActor.response.status, 409)
assert.equal(invalidDraftActor.payload.error, 'invalid-attendees')
const changedDraftPass = await post('updateGroupDraftPass', owner.idToken, {
  ...draftPassInput, draftKey: '0'.repeat(64),
})
assert.equal(changedDraftPass.response.status, 409)
assert.equal(changedDraftPass.payload.error, 'draft-version-changed')
const sharedDraftPass = await post('updateGroupDraftPass', owner.idToken, draftPassInput)
assert.equal(sharedDraftPass.response.status, 200)
assert.equal(sharedDraftPass.payload.actorUid, owner.localId)
const storedDraftPasses = await db.collection('groups').doc(groupId).collection('draftPasses')
  .where('draftKey', '==', sharedDraftPass.payload.draftKey).get()
assert.equal(storedDraftPasses.size, 1)
const storedDraftPass = storedDraftPasses.docs[0].data()
assert.deepEqual(Object.keys(storedDraftPass).sort(), [
  'actorUid', 'createdAt', 'draftKey', 'expiresAt', 'permissionVersion', 'placeId',
].sort())
assert.equal(storedDraftPass.placeId, quickPlaceId)
assert.equal(storedDraftPass.actorUid, owner.localId)
assert.equal(storedDraftPass.expiresAt.toMillis() - storedDraftPass.createdAt.toMillis(), 6 * 60 * 60 * 1000)
const firstDraftPassUpdateTime = storedDraftPasses.docs[0].updateTime.toMillis()
const replayedDraftPass = await post('updateGroupDraftPass', owner.idToken, draftPassInput)
assert.equal(replayedDraftPass.response.status, 200)
assert.equal(replayedDraftPass.payload.actorUid, owner.localId)
assert.equal((await db.collection('groups').doc(groupId).collection('draftPasses')
  .where('draftKey', '==', sharedDraftPass.payload.draftKey).get()).docs[0].updateTime.toMillis(), firstDraftPassUpdateTime)
const racedDraftPass = await post('updateGroupDraftPass', member.idToken, draftPassInput)
assert.equal(racedDraftPass.response.status, 200)
assert.equal(racedDraftPass.payload.actorUid, owner.localId)
assert.equal((await db.collection('groups').doc(groupId).collection('draftPasses')
  .where('draftKey', '==', sharedDraftPass.payload.draftKey).get()).size, 1)
const otherUndo = await post('updateGroupDraftPass', member.idToken, { ...draftPassInput, action: 'undo' })
assert.equal(otherUndo.response.status, 409)
assert.equal(otherUndo.payload.error, 'pass-owned-by-other')
const invalidPickCreationKey = await post('createGroupPick', owner.idToken, {
  groupId, attendeeUids: [owner.localId, member.localId], placeId: quickPlaceId, context: 'Food',
})
assert.equal(invalidPickCreationKey.response.status, 422)
assert.equal(invalidPickCreationKey.payload.error, 'invalid-creation-key')
const passedPick = await post('createGroupPick', owner.idToken, {
  groupId, creationKey: 'group-pick-operation-passed-candidate',
  attendeeUids: [owner.localId, member.localId], placeId: quickPlaceId, context: 'Food',
})
assert.equal(passedPick.response.status, 409)
assert.equal(passedPick.payload.error, 'candidate-passed')
const ownUndo = await post('updateGroupDraftPass', owner.idToken, { ...draftPassInput, action: 'undo' })
assert.equal(ownUndo.response.status, 200)
assert.equal(ownUndo.payload.removed, true)
assert.equal((await db.collection('groups').doc(groupId).collection('draftPasses')
  .where('draftKey', '==', sharedDraftPass.payload.draftKey).get()).empty, true)
const replayedDraftUndo = await post('updateGroupDraftPass', owner.idToken, { ...draftPassInput, action: 'undo' })
assert.equal(replayedDraftUndo.response.status, 200)
assert.equal(replayedDraftUndo.payload.removed, false)
assert.equal((await db.collection('groups').doc(groupId).collection('draftPasses')
  .where('draftKey', '==', sharedDraftPass.payload.draftKey).get()).empty, true)
console.log('PASS a six-hour attributed draft pass synchronizes once, exact replay does not rewrite it, and only its actor can undo it')
const quickPick = await post('createGroupPick', owner.idToken, {
  groupId, creationKey: 'group-pick-operation-quick-fit',
  attendeeUids: [owner.localId, member.localId], placeId: quickPlaceId, context: 'Food',
})
assert.equal(quickPick.response.status, 201)
assert.equal(quickPick.payload.reasonCode, 'quick_start_fit')
assert.equal(quickPick.payload.reason, "Mika wants this; it fits Vivian's food hint.")
console.log('PASS one exact Want plus an independent Quick start hint yields a labeled weak fit, never false agreement')
const quickPickDismissed = await post('closeGroupPick', owner.idToken, {
  pickId: quickPick.payload.id, status: 'dismissed',
})
assert.equal(quickPickDismissed.response.status, 200)
assert.equal(quickPickDismissed.payload.changed, true)
const quickPickDismissedReplay = await post('closeGroupPick', owner.idToken, {
  pickId: quickPick.payload.id, status: 'dismissed',
})
assert.equal(quickPickDismissedReplay.response.status, 200)
assert.equal(quickPickDismissedReplay.payload.changed, false)
const quickPickOutcomeConflict = await post('closeGroupPick', owner.idToken, {
  pickId: quickPick.payload.id, status: 'visited',
})
assert.equal(quickPickOutcomeConflict.response.status, 409)
assert.equal(quickPickOutcomeConflict.payload.error, 'pick-outcome-conflict')
const removedQuickStart = await post('saveGroupQuickStart', member.idToken, { groupId, action: 'remove' })
assert.equal(removedQuickStart.response.status, 200)
assert.equal((await db.collection('groups').doc(groupId).collection('preferences').doc(member.localId).get()).exists, false)
const groupAfterQuickStartRemoval = await db.collection('groups').doc(groupId).get()
const removedQuickStartReplay = await post('saveGroupQuickStart', member.idToken, { groupId, action: 'remove' })
assert.equal(removedQuickStartReplay.response.status, 200)
assert.equal((await db.collection('groups').doc(groupId).collection('preferences').doc(member.localId).get()).exists, false)
assert.equal((await db.collection('groups').doc(groupId).get()).updateTime.toMillis(), groupAfterQuickStartRemoval.updateTime.toMillis())
const unsupportedAfterRemoval = await post('createGroupPick', owner.idToken, {
  groupId, creationKey: 'group-pick-operation-unsupported-after-remove',
  attendeeUids: [owner.localId, member.localId], placeId: quickPlaceId, context: 'Food',
})
assert.equal(unsupportedAfterRemoval.response.status, 409)
const restoredQuickStart = await postReviewedGroupWrite('saveGroupQuickStart', member.idToken, {
  groupId, categoryHints: ['food'], constraintHints: ['casual'],
})
assert.equal(restoredQuickStart.response.status, 200)
console.log('PASS Quick start save and removal replay without rewriting, removal stops influence, and neither path reopens the fixed audience')

const shareReplayPlaceId = 'o:group-share-replay-proof'
const shareReplayRef = db.collection('groups').doc(groupId).collection('signals')
  .doc(`${owner.localId}__${shareReplayPlaceId}`)
const malformedShareGroup = await post('shareGroupSignal', owner.idToken, {
  groupId: `${groupId}/nested`, placeId: shareReplayPlaceId,
})
assert.equal(malformedShareGroup.response.status, 422)
assert.equal(malformedShareGroup.payload.error, 'invalid-share-target')
const malformedSharePlace = await post('shareGroupSignal', owner.idToken, {
  groupId, placeId: 'g:nested/place',
})
assert.equal(malformedSharePlace.response.status, 422)
assert.equal(malformedSharePlace.payload.error, 'invalid-share-target')
const malformedShareAction = await post('shareGroupSignal', owner.idToken, {
  groupId, placeId: shareReplayPlaceId, action: 'publish',
})
assert.equal(malformedShareAction.response.status, 422)
assert.equal(malformedShareAction.payload.error, 'invalid-share-action')
assert.equal((await shareReplayRef.get()).exists, false)
await db.collection('saves').doc(`${owner.localId}__${shareReplayPlaceId}`).set({
  uid: owner.localId, placeId: shareReplayPlaceId, tag: 'want', visibility: 'private', ts: 1,
  memory: memory(shareReplayPlaceId, 'Group Share Replay Proof', 'coffee'),
})
assert.equal((await postReviewedGroupWrite('shareGroupSignal', owner.idToken, {
  groupId, placeId: shareReplayPlaceId, includeNote: false, includeObservations: false,
})).response.status, 200)
const firstShareProjection = await shareReplayRef.get()
const groupAfterFirstShare = await db.collection('groups').doc(groupId).get()
assert.equal(firstShareProjection.exists, true)
const firstShareProjectionData = firstShareProjection.data()
await shareReplayRef.set(Object.fromEntries(Object.entries(firstShareProjectionData).reverse()))
const reorderedFirstShareProjection = await shareReplayRef.get()
assert.deepEqual(reorderedFirstShareProjection.data(), firstShareProjectionData)
assert.equal((await postReviewedGroupWrite('shareGroupSignal', owner.idToken, {
  groupId, placeId: shareReplayPlaceId, includeNote: false, includeObservations: false,
})).response.status, 200)
assert.equal((await shareReplayRef.get()).updateTime.toMillis(), reorderedFirstShareProjection.updateTime.toMillis())
assert.equal((await db.collection('groups').doc(groupId).get()).updateTime.toMillis(), groupAfterFirstShare.updateTime.toMillis())
assert.equal((await post('shareGroupSignal', owner.idToken, {
  groupId, placeId: shareReplayPlaceId, action: 'remove',
})).response.status, 200)
assert.equal((await shareReplayRef.get()).exists, false)
const groupAfterFirstShareRemoval = await db.collection('groups').doc(groupId).get()
assert.equal((await post('shareGroupSignal', owner.idToken, {
  groupId, placeId: shareReplayPlaceId, action: 'remove',
})).response.status, 200)
assert.equal((await shareReplayRef.get()).exists, false)
assert.equal((await db.collection('groups').doc(groupId).get()).updateTime.toMillis(), groupAfterFirstShareRemoval.updateTime.toMillis())
console.log('PASS exact group sharing and already-completed removal replay without rewriting either document')

const placeId = 'o:group-proof'
await db.collection('saves').doc(`${owner.localId}__${placeId}`).set({
  uid: owner.localId, placeId, tag: 'loved', visibility: 'private', ts: 1,
  note: 'Owner-only note', memory: memory(placeId, 'Proof Place', 'other', 'Cresskill, NJ'),
  observations: {
    quiet: { value: 'yes', observedAt: 1, audience: 'private', source: 'user_authored' },
    easy_parking: { value: 'no', observedAt: 1, audience: 'private', source: 'user_authored' },
  },
})
const shared = await postReviewedGroupWrite('shareGroupSignal', owner.idToken, {
  groupId, placeId, includeNote: false, includeObservations: true,
})
assert.equal(shared.response.status, 200)
await db.collection('saves').doc(`${member.localId}__${placeId}`).set({
  uid: member.localId, placeId, tag: 'want', visibility: 'private', ts: 2,
  memory: memory(placeId, 'Proof Place', 'other', 'Cresskill, NJ'),
})
const memberShared = await postReviewedGroupWrite(
  'shareGroupSignal', member.idToken, { groupId, placeId, includeNote: false },
)
assert.equal(memberShared.response.status, 200)
const projection = await db.collection('groups').doc(groupId).collection('signals').doc(`${owner.localId}__${placeId}`).get()
assert.equal(projection.exists, true)
assert.equal('note' in projection.data(), false)
assert.equal('place' in projection.data(), false)
assert.equal(projection.data()?.memory?.label, 'Proof Place')
group = await db.collection('groups').doc(groupId).get()
assert.equal(group.data()?.membershipLocked, true)
const lateInvite = await post('createGroupInvite', owner.idToken, {
  groupId, creationKey: 'invite-create-operation-after-lock',
})
assert.equal(lateInvite.response.status, 409)
assert.equal(lateInvite.payload.error, 'membership-locked')
console.log('PASS explicit sharing omits private notes and locks the accepted audience')

const syncPlaceId = 'o:projection-sync-proof'
const syncProjectionRef = db.collection('groups').doc(groupId).collection('signals')
  .doc(`${owner.localId}__${syncPlaceId}`)
const projectionCountBeforeSync = Number((await db.collection('groups').doc(groupId).get()).data()?.projectionCount ?? 0)
await db.collection('saves').doc(`${owner.localId}__${syncPlaceId}`).set({
  uid: owner.localId, placeId: syncPlaceId, tag: 'want', visibility: 'private', ts: 10,
  note: 'Owner-only first note', memory: memory(syncPlaceId, 'First owner label', 'coffee'),
  observations: {
    quiet: { value: 'yes', observedAt: 10, audience: 'private', source: 'user_authored' },
  },
})
assert.equal((await postReviewedGroupWrite('shareGroupSignal', owner.idToken, {
  groupId, placeId: syncPlaceId, includeNote: false,
})).response.status, 200)
let syncedProjection = await syncProjectionRef.get()
assert.equal(syncedProjection.data()?.includeNote, false)
assert.equal('note' in syncedProjection.data(), false)
assert.equal(syncedProjection.data()?.includeObservations, false)
assert.equal('observations' in syncedProjection.data(), false)

await db.collection('saves').doc(`${owner.localId}__${syncPlaceId}`).update({
  tag: 'loved', ts: 11, note: 'Still owner-only',
  memory: memory(syncPlaceId, 'Updated owner label', 'coffee', 'Cresskill, NJ'),
  observations: {
    quiet: { value: 'no', observedAt: 11, audience: 'private', source: 'user_authored' },
  },
})
syncedProjection = await waitUntil(
  'private-note projection update',
  () => syncProjectionRef.get(),
  snapshot => snapshot.data()?.tag === 'loved'
    && snapshot.data()?.memory?.label === 'Updated owner label'
    && snapshot.data()?.memory?.area === 'Cresskill, NJ',
)
assert.equal(syncedProjection.data()?.memory?.area, 'Cresskill, NJ')
assert.equal('note' in syncedProjection.data(), false)
assert.equal('observations' in syncedProjection.data(), false)

assert.equal((await postReviewedGroupWrite('shareGroupSignal', owner.idToken, {
  groupId, placeId: syncPlaceId, includeNote: true,
})).response.status, 200)
await db.collection('saves').doc(`${owner.localId}__${syncPlaceId}`).update({
  ts: 12, note: 'Shared revised note',
})
syncedProjection = await waitUntil(
  'opted-in note projection update',
  () => syncProjectionRef.get(),
  snapshot => snapshot.data()?.note === 'Shared revised note',
)
assert.equal(syncedProjection.data()?.includeNote, true)

assert.equal((await postReviewedGroupWrite('shareGroupSignal', owner.idToken, {
  groupId, placeId: syncPlaceId, includeNote: true, includeObservations: true,
})).response.status, 200)
await db.collection('saves').doc(`${owner.localId}__${syncPlaceId}`).update({
  observations: {
    quiet: { value: 'yes', observedAt: 12, audience: 'private', source: 'user_authored' },
    easy_parking: { value: 'no', observedAt: 12, audience: 'private', source: 'user_authored' },
  },
})
syncedProjection = await waitUntil(
  'opted-in observation projection update',
  () => syncProjectionRef.get(),
  snapshot => snapshot.data()?.observations?.easy_parking?.value === 'no',
)
assert.equal(syncedProjection.data()?.includeObservations, true)
assert.equal(syncedProjection.data()?.observations?.quiet?.audience, 'group')
assert.equal(syncedProjection.data()?.observations?.easy_parking?.source, 'user_authored')

const currentSyncSave = (await db.collection('saves').doc(`${owner.localId}__${syncPlaceId}`).get()).data()
const groupBeforeStaleDelete = await db.collection('groups').doc(groupId).get()
const countBeforeStaleDelete = Number(groupBeforeStaleDelete.data()?.projectionCount ?? 0)
const replayWriteTimes = {
  projection: {
    seconds: syncedProjection.updateTime.seconds,
    nanoseconds: syncedProjection.updateTime.nanoseconds,
  },
  group: {
    seconds: groupBeforeStaleDelete.updateTime.seconds,
    nanoseconds: groupBeforeStaleDelete.updateTime.nanoseconds,
  },
}
await runProjectionSyncEvent(`${owner.localId}__${syncPlaceId}`, {
  uid: owner.localId, placeId: syncPlaceId, tag: 'want', visibility: 'private', ts: 9,
  memory: memory(syncPlaceId, 'Stale event label', 'coffee'),
}, null)
syncedProjection = await syncProjectionRef.get()
const groupAfterStaleDelete = await db.collection('groups').doc(groupId).get()
assert.equal(syncedProjection.exists, true, 'A delayed delete must not remove a current re-shared projection.')
assert.equal(syncedProjection.data()?.tag, currentSyncSave.tag)
assert.equal(syncedProjection.data()?.memory?.label, currentSyncSave.memory.label)
assert.equal(syncedProjection.data()?.includeNote, true)
assert.equal(syncedProjection.data()?.includeObservations, true)
assert.equal(groupAfterStaleDelete.data()?.projectionCount, countBeforeStaleDelete)
assert.deepEqual({
  projection: {
    seconds: syncedProjection.updateTime.seconds,
    nanoseconds: syncedProjection.updateTime.nanoseconds,
  },
  group: {
    seconds: groupAfterStaleDelete.updateTime.seconds,
    nanoseconds: groupAfterStaleDelete.updateTime.nanoseconds,
  },
}, replayWriteTimes, 'A duplicate or stale event must not rewrite current projection or group metadata.')

const lifetimePlaceId = 'o:projection-lifetime-proof'
const lifetimeSaveId = `${owner.localId}__${lifetimePlaceId}`
const lifetimeSaveRef = db.collection('saves').doc(lifetimeSaveId)
const lifetimeProjectionRef = db.collection('groups').doc(groupId).collection('signals').doc(lifetimeSaveId)
const countBeforeLifetimeProof = Number((await db.collection('groups').doc(groupId).get()).data()?.projectionCount ?? 0)
const oldLifetimeSignal = {
  uid: owner.localId, placeId: lifetimePlaceId, tag: 'want', visibility: 'circle', ts: 20,
  memory: memory(lifetimePlaceId, 'Old lifetime label', 'food'),
  includeNote: false, includeObservations: false, permissionVersion: 1,
}
await lifetimeProjectionRef.set(oldLifetimeSignal)
await db.collection('groups').doc(groupId).update({ projectionCount: countBeforeLifetimeProof + 1 })
await lifetimeSaveRef.set({
  uid: owner.localId, placeId: lifetimePlaceId, tag: 'loved', visibility: 'private', ts: 21,
  memory: memory(lifetimePlaceId, 'New private lifetime', 'activity'),
})
await runProjectionSyncEvent(lifetimeSaveId, null, {
  uid: owner.localId, placeId: lifetimePlaceId, tag: 'loved', visibility: 'private', ts: 21,
  memory: memory(lifetimePlaceId, 'New private lifetime', 'activity'),
})
assert.equal((await lifetimeProjectionRef.get()).exists, false,
  'A recreated private save must not inherit an older document lifetime\'s group consent.')
assert.equal((await db.collection('groups').doc(groupId).get()).data()?.projectionCount, countBeforeLifetimeProof)

assert.equal((await postReviewedGroupWrite('shareGroupSignal', owner.idToken, {
  groupId, placeId: lifetimePlaceId, includeNote: false,
})).response.status, 200)
await lifetimeSaveRef.update({
  tag: 'want', ts: 22, memory: memory(lifetimePlaceId, 'Current re-shared lifetime', 'activity'),
})
await waitUntil('current-lifetime projection update', () => lifetimeProjectionRef.get(),
  snapshot => snapshot.data()?.memory?.label === 'Current re-shared lifetime')
await runProjectionSyncEvent(lifetimeSaveId, oldLifetimeSignal, null)
const currentLifetimeProjection = await lifetimeProjectionRef.get()
assert.equal(currentLifetimeProjection.exists, true)
assert.equal(currentLifetimeProjection.data()?.tag, 'want')
assert.equal(currentLifetimeProjection.data()?.memory?.label, 'Current re-shared lifetime')
assert.equal((await db.collection('groups').doc(groupId).get()).data()?.projectionCount, countBeforeLifetimeProof + 1)
assert.equal((await post('shareGroupSignal', owner.idToken, {
  groupId, placeId: lifetimePlaceId, action: 'remove',
})).response.status, 200)
await lifetimeSaveRef.delete()
console.log('PASS stale save events use current canonical truth, preserve current re-sharing, and cannot transfer old consent across recreation')

await db.collection('saves').doc(`${owner.localId}__${syncPlaceId}`).delete()
await waitUntil('projection deletion', () => syncProjectionRef.get(), snapshot => !snapshot.exists)
const repairedSyncGroup = await waitUntil(
  'projection count repair',
  () => db.collection('groups').doc(groupId).get(),
  snapshot => snapshot.data()?.projectionCount === projectionCountBeforeSync,
)
assert.equal(repairedSyncGroup.data()?.projectionCount, projectionCountBeforeSync)
console.log('PASS canonical place memory, notes, and observations synchronize without widening explicit group consent')

const photoPlaceId = 'g:ChIJPhotoBudgetProof123'
await db.collection('saves').doc(`${owner.localId}__${photoPlaceId}`).set({
  uid: owner.localId, placeId: photoPlaceId, tag: 'want', visibility: 'private', ts: 3,
  memory: memory(photoPlaceId, 'Photo Budget Proof', 'food'),
})
assert.equal((await postReviewedGroupWrite('shareGroupSignal', owner.idToken, {
  groupId, placeId: photoPlaceId, includeNote: false,
})).response.status, 200)
assert.equal((await post('placePhoto', null, { groupId, placeId: photoPlaceId })).response.status, 401)
assert.equal((await post('placePhoto', intruder.idToken, { groupId, placeId: photoPlaceId })).response.status, 403)
assert.equal((await post('placePhoto', intruder.idToken, { placeId: photoPlaceId })).response.status, 404)
const personalPhotoWithoutBudget = await post('placePhoto', owner.idToken, { placeId: photoPlaceId })
assert.equal(personalPhotoWithoutBudget.response.status, 429)
assert.equal(personalPhotoWithoutBudget.payload.error, 'photo-budget-unavailable')
const disabledPhoto = await post('placePhoto', owner.idToken, { groupId, placeId: photoPlaceId })
assert.equal(disabledPhoto.response.status, 429)
assert.equal(disabledPhoto.payload.error, 'photo-budget-unavailable')
const month = new Date().toISOString().slice(0, 7)
assert.equal((await db.collection('serviceUsage').doc(`placePhotos-${month}`).get()).exists, false)
await db.collection('serviceConfig').doc('placePhotos').set({ enabled: false, monthlyLimit: 500 })
const killedPhoto = await post('placePhoto', owner.idToken, { groupId, placeId: photoPlaceId })
assert.equal(killedPhoto.response.status, 429)
assert.equal(killedPhoto.payload.error, 'photo-budget-unavailable')
assert.equal((await db.collection('serviceUsage').doc(`placePhotos-${month}`).get()).exists, false)
console.log('PASS remote photo kill switch denies media without reserving project allowance')
await Promise.all([
  db.collection('serviceConfig').doc('placePhotos').set({ enabled: true, monthlyLimit: 1 }),
  db.collection('serviceUsage').doc(`placePhotos-${month}`).set({
    kind: 'place_photo', month, count: 1, monthlyLimit: 1,
  }),
])
const exhaustedPhoto = await post('placePhoto', member.idToken, { groupId, placeId: photoPlaceId })
assert.equal(exhaustedPhoto.response.status, 429)
assert.equal(exhaustedPhoto.payload.error, 'photo-budget-unavailable')
assert.equal((await db.collection('serviceUsage').doc(`placePhotos-${month}`).get()).data()?.count, 1)
console.log('PASS saved and group place photos require current evidence and the same server budget')

const wrongAreaPick = await post('createGroupPick', owner.idToken, {
  groupId, creationKey: 'group-pick-operation-wrong-area',
  attendeeUids: [owner.localId, member.localId], placeId, context: 'Anything',
  planArea: 'Piscataway', requiredObservation: 'quiet',
})
assert.equal(wrongAreaPick.response.status, 409)
const contradictedNeedPick = await post('createGroupPick', owner.idToken, {
  groupId, creationKey: 'group-pick-operation-contradicted-need',
  attendeeUids: [owner.localId, member.localId], placeId, context: 'Anything',
  planArea: 'Cresskill', requiredObservation: 'easy_parking',
})
assert.equal(contradictedNeedPick.response.status, 409)
const missingNeedPick = await post('createGroupPick', owner.idToken, {
  groupId, creationKey: 'group-pick-operation-missing-need',
  attendeeUids: [owner.localId, member.localId], placeId, context: 'Anything',
  planArea: 'Cresskill', requiredObservation: 'outdoors',
})
assert.equal(missingNeedPick.response.status, 409)
const groupPickCreationKey = 'group-pick-operation-context-proof'
const groupPickInput = {
  groupId, creationKey: groupPickCreationKey,
  attendeeUids: [owner.localId, member.localId], placeId, context: 'Anything',
  planArea: '  Cresskill  ', requiredObservation: 'quiet',
}
const groupPick = await post('createGroupPick', owner.idToken, groupPickInput)
assert.equal(groupPick.response.status, 201)
assert.equal(groupPick.payload.kind, 'group')
assert.equal('place' in groupPick.payload, false)
assert.equal(groupPick.payload.memory?.label, 'Proof Place')
assert.equal(groupPick.payload.reason, 'Everyone has a reason to go.')
assert.equal(groupPick.payload.planArea, 'Cresskill')
assert.equal(groupPick.payload.requiredObservation, 'quiet')
assert.deepEqual(groupPick.payload.memberUids, [owner.localId, member.localId, outsider.localId])
assert.deepEqual(groupPick.payload.attendeeUids, [owner.localId, member.localId])
assert.match(groupPick.payload.shareToken, /^[A-Za-z0-9_-]{16,64}$/)
let currentGroup = await db.collection('groups').doc(groupId).get()
assert.equal(currentGroup.data()?.activePick?.id, groupPick.payload.id)
assert.equal(currentGroup.data()?.activePick?.label, 'Proof Place')
assert.equal(currentGroup.data()?.activePick?.attendeeCount, 2)
const groupPickReplay = await post('createGroupPick', owner.idToken, groupPickInput)
assert.equal(groupPickReplay.response.status, 200)
assert.equal(groupPickReplay.payload.id, groupPick.payload.id)
assert.equal(groupPickReplay.payload.shareToken, groupPick.payload.shareToken)
assert.equal((await db.collection('picks').where('shareToken', '==', groupPick.payload.shareToken).get()).size, 1)
assert.equal((await db.collection('pickReceipts').doc(groupPick.payload.shareToken).get()).exists, true)
const groupPickConflict = await post('createGroupPick', owner.idToken, {
  ...groupPickInput, placeId: quickPlaceId, context: 'Food', planArea: '', requiredObservation: undefined,
})
assert.equal(groupPickConflict.response.status, 409)
assert.equal(groupPickConflict.payload.error, 'pick-operation-conflict')
console.log('PASS Pick replay returns one committed decision and one receipt while key reuse cannot change it')
const secondOpenPick = await post('createGroupPick', owner.idToken, {
  groupId, creationKey: 'group-pick-operation-second-open',
  attendeeUids: [owner.localId, member.localId], placeId, context: 'Anything',
})
assert.equal(secondOpenPick.response.status, 409)
assert.equal(secondOpenPick.payload.error, 'pick-already-open')
const receiptUrl = `${origin}/pickReceipt?token=${encodeURIComponent(groupPick.payload.shareToken)}`
let receipt = await fetch(receiptUrl)
assert.equal(receipt.status, 200)
let receiptHtml = await receipt.text()
assert.match(receiptHtml, /property="og:title"/)
assert.match(receiptHtml, /Proof Place/)
assert.match(receiptHtml, /Everyone has a reason to go\./)
assert.match(receiptHtml, /2 going/)
for (const privateValue of [owner.localId, member.localId, outsider.localId, 'Mika', 'Vivian', 'Ari', 'Friday Table', 'Cresskill', 'quiet']) {
  assert.equal(receiptHtml.includes(privateValue), false)
}
console.log('PASS server revalidates bounded Pick context while the public receipt omits it and other private evidence')
const nonAttendeeClose = await post('closeGroupPick', outsider.idToken, {
  pickId: groupPick.payload.id, status: 'visited',
})
assert.equal(nonAttendeeClose.response.status, 409)
const attendeeClose = await post('closeGroupPick', member.idToken, {
  pickId: groupPick.payload.id, status: 'visited',
})
assert.equal(attendeeClose.response.status, 200)
assert.equal(attendeeClose.payload.changed, true)
const attendeeCloseReplay = await post('closeGroupPick', member.idToken, {
  pickId: groupPick.payload.id, status: 'visited',
})
assert.equal(attendeeCloseReplay.response.status, 200)
assert.equal(attendeeCloseReplay.payload.changed, false)
const visitedOutcomeConflict = await post('closeGroupPick', owner.idToken, {
  pickId: groupPick.payload.id, status: 'dismissed',
})
assert.equal(visitedOutcomeConflict.response.status, 409)
assert.equal(visitedOutcomeConflict.payload.error, 'pick-outcome-conflict')
currentGroup = await db.collection('groups').doc(groupId).get()
assert.equal('activePick' in currentGroup.data(), false)
assert.equal(currentGroup.data()?.recentPick?.id, groupPick.payload.id)
assert.equal(currentGroup.data()?.recentPick?.label, 'Proof Place')
assert.equal((await db.collection('saves').doc(`${owner.localId}__${placeId}`).get()).data()?.tag, 'loved')
assert.equal((await db.collection('saves').doc(`${member.localId}__${placeId}`).get()).data()?.tag, 'want')
receipt = await fetch(receiptUrl)
assert.equal(receipt.status, 200)
receiptHtml = await receipt.text()
assert.match(receiptHtml, /The group went/)
console.log('PASS group Pick reasons are server-derived and only actual attendees can close them')
console.log('PASS terminal Pick replay recovers the same outcome while conflicting closure stays impossible')

const repeatedRecentPick = await post('createGroupPick', owner.idToken, {
  groupId, creationKey: 'group-pick-operation-recent-repeat',
  attendeeUids: [owner.localId, member.localId], placeId, context: 'Anything',
})
assert.equal(repeatedRecentPick.response.status, 409)
assert.equal(repeatedRecentPick.payload.error, 'unsupported-place')
await db.collection('saves').doc(`${member.localId}__${quickPlaceId}`).set({
  uid: member.localId, placeId: quickPlaceId, tag: 'want', visibility: 'private', ts: 2,
  memory: memory(quickPlaceId, 'Quick Fit Proof', 'food'),
})
assert.equal((await postReviewedGroupWrite('shareGroupSignal', member.idToken, {
  groupId, placeId: quickPlaceId, includeNote: false,
})).response.status, 200)
const guestPick = await post('createGroupPick', owner.idToken, {
  groupId, creationKey: 'group-pick-operation-guest',
  attendeeUids: [owner.localId, member.localId], placeId: quickPlaceId, context: 'Food', guestCount: 1,
})
assert.equal(guestPick.response.status, 201)
currentGroup = await db.collection('groups').doc(groupId).get()
assert.equal('recentPick' in currentGroup.data(), false)
assert.equal(guestPick.payload.guestCount, 1)
assert.equal(guestPick.payload.reason, '2 of 3 want or love this.')
const guestReceipt = await fetch(`${origin}/pickReceipt?token=${encodeURIComponent(guestPick.payload.shareToken)}`)
assert.equal(guestReceipt.status, 200)
assert.match(await guestReceipt.text(), /3 going/)
console.log('PASS one unnamed guest stays unknown, stores no guest identity, and enters the receipt count')
console.log('PASS the Last Pick is suppressed until a different supported place starts the next decision')
assert.equal((await post('closeGroupPick', owner.idToken, {
  pickId: guestPick.payload.id, status: 'dismissed',
})).response.status, 200)

const revocablePick = await post('createGroupPick', owner.idToken, {
  groupId, creationKey: 'group-pick-operation-revocable',
  attendeeUids: [owner.localId, member.localId], placeId, context: 'Anything',
})
assert.equal(revocablePick.response.status, 201)
const intruderRevoke = await post('revokePickReceipt', intruder.idToken, { pickId: revocablePick.payload.id })
assert.equal(intruderRevoke.response.status, 409)
const memberRevoke = await post('revokePickReceipt', outsider.idToken, { pickId: revocablePick.payload.id })
assert.equal(memberRevoke.response.status, 200)
// Any current group member can revoke a link; receipt control is group-wide, not attendee-only.
const receiptCountAfterRevoke = (await db.collection('groups').doc(groupId).get()).data()?.receiptCount
const memberRevokeReplay = await post('revokePickReceipt', owner.idToken, { pickId: revocablePick.payload.id })
assert.equal(memberRevokeReplay.response.status, 200)
assert.equal((await db.collection('groups').doc(groupId).get()).data()?.receiptCount, receiptCountAfterRevoke)
assert.equal('shareToken' in ((await db.collection('picks').doc(revocablePick.payload.id).get()).data() ?? {}), false)
const revokedReceipt = await fetch(`${origin}/pickReceipt?token=${encodeURIComponent(revocablePick.payload.shareToken)}`)
assert.equal(revokedReceipt.status, 404)
assert.match(revokedReceipt.headers.get('content-type') ?? '', /^text\/html/)
assert.match(await revokedReceipt.text(), /That Pick link is no longer available\./)
console.log('PASS any current member can immediately revoke a public receipt and exact retry cannot restore or recount it')
assert.equal((await post('closeGroupPick', owner.idToken, {
  pickId: revocablePick.payload.id, status: 'dismissed',
})).response.status, 200)

const dismissedPick = await post('createGroupPick', owner.idToken, {
  groupId, creationKey: 'group-pick-operation-dismissed',
  attendeeUids: [owner.localId, member.localId], placeId, context: 'Anything',
})
assert.equal(dismissedPick.response.status, 201)
const dismissed = await post('closeGroupPick', member.idToken, {
  pickId: dismissedPick.payload.id, status: 'dismissed',
})
assert.equal(dismissed.response.status, 200)
const dismissedReceipt = await fetch(`${origin}/pickReceipt?token=${encodeURIComponent(dismissedPick.payload.shareToken)}`)
assert.equal(dismissedReceipt.status, 404)
const dismissedStoredPick = await db.collection('picks').doc(dismissedPick.payload.id).get()
assert.equal('shareToken' in dismissedStoredPick.data(), false)
console.log('PASS dismissing a Pick revokes its receipt and removes the stale share control')

const leavingPick = await post('createGroupPick', owner.idToken, {
  groupId, creationKey: 'group-pick-operation-leaving',
  attendeeUids: [owner.localId, member.localId], placeId, context: 'Anything',
})
assert.equal(leavingPick.response.status, 201)
const outsiderLeaveNoop = await post('leaveGroup', intruder.idToken, { groupId })
assert.equal(outsiderLeaveNoop.response.status, 200)
group = await db.collection('groups').doc(groupId).get()
assert.deepEqual(group.data()?.memberUids, [owner.localId, member.localId, outsider.localId])
assert.equal(group.data()?.activePick?.id, leavingPick.payload.id)
const memberLeft = await post('leaveGroup', member.idToken, { groupId })
assert.equal(memberLeft.response.status, 200)
receipt = await fetch(receiptUrl)
assert.equal(receipt.status, 404)
group = await db.collection('groups').doc(groupId).get()
assert.equal(group.exists, true)
assert.deepEqual(group.data()?.memberUids, [owner.localId, outsider.localId])
assert.equal(group.data()?.permissionVersion, 2)
assert.equal('activePick' in group.data(), false)
assert.equal((await db.collection('picks').doc(leavingPick.payload.id).get()).data()?.status, 'dismissed')
const repairedProjection = await db.collection('groups').doc(groupId).collection('signals').doc(`${owner.localId}__${placeId}`).get()
const removedProjection = await db.collection('groups').doc(groupId).collection('signals').doc(`${member.localId}__${placeId}`).get()
const removedPreference = await db.collection('groups').doc(groupId).collection('preferences').doc(member.localId).get()
assert.equal(repairedProjection.data()?.permissionVersion, 2)
assert.equal(removedProjection.exists, false)
assert.equal(removedPreference.exists, false)
const memberLeaveReplay = await post('leaveGroup', member.idToken, { groupId })
assert.equal(memberLeaveReplay.response.status, 200)
const groupAfterLeaveReplay = await db.collection('groups').doc(groupId).get()
assert.deepEqual(groupAfterLeaveReplay.data()?.memberUids, [owner.localId, outsider.localId])
assert.equal(groupAfterLeaveReplay.data()?.permissionVersion, 2)
const ownerLeft = await post('leaveGroup', owner.idToken, { groupId })
assert.equal(ownerLeft.response.status, 200)
group = await db.collection('groups').doc(groupId).get()
assert.equal(group.exists, false)
const deletedGroupLeaveReplay = await post('leaveGroup', owner.idToken, { groupId })
assert.equal(deletedGroupLeaveReplay.response.status, 200)
console.log('PASS leaving is retry-safe, outsiders cannot mutate it, surviving projections repair, and groups below two close')
