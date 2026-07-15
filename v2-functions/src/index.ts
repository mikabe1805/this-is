import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getStorage } from 'firebase-admin/storage'
import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import {
  FieldValue,
  getFirestore,
  Timestamp,
  type DocumentData,
  type Query,
  type QuerySnapshot,
} from 'firebase-admin/firestore'
import { onRequest } from 'firebase-functions/v2/https'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { defineSecret } from 'firebase-functions/params'
import { hasRecentAuthentication, portable } from './account-data.js'
import { resolveMapsRedirects } from './maps-url.js'
import {
  acceptGroupMember,
  buildGroupQuickStartPreference,
  groupAudienceStampMatches,
  groupSignalProjection,
  memberSnapshot,
  normalizeGroupAudienceStamp,
  normalizeGroupName,
  normalizePlaceObservations,
  validUserPlaceMemory,
  type CanonicalSignal,
  type GroupLifecycleState,
} from './group-lifecycle.js'
import {
  deriveGroupCandidate,
  GROUP_PICK_REQUIREMENT_KEYS,
  GROUP_PICK_CONTEXTS,
  normalizeGroupPickPlanArea,
  validGroupAttendees,
  type GroupPickContext,
  type ProjectedPreference,
  type ProjectedSignal,
} from './group-pick.js'
import {
  PICK_RECEIPT_LIFETIME_MS,
  renderPickReceiptHtml,
  renderUnavailablePickReceiptHtml,
  validPickReceipt,
} from './pick-receipt.js'
import {
  buildPairGroupMigration,
  pairMigrationGroupId,
  pairReasonToGroupReason,
  type PairConnectionMigrationInput,
} from './pair-migration.js'
import {
  canReservePlacePhoto,
  fetchGooglePlacePhoto,
  normalizePlacePhotoBudget,
  photoUsageMonth,
  validGooglePlaceId,
} from './place-photo.js'
import {
  canonicalSignalFromSave,
  planProjectionSync,
  projectionBelongsToSaveLifetime,
} from './projection-sync.js'
import {
  createAreaGazetteerLoader,
  normalizeAreaGazetteerServiceConfig,
  searchServerPlanAreas,
  validPlanAreaQuery,
} from './area-gazetteer.js'
import {
  GROUP_DRAFT_PASS_LIFETIME_MS,
  GROUP_DRAFT_PASS_LIMIT,
  groupDraftKey,
  groupDraftPassId,
} from './group-draft.js'

const app = getApps()[0] ?? initializeApp()
const firestore = getFirestore(app)
const placesServerKey = defineSecret('PLACES_SERVER_KEY')
const loadAreaGazetteer = createAreaGazetteerLoader(async objectPath => {
  const [bytes] = await getStorage().bucket().file(objectPath).download()
  return bytes
})

function bearerToken(request: { get(name: string): string | undefined }): string | null {
  return request.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null
}

async function authenticatedUid(request: { get(name: string): string | undefined }) {
  const token = bearerToken(request)
  if (!token) return null
  try {
    return await getAuth().verifyIdToken(token, true)
  } catch {
    return null
  }
}

function rows(snapshot: QuerySnapshot<DocumentData>) {
  return snapshot.docs.map(document => ({ id: document.id, ...portable(document.data()) as object }))
}

async function recursiveDeleteQuery(query: Query<DocumentData>): Promise<void> {
  while (true) {
    const snapshot = await query.limit(200).get()
    if (snapshot.empty) return
    await Promise.all(snapshot.docs.map(document => firestore.recursiveDelete(document.ref)))
  }
}

function lifecycleState(data: DocumentData): GroupLifecycleState | null {
  if (
    typeof data.name !== 'string'
    || !['forming', 'active'].includes(data.status)
    || !Array.isArray(data.memberUids)
    || !Array.isArray(data.members)
    || typeof data.membershipLocked !== 'boolean'
    || !Number.isSafeInteger(data.permissionVersion)
  ) return null
  return data as GroupLifecycleState
}

function timestampMillis(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value && typeof value === 'object' && 'toMillis' in value
    && typeof value.toMillis === 'function') {
    const millis = value.toMillis()
    return typeof millis === 'number' && Number.isFinite(millis) ? millis : 0
  }
  return 0
}

function validDocumentId(value: unknown, maxLength: number): value is string {
  return typeof value === 'string'
    && value.length >= 1
    && value.length <= maxLength
    && value === value.trim()
    && value !== '.'
    && value !== '..'
    && !value.includes('/')
    && ![...value].some(character => {
      const code = character.charCodeAt(0)
      return code <= 31 || code === 127
    })
    && !/^__.*__$/.test(value)
}

function groupCreationDocumentId(uid: string, creationKey: unknown): string | null {
  if (typeof creationKey !== 'string' || !/^[A-Za-z0-9_-]{16,80}$/.test(creationKey)) return null
  const digest = createHash('sha256').update(`this.is:group-create:${uid}:${creationKey}`).digest('hex')
  return `create_${digest.slice(0, 40)}`
}

function groupInviteDocumentId(uid: string, groupId: string, creationKey: unknown): string | null {
  if (!groupId || typeof creationKey !== 'string' || !/^[A-Za-z0-9_-]{16,80}$/.test(creationKey)) return null
  const digest = createHash('sha256').update(`this.is:group-invite:${uid}:${groupId}:${creationKey}`).digest('hex')
  return `invite_${digest.slice(0, 40)}`
}

function groupPickDocumentIds(uid: string, groupId: string, creationKey: unknown): {
  pickId: string
  receiptToken: string
} | null {
  if (!groupId || typeof creationKey !== 'string' || !/^[A-Za-z0-9_-]{16,80}$/.test(creationKey)) return null
  const pickDigest = createHash('sha256').update(`this.is:group-pick:${uid}:${groupId}:${creationKey}`).digest('hex')
  const receiptDigest = createHash('sha256').update(`this.is:group-pick-receipt:${uid}:${groupId}:${creationKey}`).digest('hex')
  return {
    pickId: `pick_${pickDigest.slice(0, 40)}`,
    receiptToken: `receipt_${receiptDigest.slice(0, 40)}`,
  }
}

export const syncGroupSignalProjections = onDocumentWritten({
  document: 'saves/{saveId}',
  region: 'us-central1',
  maxInstances: 4,
}, async event => {
  const before = event.data?.before.exists ? event.data.before.data() : null
  const after = event.data?.after.exists ? event.data.after.data() : null
  const source = after ?? before
  const uid = typeof source?.uid === 'string' ? source.uid : ''
  const placeId = typeof source?.placeId === 'string' ? source.placeId : ''
  if (!uid || !placeId || event.params.saveId !== `${uid}__${placeId}`) return
  const saveRef = firestore.collection('saves').doc(event.params.saveId)
  const projections = await firestore.collectionGroup('signals')
    .where('uid', '==', uid)
    .where('placeId', '==', placeId)
    .get()
  for (const projectedDocument of projections.docs) {
    const projectionRef = projectedDocument.ref
    const groupRef = projectionRef.parent.parent
    if (!groupRef || groupRef.parent.id !== 'groups') continue
    await firestore.runTransaction(async transaction => {
      const [group, projection, save] = await Promise.all([
        transaction.get(groupRef),
        transaction.get(projectionRef),
        transaction.get(saveRef),
      ])
      const canonical = canonicalSignalFromSave(save.exists ? save.data() : null, uid, placeId)
      const consentIsCurrent = !save.exists || !projection.exists
        ? true
        : projectionBelongsToSaveLifetime(projection.updateTime, save.createTime)
      const plan = planProjectionSync({
        canonical: consentIsCurrent ? canonical : null,
        group: group.exists ? lifecycleState(group.data() ?? {}) : null,
        projection: projection.exists ? projection.data() : null,
      })
      if (plan.action === 'none') return
      if (plan.action === 'update') {
        transaction.set(projectionRef, plan.value)
        transaction.update(groupRef, { updatedAt: FieldValue.serverTimestamp() })
        return
      }
      transaction.delete(projectionRef)
      if (group.exists) {
        transaction.update(groupRef, {
          projectionCount: Math.max(0, Number(group.data()?.projectionCount ?? 0) - 1),
          updatedAt: FieldValue.serverTimestamp(),
        })
      }
    })
  }
})

export const revokeClosedGroupInvites = onDocumentWritten({
  document: 'groups/{groupId}',
  region: 'us-central1',
  maxInstances: 4,
}, async event => {
  const before = event.data?.before.exists ? event.data.before.data() : null
  const after = event.data?.after.exists ? event.data.after.data() : null
  const lockedNow = before?.membershipLocked !== true && after?.membershipLocked === true
  const beforeCount = Array.isArray(before?.memberUids) ? before.memberUids.length : 0
  const afterCount = Array.isArray(after?.memberUids) ? after.memberUids.length : 0
  const filledNow = beforeCount < 6 && afterCount >= 6
  if (!lockedNow && !filledNow) return
  const revokedReason = lockedNow ? 'audience-locked' : 'group-full'

  const activeInvites = firestore.collection('groupInvites')
    .where('groupId', '==', event.params.groupId)
    .where('status', '==', 'active')
  while (true) {
    const snapshot = await activeInvites.limit(400).get()
    if (snapshot.empty) return
    const batch = firestore.batch()
    snapshot.docs.forEach(invite => batch.update(invite.ref, {
      status: 'revoked',
      revokedReason,
      revokedAt: FieldValue.serverTimestamp(),
    }))
    await batch.commit()
    if (snapshot.size < 400) return
  }
})

export const placePhoto = onRequest({
  cors: false,
  maxInstances: 2,
  timeoutSeconds: 20,
  memory: '256MiB',
  secrets: [placesServerKey],
}, async (request, response) => {
  response.set('Cache-Control', 'private, no-store, max-age=0')
  response.set('Cross-Origin-Resource-Policy', 'same-origin')
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method-not-allowed' })
    return
  }
  const identity = await authenticatedUid(request)
  if (!identity) {
    response.status(401).json({ error: 'invalid-authentication' })
    return
  }
  const groupId = request.body?.groupId
  const placeId = request.body?.placeId
  const googlePlaceId = typeof placeId === 'string' && placeId.startsWith('g:')
    ? placeId.slice(2)
    : placeId
  if (
    (groupId !== undefined && (typeof groupId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(groupId)))
    || typeof placeId !== 'string'
    || !validGooglePlaceId(googlePlaceId)
  ) {
    response.status(422).json({ error: 'invalid-photo-request' })
    return
  }

  if (typeof groupId === 'string') {
    const group = await firestore.collection('groups').doc(groupId).get()
    const data = group.data()
    const memberUids = Array.isArray(data?.memberUids)
      ? data.memberUids.filter((uid): uid is string => typeof uid === 'string')
      : []
    const permissionVersion = Number(data?.permissionVersion)
    if (!group.exists || data?.status !== 'active' || !memberUids.includes(identity.uid)
      || !Number.isSafeInteger(permissionVersion)) {
      response.status(403).json({ error: 'group-photo-forbidden' })
      return
    }
    const signalRefs = memberUids.map(uid => firestore.collection('groups').doc(groupId)
      .collection('signals').doc(`${uid}__${placeId}`))
    const signals = await firestore.getAll(...signalRefs)
    const hasCurrentEvidence = signals.some(signal => {
      const signalData = signal.data()
      return signal.exists
        && signalData?.placeId === placeId
        && signalData?.permissionVersion === permissionVersion
        && ['want', 'loved'].includes(signalData?.tag)
        && validUserPlaceMemory(signalData?.memory, placeId)
    })
    if (!hasCurrentEvidence) {
      response.status(404).json({ error: 'candidate-photo-unavailable' })
      return
    }
  } else {
    const save = await firestore.collection('saves').doc(`${identity.uid}__${placeId}`).get()
    const data = save.data()
    if (!save.exists || data?.uid !== identity.uid || data?.placeId !== placeId
      || !['want', 'tried', 'loved'].includes(data?.tag)
      || !validUserPlaceMemory(data?.memory, placeId)) {
      response.status(404).json({ error: 'saved-photo-unavailable' })
      return
    }
  }

  const month = photoUsageMonth()
  const configRef = firestore.collection('serviceConfig').doc('placePhotos')
  const usageRef = firestore.collection('serviceUsage').doc(`placePhotos-${month}`)
  const reserved = await firestore.runTransaction(async transaction => {
    const [configSnapshot, usageSnapshot] = await Promise.all([
      transaction.get(configRef),
      transaction.get(usageRef),
    ])
    const config = normalizePlacePhotoBudget(configSnapshot.data())
    const used = Number(usageSnapshot.data()?.count ?? 0)
    if (!canReservePlacePhoto(config, used)) return false
    transaction.set(usageRef, {
      kind: 'place_photo',
      month,
      count: used + 1,
      monthlyLimit: config.monthlyLimit,
      updatedAt: Timestamp.now(),
    })
    return true
  })
  if (!reserved) {
    response.status(429).json({ error: 'photo-budget-unavailable' })
    return
  }

  const photo = await fetchGooglePlacePhoto(googlePlaceId, placesServerKey.value())
  if (!photo) {
    response.status(404).json({ error: 'photo-unavailable' })
    return
  }
  response.set('Content-Type', photo.contentType)
  if (photo.attribution) response.set('X-Photo-Attribution', encodeURIComponent(photo.attribution))
  if (photo.sourceUri) response.set('X-Photo-Source', encodeURIComponent(photo.sourceUri))
  response.status(200).end(Buffer.from(photo.bytes))
})

export const searchPlanAreas = onRequest({
  cors: false,
  maxInstances: 2,
  timeoutSeconds: 15,
  memory: '512MiB',
}, async (request, response) => {
  response.set('Cache-Control', 'private, no-store, max-age=0')
  response.set('Cross-Origin-Resource-Policy', 'same-origin')
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method-not-allowed' })
    return
  }
  const identity = await authenticatedUid(request)
  if (!identity) {
    response.status(401).json({ error: 'invalid-authentication' })
    return
  }
  const groupId = request.body?.groupId
  const query = request.body?.query
  if (typeof groupId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(groupId)
    || !validPlanAreaQuery(query)) {
    response.status(422).json({ error: 'invalid-area-search' })
    return
  }
  const group = await firestore.collection('groups').doc(groupId).get()
  const state = group.exists ? lifecycleState(group.data() ?? {}) : null
  if (state?.status !== 'active' || state.memberUids.length < 2 || !state.memberUids.includes(identity.uid)) {
    response.status(403).json({ error: 'area-search-forbidden' })
    return
  }
  const configSnapshot = await firestore.collection('serviceConfig').doc('areaGazetteer').get()
  const config = normalizeAreaGazetteerServiceConfig(configSnapshot.data())
  if (!config) {
    response.status(503).json({ error: 'area-search-unavailable' })
    return
  }
  try {
    const artifact = await loadAreaGazetteer(config)
    const areas = searchServerPlanAreas(query, artifact)
    const month = new Date().toISOString().slice(0, 7)
    try {
      await firestore.collection('serviceUsage').doc(`areaGazetteer-${month}`).set({
        kind: 'area_gazetteer_search',
        month,
        queryCount: FieldValue.increment(1),
        updatedAt: Timestamp.now(),
      }, { merge: true })
    } catch {
      // Search remains usable if aggregate-only cost telemetry is temporarily unavailable.
    }
    response.status(200).json({
      areas,
      snapshotDate: artifact.snapshotDate,
      attribution: {
        provider: 'GeoNames',
        license: 'CC BY 4.0',
        source: 'https://www.geonames.org/',
      },
    })
  } catch {
    // Never expose object names, digests, parser failures, or storage details.
    response.status(503).json({ error: 'area-search-unavailable' })
  }
})

export const createGroup = onRequest({
  cors: false,
  maxInstances: 4,
  timeoutSeconds: 15,
}, async (request, response) => {
  response.set('Cache-Control', 'private, no-store')
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method-not-allowed' })
    return
  }
  const identity = await authenticatedUid(request)
  if (!identity) {
    response.status(401).json({ error: 'invalid-authentication' })
    return
  }
  const name = normalizeGroupName(request.body?.name)
  const groupId = groupCreationDocumentId(identity.uid, request.body?.creationKey)
  const profile = await firestore.collection('users').doc(identity.uid).get()
  const member = memberSnapshot(identity.uid, profile.data())
  if (!name || !groupId || !member || profile.data()?.deleting === true) {
    response.status(422).json({ error: 'invalid-group' })
    return
  }
  const now = Timestamp.now()
  const groupRef = firestore.collection('groups').doc(groupId)
  const created = await firestore.runTransaction(async transaction => {
    const existing = await transaction.get(groupRef)
    if (existing.exists) {
      if (existing.data()?.createdBy !== identity.uid) throw new Error('group-creation-conflict')
      return false
    }
    transaction.create(groupRef, {
      name,
      status: 'forming',
      createdBy: identity.uid,
      memberUids: [identity.uid],
      members: [{ ...member, joinedAt: now }],
      membershipLocked: false,
      permissionVersion: 1,
      projectionCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    return true
  })
  response.status(created ? 201 : 200).json({ groupId })
})

export const createGroupInvite = onRequest({
  cors: false,
  maxInstances: 4,
  timeoutSeconds: 15,
}, async (request, response) => {
  response.set('Cache-Control', 'private, no-store')
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method-not-allowed' })
    return
  }
  const identity = await authenticatedUid(request)
  if (!identity) {
    response.status(401).json({ error: 'invalid-authentication' })
    return
  }
  const groupId = typeof request.body?.groupId === 'string' ? request.body.groupId : ''
  const token = groupInviteDocumentId(identity.uid, groupId, request.body?.creationKey)
  if (!token) {
    response.status(422).json({ error: 'invalid-invite' })
    return
  }
  const now = Timestamp.now()
  const inviteRef = firestore.collection('groupInvites').doc(token)
  const groupRef = firestore.collection('groups').doc(groupId)
  const activeInvitesQuery = firestore.collection('groupInvites')
    .where('groupId', '==', groupId)
    .where('status', '==', 'active')
  try {
    const created = await firestore.runTransaction(async transaction => {
      const [group, activeInvites, existingInvite] = await Promise.all([
        transaction.get(groupRef),
        transaction.get(activeInvitesQuery),
        transaction.get(inviteRef),
      ])
      const state = group.exists ? lifecycleState(group.data() ?? {}) : null
      const inviter = state?.members.find(member => member.uid === identity.uid)
      if (
        !state || !inviter || state.memberUids.length >= 6
        || !['forming', 'active'].includes(state.status)
      ) throw new Error('invite-unavailable')
      if (state.membershipLocked) throw new Error('membership-locked')
      if (existingInvite.exists) {
        const existing = existingInvite.data()
        if (!existing) throw new Error('invite-unavailable')
        if (
          existing?.groupId === groupId
          && existing.invitedBy === identity.uid
          && existing.status === 'active'
          && existing.expiresAt instanceof Timestamp
          && existing.expiresAt.toMillis() > now.toMillis()
        ) return false
        throw new Error('invite-unavailable')
      }
      const validActiveInvites = activeInvites.docs.filter(invite => {
        const expiresAt = invite.data().expiresAt
        return expiresAt instanceof Timestamp && expiresAt.toMillis() > now.toMillis()
      }).length
      if (validActiveInvites >= 6 - state.memberUids.length) {
        throw new Error('invite-capacity-reserved')
      }
      transaction.create(inviteRef, {
        groupId,
        groupName: state.name,
        invitedBy: identity.uid,
        inviterName: inviter.displayName,
        inviterAvatarHex: inviter.avatarHex,
        memberCountAtCreation: state.memberUids.length,
        status: 'active',
        createdAt: now,
        expiresAt: Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1000),
      })
      return true
    })
    response.status(created ? 201 : 200).json({ token })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'invite-unavailable'
    response.status(409).json({ error: [
      'membership-locked', 'invite-capacity-reserved',
    ].includes(code) ? code : 'invite-unavailable' })
  }
})

export const listGroupInvites = onRequest({
  cors: false,
  maxInstances: 4,
  timeoutSeconds: 15,
}, async (request, response) => {
  response.set('Cache-Control', 'private, no-store')
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method-not-allowed' })
    return
  }
  const identity = await authenticatedUid(request)
  if (!identity) {
    response.status(401).json({ error: 'invalid-authentication' })
    return
  }
  const groupId = typeof request.body?.groupId === 'string' ? request.body.groupId : ''
  const group = await firestore.collection('groups').doc(groupId).get()
  const state = group.exists ? lifecycleState(group.data() ?? {}) : null
  if (
    !state?.memberUids.includes(identity.uid) || state.membershipLocked
    || state.memberUids.length >= 6
  ) {
    response.status(409).json({ error: 'group-unavailable' })
    return
  }
  const now = Timestamp.now()
  const invites = await firestore.collection('groupInvites')
    .where('groupId', '==', groupId)
    .where('invitedBy', '==', identity.uid)
    .where('status', '==', 'active')
    .where('expiresAt', '>', now)
    .orderBy('expiresAt', 'asc')
    .limit(5)
    .get()
  response.status(200).json({
    links: invites.docs.map(invite => ({
      token: invite.id,
      createdAt: invite.data().createdAt instanceof Timestamp
        ? invite.data().createdAt.toMillis()
        : now.toMillis(),
      expiresAt: invite.data().expiresAt.toMillis(),
    })),
  })
})

export const revokeGroupInvite = onRequest({
  cors: false,
  maxInstances: 4,
  timeoutSeconds: 15,
}, async (request, response) => {
  response.set('Cache-Control', 'private, no-store')
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method-not-allowed' })
    return
  }
  const identity = await authenticatedUid(request)
  if (!identity) {
    response.status(401).json({ error: 'invalid-authentication' })
    return
  }
  const token = typeof request.body?.token === 'string' ? request.body.token : ''
  const inviteRef = firestore.collection('groupInvites').doc(token)
  try {
    await firestore.runTransaction(async transaction => {
      const invite = await transaction.get(inviteRef)
      const inviteData = invite.data()
      if (!invite.exists || !inviteData) throw new Error('invite-unavailable')
      const groupRef = firestore.collection('groups').doc(String(inviteData.groupId ?? ''))
      const group = await transaction.get(groupRef)
      const state = group.exists ? lifecycleState(group.data() ?? {}) : null
      if (!state?.memberUids.includes(identity.uid)) throw new Error('invite-unavailable')
      if (
        inviteData.status === 'revoked'
        && inviteData.revokedReason === 'creator-revoked'
        && inviteData.invitedBy === identity.uid
        && inviteData.revokedBy === identity.uid
      ) return
      if (inviteData.status !== 'active' || inviteData.invitedBy !== identity.uid) {
        throw new Error('invite-unavailable')
      }
      transaction.update(inviteRef, {
        status: 'revoked',
        revokedReason: 'creator-revoked',
        revokedBy: identity.uid,
        revokedAt: FieldValue.serverTimestamp(),
      })
    })
    response.status(200).json({ revoked: true })
  } catch {
    response.status(409).json({ error: 'invite-unavailable' })
  }
})

export const acceptGroupInvite = onRequest({
  cors: false,
  maxInstances: 4,
  timeoutSeconds: 20,
}, async (request, response) => {
  response.set('Cache-Control', 'private, no-store')
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method-not-allowed' })
    return
  }
  const identity = await authenticatedUid(request)
  if (!identity) {
    response.status(401).json({ error: 'invalid-authentication' })
    return
  }
  const token = typeof request.body?.token === 'string' ? request.body.token : ''
  const inviteRef = firestore.collection('groupInvites').doc(token)
  const profileRef = firestore.collection('users').doc(identity.uid)
  try {
    const groupId = await firestore.runTransaction(async transaction => {
      const invite = await transaction.get(inviteRef)
      const inviteData = invite.data()
      if (!invite.exists || !inviteData) throw new Error('invite-unavailable')
      const groupRef = firestore.collection('groups').doc(String(inviteData.groupId ?? ''))
      const group = await transaction.get(groupRef)
      const state = group.exists ? lifecycleState(group.data() ?? {}) : null
      if (
        inviteData.status === 'accepted'
        && inviteData.acceptedBy === identity.uid
        && state?.memberUids.includes(identity.uid)
      ) return groupRef.id
      if (
        inviteData.status !== 'active'
        || !(inviteData.expiresAt instanceof Timestamp)
        || inviteData.expiresAt.toMillis() <= Date.now()
      ) throw new Error('invite-unavailable')
      const profile = await transaction.get(profileRef)
      const member = memberSnapshot(identity.uid, profile.data())
      if (!state || !member || profile.data()?.deleting === true) throw new Error('invite-unavailable')
      const next = acceptGroupMember(state, { ...member, joinedAt: Timestamp.now() })
      transaction.update(groupRef, {
        status: next.status,
        memberUids: next.memberUids,
        members: next.members,
        updatedAt: FieldValue.serverTimestamp(),
      })
      transaction.update(inviteRef, {
        status: 'accepted',
        acceptedBy: identity.uid,
        acceptedAt: FieldValue.serverTimestamp(),
      })
      return groupRef.id
    })
    response.status(200).json({ groupId })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'invite-unavailable'
    response.status(409).json({ error: ['membership-locked', 'group-full'].includes(code) ? code : 'invite-unavailable' })
  }
})

export const saveGroupQuickStart = onRequest({
  cors: false,
  maxInstances: 4,
  timeoutSeconds: 15,
}, async (request, response) => {
  response.set('Cache-Control', 'private, no-store')
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method-not-allowed' })
    return
  }
  const identity = await authenticatedUid(request)
  if (!identity) {
    response.status(401).json({ error: 'invalid-authentication' })
    return
  }
  const groupId = typeof request.body?.groupId === 'string' ? request.body.groupId : ''
  const requestedAction = request.body?.action
  const action = requestedAction === undefined || requestedAction === 'save'
    ? 'save'
    : requestedAction === 'remove'
      ? 'remove'
      : null
  if (!action) {
    response.status(422).json({ error: 'invalid-quick-start-action' })
    return
  }
  if (!validDocumentId(groupId, 160)) {
    response.status(422).json({ error: 'invalid-quick-start-target' })
    return
  }
  const audience = action === 'save' ? normalizeGroupAudienceStamp(request.body?.audience) : null
  if ((action === 'save' && !audience) || (action === 'remove' && request.body?.audience !== undefined)) {
    response.status(422).json({ error: 'invalid-audience-review' })
    return
  }
  const groupRef = firestore.collection('groups').doc(groupId)
  const preferenceRef = groupRef.collection('preferences').doc(identity.uid)
  const profileRef = firestore.collection('users').doc(identity.uid)
  try {
    await firestore.runTransaction(async transaction => {
      const [group, profile, existingPreference] = await Promise.all([
        transaction.get(groupRef), transaction.get(profileRef), transaction.get(preferenceRef),
      ])
      const state = group.exists ? lifecycleState(group.data() ?? {}) : null
      if (
        !state || state.status !== 'active' || !state.memberUids.includes(identity.uid)
        || profile.data()?.deleting === true
      ) throw new Error('group-unavailable')
      if (action === 'remove') {
        if (!existingPreference.exists) return
        transaction.delete(preferenceRef)
        transaction.update(groupRef, { updatedAt: FieldValue.serverTimestamp() })
        return
      }
      if (!groupAudienceStampMatches(audience, state)) throw new Error('audience-changed')
      const preference = buildGroupQuickStartPreference({
        uid: identity.uid,
        categoryHints: request.body?.categoryHints,
        constraintHints: request.body?.constraintHints,
        permissionVersion: state.permissionVersion,
      })
      if (!preference) throw new Error('invalid-quick-start')
      const existing = existingPreference.data()
      const unchanged = existingPreference.exists
        && existing?.uid === preference.uid
        && existing?.permissionVersion === preference.permissionVersion
        && JSON.stringify(existing?.categoryHints ?? []) === JSON.stringify(preference.categoryHints)
        && JSON.stringify(existing?.constraintHints ?? []) === JSON.stringify(preference.constraintHints)
      if (unchanged && state.membershipLocked) return
      transaction.set(preferenceRef, { ...preference, updatedAt: FieldValue.serverTimestamp() })
      transaction.update(groupRef, {
        membershipLocked: true,
        updatedAt: FieldValue.serverTimestamp(),
      })
    })
    response.status(200).json({ saved: action === 'save' })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'quick-start-failed'
    response.status(409).json({ error: code })
  }
})

export const shareGroupSignal = onRequest({
  cors: false,
  maxInstances: 4,
  timeoutSeconds: 20,
}, async (request, response) => {
  response.set('Cache-Control', 'private, no-store')
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method-not-allowed' })
    return
  }
  const identity = await authenticatedUid(request)
  if (!identity) {
    response.status(401).json({ error: 'invalid-authentication' })
    return
  }
  const groupId = typeof request.body?.groupId === 'string' ? request.body.groupId : ''
  const placeId = typeof request.body?.placeId === 'string' ? request.body.placeId : ''
  const requestedAction = request.body?.action
  const action = requestedAction === undefined || requestedAction === 'share'
    ? 'share'
    : requestedAction === 'remove'
      ? 'remove'
      : null
  if (!action) {
    response.status(422).json({ error: 'invalid-share-action' })
    return
  }
  if (!validDocumentId(groupId, 160) || !validDocumentId(placeId, 260)) {
    response.status(422).json({ error: 'invalid-share-target' })
    return
  }
  const audience = action === 'share' ? normalizeGroupAudienceStamp(request.body?.audience) : null
  if ((action === 'share' && !audience) || (action === 'remove' && request.body?.audience !== undefined)) {
    response.status(422).json({ error: 'invalid-audience-review' })
    return
  }
  const groupRef = firestore.collection('groups').doc(groupId)
  const projectionRef = groupRef.collection('signals').doc(`${identity.uid}__${placeId}`)
  const saveRef = firestore.collection('saves').doc(`${identity.uid}__${placeId}`)
  try {
    await firestore.runTransaction(async transaction => {
      const [group, projection, save] = await Promise.all([
        transaction.get(groupRef),
        transaction.get(projectionRef),
        transaction.get(saveRef),
      ])
      const state = group.exists ? lifecycleState(group.data() ?? {}) : null
      if (!state || state.status !== 'active' || !state.memberUids.includes(identity.uid)) {
        throw new Error('group-unavailable')
      }
      const count = Number(group.data()?.projectionCount ?? 0)
      if (action === 'remove') {
        if (projection.exists) transaction.delete(projectionRef)
        if (projection.exists) transaction.update(groupRef, {
          projectionCount: Math.max(0, count - 1),
          updatedAt: FieldValue.serverTimestamp(),
        })
        return
      }
      if (!groupAudienceStampMatches(audience, state)) throw new Error('audience-changed')
      const data = save.data()
      const observations = data?.observations === undefined
        ? undefined
        : normalizePlaceObservations(data.observations, 'private')
      if (
        !save.exists || data?.uid !== identity.uid || data.placeId !== placeId
        || !['want', 'tried', 'loved'].includes(data.tag)
        || !validUserPlaceMemory(data.memory, placeId)
        || (data.observations !== undefined && !observations)
      ) throw new Error('signal-unavailable')
      if (!projection.exists && count >= 300) throw new Error('group-signal-limit')
      const signal: CanonicalSignal = {
        uid: identity.uid,
        placeId,
        tag: data.tag,
        ts: Number(data.ts ?? 0),
        note: typeof data.note === 'string' ? data.note : undefined,
        memory: data.memory,
        ...(observations ? { observations } : {}),
      }
      const desiredProjection = groupSignalProjection(
        signal,
        state.permissionVersion,
        request.body?.includeNote === true,
        request.body?.includeObservations === true,
      )
      const unchanged = projection.exists
        && isDeepStrictEqual(projection.data(), desiredProjection)
      if (unchanged && state.membershipLocked) return
      transaction.set(
        projectionRef,
        desiredProjection,
      )
      transaction.update(groupRef, {
        membershipLocked: true,
        projectionCount: projection.exists ? count : count + 1,
        updatedAt: FieldValue.serverTimestamp(),
      })
    })
    response.status(200).json({ shared: action === 'share' })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'share-failed'
    response.status(409).json({ error: code })
  }
})

export const leaveGroup = onRequest({
  cors: false,
  maxInstances: 4,
  timeoutSeconds: 30,
}, async (request, response) => {
  response.set('Cache-Control', 'private, no-store')
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method-not-allowed' })
    return
  }
  const identity = await authenticatedUid(request)
  if (!identity) {
    response.status(401).json({ error: 'invalid-authentication' })
    return
  }
  const groupId = typeof request.body?.groupId === 'string' ? request.body.groupId : ''
  const groupRef = firestore.collection('groups').doc(groupId)
  try {
    const leaveResult = await firestore.runTransaction(async transaction => {
      const group = await transaction.get(groupRef)
      const state = group.exists ? lifecycleState(group.data() ?? {}) : null
      if (!state || !state.memberUids.includes(identity.uid)) {
        return { changed: false, deleteGroup: false }
      }
      const activePickId = typeof group.data()?.activePick?.id === 'string' ? group.data()?.activePick.id : ''
      const activePickRef = activePickId ? firestore.collection('picks').doc(activePickId) : null
      const [signals, preferences, receiptRefs, activePick] = await Promise.all([
        transaction.get(groupRef.collection('signals')),
        transaction.get(groupRef.collection('preferences')),
        transaction.get(groupRef.collection('receiptRefs')),
        activePickRef ? transaction.get(activePickRef) : Promise.resolve(null),
      ])
      const permissionVersion = state.permissionVersion + 1
      receiptRefs.docs.forEach(receipt => {
        transaction.delete(firestore.collection('pickReceipts').doc(receipt.id))
        transaction.delete(receipt.ref)
      })
      if (activePick?.exists && activePick.data()?.status === 'selected') {
        transaction.update(activePick.ref, {
          status: 'dismissed',
          shareToken: FieldValue.delete(),
          updatedAt: Date.now(),
        })
      }
      if (state.memberUids.length <= 2) {
        transaction.update(groupRef, {
          status: 'deleting', memberUids: [], members: [], permissionVersion,
          projectionCount: 0, receiptCount: 0,
          activePick: FieldValue.delete(), recentPick: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        })
        return { changed: true, deleteGroup: true }
      }
      let projectionCount = 0
      signals.docs.forEach(signal => {
        if (signal.data().uid === identity.uid) transaction.delete(signal.ref)
        else {
          projectionCount += 1
          transaction.update(signal.ref, { permissionVersion })
        }
      })
      preferences.docs.forEach(preference => {
        if (preference.data().uid === identity.uid) transaction.delete(preference.ref)
        else transaction.update(preference.ref, { permissionVersion })
      })
      transaction.update(groupRef, {
        memberUids: state.memberUids.filter(uid => uid !== identity.uid),
        members: state.members.filter(member => member.uid !== identity.uid),
        permissionVersion,
        projectionCount,
        receiptCount: 0,
        activePick: FieldValue.delete(),
        recentPick: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      })
      return { changed: true, deleteGroup: false }
    })
    if (leaveResult.deleteGroup) await firestore.recursiveDelete(groupRef)
    if (leaveResult.changed) {
      await recursiveDeleteQuery(firestore.collection('groupInvites').where('groupId', '==', groupId))
    }
    response.status(200).json({ left: true })
  } catch {
    response.status(409).json({ error: 'group-unavailable' })
  }
})

export const migratePairToGroup = onRequest({
  cors: false,
  maxInstances: 4,
  timeoutSeconds: 30,
}, async (request, response) => {
  response.set('Cache-Control', 'private, no-store')
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method-not-allowed' })
    return
  }
  const identity = await authenticatedUid(request)
  if (!identity) {
    response.status(401).json({ error: 'invalid-authentication' })
    return
  }
  const otherUid = typeof request.body?.otherUid === 'string' ? request.body.otherUid : ''
  if (!otherUid || otherUid === identity.uid) {
    response.status(422).json({ error: 'invalid-pair' })
    return
  }
  const memberUids = [identity.uid, otherUid].sort()
  const connectionId = memberUids.join('__')
  const connectionRef = firestore.collection('connections').doc(connectionId)
  const groupRef = firestore.collection('groups').doc(pairMigrationGroupId(connectionId))
  try {
    const result = await firestore.runTransaction(async transaction => {
      const [
        connection, existingGroup, firstProfile, secondProfile,
        firstSaves, secondSaves, pairPicks,
      ] = await Promise.all([
        transaction.get(connectionRef),
        transaction.get(groupRef),
        transaction.get(firestore.collection('users').doc(memberUids[0])),
        transaction.get(firestore.collection('users').doc(memberUids[1])),
        transaction.get(firestore.collection('saves').where('uid', '==', memberUids[0])),
        transaction.get(firestore.collection('saves').where('uid', '==', memberUids[1])),
        transaction.get(firestore.collection('picks').where('memberUids', 'array-contains', identity.uid)),
      ])
      const connectionData = connection.data()
      if (
        connection.exists && connectionData?.status === 'migrated'
        && connectionData.migratedGroupId === groupRef.id
        && existingGroup.exists && existingGroup.data()?.memberUids?.includes(identity.uid)
      ) return { groupId: groupRef.id, migrated: false }
      if (
        !connection.exists || connectionData?.status !== 'active'
        || JSON.stringify([...(connectionData.memberUids ?? [])].sort()) !== JSON.stringify(memberUids)
        || existingGroup.exists
        || firstProfile.data()?.deleting === true || secondProfile.data()?.deleting === true
      ) throw new Error('pair-unavailable')
      const members = [
        memberSnapshot(memberUids[0], firstProfile.data()),
        memberSnapshot(memberUids[1], secondProfile.data()),
      ]
      if (members.some(member => !member)) throw new Error('pair-unavailable')
      const now = Timestamp.now()
      const signalDocuments = [...firstSaves.docs, ...secondSaves.docs]
      const migration = buildPairGroupMigration({
        connectionId,
        memberUids,
        status: connectionData.status,
        members: members as NonNullable<(typeof members)[number]>[],
        signals: signalDocuments.map(document => document.data()) as PairConnectionMigrationInput['signals'],
        migratedAt: now,
      })
      const legacyPicks = pairPicks.docs.filter(document => {
        const data = document.data()
        return data.kind !== 'group'
          && Array.isArray(data.memberUids)
          && JSON.stringify([...data.memberUids].sort()) === JSON.stringify(memberUids)
          && validUserPlaceMemory(data.memory, data.placeId)
      })
      if (legacyPicks.length > 100) throw new Error('pair-pick-limit')

      const selectedLegacyPicks = legacyPicks
        .filter(document => document.data().status === 'selected')
        .sort((a, b) => timestampMillis(b.data().updatedAt ?? b.data().createdAt)
          - timestampMillis(a.data().updatedAt ?? a.data().createdAt))
      const currentLegacyPick = selectedLegacyPicks[0]
      const currentLegacyData = currentLegacyPick?.data()
      const migratedActivePick = currentLegacyPick && currentLegacyData
        ? {
            id: currentLegacyPick.id,
            placeId: String(currentLegacyData.placeId),
            label: currentLegacyData.memory.label,
            attendeeCount: 2,
            createdAt: timestampMillis(currentLegacyData.createdAt) || Date.now(),
          }
        : undefined
      const currentVisitedPick = !migratedActivePick
        ? legacyPicks
            .filter(document => document.data().status === 'visited')
            .sort((a, b) => timestampMillis(b.data().updatedAt ?? b.data().createdAt)
              - timestampMillis(a.data().updatedAt ?? a.data().createdAt))[0]
        : undefined
      const currentVisitedData = currentVisitedPick?.data()
      const migratedRecentPick = currentVisitedPick && currentVisitedData
        ? {
            id: currentVisitedPick.id,
            placeId: String(currentVisitedData.placeId),
            label: currentVisitedData.memory.label,
            attendeeCount: 2,
            createdAt: timestampMillis(currentVisitedData.createdAt) || Date.now(),
            visitedAt: Math.max(
              timestampMillis(currentVisitedData.createdAt),
              timestampMillis(currentVisitedData.updatedAt),
            ) || Date.now(),
          }
        : undefined

      transaction.set(groupRef, {
        ...migration.group,
        ...(migratedActivePick ? { activePick: migratedActivePick } : {}),
        ...(migratedRecentPick ? { recentPick: migratedRecentPick } : {}),
      })
      migration.projections.forEach(projection => {
        transaction.set(groupRef.collection('signals').doc(projection.id), projection.value)
      })
      transaction.update(connectionRef, {
        status: 'migrated',
        migratedGroupId: groupRef.id,
        migratedAt: now,
      })
      const attendees = migration.group.members.map(({ uid, displayName, avatarHex }) => ({
        uid, displayName, avatarHex,
      }))
      legacyPicks.forEach(document => {
        const data = document.data()
        transaction.update(document.ref, {
          kind: 'group',
          groupId: groupRef.id,
          groupName: migration.group.name,
          groupPermissionVersion: 1,
          attendeeUids: memberUids,
          attendees,
          reasonCode: pairReasonToGroupReason(data.reasonCode),
          place: FieldValue.delete(),
          withUid: FieldValue.delete(),
          withName: FieldValue.delete(),
          ...(data.status === 'selected' && document.id !== currentLegacyPick?.id
            ? { status: 'dismissed' }
            : {}),
          updatedAt: Date.now(),
        })
      })
      return { groupId: groupRef.id, migrated: true }
    })
    response.status(200).json(result)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'pair-unavailable'
    response.status(409).json({ error: code })
  }
})

export const updateGroupDraftPass = onRequest({
  cors: false,
  maxInstances: 4,
  timeoutSeconds: 20,
}, async (request, response) => {
  response.set('Cache-Control', 'private, no-store')
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method-not-allowed' })
    return
  }
  const identity = await authenticatedUid(request)
  if (!identity) {
    response.status(401).json({ error: 'invalid-authentication' })
    return
  }
  const action = ['pass', 'undo'].includes(request.body?.action) ? request.body.action as 'pass' | 'undo' : null
  const groupId = typeof request.body?.groupId === 'string' ? request.body.groupId : ''
  const expectedDraftKey = typeof request.body?.draftKey === 'string' && /^[a-f0-9]{64}$/.test(request.body.draftKey)
    ? request.body.draftKey
    : ''
  const placeId = typeof request.body?.placeId === 'string' ? request.body.placeId : ''
  const attendeeUids = Array.isArray(request.body?.attendeeUids)
    ? request.body.attendeeUids.filter((uid: unknown): uid is string => typeof uid === 'string')
    : []
  const guestCount = request.body?.guestCount === 1
    ? 1
    : request.body?.guestCount === 0 || request.body?.guestCount === undefined
    ? 0
    : null
  const context = GROUP_PICK_CONTEXTS.includes(request.body?.context)
    ? request.body.context as GroupPickContext
    : null
  const planArea = request.body?.planArea === undefined
    ? ''
    : normalizeGroupPickPlanArea(request.body.planArea)
  const requiredObservation = request.body?.requiredObservation === undefined
    ? undefined
    : GROUP_PICK_REQUIREMENT_KEYS.find(key => key === request.body.requiredObservation)
  if (!action || !groupId || !expectedDraftKey || !placeId || placeId.length > 512 || !context || guestCount === null
    || planArea === null
    || (request.body?.requiredObservation !== undefined && !requiredObservation)) {
    response.status(422).json({ error: 'invalid-draft-pass' })
    return
  }
  const groupRef = firestore.collection('groups').doc(groupId)
  try {
    const result = await firestore.runTransaction(async transaction => {
      const group = await transaction.get(groupRef)
      const state = group.exists ? lifecycleState(group.data() ?? {}) : null
      if (!state || state.status !== 'active'
        || !validGroupAttendees(state.memberUids, attendeeUids, identity.uid)) {
        throw new Error('invalid-attendees')
      }
      const evidenceUpdatedAt = timestampMillis(group.data()?.updatedAt)
      if (evidenceUpdatedAt <= 0) throw new Error('invalid-draft-version')
      const orderedAttendees = state.memberUids.filter(uid => attendeeUids.includes(uid))
      const recentPlaceId = typeof group.data()?.recentPick?.placeId === 'string'
        ? group.data()?.recentPick.placeId as string
        : undefined
      const draftKey = groupDraftKey({
        permissionVersion: state.permissionVersion,
        evidenceUpdatedAt,
        attendeeUids: orderedAttendees,
        guestCount,
        context,
        planArea,
        ...(requiredObservation ? { requiredObservation } : {}),
        ...(recentPlaceId ? { recentPlaceId } : {}),
      })
      if (draftKey !== expectedDraftKey) throw new Error('draft-version-changed')
      const passRef = groupRef.collection('draftPasses').doc(groupDraftPassId(draftKey, placeId))
      const [existing, draftPasses] = await Promise.all([
        transaction.get(passRef),
        transaction.get(groupRef.collection('draftPasses').where('draftKey', '==', draftKey).limit(12)),
      ])
      const now = Date.now()
      const activePasses = draftPasses.docs.filter(document => timestampMillis(document.data().expiresAt) > now)
      draftPasses.docs.filter(document => timestampMillis(document.data().expiresAt) <= now)
        .forEach(document => transaction.delete(document.ref))

      if (action === 'undo') {
        if (!existing.exists || timestampMillis(existing.data()?.expiresAt) <= now) {
          return { draftKey, removed: false }
        }
        if (existing.data()?.actorUid !== identity.uid) throw new Error('pass-owned-by-other')
        transaction.delete(passRef)
        return { draftKey, removed: true }
      }

      if (existing.exists && timestampMillis(existing.data()?.expiresAt) > now) {
        return { draftKey, passed: true, actorUid: existing.data()?.actorUid as string }
      }
      if (activePasses.length >= GROUP_DRAFT_PASS_LIMIT) throw new Error('draft-pass-limit')
      const [signals, preferences] = await Promise.all([
        transaction.get(groupRef.collection('signals')
          .where('permissionVersion', '==', state.permissionVersion)),
        transaction.get(groupRef.collection('preferences')
          .where('permissionVersion', '==', state.permissionVersion)),
      ])
      const candidate = deriveGroupCandidate({
        placeId,
        context,
        permissionVersion: state.permissionVersion,
        attendeeUids: orderedAttendees,
        members: state.members,
        signals: signals.docs.map(document => document.data() as ProjectedSignal),
        preferences: preferences.docs.map(document => document.data() as ProjectedPreference),
        guestCount,
        planArea,
        requiredObservation,
        ...(recentPlaceId ? { excludedPlaceIds: [recentPlaceId] } : {}),
      })
      if (!candidate) throw new Error('unsupported-place')
      transaction.set(passRef, {
        draftKey,
        placeId,
        actorUid: identity.uid,
        permissionVersion: state.permissionVersion,
        createdAt: Timestamp.fromMillis(now),
        expiresAt: Timestamp.fromMillis(now + GROUP_DRAFT_PASS_LIFETIME_MS),
      })
      return { draftKey, passed: true, actorUid: identity.uid }
    })
    response.status(200).json(result)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'draft-pass-unavailable'
    response.status(409).json({ error: [
      'invalid-attendees', 'invalid-draft-version', 'draft-version-changed', 'pass-owned-by-other',
      'draft-pass-limit', 'unsupported-place',
    ].includes(code) ? code : 'draft-pass-unavailable' })
  }
})

export const createGroupPick = onRequest({
  cors: false,
  maxInstances: 4,
  timeoutSeconds: 20,
}, async (request, response) => {
  response.set('Cache-Control', 'private, no-store')
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method-not-allowed' })
    return
  }
  const identity = await authenticatedUid(request)
  if (!identity) {
    response.status(401).json({ error: 'invalid-authentication' })
    return
  }
  const groupId = typeof request.body?.groupId === 'string' ? request.body.groupId : ''
  const placeId = typeof request.body?.placeId === 'string' ? request.body.placeId : ''
  const attendeeUids = Array.isArray(request.body?.attendeeUids)
    ? request.body.attendeeUids.filter((uid: unknown): uid is string => typeof uid === 'string')
    : []
  const guestCount = request.body?.guestCount === 1
    ? 1
    : request.body?.guestCount === 0 || request.body?.guestCount === undefined
    ? 0
    : null
  const context = GROUP_PICK_CONTEXTS.includes(request.body?.context)
    ? request.body.context as GroupPickContext
    : null
  const planArea = request.body?.planArea === undefined
    ? ''
    : normalizeGroupPickPlanArea(request.body.planArea)
  const requiredObservation = request.body?.requiredObservation === undefined
    ? undefined
    : GROUP_PICK_REQUIREMENT_KEYS.find(key => key === request.body.requiredObservation)
  if (!groupId || !placeId || !context || guestCount === null || planArea === null
    || (request.body?.requiredObservation !== undefined && !requiredObservation)) {
    response.status(422).json({ error: 'invalid-pick' })
    return
  }
  const documentIds = groupPickDocumentIds(identity.uid, groupId, request.body?.creationKey)
  if (!documentIds) {
    response.status(422).json({ error: 'invalid-creation-key' })
    return
  }
  const groupRef = firestore.collection('groups').doc(groupId)
  const pickRef = firestore.collection('picks').doc(documentIds.pickId)
  const receiptRef = firestore.collection('pickReceipts').doc(documentIds.receiptToken)
  const groupReceiptRef = groupRef.collection('receiptRefs').doc(receiptRef.id)
  try {
    const result = await firestore.runTransaction(async transaction => {
      const [group, existingPick] = await Promise.all([
        transaction.get(groupRef),
        transaction.get(pickRef),
      ])
      const state = group.exists ? lifecycleState(group.data() ?? {}) : null
      if (
        !state || state.status !== 'active'
        || !validGroupAttendees(state.memberUids, attendeeUids, identity.uid)
      ) throw new Error('invalid-attendees')
      const orderedAttendees = state.memberUids.filter(uid => attendeeUids.includes(uid))
      if (existingPick.exists) {
        const data = existingPick.data() ?? {}
        const sameRequest = data.kind === 'group'
          && data.createdBy === identity.uid
          && data.groupId === groupId
          && data.groupPermissionVersion === state.permissionVersion
          && data.placeId === placeId
          && data.context === context
          && Number(data.guestCount ?? 0) === guestCount
          && String(data.planArea ?? '') === planArea
          && String(data.requiredObservation ?? '') === String(requiredObservation ?? '')
          && Array.isArray(data.attendeeUids)
          && data.attendeeUids.length === orderedAttendees.length
          && data.attendeeUids.every((uid: unknown, index: number) => uid === orderedAttendees[index])
        if (!sameRequest) throw new Error('pick-operation-conflict')
        return { pick: data, replayed: true }
      }
      if (group.data()?.activePick && typeof group.data()?.activePick.id === 'string') {
        throw new Error('pick-already-open')
      }
      const evidenceUpdatedAt = timestampMillis(group.data()?.updatedAt)
      if (evidenceUpdatedAt <= 0) throw new Error('invalid-draft-version')
      const recentPlaceId = typeof group.data()?.recentPick?.placeId === 'string'
        ? group.data()?.recentPick.placeId as string
        : undefined
      const draftKey = groupDraftKey({
        permissionVersion: state.permissionVersion,
        evidenceUpdatedAt,
        attendeeUids: orderedAttendees,
        guestCount,
        context,
        planArea,
        ...(requiredObservation ? { requiredObservation } : {}),
        ...(recentPlaceId ? { recentPlaceId } : {}),
      })
      const [signals, preferences, expiredReceiptRefs, draftPasses] = await Promise.all([
        transaction.get(groupRef.collection('signals')
          .where('permissionVersion', '==', state.permissionVersion)),
        transaction.get(groupRef.collection('preferences')
          .where('permissionVersion', '==', state.permissionVersion)),
        transaction.get(groupRef.collection('receiptRefs').where('expiresAt', '<=', Date.now())),
        transaction.get(groupRef.collection('draftPasses').where('draftKey', '==', draftKey).limit(12)),
      ])
      const storedReceiptCount = Number(group.data()?.receiptCount ?? 0)
      const receiptCount = Math.max(0, storedReceiptCount - expiredReceiptRefs.size)
      if (!Number.isSafeInteger(storedReceiptCount) || receiptCount >= 100) throw new Error('receipt-limit')
      const now = Date.now()
      if (draftPasses.docs.some(document => document.data().placeId === placeId
        && timestampMillis(document.data().expiresAt) > now)) throw new Error('candidate-passed')
      const candidate = deriveGroupCandidate({
        placeId,
        context,
        permissionVersion: state.permissionVersion,
        attendeeUids: orderedAttendees,
        members: state.members,
        signals: signals.docs.map(document => document.data() as ProjectedSignal),
        preferences: preferences.docs.map(document => document.data() as ProjectedPreference),
        guestCount,
        planArea,
        requiredObservation,
        ...(recentPlaceId ? { excludedPlaceIds: [recentPlaceId] } : {}),
      })
      if (!candidate) throw new Error('unsupported-place')
      const expiresAt = now + PICK_RECEIPT_LIFETIME_MS
      const attendees = state.members.filter(member => orderedAttendees.includes(member.uid))
        .map(({ uid, displayName, avatarHex }) => ({ uid, displayName, avatarHex }))
      const value = {
        kind: 'group',
        id: pickRef.id,
        groupId,
        groupName: state.name,
        groupPermissionVersion: state.permissionVersion,
        createdBy: identity.uid,
        memberUids: state.memberUids,
        attendeeUids: orderedAttendees,
        attendees,
        ...(guestCount === 1 ? { guestCount } : {}),
        placeId,
        memory: candidate.memory,
        reasonCode: candidate.reasonCode,
        reason: candidate.reason,
        context,
        ...(planArea ? { planArea } : {}),
        ...(requiredObservation ? { requiredObservation } : {}),
        shareToken: receiptRef.id,
        status: 'selected',
        createdAt: now,
        updatedAt: now,
      }
      transaction.set(pickRef, value)
      expiredReceiptRefs.docs.forEach(expired => {
        transaction.delete(firestore.collection('pickReceipts').doc(expired.id))
        transaction.delete(expired.ref)
      })
      transaction.set(receiptRef, {
        placeId,
        placeName: candidate.memory.label,
        primaryType: candidate.memory.category,
        reason: candidate.reason,
        context,
        attendeeCount: orderedAttendees.length + guestCount,
        status: 'selected',
        createdAt: now,
        expiresAt,
      })
      transaction.set(groupReceiptRef, { pickId: pickRef.id, createdAt: now, expiresAt })
      draftPasses.docs.forEach(document => transaction.delete(document.ref))
      transaction.update(groupRef, {
        activePick: {
          id: pickRef.id,
          placeId,
          label: candidate.memory.label,
          attendeeCount: orderedAttendees.length + guestCount,
          createdAt: now,
        },
        recentPick: FieldValue.delete(),
        receiptCount: receiptCount + 1,
        updatedAt: FieldValue.serverTimestamp(),
      })
      return { pick: value, replayed: false }
    })
    response.status(result.replayed ? 200 : 201).json(result.pick)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'invalid-pick'
    response.status(409).json({ error: code })
  }
})

export const closeGroupPick = onRequest({
  cors: false,
  maxInstances: 4,
  timeoutSeconds: 15,
}, async (request, response) => {
  response.set('Cache-Control', 'private, no-store')
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method-not-allowed' })
    return
  }
  const identity = await authenticatedUid(request)
  if (!identity) {
    response.status(401).json({ error: 'invalid-authentication' })
    return
  }
  const pickId = typeof request.body?.pickId === 'string' ? request.body.pickId : ''
  const status = ['visited', 'dismissed'].includes(request.body?.status)
    ? request.body.status as 'visited' | 'dismissed'
    : null
  if (!pickId || !status) {
    response.status(422).json({ error: 'invalid-pick-status' })
    return
  }
  const pickRef = firestore.collection('picks').doc(pickId)
  try {
    const result = await firestore.runTransaction(async transaction => {
      const pick = await transaction.get(pickRef)
      const data = pick.data()
      if (
        !pick.exists || data?.kind !== 'group'
        || !Array.isArray(data.attendeeUids) || !data.attendeeUids.includes(identity.uid)
      ) throw new Error('pick-unavailable')
      const group = await transaction.get(firestore.collection('groups').doc(String(data.groupId ?? '')))
      if (!group.exists || !group.data()?.memberUids?.includes(identity.uid)) throw new Error('pick-unavailable')
      if (data.status === status) return { status, changed: false }
      if (data.status !== 'selected') throw new Error('pick-outcome-conflict')
      const shareToken = typeof data.shareToken === 'string' ? data.shareToken : ''
      const receiptRef = shareToken ? firestore.collection('pickReceipts').doc(shareToken) : null
      const receipt = receiptRef ? await transaction.get(receiptRef) : null
      const groupData = group.data() ?? {}
      const closesCurrentPick = groupData.activePick?.id === pickId
      const closedAt = Date.now()
      transaction.update(pickRef, {
        status,
        updatedAt: closedAt,
        ...(status === 'dismissed' && receiptRef ? { shareToken: FieldValue.delete() } : {}),
      })
      if (receiptRef && receipt?.exists) {
        if (status === 'visited') transaction.update(receiptRef, { status, updatedAt: closedAt })
        else {
          transaction.delete(receiptRef)
          transaction.delete(group.ref.collection('receiptRefs').doc(shareToken))
        }
      }
      if (closesCurrentPick || (status === 'dismissed' && receiptRef && receipt?.exists)) {
        transaction.update(group.ref, {
          ...(closesCurrentPick ? { activePick: FieldValue.delete() } : {}),
          ...(closesCurrentPick && status === 'visited'
            ? { recentPick: { ...groupData.activePick, visitedAt: closedAt } }
            : {}),
          ...(status === 'dismissed' && receiptRef && receipt?.exists
            ? { receiptCount: Math.max(0, Number(groupData.receiptCount ?? 1) - 1) }
            : {}),
          updatedAt: FieldValue.serverTimestamp(),
        })
      }
      return { status, changed: true }
    })
    response.status(200).json(result)
  } catch (error) {
    response.status(409).json({
      error: error instanceof Error && error.message === 'pick-outcome-conflict'
        ? 'pick-outcome-conflict'
        : 'pick-unavailable',
    })
  }
})

export const revokePickReceipt = onRequest({
  cors: false,
  maxInstances: 4,
  timeoutSeconds: 15,
}, async (request, response) => {
  response.set('Cache-Control', 'private, no-store')
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method-not-allowed' })
    return
  }
  const identity = await authenticatedUid(request)
  if (!identity) {
    response.status(401).json({ error: 'invalid-authentication' })
    return
  }
  const pickId = typeof request.body?.pickId === 'string' ? request.body.pickId : ''
  const pickRef = firestore.collection('picks').doc(pickId)
  try {
    await firestore.runTransaction(async transaction => {
      const pick = await transaction.get(pickRef)
      const data = pick.data()
      if (!pick.exists || data?.kind !== 'group') {
        throw new Error('receipt-unavailable')
      }
      const groupRef = firestore.collection('groups').doc(String(data.groupId ?? ''))
      const group = await transaction.get(groupRef)
      if (!group.exists || !group.data()?.memberUids?.includes(identity.uid)) {
        throw new Error('receipt-unavailable')
      }
      if (typeof data.shareToken !== 'string') return
      transaction.delete(firestore.collection('pickReceipts').doc(data.shareToken))
      transaction.delete(groupRef.collection('receiptRefs').doc(data.shareToken))
      transaction.update(pickRef, { shareToken: FieldValue.delete(), updatedAt: Date.now() })
      transaction.update(groupRef, {
        receiptCount: Math.max(0, Number(group.data()?.receiptCount ?? 1) - 1),
        updatedAt: FieldValue.serverTimestamp(),
      })
    })
    response.status(200).json({ revoked: true })
  } catch {
    response.status(409).json({ error: 'receipt-unavailable' })
  }
})

export const pickReceipt = onRequest({
  cors: false,
  maxInstances: 4,
  timeoutSeconds: 10,
}, async (request, response) => {
  response.set({
    'Cache-Control': 'private, no-store, max-age=0',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
  })
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.status(405).send('Method not allowed')
    return
  }
  const pathToken = request.path.split('/').filter(Boolean).at(-1) ?? ''
  const token = typeof request.query.token === 'string' ? request.query.token : pathToken
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) {
    response.status(404).type('html').send(request.method === 'HEAD' ? '' : renderUnavailablePickReceiptHtml())
    return
  }
  const snapshot = await firestore.collection('pickReceipts').doc(token).get()
  const value = snapshot.data()
  if (!snapshot.exists || !validPickReceipt(value)) {
    response.status(404).type('html').send(request.method === 'HEAD' ? '' : renderUnavailablePickReceiptHtml())
    return
  }
  const forwardedHost = request.get('x-forwarded-host')?.split(',')[0]?.trim()
  const requestHost = forwardedHost || request.get('host') || 'this-is-v2.web.app'
  const safeHost = /^[A-Za-z0-9.-]+(?::\d+)?$/.test(requestHost) ? requestHost : 'this-is-v2.web.app'
  const protocol = safeHost.startsWith('127.0.0.1') || safeHost.startsWith('localhost') ? 'http' : 'https'
  const canonicalUrl = `${protocol}://${safeHost}/pick/${token}`
  response.status(200).type('html').send(request.method === 'HEAD' ? '' : renderPickReceiptHtml(value, canonicalUrl))
})

export const resolveMapsUrl = onRequest({
  cors: false,
  maxInstances: 2,
  timeoutSeconds: 10,
}, async (request, response) => {
  response.set('Cache-Control', 'private, no-store')
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method-not-allowed' })
    return
  }
  const identity = await authenticatedUid(request)
  if (!identity) {
    response.status(401).json({ error: 'invalid-authentication' })
    return
  }
  const input = typeof request.body?.url === 'string' ? request.body.url : ''
  try {
    const finalUrl = await resolveMapsRedirects(input, async url => {
      const redirect = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        headers: { 'User-Agent': 'this.is maps-link resolver/1.0' },
        signal: AbortSignal.timeout(6_000),
      })
      const result = { status: redirect.status, headers: redirect.headers }
      await redirect.body?.cancel()
      return result
    })
    response.status(200).json({ finalUrl })
  } catch {
    response.status(422).json({ error: 'unresolvable-maps-link' })
  }
})

export const exportMyData = onRequest({
  cors: false,
  maxInstances: 2,
  timeoutSeconds: 30,
}, async (request, response) => {
  response.set('Cache-Control', 'private, no-store')
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method-not-allowed' })
    return
  }
  const identity = await authenticatedUid(request)
  if (!identity) {
    response.status(401).json({ error: 'invalid-authentication' })
    return
  }
  const uid = identity.uid
  const profileRef = firestore.collection('users').doc(uid)
  const [
    account, profile, saves, connections, groups, groupSignals,
    groupDraftPasses, createdGroupInvites, acceptedGroupInvites, picks, invites, events,
  ] = await Promise.all([
    getAuth().getUser(uid),
    profileRef.get(),
    firestore.collection('saves').where('uid', '==', uid).get(),
    firestore.collection('connections').where('memberUids', 'array-contains', uid).get(),
    firestore.collection('groups').where('memberUids', 'array-contains', uid).get(),
    firestore.collectionGroup('signals').where('uid', '==', uid).get(),
    firestore.collectionGroup('draftPasses').where('actorUid', '==', uid).get(),
    firestore.collection('groupInvites').where('invitedBy', '==', uid).get(),
    firestore.collection('groupInvites').where('acceptedBy', '==', uid).get(),
    firestore.collection('picks').where('memberUids', 'array-contains', uid).get(),
    firestore.collection('invites').where('inviterUid', '==', uid).get(),
    profileRef.collection('events').get(),
  ])
  if (profile.data()?.deleting === true) {
    response.status(409).json({ error: 'deletion-in-progress' })
    return
  }
  const groupInvites = new Map([
    ...createdGroupInvites.docs,
    ...acceptedGroupInvites.docs,
  ].map(document => [document.id, document]))
  const groupPreferenceSnapshots = await Promise.all(groups.docs.map(group =>
    group.ref.collection('preferences').doc(uid).get()))
  const receiptTokens = picks.docs
    .map(document => document.data().shareToken)
    .filter((token): token is string => typeof token === 'string')
  const pickReceipts = await Promise.all(receiptTokens.map(async token => {
    const receipt = await firestore.collection('pickReceipts').doc(token).get()
    return receipt.exists ? { token, ...portable(receipt.data()) as object } : null
  }))
  response.status(200).json({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    scope: 'canonical-v2',
    account: {
      uid: account.uid,
      email: account.email ?? null,
      displayName: account.displayName ?? null,
      photoURL: account.photoURL ?? null,
      createdAt: account.metadata.creationTime ?? null,
      lastSignInAt: account.metadata.lastSignInTime ?? null,
      providers: account.providerData.map(provider => provider.providerId),
    },
    profile: profile.exists ? portable(profile.data()) : null,
    saves: rows(saves),
    connections: rows(connections),
    groups: rows(groups),
    groupSignals: rows(groupSignals),
    groupDraftPasses: rows(groupDraftPasses),
    groupPreferences: groupPreferenceSnapshots.flatMap(preference => preference.exists
      ? [{ id: preference.id, groupId: preference.ref.parent.parent?.id ?? null, ...portable(preference.data()) as object }]
      : []),
    groupInvites: [...groupInvites.values()].map(document => ({
      id: document.id,
      ...portable(document.data()) as object,
    })),
    picks: rows(picks),
    pickReceipts: pickReceipts.filter(receipt => receipt !== null),
    invites: rows(invites),
    events: rows(events),
  })
})

export const deleteMyAccount = onRequest({
  cors: false,
  maxInstances: 2,
  timeoutSeconds: 120,
  memory: '512MiB',
}, async (request, response) => {
  response.set('Cache-Control', 'private, no-store')
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method-not-allowed' })
    return
  }
  if (request.body?.confirmation !== 'DELETE') {
    response.status(400).json({ error: 'confirmation-required' })
    return
  }
  const operationKey = typeof request.body?.operationKey === 'string'
    ? request.body.operationKey
    : ''
  if (!/^[A-Za-z0-9_-]{43}$/.test(operationKey)) {
    response.status(422).json({ error: 'invalid-deletion-operation' })
    return
  }
  const operationRef = firestore.collection('accountDeletionOps').doc(
    createHash('sha256').update(operationKey).digest('hex'),
  )
  const operationSnapshot = await operationRef.get()
  const operation = operationSnapshot.exists ? operationSnapshot.data() ?? {} : null
  const expiresAt = Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const finishAuthDeletion = async (uid: string) => {
    try {
      await getAuth().deleteUser(uid)
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error
        ? String(error.code)
        : ''
      if (code !== 'auth/user-not-found') throw error
    }
    await operationRef.set({
      status: 'complete',
      uid: FieldValue.delete(),
      completedAt: FieldValue.serverTimestamp(),
      expiresAt,
    }, { merge: true })
  }

  const identity = await authenticatedUid(request)
  if (!identity) {
    if (operation?.status === 'complete') {
      response.status(200).json({ deleted: true })
      return
    }
    if (operation?.status === 'cleanup-complete' && typeof operation.uid === 'string') {
      await finishAuthDeletion(operation.uid)
      response.status(200).json({ deleted: true })
      return
    }
    response.status(401).json({ error: 'invalid-authentication' })
    return
  }
  if (!hasRecentAuthentication(identity.auth_time)) {
    response.status(409).json({ error: 'recent-login-required' })
    return
  }

  const uid = identity.uid
  const claimedOperation = await firestore.runTransaction(async transaction => {
    const current = await transaction.get(operationRef)
    if (current.exists) return current.data() ?? {}
    const created = {
      uid,
      status: 'active',
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
    }
    transaction.create(operationRef, created)
    return { uid, status: 'active' }
  })
  if (claimedOperation.status === 'complete') {
    // The identity-free completion tombstone deliberately retains no UID, so
    // no authenticated caller can be safely associated with it. Only an
    // unauthenticated exact-key replay may confirm completed deletion above.
    response.status(409).json({ error: 'deletion-operation-unavailable' })
    return
  }
  if (claimedOperation.uid !== uid) {
    response.status(409).json({ error: 'deletion-operation-unavailable' })
    return
  }
  if (claimedOperation.status === 'cleanup-complete') {
    await finishAuthDeletion(uid)
    response.status(200).json({ deleted: true })
    return
  }

  const profileRef = firestore.collection('users').doc(uid)
  // This server-only marker makes accountActive() false before the first
  // multi-document delete. A retry remains possible through this endpoint.
  await profileRef.set({ deleting: true }, { merge: true })

  await recursiveDeleteQuery(firestore.collection('saves').where('uid', '==', uid))
  await recursiveDeleteQuery(firestore.collection('invites').where('inviterUid', '==', uid))
  await recursiveDeleteQuery(firestore.collection('connections').where('memberUids', 'array-contains', uid))
  await recursiveDeleteQuery(firestore.collection('picks').where('memberUids', 'array-contains', uid))
  await recursiveDeleteQuery(firestore.collection('groupInvites').where('invitedBy', '==', uid))
  await recursiveDeleteQuery(firestore.collection('groupInvites').where('acceptedBy', '==', uid))
  await recursiveDeleteQuery(firestore.collectionGroup('draftPasses').where('actorUid', '==', uid))

  const groups = await firestore.collection('groups').where('memberUids', 'array-contains', uid).get()
  for (const group of groups.docs) {
    const deleteGroup = await firestore.runTransaction(async transaction => {
      const current = await transaction.get(group.ref)
      if (!current.exists) return false
      const [signals, preferences, receiptRefs] = await Promise.all([
        transaction.get(group.ref.collection('signals')),
        transaction.get(group.ref.collection('preferences')),
        transaction.get(group.ref.collection('receiptRefs')),
      ])
      const data = current.data() ?? {}
      const memberUids = Array.isArray(data.memberUids)
        ? data.memberUids.filter((member): member is string => typeof member === 'string')
        : []
      const members = Array.isArray(data.members)
        ? data.members.filter(member => member?.uid !== uid)
        : []
      const permissionVersion = Number.isSafeInteger(data.permissionVersion)
        ? data.permissionVersion + 1
        : 1
      receiptRefs.docs.forEach(receipt => {
        transaction.delete(firestore.collection('pickReceipts').doc(receipt.id))
        transaction.delete(receipt.ref)
      })
      if (memberUids.length <= 2) {
        transaction.update(group.ref, {
          status: 'deleting', memberUids: [], members: [], permissionVersion,
          receiptCount: 0, activePick: FieldValue.delete(), recentPick: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        })
        return true
      }
      let projectionCount = 0
      signals.docs.forEach(signal => {
        if (signal.data().uid === uid) transaction.delete(signal.ref)
        else {
          projectionCount += 1
          transaction.update(signal.ref, { permissionVersion })
        }
      })
      preferences.docs.forEach(preference => {
        if (preference.data().uid === uid) transaction.delete(preference.ref)
        else transaction.update(preference.ref, { permissionVersion })
      })
      transaction.update(group.ref, {
        memberUids: memberUids.filter(member => member !== uid),
        members,
        permissionVersion,
        projectionCount,
        receiptCount: 0,
        activePick: FieldValue.delete(),
        recentPick: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      })
      return false
    })
    if (deleteGroup) await firestore.recursiveDelete(group.ref)
  }

  // Remove the one legacy relationship reference retained on profiles during
  // migration. No other v1 collection is represented as canonical v2 data.
  while (true) {
    const followers = await firestore.collection('users')
      .where('following', 'array-contains', uid)
      .limit(200)
      .get()
    if (followers.empty) break
    const batch = firestore.batch()
    followers.docs.forEach(document => batch.update(document.ref, {
      following: FieldValue.arrayRemove(uid),
    }))
    await batch.commit()
  }

  // recursiveDelete is required: deleting users/{uid} alone would leave its
  // write-only event subcollection behind.
  await firestore.recursiveDelete(profileRef)
  await operationRef.set({
    status: 'cleanup-complete',
    cleanupCompletedAt: FieldValue.serverTimestamp(),
    expiresAt,
  }, { merge: true })
  await finishAuthDeletion(uid)
  response.status(200).json({ deleted: true })
})
