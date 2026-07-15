import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const projectId = 'demo-this-is-v2'
initializeApp({ projectId })
const auth = getAuth()
const db = getFirestore()
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST
if (!authHost || !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Run through Firebase auth + Firestore emulators.')
}

const signup = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'owner@example.test', password: 'correct-horse-battery', returnSecureToken: true }),
})
assert.equal(signup.status, 200)
const identity = await signup.json()
const uid = identity.localId
const token = identity.idToken
const deletionOperationKey = 'A'.repeat(43)
const deletionOperationId = createHash('sha256').update(deletionOperationKey).digest('hex')

const crossAccountSignup = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'cross-account@example.test', password: 'another-correct-horse', returnSecureToken: true }),
})
assert.equal(crossAccountSignup.status, 200)
const crossAccountIdentity = await crossAccountSignup.json()
const crossAccountUid = crossAccountIdentity.localId
const crossAccountToken = crossAccountIdentity.idToken
const crossAccountSaveId = `${crossAccountUid}__g:cross-account-proof`

const other = await auth.createUser({ email: 'other@example.test' })
const third = await auth.createUser({ email: 'third@example.test' })
const saveId = `${uid}__g:export-proof`
await Promise.all([
  db.collection('users').doc(uid).set({ displayName: 'Owner', avatarHex: '#5A6B8E' }),
  db.collection('users').doc(other.uid).set({ displayName: 'Other', following: [uid] }),
  db.collection('users').doc(third.uid).set({ displayName: 'Third' }),
  db.collection('users').doc(crossAccountUid).set({ displayName: 'Cross Account', avatarHex: '#735F4C' }),
  db.collection('saves').doc(crossAccountSaveId).set({
    uid: crossAccountUid, placeId: 'g:cross-account-proof', tag: 'want', visibility: 'private', ts: 2,
    memory: {
      placeId: 'g:cross-account-proof', label: 'Cross Account Proof', category: 'coffee',
      hex: '#735F4C', provenance: 'user_confirmed',
    },
  }),
  db.collection('saves').doc(saveId).set({
    uid, placeId: 'g:export-proof', tag: 'loved', visibility: 'private', ts: 1,
    note: 'private export proof', place: { name: 'Proof', hex: '#3A2B31' },
    observations: { quiet: { value: 'yes', observedAt: 1, audience: 'private', source: 'user_authored' } },
  }),
  db.collection('invites').doc('export-token').set({
    inviterUid: uid, status: 'active', createdAt: Timestamp.now(),
    expiresAt: Timestamp.fromMillis(Date.now() + 60_000),
  }),
  db.collection('connections').doc(`${uid}__${other.uid}`).set({
    memberUids: [uid, other.uid], invitedBy: uid, acceptedBy: other.uid,
    inviteToken: 'export-token', status: 'active', createdAt: 1,
  }),
  db.collection('picks').doc('export-pick').set({
    id: 'export-pick', createdBy: uid, memberUids: [uid, other.uid], withUid: other.uid,
    withName: 'Other', placeId: 'g:export-proof', place: { name: 'Proof', hex: '#3A2B31' },
    reasonCode: 'my_love', reason: 'Your turn to introduce Other.', context: 'Anything',
    status: 'selected', createdAt: 1, updatedAt: 1,
  }),
  db.collection('picks').doc('export-group-pick').set({
    kind: 'group', id: 'export-group-pick', groupId: 'export-group', groupName: 'Export Group',
    groupPermissionVersion: 1, createdBy: uid,
    memberUids: [uid, other.uid, third.uid], attendeeUids: [uid, other.uid],
    attendees: [
      { uid, displayName: 'Owner', avatarHex: '#5A6B8E' },
      { uid: other.uid, displayName: 'Other', avatarHex: '#8E5A6B' },
    ],
    placeId: 'g:export-proof', place: { name: 'Proof', hex: '#3A2B31' },
    reasonCode: 'everyone_supports', reason: 'Everyone has a reason to go.', context: 'Anything',
    shareToken: 'exportReceiptToken123',
    status: 'selected', createdAt: 1, updatedAt: 1,
  }),
  db.collection('pickReceipts').doc('exportReceiptToken123').set({
    placeId: 'g:export-proof', placeName: 'Proof', reason: 'Everyone has a reason to go.',
    context: 'Anything', attendeeCount: 2, status: 'selected', createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  }),
  db.collection('users').doc(uid).collection('events').doc('export-event').set({
    name: 'signal_saved', properties: { tag: 'loved' }, schemaVersion: 1,
    ts: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000),
  }),
  db.collection('groups').doc('export-group').set({
    name: 'Export Group', status: 'active',
    memberUids: [uid, other.uid, third.uid],
    members: [
      { uid, displayName: 'Owner', avatarHex: '#5A6B8E' },
      { uid: other.uid, displayName: 'Other', avatarHex: '#8E5A6B' },
      { uid: third.uid, displayName: 'Third', avatarHex: '#6B8E5A' },
    ],
    membershipLocked: true,
    permissionVersion: 1,
    projectionCount: 2,
    receiptCount: 1,
  }),
  db.collection('groups').doc('export-group').collection('receiptRefs').doc('exportReceiptToken123').set({
    pickId: 'export-group-pick', createdAt: Date.now(),
  }),
  db.collection('groups').doc('export-group').collection('signals').doc(`${uid}__g:export-proof`).set({
    uid, placeId: 'g:export-proof', tag: 'loved', visibility: 'circle', ts: 1,
    note: 'group projection export proof', place: { name: 'Proof', hex: '#3A2B31' },
    observations: { quiet: { value: 'yes', observedAt: 1, audience: 'group', source: 'user_authored' } },
    includeObservations: true, permissionVersion: 1,
  }),
  db.collection('groups').doc('export-group').collection('signals').doc(`${other.uid}__g:other`).set({
    uid: other.uid, placeId: 'g:other', tag: 'want', visibility: 'circle', ts: 1,
    place: { name: 'Other Proof', hex: '#4A3038' }, permissionVersion: 1,
  }),
  db.collection('groups').doc('export-group').collection('preferences').doc(uid).set({
    uid, categoryHints: ['coffee'], constraintHints: ['quiet'], permissionVersion: 1,
  }),
  db.collection('groups').doc('export-group').collection('preferences').doc(other.uid).set({
    uid: other.uid, categoryHints: ['food'], constraintHints: ['casual'], permissionVersion: 1,
  }),
  db.collection('groups').doc('export-group').collection('draftPasses').doc('export-draft-pass').set({
    draftKey: 'a'.repeat(64), placeId: 'g:export-proof', actorUid: uid, permissionVersion: 1,
    createdAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() + 6 * 60 * 60 * 1000),
  }),
  db.collection('groupInvites').doc('export-group-token').set({
    groupId: 'export-group', groupName: 'Export Group', invitedBy: uid,
    inviterName: 'Owner', inviterAvatarHex: '#5A6B8E', memberCountAtCreation: 3,
    status: 'active', createdAt: Timestamp.now(),
    expiresAt: Timestamp.fromMillis(Date.now() + 60_000),
  }),
])

const origin = `http://127.0.0.1:5001/${projectId}/us-central1`
const unauthorized = await fetch(`${origin}/exportMyData`, { method: 'POST' })
assert.equal(unauthorized.status, 401)
console.log('PASS data export requires a verified Firebase identity')

const exportResponse = await fetch(`${origin}/exportMyData`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: '{}',
})
assert.equal(exportResponse.status, 200)
const exported = await exportResponse.json()
assert.equal(exported.scope, 'canonical-v2')
assert.equal(exported.account.uid, uid)
assert.equal(exported.saves[0].note, 'private export proof')
assert.equal(exported.saves[0].observations.quiet.audience, 'private')
assert.equal(exported.connections.length, 1)
assert.equal(exported.groups.length, 1)
assert.equal(exported.groupSignals.length, 1)
assert.equal(exported.groupSignals[0].note, 'group projection export proof')
assert.equal(exported.groupSignals[0].observations.quiet.audience, 'group')
assert.equal(exported.groupPreferences.length, 1)
assert.deepEqual(exported.groupPreferences[0].categoryHints, ['coffee'])
assert.equal(exported.groupDraftPasses.length, 1)
assert.equal(exported.groupDraftPasses[0].actorUid, uid)
assert.equal(exported.groupInvites.length, 1)
assert.equal(exported.picks.length, 2)
assert.equal(exported.pickReceipts.length, 1)
assert.equal(exported.pickReceipts[0].placeName, 'Proof')
assert.equal(exported.invites.length, 1)
assert.equal(exported.events.length, 1)
assert.match(exported.events[0].ts, /^\d{4}-\d{2}-\d{2}T/)
console.log('PASS owner export covers every canonical personal-data surface')

const deletion = await fetch(`${origin}/deleteMyAccount`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ confirmation: 'DELETE', operationKey: deletionOperationKey }),
})
assert.equal(deletion.status, 200, await deletion.text())

const deletionOperationBeforeReplay = await db.collection('accountDeletionOps').doc(deletionOperationId).get()
assert.equal(deletionOperationBeforeReplay.data()?.status, 'complete')
assert.equal(deletionOperationBeforeReplay.data()?.uid, undefined)
assert.ok(deletionOperationBeforeReplay.data()?.expiresAt instanceof Timestamp)
await assert.rejects(() => auth.getUser(uid))
const deletionOperationBytesBeforeReplay = JSON.stringify(deletionOperationBeforeReplay.data())
const deletionOperationUpdateBeforeReplay = deletionOperationBeforeReplay.updateTime?.toMillis()

const deletionReplay = await fetch(`${origin}/deleteMyAccount`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ confirmation: 'DELETE', operationKey: deletionOperationKey }),
})
const deletionReplayBody = await deletionReplay.json()
assert.equal(deletionReplay.status, 200, JSON.stringify(deletionReplayBody))
assert.deepEqual(deletionReplayBody, { deleted: true })
const deletionOperationAfterReplay = await db.collection('accountDeletionOps').doc(deletionOperationId).get()
assert.equal(JSON.stringify(deletionOperationAfterReplay.data()), deletionOperationBytesBeforeReplay)
assert.equal(deletionOperationAfterReplay.updateTime?.toMillis(), deletionOperationUpdateBeforeReplay)

const [profile, save, invite, connection, group, groupSignal, otherGroupSignal, groupPreference, otherGroupPreference, groupDraftPass, groupReceiptRef, publicReceipt, groupInvite, pick, groupPick, event, otherProfile, deletionOperation] = await Promise.all([
  db.collection('users').doc(uid).get(),
  db.collection('saves').doc(saveId).get(),
  db.collection('invites').doc('export-token').get(),
  db.collection('connections').doc(`${uid}__${other.uid}`).get(),
  db.collection('groups').doc('export-group').get(),
  db.collection('groups').doc('export-group').collection('signals').doc(`${uid}__g:export-proof`).get(),
  db.collection('groups').doc('export-group').collection('signals').doc(`${other.uid}__g:other`).get(),
  db.collection('groups').doc('export-group').collection('preferences').doc(uid).get(),
  db.collection('groups').doc('export-group').collection('preferences').doc(other.uid).get(),
  db.collection('groups').doc('export-group').collection('draftPasses').doc('export-draft-pass').get(),
  db.collection('groups').doc('export-group').collection('receiptRefs').doc('exportReceiptToken123').get(),
  db.collection('pickReceipts').doc('exportReceiptToken123').get(),
  db.collection('groupInvites').doc('export-group-token').get(),
  db.collection('picks').doc('export-pick').get(),
  db.collection('picks').doc('export-group-pick').get(),
  db.collection('users').doc(uid).collection('events').doc('export-event').get(),
  db.collection('users').doc(other.uid).get(),
  db.collection('accountDeletionOps').doc(deletionOperationId).get(),
])
assert.deepEqual(
  [profile.exists, save.exists, invite.exists, connection.exists, groupSignal.exists, groupPreference.exists, groupDraftPass.exists, groupReceiptRef.exists, publicReceipt.exists, groupInvite.exists, pick.exists, groupPick.exists, event.exists],
  [false, false, false, false, false, false, false, false, false, false, false, false, false],
)
assert.equal(group.exists, true)
assert.deepEqual(group.data()?.memberUids, [other.uid, third.uid])
assert.equal(group.data()?.permissionVersion, 2)
assert.equal(group.data()?.projectionCount, 1)
assert.equal(group.data()?.receiptCount, 0)
assert.equal(otherGroupSignal.data()?.permissionVersion, 2)
assert.equal(otherGroupPreference.data()?.permissionVersion, 2)
assert.deepEqual(otherProfile.data()?.following, [])
assert.equal(deletionOperation.data()?.status, 'complete')
assert.equal(deletionOperation.data()?.uid, undefined)
assert.ok(deletionOperation.data()?.expiresAt instanceof Timestamp)
console.log('PASS deletion removes Auth, events, signals, Quick start preferences, draft passes, group projections, receipts, relationships, Picks, and legacy references')
console.log('PASS unauthenticated exact deletion replay remains a no-op success after Auth removal')

const [crossProfileBefore, crossSaveBefore, operationBeforeCross, crossAuthBefore] = await Promise.all([
  db.collection('users').doc(crossAccountUid).get(),
  db.collection('saves').doc(crossAccountSaveId).get(),
  db.collection('accountDeletionOps').doc(deletionOperationId).get(),
  auth.getUser(crossAccountUid),
])
assert.equal(crossProfileBefore.exists, true)
assert.equal(crossSaveBefore.exists, true)
assert.equal(operationBeforeCross.data()?.status, 'complete')

const crossAccountReplay = await fetch(`${origin}/deleteMyAccount`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${crossAccountToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ confirmation: 'DELETE', operationKey: deletionOperationKey }),
})
const crossAccountReplayBody = await crossAccountReplay.json()
assert.equal(crossAccountReplay.status, 409, JSON.stringify(crossAccountReplayBody))
assert.deepEqual(crossAccountReplayBody, { error: 'deletion-operation-unavailable' })

const [crossProfileAfter, crossSaveAfter, operationAfterCross, crossAuthAfter] = await Promise.all([
  db.collection('users').doc(crossAccountUid).get(),
  db.collection('saves').doc(crossAccountSaveId).get(),
  db.collection('accountDeletionOps').doc(deletionOperationId).get(),
  auth.getUser(crossAccountUid),
])
assert.deepEqual(crossProfileAfter.data(), crossProfileBefore.data())
assert.equal(crossProfileAfter.updateTime?.toMillis(), crossProfileBefore.updateTime?.toMillis())
assert.deepEqual(crossSaveAfter.data(), crossSaveBefore.data())
assert.equal(crossSaveAfter.updateTime?.toMillis(), crossSaveBefore.updateTime?.toMillis())
assert.deepEqual(operationAfterCross.data(), operationBeforeCross.data())
assert.equal(operationAfterCross.updateTime?.toMillis(), operationBeforeCross.updateTime?.toMillis())
assert.deepEqual(
  {
    uid: crossAuthAfter.uid,
    email: crossAuthAfter.email,
    disabled: crossAuthAfter.disabled,
    tokensValidAfterTime: crossAuthAfter.tokensValidAfterTime,
  },
  {
    uid: crossAuthBefore.uid,
    email: crossAuthBefore.email,
    disabled: crossAuthBefore.disabled,
    tokensValidAfterTime: crossAuthBefore.tokensValidAfterTime,
  },
)
console.log('PASS an authenticated second account cannot reuse a completed deletion key or alter either account')
