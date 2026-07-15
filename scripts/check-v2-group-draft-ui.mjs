import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { chromium } from 'playwright'

const projectId = 'demo-this-is-v2'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appRoot = path.join(root, 'v2')
const vite = path.join(appRoot, 'node_modules', 'vite', 'bin', 'vite.js')
const origin = 'http://127.0.0.1:4175'
const functionOrigin = `http://127.0.0.1:5001/${projectId}/us-central1`
const placesStubOrigin = `${origin}/__this_is_emulator_places/v1`
const artifactDir = path.join(root, 'output', 'playwright')
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST

if (!authHost || !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Run through Firebase Auth, Firestore, and Functions emulators.')
}

initializeApp({ projectId })
const db = getFirestore()

async function signup(email) {
  const response = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'correct-horse-battery', returnSecureToken: true }),
  })
  const text = await response.text()
  assert.equal(response.status, 200, text)
  return JSON.parse(text)
}

async function waitUntil(label, probe, predicate, timeoutMs = 15_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const value = await probe()
    if (predicate(value)) return value
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for ${label}.`)
}

async function waitForServer(server) {
  await waitUntil('the emulator-configured app preview', async () => {
    if (server.exitCode !== null) throw new Error(`Preview exited early with code ${server.exitCode}.`)
    try {
      return (await fetch(origin)).ok
    } catch {
      return false
    }
  }, Boolean, 20_000)
}

async function waitForFunction(name) {
  await waitUntil(`${name} function registration`, async () => {
    try {
      return (await fetch(`${functionOrigin}/${name}`, { method: 'POST' })).status
    } catch {
      return 0
    }
  }, status => status === 401, 20_000)
}

async function installAuth(page, account, displayName) {
  await page.goto(`${origin}/terms`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Terms of use' }).waitFor()
  await page.evaluate(async ({ account: value, displayName: name }) => {
    const authUser = {
      uid: value.localId,
      email: value.email,
      emailVerified: false,
      displayName: name,
      isAnonymous: false,
      providerData: [],
      stsTokenManager: {
        refreshToken: value.refreshToken,
        accessToken: value.idToken,
        expirationTime: Date.now() + Number(value.expiresIn) * 1000,
      },
      createdAt: String(Date.now()),
      lastLoginAt: String(Date.now()),
      apiKey: 'fake',
      appName: '[DEFAULT]',
    }
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('firebaseLocalStorageDb', 1)
      request.onerror = () => reject(request.error)
      request.onupgradeneeded = () => {
        request.result.createObjectStore('firebaseLocalStorage', { keyPath: 'fbase_key' })
      }
      request.onsuccess = () => {
        const database = request.result
        const transaction = database.transaction('firebaseLocalStorage', 'readwrite')
        transaction.objectStore('firebaseLocalStorage').put({
          fbase_key: 'firebase:authUser:fake:[DEFAULT]',
          value: authUser,
        })
        transaction.onerror = () => reject(transaction.error)
        transaction.oncomplete = () => {
          database.close()
          resolve(undefined)
        }
      }
    })
  }, { account, displayName })
}

async function forwardFunction(route, name) {
  const request = route.request()
  const headers = await request.allHeaders()
  const response = await fetch(`${functionOrigin}/${name}`, {
    method: request.method(),
    headers: {
      ...(headers.authorization ? { Authorization: headers.authorization } : {}),
      'Content-Type': 'application/json',
    },
    body: request.postData() ?? '{}',
  })
  await route.fulfill({
    status: response.status,
    contentType: response.headers.get('content-type') ?? 'application/json',
    body: Buffer.from(await response.arrayBuffer()),
  })
}

const discoveryGooglePlaceId = 'emulator-discovery-glasshouse'
const personalDiscoveryGooglePlaceId = 'emulator-personal-harbor-coffee'
const sharingHandoffGooglePlaceId = 'ChIJFamilyHandoff01'
const sharingHandoffPlaceId = `g:${sharingHandoffGooglePlaceId}`
const brokenDetailsPlaceId = 'emulator-broken-details'
const mismatchedDetailsPlaceId = 'emulator-mismatched-details'
const unsupportedDetailsPlaceId = `ChIJ${'x'.repeat(300)}`
const discoveryQuery = 'things to do in Cresskill, NJ'
const personalDiscoveryQuery = 'coffee shops in Englewood, NJ'
const placesCalls = []
let discoverySessionToken = null

async function fulfillEmulatorPlaces(route) {
  const request = route.request()
  const url = new URL(request.url())
  const headers = await request.allHeaders()
  assert.equal(url.origin, origin, 'Emulator Places requests must stay on the local preview origin.')
  assert.equal(headers['x-goog-api-key'], 'emulator-only-no-google')

  if (url.pathname === '/__this_is_emulator_places/v1/places:autocomplete') {
    assert.equal(request.method(), 'POST')
    assert.equal(
      headers['x-goog-fieldmask'],
      'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat.mainText',
    )
    const body = JSON.parse(request.postData() ?? '{}')
    assert.deepEqual(
      Object.keys(body).sort(),
      ['input', 'languageCode', 'sessionToken'],
      'Discovery autocomplete must not send taste, coordinates, or hidden location bias.',
    )
    assert.equal(typeof body.sessionToken, 'string')
    assert(body.sessionToken.length > 10)
    discoverySessionToken = body.sessionToken
    if (body.input === 'things to do in No Match, NJ') {
      placesCalls.push({ kind: 'autocomplete-empty', sessionToken: body.sessionToken })
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"suggestions":[]}' })
      return
    }
    if (body.input === 'things to do in Broken Details, NJ') {
      placesCalls.push({ kind: 'autocomplete-broken', sessionToken: body.sessionToken })
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          suggestions: [{
            placePrediction: {
              placeId: brokenDetailsPlaceId,
              text: { text: 'Broken Details Studio, Cresskill, NJ' },
              structuredFormat: { mainText: { text: 'Broken Details Studio' } },
            },
          }],
        }),
      })
      return
    }
    if (body.input === 'things to do in Mismatched Details, NJ') {
      placesCalls.push({ kind: 'autocomplete-mismatched', sessionToken: body.sessionToken })
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          suggestions: [{
            placePrediction: {
              placeId: mismatchedDetailsPlaceId,
              text: { text: 'Mismatched Details Studio, Cresskill, NJ' },
              structuredFormat: { mainText: { text: 'Mismatched Details Studio' } },
            },
          }],
        }),
      })
      return
    }
    if (body.input === 'things to do in Unsupported ID, NJ') {
      placesCalls.push({ kind: 'autocomplete-unsupported', sessionToken: body.sessionToken })
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          suggestions: [{
            placePrediction: {
              placeId: unsupportedDetailsPlaceId,
              text: { text: 'Long ID Cafe, Cresskill, NJ' },
              structuredFormat: { mainText: { text: 'Long ID Cafe' } },
            },
          }],
        }),
      })
      return
    }
    if (body.input === personalDiscoveryQuery) {
      placesCalls.push({ kind: 'autocomplete-personal', sessionToken: body.sessionToken })
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          suggestions: [{
            placePrediction: {
              placeId: personalDiscoveryGooglePlaceId,
              text: { text: 'Harbor Coffee, Englewood, NJ' },
              structuredFormat: { mainText: { text: 'Harbor Coffee' } },
            },
          }],
        }),
      })
      return
    }
    assert.equal(body.input, discoveryQuery)
    placesCalls.push({ kind: 'autocomplete', sessionToken: body.sessionToken })
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        suggestions: [{
          placePrediction: {
            placeId: discoveryGooglePlaceId,
            text: { text: 'Glasshouse Studio, Cresskill, NJ' },
            structuredFormat: { mainText: { text: 'Glasshouse Studio' } },
          },
        }],
      }),
    })
    return
  }

  if (url.pathname === `/__this_is_emulator_places/v1/places/${discoveryGooglePlaceId}`) {
    assert.equal(request.method(), 'GET')
    assert.equal(headers['x-goog-fieldmask'], 'id,formattedAddress,location,types')
    assert.equal(url.searchParams.get('sessionToken'), discoverySessionToken)
    placesCalls.push({ kind: 'details', sessionToken: url.searchParams.get('sessionToken') })
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: discoveryGooglePlaceId,
        formattedAddress: '12 Union Avenue, Cresskill, NJ 07626',
        location: { latitude: 40.9401, longitude: -73.9593 },
        types: ['art_studio', 'point_of_interest'],
      }),
    })
    return
  }

  if (url.pathname === `/__this_is_emulator_places/v1/places/${personalDiscoveryGooglePlaceId}`) {
    assert.equal(request.method(), 'GET')
    assert.equal(headers['x-goog-fieldmask'], 'id,formattedAddress,location,types')
    assert.equal(url.searchParams.get('sessionToken'), discoverySessionToken)
    placesCalls.push({ kind: 'details-personal', sessionToken: url.searchParams.get('sessionToken') })
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: personalDiscoveryGooglePlaceId,
        formattedAddress: '8 Palisade Avenue, Englewood, NJ 07631',
        location: { latitude: 40.8929, longitude: -73.9726 },
        types: ['coffee_shop', 'cafe'],
      }),
    })
    return
  }

  if (url.pathname === `/__this_is_emulator_places/v1/places/${brokenDetailsPlaceId}`) {
    assert.equal(request.method(), 'GET')
    assert.equal(headers['x-goog-fieldmask'], 'id,formattedAddress,location,types')
    assert.equal(url.searchParams.get('sessionToken'), discoverySessionToken)
    placesCalls.push({ kind: 'details-broken', sessionToken: url.searchParams.get('sessionToken') })
    await route.fulfill({ status: 200, contentType: 'application/json', body: 'not valid json' })
    return
  }

  if (url.pathname === `/__this_is_emulator_places/v1/places/${mismatchedDetailsPlaceId}`) {
    assert.equal(request.method(), 'GET')
    assert.equal(headers['x-goog-fieldmask'], 'id,formattedAddress,location,types')
    assert.equal(url.searchParams.get('sessionToken'), discoverySessionToken)
    placesCalls.push({ kind: 'details-mismatched', sessionToken: url.searchParams.get('sessionToken') })
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'emulator-another-place',
        formattedAddress: '99 Wrong Place, Cresskill, NJ 07626',
        location: { latitude: 40.94, longitude: -73.95 },
        types: ['art_studio'],
      }),
    })
    return
  }

  placesCalls.push({ kind: 'unexpected', path: url.pathname })
  await route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"unknown-emulator-place-request"}' })
}

function watchErrors(page, errors, actor) {
  page.on('console', message => {
    if (message.type() === 'error') {
      const location = message.location().url
      const isEmulatorListenRestart = message.text().includes('400 (Bad Request)')
        && location.startsWith('http://127.0.0.1:8180/google.firestore.v1.Firestore/Listen/channel')
      if (isEmulatorListenRestart) return
      errors.push(`${actor}: ${message.text()}${location ? ` (${location})` : ''}`)
    }
  })
  page.on('pageerror', error => errors.push(`${actor}: ${error.message}`))
}

const [owner, member] = await Promise.all([
  signup('draft-ui-owner@example.test'),
  signup('draft-ui-member@example.test'),
])
const groupId = 'draft-ui-family'
const freshnessGroupId = 'directory-freshness-group'
const discoveryGroupId = 'discovery-ui-family'
const now = Timestamp.now()
const members = [
  { uid: owner.localId, displayName: 'Mika', avatarHex: '#8E5A6B', joinedAt: now },
  { uid: member.localId, displayName: 'Vivian', avatarHex: '#5A6B8E', joinedAt: now },
]
const memory = {
  placeId: 'o:draft-ui-place',
  label: 'Supper Club',
  category: 'food',
  area: 'Cresskill, NJ',
  hex: '#704739',
  provenance: 'user_confirmed',
}
await Promise.all([
  db.collection('users').doc(owner.localId).set({ displayName: 'Mika', avatarHex: '#8E5A6B', onboardedAt: Date.now() }),
  db.collection('users').doc(member.localId).set({ displayName: 'Vivian', avatarHex: '#5A6B8E', onboardedAt: Date.now() }),
  db.collection('groups').doc(groupId).set({
    name: 'Family Sunday', createdBy: owner.localId, status: 'active',
    memberUids: members.map(person => person.uid), members,
    permissionVersion: 1, membershipLocked: true, projectionCount: 2, receiptCount: 0,
    createdAt: now, updatedAt: now,
  }),
  db.collection('groups').doc(freshnessGroupId).set({
    name: 'Planning Crew', createdBy: owner.localId, status: 'forming',
    memberUids: [owner.localId], members: [members[0]],
    permissionVersion: 1, membershipLocked: false, projectionCount: 0, receiptCount: 0,
    createdAt: now, updatedAt: now,
  }),
  db.collection('groups').doc(discoveryGroupId).set({
    name: 'Family Discovery', createdBy: owner.localId, status: 'active',
    memberUids: members.map(person => person.uid), members,
    permissionVersion: 1, membershipLocked: false, projectionCount: 0, receiptCount: 0,
    createdAt: now, updatedAt: now,
  }),
  db.collection('saves').doc(`${owner.localId}__o:activity-one`).set({
    uid: owner.localId, placeId: 'o:activity-one', tag: 'loved', visibility: 'private', ts: 10,
    memory: { placeId: 'o:activity-one', label: 'Museum afternoon', category: 'activity', area: 'New York, NY', hex: '#46525A', provenance: 'user_confirmed' },
  }),
  db.collection('saves').doc(`${owner.localId}__o:activity-two`).set({
    uid: owner.localId, placeId: 'o:activity-two', tag: 'loved', visibility: 'private', ts: 11,
    memory: { placeId: 'o:activity-two', label: 'Ceramics night', category: 'activity', area: 'Fort Lee, NJ', hex: '#46525A', provenance: 'user_confirmed' },
  }),
  db.collection('saves').doc(`${owner.localId}__o:coffee-one`).set({
    uid: owner.localId, placeId: 'o:coffee-one', tag: 'want', visibility: 'private', ts: 12,
    memory: { placeId: 'o:coffee-one', label: 'Window coffee', category: 'coffee', area: 'Ridgewood, NJ', hex: '#5A463C', provenance: 'user_confirmed' },
  }),
  db.collection('saves').doc(`${owner.localId}__g:${discoveryGooglePlaceId}`).set({
    uid: owner.localId, placeId: `g:${discoveryGooglePlaceId}`, tag: 'tried', visibility: 'circle', ts: 13,
    memory: { placeId: `g:${discoveryGooglePlaceId}`, label: 'Old imported label', category: 'activity', area: 'Unknown', hex: '#46525A', provenance: 'user_confirmed' },
  }),
  db.collection('groups').doc(groupId).collection('signals').doc(`${owner.localId}__${memory.placeId}`).set({
    uid: owner.localId, placeId: memory.placeId, tag: 'loved', visibility: 'circle', ts: 1,
    memory, includeNote: false, includeObservations: false, permissionVersion: 1,
  }),
  db.collection('groups').doc(groupId).collection('signals').doc(`${member.localId}__${memory.placeId}`).set({
    uid: member.localId, placeId: memory.placeId, tag: 'want', visibility: 'circle', ts: 1,
    memory, includeNote: false, includeObservations: false, permissionVersion: 1,
  }),
])

async function seedPickSyncFixture({ groupId: fixtureGroupId, pickId, shareToken, memory: pickMemory }) {
  const createdAt = Date.now()
  const activePick = {
    id: pickId,
    placeId: pickMemory.placeId,
    label: pickMemory.label,
    attendeeCount: 2,
    createdAt,
  }
  await Promise.all([
    db.collection('groups').doc(fixtureGroupId).set({
      name: 'Pick Sync Family',
      createdBy: owner.localId,
      status: 'active',
      memberUids: members.map(person => person.uid),
      members,
      permissionVersion: 1,
      membershipLocked: true,
      projectionCount: 0,
      receiptCount: 1,
      activePick,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }),
    db.collection('picks').doc(pickId).set({
      kind: 'group',
      id: pickId,
      groupId: fixtureGroupId,
      groupName: 'Pick Sync Family',
      groupPermissionVersion: 1,
      createdBy: owner.localId,
      memberUids: members.map(person => person.uid),
      attendeeUids: members.map(person => person.uid),
      attendees: members.map(({ uid, displayName, avatarHex }) => ({ uid, displayName, avatarHex })),
      placeId: pickMemory.placeId,
      memory: pickMemory,
      reasonCode: 'everyone_supports',
      reason: 'Everyone has a reason to go.',
      context: 'Anything',
      shareToken,
      status: 'selected',
      createdAt,
      updatedAt: createdAt,
    }),
    db.collection('pickReceipts').doc(shareToken).set({
      placeId: pickMemory.placeId,
      placeName: pickMemory.label,
      primaryType: pickMemory.category,
      reason: 'Everyone has a reason to go.',
      context: 'Anything',
      attendeeCount: 2,
      status: 'selected',
      createdAt,
      expiresAt: createdAt + 30 * 24 * 60 * 60 * 1000,
    }),
    db.collection('groups').doc(fixtureGroupId).collection('receiptRefs').doc(shareToken).set({
      pickId,
      createdAt,
      expiresAt: createdAt + 30 * 24 * 60 * 60 * 1000,
    }),
  ])
}

async function productEvents(uid) {
  const snapshot = await db.collection('users').doc(uid).collection('events').get()
  return snapshot.docs.map(document => ({ id: document.id, ...document.data() }))
}

await mkdir(artifactDir, { recursive: true })
const preview = spawn(process.execPath, [
  vite, 'preview', '--host', '127.0.0.1', '--port', '4175', '--strictPort',
  '--outDir', '.emulator-dist', '--mode', 'emulator', '--logLevel', 'error',
], {
  cwd: appRoot,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, THIS_IS_VERIFIED_EMULATOR_PREVIEW: 'true' },
})
let browser
try {
  await Promise.all([
    waitForServer(preview),
    waitForFunction('updateGroupDraftPass'),
    waitForFunction('shareGroupSignal'),
    waitForFunction('closeGroupPick'),
  ])
  const managedBrowserExists = existsSync(chromium.executablePath())
  browser = await chromium.launch({
    headless: true,
    ...(managedBrowserExists ? {} : { channel: 'chrome' }),
  })
  const [ownerContext, memberContext] = await Promise.all([
    browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' }),
    browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' }),
  ])
  const ownerPage = await ownerContext.newPage()
  const memberPage = await memberContext.newPage()
  const errors = []
  const unexpectedGooglePlacesRequests = []
  const shareFunctionCalls = []
  watchErrors(ownerPage, errors, 'Mika')
  watchErrors(memberPage, errors, 'Vivian')
  ownerPage.on('request', request => {
    if (new URL(request.url()).hostname === 'places.googleapis.com') {
      unexpectedGooglePlacesRequests.push(request.url())
    }
  })
  await Promise.all([
    ownerContext.route(`${origin}/updateGroupDraftPass`, route => forwardFunction(route, 'updateGroupDraftPass')),
    memberContext.route(`${origin}/updateGroupDraftPass`, route => forwardFunction(route, 'updateGroupDraftPass')),
    ownerContext.route(`${origin}/closeGroupPick`, route => forwardFunction(route, 'closeGroupPick')),
    memberContext.route(`${origin}/closeGroupPick`, route => forwardFunction(route, 'closeGroupPick')),
    memberContext.route('https://www.google.com/maps/**', route => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>Local Maps handoff</title><main>Google Maps handoff stub</main>',
    })),
    ownerContext.route(`${origin}/shareGroupSignal`, async route => {
      const body = JSON.parse(route.request().postData() ?? '{}')
      assert.equal(body.groupId, discoveryGroupId)
      assert(
        [sharingHandoffPlaceId, `g:${discoveryGooglePlaceId}`].includes(body.placeId),
        'Only the two exact verifier identities may reach the share function.',
      )
      const canonical = await db.collection('saves').doc(`${owner.localId}__${body.placeId}`).get()
      assert.equal(canonical.exists, true, 'The private canonical save must commit before explicit group sharing begins.')
      assert.equal(canonical.data()?.visibility, 'private')
      const beforeProjection = await db.collection('groups').doc(discoveryGroupId)
        .collection('signals').doc(`${owner.localId}__${body.placeId}`).get()
      if (body.action === 'remove') {
        if (body.placeId === `g:${discoveryGooglePlaceId}`) {
          assert.equal(canonical.data()?.tag, 'tried', 'Tried removal must follow the exact private canonical update.')
        } else {
          assert.equal(beforeProjection.exists, true, 'An explicit handoff removal must follow a confirmed share.')
        }
      } else {
        assert.equal(beforeProjection.exists, false, 'A new projection must not predate the explicit share request.')
      }
      shareFunctionCalls.push(body)
      await forwardFunction(route, 'shareGroupSignal')
    }),
    ownerContext.route(`${placesStubOrigin}/**`, fulfillEmulatorPlaces),
  ])
  await Promise.all([
    installAuth(ownerPage, owner, 'Mika'),
    installAuth(memberPage, member, 'Vivian'),
  ])
  await ownerPage.goto(
    `${origin}/add?mode=discover&group=${encodeURIComponent('invalid/nested')}&text=${encodeURIComponent(discoveryQuery)}`,
    { waitUntil: 'domcontentloaded' },
  )
  await ownerPage.getByRole('heading', { name: /That group .* available\./ }).waitFor()
  await ownerPage.waitForTimeout(500)
  assert.equal(placesCalls.length, 0, 'An invalid disabled audience must fail closed without searching or waiting forever.')
  await ownerPage.goto(
    `${origin}/add?mode=discover&group=${freshnessGroupId}&text=${encodeURIComponent(discoveryQuery)}`,
    { waitUntil: 'domcontentloaded' },
  )
  await ownerPage.getByRole('heading', { name: 'Finish the audience first.' }).waitFor()
  await ownerPage.getByText('Planning Crew cannot receive taste until at least two people have joined. Nothing has been saved or shared from this screen.').waitFor()
  assert.equal(await ownerPage.getByRole('textbox', { name: 'Area for discovery' }).count(), 0)
  await ownerPage.waitForTimeout(500)
  assert.equal(placesCalls.length, 0, 'A prefilled URL must not search while its group audience is still forming.')
  await ownerPage.goto(`${origin}/add?mode=discover&group=${freshnessGroupId}`, { waitUntil: 'domcontentloaded' })
  await ownerPage.getByRole('heading', { name: 'Finish the audience first.' }).waitFor()
  await ownerPage.getByRole('button', { name: 'Keep privately instead' }).click()
  await ownerPage.waitForURL(`${origin}/add?mode=discover`)
  await ownerPage.getByRole('heading', { name: 'DISCOVER FOR KEEP', level: 1 }).waitFor()

  const handoffSaveRef = db.collection('saves').doc(`${owner.localId}__${sharingHandoffPlaceId}`)
  const handoffProjectionRef = db.collection('groups').doc(discoveryGroupId)
    .collection('signals').doc(`${owner.localId}__${sharingHandoffPlaceId}`)
  const exactHandoffUrl = `https://www.google.com/maps/place/Juniper%20Commons/data=!4m6!3m5!1s${sharingHandoffGooglePlaceId}!8m2!3d40.9415!4d-73.9593`
  const placesBeforeHandoff = placesCalls.length
  await ownerPage.goto(`${origin}/add?text=${encodeURIComponent(exactHandoffUrl)}`, { waitUntil: 'domcontentloaded' })
  await ownerPage.getByRole('button', { name: 'Use this Google Maps link' }).click()
  await ownerPage.getByRole('heading', { name: 'What do you call this place?' }).waitFor()
  await ownerPage.getByRole('textbox', { name: 'Your label for this place' }).fill('Juniper after practice')
  await ownerPage.getByRole('button', { name: 'Coffee', exact: true }).click()
  await ownerPage.getByRole('button', { name: 'Want', exact: true }).click()
  await ownerPage.getByRole('button', { name: 'Keep privately as Want' }).click()

  const privateHandoffSave = await waitUntil(
    'exact-link capture to commit privately before any group choice',
    () => handoffSaveRef.get(),
    snapshot => snapshot.exists,
  )
  assert.equal(privateHandoffSave.data()?.visibility, 'private')
  assert.equal(privateHandoffSave.data()?.tag, 'want')
  assert.deepEqual(privateHandoffSave.data()?.memory, {
    placeId: sharingHandoffPlaceId,
    label: 'Juniper after practice',
    category: 'coffee',
    hex: '#5A463C',
    provenance: 'user_confirmed',
  })
  assert.equal((await handoffProjectionRef.get()).exists, false,
    'A private capture must not infer a group audience.')
  const handoffToast = ownerPage.locator('.toast')
  await handoffToast.getByText('saved privately to Keep', { exact: false }).waitFor()
  await handoffToast.getByRole('button', { name: 'tried', exact: true }).click()
  await waitUntil(
    'private-capture retag to Tried',
    () => handoffSaveRef.get(),
    snapshot => snapshot.data()?.tag === 'tried',
  )
  await handoffToast.getByRole('button', { name: 'add a note', exact: true }).waitFor()
  await handoffToast.getByRole('button', { name: 'want', exact: true }).click()
  await waitUntil(
    'private-capture retag back to Want',
    () => handoffSaveRef.get(),
    snapshot => snapshot.data()?.tag === 'want',
  )
  const reviewSharing = ownerPage.getByRole('button', { name: 'Review sharing' })
  await reviewSharing.waitFor()
  assert.equal(await reviewSharing.count(), 1,
    'A private capture must restore Review sharing after a Tried-to-Want retag.')
  await reviewSharing.click()
  await ownerPage.waitForURL(`${origin}/p/${sharingHandoffPlaceId}?sharing=1`)
  await ownerPage.getByText('Juniper after practice', { exact: true }).first().waitFor()
  const sharingSection = ownerPage.locator('.group-signal-sharing')
  await sharingSection.waitFor()
  await ownerPage.screenshot({
    path: path.join(artifactDir, 'private-save-review-sharing-mobile.png'),
  })
  const sharingText = await waitUntil(
    'named group controls or an explicit group-directory state',
    () => sharingSection.innerText(),
    text => text.includes('Family Discovery')
      || text.includes('Groups couldn\u2019t be checked.')
      || text.includes('Private for now.'),
  )
  assert.match(sharingText, /Family Discovery/,
    `The explicit sharing handoff did not load its named groups:\n${sharingText}`)
  await ownerPage.waitForFunction(() => document.activeElement?.classList.contains('group-signal-sharing'))
  assert.equal(placesCalls.length, placesBeforeHandoff,
    'Opening reviewed private memory must not spend a Place Details request.')

  await ownerPage.getByRole('button', { name: 'Share with Family Discovery' }).click()
  const handoffAudienceDialog = ownerPage.getByRole('dialog', { name: 'Confirm sharing circle' })
  await handoffAudienceDialog.waitFor()
  assert.deepEqual(
    await handoffAudienceDialog.locator('.group-audience-confirmation-members strong').allTextContents(),
    ['Mika', 'Vivian'],
    'The first group-visible handoff must review the exact named audience before sharing.',
  )
  assert.equal(shareFunctionCalls.length, 0,
    'Opening the audience review must not call the share function.')
  await handoffAudienceDialog.getByRole('button', {
    name: 'Share with these 2 & close invitations',
  }).click()
  const [sharedHandoffSave, sharedHandoffProjection, handoffGroup] = await waitUntil(
    'explicit private-save handoff to exactly one named group',
    () => Promise.all([
      handoffSaveRef.get(),
      handoffProjectionRef.get(),
      db.collection('groups').doc(discoveryGroupId).get(),
    ]),
    snapshots => snapshots[0].exists && snapshots[1].exists
      && snapshots[2].data()?.projectionCount === 1,
  )
  assert.equal(sharedHandoffSave.data()?.visibility, 'private',
    'Group sharing must not widen the canonical personal save.')
  assert.equal(sharedHandoffProjection.data()?.visibility, 'circle')
  assert.deepEqual(sharedHandoffProjection.data()?.memory, sharedHandoffSave.data()?.memory)
  assert.equal(handoffGroup.data()?.projectionCount, 1)
  assert.equal(
    (await db.collection('groups').doc(groupId).collection('signals')
      .doc(`${owner.localId}__${sharingHandoffPlaceId}`).get()).exists,
    false,
    'Review sharing must not leak into another active group.',
  )
  assert.equal(
    (await db.collection('groups').doc(freshnessGroupId).collection('signals')
      .doc(`${owner.localId}__${sharingHandoffPlaceId}`).get()).exists,
    false,
    'Review sharing must not leak into a forming group.',
  )
  await memberPage.goto(`${origin}/g/${discoveryGroupId}`, { waitUntil: 'domcontentloaded' })
  await memberPage.getByRole('heading', { name: 'One shared place needs your honest answer.' }).waitFor()
  await memberPage.getByText(/Mika wants to try Juniper after practice\./).waitFor()

  await ownerPage.getByRole('button', { name: 'Stop sharing with Family Discovery' }).click()
  await waitUntil(
    'explicit handoff cleanup to restore the isolated discovery fixture',
    () => Promise.all([
      handoffSaveRef.get(),
      handoffProjectionRef.get(),
      db.collection('groups').doc(discoveryGroupId).get(),
    ]),
    snapshots => snapshots[0].data()?.visibility === 'private'
      && !snapshots[1].exists && snapshots[2].data()?.projectionCount === 0,
  )
  assert.deepEqual(
    shareFunctionCalls.map(call => call.action ?? 'share'),
    ['share', 'remove'],
    'The handoff must consist of one explicit share and one explicit cleanup.',
  )
  assert.equal(placesCalls.length, placesBeforeHandoff,
    'The entire exact-link private-to-group handoff must remain zero-Details.')
  shareFunctionCalls.length = 0
  console.log('PASS exact Maps identity stays private, offers Review sharing, and reaches only one explicitly named group without a Details request')

  await Promise.all([
    ownerPage.goto(`${origin}/g/${groupId}`, { waitUntil: 'domcontentloaded' }),
    memberPage.goto(`${origin}/g/${groupId}`, { waitUntil: 'domcontentloaded' }),
  ])
  await Promise.all([
    ownerPage.locator('.group-candidate-card').waitFor(),
    memberPage.locator('.group-candidate-card').waitFor(),
  ])
  assert.equal(await ownerPage.locator('.group-candidate-card').count(), 1)
  assert.equal(await memberPage.locator('.group-candidate-card').count(), 1)

  await memberPage.locator('.group-candidate-choice').click()
  const stalePickButton = memberPage.getByRole('button', { name: 'Make this the Pick' })
  await stalePickButton.waitFor()
  await waitUntil('initial draft synchronization', () => stalePickButton.isEnabled(), Boolean)

  await ownerPage.getByRole('button', { name: 'Not for us' }).click()
  await ownerPage.getByRole('alertdialog').getByRole('button', { name: 'Confirm pass' }).click()
  await Promise.all([
    ownerPage.getByText('Mika passed on Supper Club.').waitFor(),
    memberPage.getByText('Mika passed on Supper Club.').waitFor(),
  ])
  assert.equal(await memberPage.getByRole('button', { name: 'Undo' }).count(), 0)
  assert.equal(await ownerPage.getByRole('button', { name: 'Undo' }).count(), 1)
  assert.equal(await memberPage.getByRole('button', { name: 'Make this the Pick' }).count(), 0)
  assert.equal(await memberPage.locator('.group-candidate-card').count(), 0)

  await memberPage.getByRole('button', { name: 'Food', exact: true }).click()
  await memberPage.locator('.group-candidate-card').waitFor()
  assert.equal(await memberPage.getByText('Mika passed on Supper Club.').count(), 0)
  await memberPage.getByRole('button', { name: 'Anything', exact: true }).click()
  await memberPage.getByText('Mika passed on Supper Club.').waitFor()

  await ownerPage.getByRole('button', { name: 'Undo' }).click()
  await Promise.all([
    ownerPage.locator('.group-candidate-card').waitFor(),
    memberPage.locator('.group-candidate-card').waitFor(),
  ])

  await memberPage.getByRole('button', { name: 'Not for us' }).click()
  await memberPage.getByRole('alertdialog').getByRole('button', { name: 'Confirm pass' }).click()
  await Promise.all([
    ownerPage.getByText('Vivian passed on Supper Club.').waitFor(),
    memberPage.getByText('Vivian passed on Supper Club.').waitFor(),
  ])
  assert.equal(await ownerPage.getByRole('button', { name: 'Undo' }).count(), 0)
  assert.equal(await memberPage.getByRole('button', { name: 'Undo' }).count(), 1)
  await Promise.all([
    ownerPage.screenshot({ path: path.join(artifactDir, 'group-draft-mika.png'), fullPage: true }),
    memberPage.screenshot({ path: path.join(artifactDir, 'group-draft-vivian.png'), fullPage: true }),
  ])

  await memberPage.getByRole('button', { name: 'Undo' }).click()
  await Promise.all([
    ownerPage.locator('.group-candidate-card').waitFor(),
    memberPage.locator('.group-candidate-card').waitFor(),
  ])
  assert.equal((await db.collection('groups').doc(groupId).collection('draftPasses').get()).size, 0)

  await ownerPage.goto(`${origin}/add?mode=discover&group=${discoveryGroupId}`, { waitUntil: 'domcontentloaded' })
  await ownerPage.getByRole('heading', { name: 'DISCOVER FOR FAMILY DISCOVERY', level: 1 }).waitFor()
  await ownerPage.getByText('2 Loved in your Keep', { exact: true }).waitFor()
  assert.deepEqual(
    await ownerPage.locator('.personal-discovery-prompt strong').allTextContents(),
    ['Things to do', 'Coffee', 'Food', 'Drinks'],
    'Real private Keep history should order prompts locally without hiding any category.',
  )
  await ownerPage.getByRole('textbox', { name: 'Area for discovery' }).fill('Cresskill, NJ')
  await ownerPage.locator('.personal-discovery-prompt').filter({ hasText: 'Things to do' }).click()
  await ownerPage.getByText('Glasshouse Studio, Cresskill, NJ', { exact: true }).waitFor()
  assert.equal(placesCalls.length, 1, 'A category choice should issue exactly one autocomplete request.')
  const discoveryPreview = ownerPage.getByRole('link', {
    name: 'Preview Glasshouse Studio in Google Maps (opens in a new tab)',
  })
  const expectedPreview = new URL('https://www.google.com/maps/search/')
  expectedPreview.searchParams.set('api', '1')
  expectedPreview.searchParams.set('query', 'Glasshouse Studio')
  expectedPreview.searchParams.set('query_place_id', discoveryGooglePlaceId)
  assert.equal(await discoveryPreview.getAttribute('href'), expectedPreview.toString())
  assert.equal(await discoveryPreview.getAttribute('target'), '_blank')
  const previewSaveRef = db.collection('saves').doc(`${owner.localId}__g:${discoveryGooglePlaceId}`)
  const previewSaveBefore = await previewSaveRef.get()
  assert.equal(previewSaveBefore.exists, true, 'The fixture should contain the colliding imported memory.')
  const previewSaveBeforeData = previewSaveBefore.data()
  const previewSaveBeforeUpdateTime = previewSaveBefore.updateTime?.toMillis()
  await discoveryPreview.evaluate(link => {
    link.addEventListener('click', event => event.preventDefault(), { once: true })
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
  await ownerPage.waitForTimeout(100)
  assert.equal(placesCalls.length, 1, 'A Maps preview must not spend a Details request.')
  assert.equal(shareFunctionCalls.length, 0, 'A Maps preview must not share with a group.')
  const previewSaveAfter = await previewSaveRef.get()
  assert.deepEqual(
    previewSaveAfter.data(),
    previewSaveBeforeData,
    'A Maps preview must not alter an existing private memory.',
  )
  assert.equal(
    previewSaveAfter.updateTime?.toMillis(),
    previewSaveBeforeUpdateTime,
    'A Maps preview must not rewrite an existing private memory.',
  )
  assert.equal(
    (await db.collection('saves').doc(`${owner.localId}__${discoveryGooglePlaceId}`).get()).exists,
    false,
    'A Maps preview must not create an unprefixed private save.',
  )
  await ownerPage.locator('.add-suggestion').click()
  await ownerPage.getByRole('heading', { name: 'What do you call this place?' }).waitFor()
  await ownerPage.getByText('art studio · 12 Union Avenue, Cresskill, NJ 07626', { exact: true }).waitFor()
  assert.equal(await ownerPage.getByRole('button', { name: 'Activity', exact: true }).getAttribute('aria-pressed'), 'true')
  assert.equal(await ownerPage.locator('.place-memory-area-disclosure summary strong').textContent(), 'Cresskill, NJ')
  await ownerPage.getByRole('button', { name: 'Want', exact: true }).click()
  await ownerPage.getByText('Family Discovery', { exact: true }).waitFor()
  await ownerPage.getByText('Only this group receives the place. Your personal Keep remains yours.').waitFor()
  const shareDiscoveryButton = ownerPage.getByRole('button', { name: 'Keep & share as Want' })
  await shareDiscoveryButton.evaluate(element => element.scrollIntoView({ block: 'center' }))
  const [shareDiscoveryBox, discoveryDockBox] = await Promise.all([
    shareDiscoveryButton.boundingBox(),
    ownerPage.getByRole('navigation', { name: 'Primary' }).boundingBox(),
  ])
  assert(
    shareDiscoveryBox && discoveryDockBox
      && shareDiscoveryBox.y + shareDiscoveryBox.height <= discoveryDockBox.y - 8,
    'The reviewed share action must scroll fully above the fixed dock.',
  )
  await ownerPage.screenshot({ path: path.join(artifactDir, 'group-discovery-review-emulator-mobile.png'), fullPage: true })
  await ownerPage.screenshot({ path: path.join(artifactDir, 'group-discovery-review-action-emulator-mobile.png') })
  await shareDiscoveryButton.click()
  await ownerPage.waitForURL(`${origin}/g/${discoveryGroupId}`)
  await ownerPage.getByRole('heading', { name: 'Your place needs one more reason.' }).waitFor()
  await ownerPage.getByText(/You want to try Glasshouse Studio\./).waitFor()

  const discoveredPlaceId = `g:${discoveryGooglePlaceId}`
  const saveRef = db.collection('saves').doc(`${owner.localId}__${discoveredPlaceId}`)
  const projectionRef = db.collection('groups').doc(discoveryGroupId)
    .collection('signals').doc(`${owner.localId}__${discoveredPlaceId}`)
  const [savedPlace, sharedProjection, discoveryGroup] = await waitUntil(
    'the private save and exact server-owned group projection',
    () => Promise.all([saveRef.get(), projectionRef.get(), db.collection('groups').doc(discoveryGroupId).get()]),
    snapshots => snapshots[0].exists && snapshots[1].exists
      && snapshots[2].data()?.membershipLocked === true
      && snapshots[2].data()?.projectionCount === 1,
  )
  assert.equal(savedPlace.data()?.uid, owner.localId)
  assert.equal(savedPlace.data()?.tag, 'want')
  assert.equal(savedPlace.data()?.visibility, 'private')
  assert.deepEqual(savedPlace.data()?.memory, {
    placeId: discoveredPlaceId,
    label: 'Glasshouse Studio',
    category: 'activity',
    area: 'Cresskill, NJ',
    hex: '#46525A',
    provenance: 'user_confirmed',
  })
  assert.equal('place' in savedPlace.data(), false)
  assert.equal('formattedAddress' in savedPlace.data(), false)
  assert.equal('location' in savedPlace.data(), false)
  assert.equal('primaryType' in savedPlace.data(), false)
  assert.equal('note' in savedPlace.data(), false)
  assert.equal(sharedProjection.data()?.uid, owner.localId)
  assert.equal(sharedProjection.data()?.placeId, discoveredPlaceId)
  assert.equal(sharedProjection.data()?.tag, 'want')
  assert.equal(sharedProjection.data()?.visibility, 'circle')
  assert.equal(sharedProjection.data()?.includeNote, false)
  assert.equal(sharedProjection.data()?.includeObservations, false)
  assert.equal(sharedProjection.data()?.permissionVersion, 1)
  assert.deepEqual(sharedProjection.data()?.memory, savedPlace.data()?.memory)
  assert.deepEqual(Object.keys(sharedProjection.data()).sort(), [
    'includeNote', 'includeObservations', 'memory', 'permissionVersion',
    'placeId', 'tag', 'ts', 'uid', 'visibility',
  ])
  assert.equal('place' in sharedProjection.data(), false)
  assert.equal('note' in sharedProjection.data(), false)
  assert.equal(discoveryGroup.data()?.membershipLocked, true)
  assert.equal(discoveryGroup.data()?.projectionCount, 1)
  assert.equal(
    (await db.collection('groups').doc(groupId).collection('signals')
      .doc(`${owner.localId}__${discoveredPlaceId}`).get()).exists,
    false,
    'The exact share must not leak into another active group.',
  )
  assert.equal(
    (await db.collection('groups').doc(freshnessGroupId).collection('signals')
      .doc(`${owner.localId}__${discoveredPlaceId}`).get()).exists,
    false,
    'The exact share must not leak into a forming group.',
  )
  assert.equal(
    (await db.collection('saves').doc(`${owner.localId}__${discoveryGooglePlaceId}`).get()).exists,
    false,
    'The raw unprefixed Google identifier must not create a second canonical save.',
  )
  assert.deepEqual(placesCalls.map(call => call.kind), ['autocomplete', 'details'])
  assert.equal(placesCalls[0]?.sessionToken, placesCalls[1]?.sessionToken)
  assert.deepEqual(unexpectedGooglePlacesRequests, [], 'The emulator journey must never reach Google.')

  await memberPage.goto(`${origin}/saved`, { waitUntil: 'domcontentloaded' })
  await memberPage.getByRole('heading', { name: 'Nothing kept yet.' }).waitFor()
  assert.equal(await memberPage.getByText('Glasshouse Studio', { exact: true }).count(), 0)
  await memberPage.goto(`${origin}/g/${discoveryGroupId}`, { waitUntil: 'domcontentloaded' })
  await memberPage.getByRole('heading', { name: 'One shared place needs your honest answer.' }).waitFor()
  await memberPage.getByText(/Mika wants to try Glasshouse Studio/).waitFor()
  await memberPage.screenshot({ path: path.join(artifactDir, 'group-discovery-member-emulator-mobile.png'), fullPage: true })

  await ownerPage.goto(`${origin}/add?mode=discover&group=${discoveryGroupId}`, { waitUntil: 'domcontentloaded' })
  await ownerPage.getByRole('heading', { name: 'DISCOVER FOR FAMILY DISCOVERY', level: 1 }).waitFor()
  await ownerPage.getByRole('textbox', { name: 'Area for discovery' }).fill('Cresskill, NJ')
  await ownerPage.locator('.personal-discovery-prompt').filter({ hasText: 'Things to do' }).click()
  await ownerPage.getByText('Glasshouse Studio, Cresskill, NJ', { exact: true }).waitFor()
  await ownerPage.locator('.add-suggestion').click()
  await ownerPage.getByRole('heading', { name: 'What do you call this place?' }).waitFor()
  await ownerPage.getByRole('button', { name: 'Tried', exact: true }).click()
  await ownerPage.getByText('Not shared with Family Discovery', { exact: true }).waitFor()
  await ownerPage.getByRole('button', { name: 'Keep privately as Tried' }).click()
  await ownerPage.waitForURL(new RegExp(`/p/${discoveredPlaceId}$`))
  const [triedSave, removedProjection, groupAfterTried] = await waitUntil(
    'Tried to remain private and remove the named group projection',
    () => Promise.all([saveRef.get(), projectionRef.get(), db.collection('groups').doc(discoveryGroupId).get()]),
    snapshots => snapshots[0].data()?.tag === 'tried'
      && !snapshots[1].exists
      && snapshots[2].data()?.projectionCount === 0,
  )
  assert.equal(triedSave.data()?.visibility, 'private')
  assert.equal(removedProjection.exists, false)
  assert.equal(groupAfterTried.data()?.membershipLocked, true, 'A locked historical audience must not silently reopen.')
  assert.equal(groupAfterTried.data()?.projectionCount, 0)
  assert.deepEqual(shareFunctionCalls.map(call => call.action ?? 'share'), ['share', 'remove'])

  await memberPage.goto(`${origin}/g/${discoveryGroupId}`, { waitUntil: 'domcontentloaded' })
  await memberPage.getByRole('heading', { name: 'Nothing honest fits yet.' }).waitFor()
  assert.equal(await memberPage.getByText('Glasshouse Studio', { exact: true }).count(), 0)

  await ownerPage.goto(`${origin}/add?mode=discover&group=${discoveryGroupId}`, { waitUntil: 'domcontentloaded' })
  await ownerPage.getByRole('heading', { name: 'DISCOVER FOR FAMILY DISCOVERY', level: 1 }).waitFor()
  await ownerPage.getByRole('textbox', { name: 'Area for discovery' }).fill('No Match, NJ')
  await ownerPage.locator('.personal-discovery-prompt').filter({ hasText: 'Things to do' }).click()
  await ownerPage.getByText('No result appeared for things to do in No Match, NJ. Try another area or type a more specific place search.').waitFor()
  assert.equal(await ownerPage.locator('.add-suggestion').count(), 0)
  assert.equal((await projectionRef.get()).exists, false)
  assert.equal((await db.collection('groups').doc(discoveryGroupId).get()).data()?.projectionCount, 0)
  assert.equal(shareFunctionCalls.length, 2, 'An empty provider response must never start a save or share operation.')
  assert.deepEqual(placesCalls.map(call => call.kind), [
    'autocomplete', 'details', 'autocomplete', 'details', 'autocomplete-empty',
  ])
  assert.equal(placesCalls[2]?.sessionToken, placesCalls[3]?.sessionToken)
  assert.notEqual(placesCalls[0]?.sessionToken, placesCalls[2]?.sessionToken)

  await ownerPage.getByRole('textbox', { name: 'Area for discovery' }).fill('Broken Details, NJ')
  await ownerPage.locator('.personal-discovery-prompt').filter({ hasText: 'Things to do' }).click()
  await ownerPage.getByText('Broken Details Studio, Cresskill, NJ', { exact: true }).waitFor()
  await ownerPage.locator('.add-suggestion').click()
  await ownerPage.getByText("Couldn't fetch that place — try again").waitFor()
  assert.equal(await ownerPage.getByRole('heading', { name: 'What do you call this place?' }).count(), 0)
  assert.equal(
    (await db.collection('saves').doc(`${owner.localId}__g:${brokenDetailsPlaceId}`).get()).exists,
    false,
  )
  assert.equal(
    (await db.collection('groups').doc(discoveryGroupId).collection('signals')
      .doc(`${owner.localId}__g:${brokenDetailsPlaceId}`).get()).exists,
    false,
  )
  assert.equal(shareFunctionCalls.length, 2, 'A failed Details response must never start a save or share operation.')
  assert.deepEqual(placesCalls.map(call => call.kind), [
    'autocomplete', 'details', 'autocomplete', 'details', 'autocomplete-empty',
    'autocomplete-broken', 'details-broken',
  ])
  assert.equal(placesCalls[5]?.sessionToken, placesCalls[6]?.sessionToken)
  await ownerPage.getByRole('textbox', { name: 'Area for discovery' }).fill('Mismatched Details, NJ')
  await ownerPage.locator('.personal-discovery-prompt').filter({ hasText: 'Things to do' }).click()
  await ownerPage.getByText('Mismatched Details Studio, Cresskill, NJ', { exact: true }).waitFor()
  await ownerPage.locator('.add-suggestion').click()
  await waitUntil('mismatched Details rejection', () => Promise.resolve(placesCalls.length), count => count === 9)
  assert.equal(await ownerPage.getByRole('heading', { name: 'What do you call this place?' }).count(), 0)
  assert.equal(
    (await db.collection('saves').doc(`${owner.localId}__g:${mismatchedDetailsPlaceId}`).get()).exists,
    false,
  )
  assert.equal(
    (await db.collection('groups').doc(discoveryGroupId).collection('signals')
      .doc(`${owner.localId}__g:${mismatchedDetailsPlaceId}`).get()).exists,
    false,
  )
  assert.deepEqual(placesCalls.map(call => call.kind), [
    'autocomplete', 'details', 'autocomplete', 'details', 'autocomplete-empty',
    'autocomplete-broken', 'details-broken', 'autocomplete-mismatched', 'details-mismatched',
  ])
  assert.equal(placesCalls[7]?.sessionToken, placesCalls[8]?.sessionToken)
  await ownerPage.getByRole('textbox', { name: 'Area for discovery' }).fill('Unsupported ID, NJ')
  await ownerPage.locator('.personal-discovery-prompt').filter({ hasText: 'Things to do' }).click()
  await ownerPage.getByText('Long ID Cafe, Cresskill, NJ', { exact: true }).waitFor()
  await ownerPage.getByRole('button', { name: /Long ID Cafe.*WHY UNAVAILABLE/ }).click()
  await ownerPage.getByText(
    'This Google result can\u2019t be kept safely in this version yet. Choose another result for the same place, or search for a different place.',
    { exact: true },
  ).waitFor()
  assert.equal(await ownerPage.getByRole('heading', { name: 'What do you call this place?' }).count(), 0)
  assert.equal(shareFunctionCalls.length, 2,
    'An unsupported provider identifier must never start Details, save, or share work.')
  assert.deepEqual(placesCalls.map(call => call.kind), [
    'autocomplete', 'details', 'autocomplete', 'details', 'autocomplete-empty',
    'autocomplete-broken', 'details-broken', 'autocomplete-mismatched', 'details-mismatched',
    'autocomplete-unsupported',
  ])
  assert.deepEqual(unexpectedGooglePlacesRequests, [], 'No discovery state may reach Google during emulator verification.')
  console.log('PASS discovery persists privately, shares with one named group, retracts on Tried, and rejects empty, invalid, mismatched, or unsupported provider responses without Google quota')

  const personalPlacesBaseline = placesCalls.length
  const personalShareBaseline = shareFunctionCalls.length
  const personalEventBaseline = new Set((await productEvents(owner.localId)).map(event => event.id))
  const storageBeforePersonalLoop = await ownerPage.evaluate(() => ({
    local: Object.fromEntries(Object.entries(window.localStorage)
      .filter(([key]) => !key.startsWith('firestore_'))),
    session: Object.fromEntries(Object.entries(window.sessionStorage)),
  }))
  const personalPlaceId = `g:${personalDiscoveryGooglePlaceId}`
  const personalSaveRef = db.collection('saves').doc(`${owner.localId}__${personalPlaceId}`)
  await ownerPage.goto(`${origin}/add?mode=discover`, { waitUntil: 'domcontentloaded' })
  await ownerPage.getByRole('heading', { name: 'DISCOVER FOR KEEP', level: 1 }).waitFor()
  assert.equal(new URL(ownerPage.url()).searchParams.has('area'), false)
  assert.equal(new URL(ownerPage.url()).searchParams.has('category'), false)
  await ownerPage.getByRole('textbox', { name: 'Area for discovery' }).fill('  Englewood,   NJ ')
  await ownerPage.locator('.personal-discovery-prompt').filter({ hasText: 'Coffee' }).click()
  await ownerPage.getByText('Harbor Coffee, Englewood, NJ', { exact: true }).waitFor()
  assert.deepEqual(
    placesCalls.slice(personalPlacesBaseline).map(call => call.kind),
    ['autocomplete-personal'],
    'The explicit category tap must make exactly one autocomplete request before selection.',
  )
  await ownerPage.locator('.add-suggestion').click()
  await ownerPage.getByRole('heading', { name: 'What do you call this place?' }).waitFor()
  await ownerPage.getByRole('textbox', { name: 'Your label for this place' }).fill('Coffee before the movie')
  await ownerPage.getByRole('button', { name: 'Loved', exact: true }).click()
  await ownerPage.getByRole('button', { name: 'Keep privately as Loved' }).click()

  const successHeading = ownerPage.getByRole('heading', { name: 'Kept privately', level: 2 })
  await successHeading.waitFor()
  await ownerPage.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Kept privately')
  await ownerPage.getByText(
    'Keep looking for coffee in Englewood, NJ, or finish for now.',
    { exact: true },
  ).waitFor()
  const findAnother = ownerPage.getByRole('button', { name: 'Find another Coffee', exact: true })
  const doneViewingKeep = ownerPage.getByRole('button', { name: 'Done \u2014 view Keep', exact: true })
  await Promise.all([findAnother.waitFor(), doneViewingKeep.waitFor()])
  const [findAnotherBox, doneBox, personalDockBox] = await Promise.all([
    findAnother.boundingBox(),
    doneViewingKeep.boundingBox(),
    ownerPage.getByRole('navigation', { name: 'Primary' }).boundingBox(),
  ])
  assert(
    findAnotherBox && doneBox && personalDockBox
      && Math.max(findAnotherBox.y + findAnotherBox.height, doneBox.y + doneBox.height) <= personalDockBox.y - 8,
    'The personal continuation actions must be fully visible above the dock at 390x844.',
  )

  const savedPersonal = await waitUntil(
    'the reviewed personal discovery save',
    () => personalSaveRef.get(),
    snapshot => snapshot.exists,
  )
  assert.equal(savedPersonal.data()?.uid, owner.localId)
  assert.equal(savedPersonal.data()?.tag, 'loved')
  assert.equal(savedPersonal.data()?.visibility, 'private')
  assert.deepEqual(savedPersonal.data()?.memory, {
    placeId: personalPlaceId,
    label: 'Coffee before the movie',
    category: 'coffee',
    area: 'Englewood, NJ',
    hex: '#5A463C',
    provenance: 'user_confirmed',
  })
  assert.equal((await db.collection('saves').doc(`${owner.localId}__${personalDiscoveryGooglePlaceId}`).get()).exists, false)
  assert.equal((await db.collectionGroup('signals').where('placeId', '==', personalPlaceId).get()).size, 0)
  assert.equal(shareFunctionCalls.length, personalShareBaseline)
  const firstPersonalSession = placesCalls.slice(personalPlacesBaseline)
  assert.deepEqual(firstPersonalSession.map(call => call.kind), ['autocomplete-personal', 'details-personal'])
  assert.equal(firstPersonalSession[0]?.sessionToken, firstPersonalSession[1]?.sessionToken)
  const savedPersonalData = savedPersonal.data()
  const savedPersonalUpdateTime = savedPersonal.updateTime.toMillis()

  await ownerPage.waitForTimeout(650)
  assert.deepEqual(
    placesCalls.slice(personalPlacesBaseline).map(call => call.kind),
    ['autocomplete-personal', 'details-personal'],
    'The idle Kept privately state must not start another provider request.',
  )
  assert.deepEqual(await ownerPage.evaluate(() => ({
    local: Object.fromEntries(Object.entries(window.localStorage)
      .filter(([key]) => !key.startsWith('firestore_'))),
    session: Object.fromEntries(Object.entries(window.sessionStorage)),
  })), storageBeforePersonalLoop, 'The continuation must not enter browser storage.')
  const personalEvents = await waitUntil(
    'the private save event without discovery context',
    async () => (await productEvents(owner.localId)).filter(event => !personalEventBaseline.has(event.id)),
    events => events.some(event => event.name === 'signal_saved'),
  )
  assert(personalEvents.every(event => !('area' in (event.properties ?? {})) && !('category' in (event.properties ?? {}))),
    'The temporary continuation area and category must not enter analytics.')
  await ownerPage.screenshot({
    path: path.join(artifactDir, 'personal-discovery-continuation-emulator-mobile.png'),
  })

  await findAnother.evaluate(element => {
    element.click()
    element.click()
  })
  await ownerPage.getByText('Harbor Coffee, Englewood, NJ', { exact: true }).waitFor()
  const callsAfterFindAnother = placesCalls.slice(personalPlacesBaseline)
  assert.deepEqual(
    callsAfterFindAnother.map(call => call.kind),
    ['autocomplete-personal', 'details-personal', 'autocomplete-personal'],
    'Find another must start one autocomplete even under a rapid double activation, and no Details request.',
  )
  assert.notEqual(callsAfterFindAnother[0]?.sessionToken, callsAfterFindAnother[2]?.sessionToken,
    'Find another must create a fresh autocomplete session token.')
  const afterFindAnotherSave = await personalSaveRef.get()
  assert.deepEqual(afterFindAnotherSave.data(), savedPersonalData)
  assert.equal(afterFindAnotherSave.updateTime.toMillis(), savedPersonalUpdateTime)
  assert.equal(shareFunctionCalls.length, personalShareBaseline)
  assert.equal((await db.collectionGroup('signals').where('placeId', '==', personalPlaceId).get()).size, 0)

  await ownerPage.locator('.add-suggestion').click()
  await ownerPage.getByRole('heading', { name: 'What do you call this place?' }).waitFor()
  await ownerPage.getByRole('textbox', { name: 'Your label for this place' }).fill('Coffee before the movie')
  await ownerPage.getByRole('button', { name: 'Loved', exact: true }).click()
  await ownerPage.getByRole('button', { name: 'Keep privately as Loved' }).click()
  await ownerPage.getByRole('heading', { name: 'Kept privately', level: 2 }).waitFor()
  assert.deepEqual(
    placesCalls.slice(personalPlacesBaseline).map(call => call.kind),
    ['autocomplete-personal', 'details-personal', 'autocomplete-personal', 'details-personal'],
    'The next Details request must wait for explicit selection in the fresh session.',
  )
  assert.equal(placesCalls.at(-2)?.sessionToken, placesCalls.at(-1)?.sessionToken)
  const afterSecondReviewSave = await personalSaveRef.get()
  assert.deepEqual(afterSecondReviewSave.data(), savedPersonalData)
  assert.equal(afterSecondReviewSave.updateTime.toMillis(), savedPersonalUpdateTime,
    'Repeating the exact reviewed memory must not rewrite the canonical save.')
  await ownerPage.getByRole('button', { name: 'Done \u2014 view Keep', exact: true }).click()
  await ownerPage.waitForURL(`${origin}/saved`)
  await ownerPage.waitForTimeout(400)
  assert.deepEqual(
    placesCalls.slice(personalPlacesBaseline).map(call => call.kind),
    ['autocomplete-personal', 'details-personal', 'autocomplete-personal', 'details-personal'],
    'Done must add no provider request.',
  )
  const afterDoneSave = await personalSaveRef.get()
  assert.deepEqual(afterDoneSave.data(), savedPersonalData)
  assert.equal(afterDoneSave.updateTime.toMillis(), savedPersonalUpdateTime)
  assert.equal(shareFunctionCalls.length, personalShareBaseline)
  assert.deepEqual(unexpectedGooglePlacesRequests, [])
  console.log('PASS personal Discover repeats only on Find another, keeps one exact private memory, and Done returns to Keep without background cost or group sharing')

  await ownerPage.goto(`${origin}/people`, { waitUntil: 'domcontentloaded' })
  await ownerPage.getByText('Vivian', { exact: true }).waitFor()
  assert.equal(await ownerPage.getByText('Ari', { exact: true }).count(), 0)
  await ownerPage.goto(`${origin}/g/${groupId}`, { waitUntil: 'domcontentloaded' })
  await ownerPage.locator('.group-candidate-card').waitFor()
  await db.collection('groups').doc(freshnessGroupId).update({
    status: 'active',
    memberUids: [owner.localId, 'directory-ari'],
    members: [
      members[0],
      { uid: 'directory-ari', displayName: 'Ari', avatarHex: '#6B8E5A', joinedAt: Timestamp.now() },
    ],
    updatedAt: Timestamp.now(),
  })
  await ownerPage.goto(`${origin}/people`, { waitUntil: 'domcontentloaded' })
  const freshMember = ownerPage.locator('.people-card').filter({ hasText: 'Ari' })
  await freshMember.waitFor()
  assert.equal(await freshMember.getByRole('link', { name: 'Planning Crew' }).getAttribute('href'), `/g/${freshnessGroupId}`)
  await ownerPage.screenshot({ path: path.join(artifactDir, 'group-directory-freshness-mobile.png'), fullPage: true })
  console.log('PASS a primary directory remount revalidates membership without polling or a duplicate listener')

  const ownerEventBaseline = new Set((await productEvents(owner.localId)).map(event => event.id))
  const memberEventBaseline = new Set((await productEvents(member.localId)).map(event => event.id))
  const pickPlacesBaseline = placesCalls.length
  const newPickClosureEvents = async () => {
    const [ownerEvents, memberEvents] = await Promise.all([
      productEvents(owner.localId),
      productEvents(member.localId),
    ])
    return [
      ...ownerEvents
        .filter(event => !ownerEventBaseline.has(event.id) && event.name === 'pick_closed')
        .map(event => ({ actor: 'owner', ...event })),
      ...memberEvents
        .filter(event => !memberEventBaseline.has(event.id) && event.name === 'pick_closed')
        .map(event => ({ actor: 'member', ...event })),
    ]
  }

  const visitedGroupId = 'pick-sync-visited-group'
  const visitedPickId = 'pick-sync-visited'
  const visitedShareToken = 'pick-sync-visited-receipt'
  const visitedMemory = {
    placeId: 'g:ChIJPickSyncVisited01',
    label: 'Return Sync Coffee',
    category: 'coffee',
    area: 'Cresskill, NJ',
    hex: '#5A463C',
    provenance: 'user_confirmed',
  }
  await seedPickSyncFixture({
    groupId: visitedGroupId,
    pickId: visitedPickId,
    shareToken: visitedShareToken,
    memory: visitedMemory,
  })
  const visitedUrl = `${origin}/p/${encodeURIComponent(visitedMemory.placeId)}?pick=${visitedPickId}`
  await Promise.all([
    ownerPage.goto(visitedUrl, { waitUntil: 'domcontentloaded' }),
    memberPage.goto(visitedUrl, { waitUntil: 'domcontentloaded' }),
  ])
  await Promise.all([
    ownerPage.getByRole('heading', { name: visitedMemory.label, level: 1 }).waitFor(),
    memberPage.getByRole('heading', { name: visitedMemory.label, level: 1 }).waitFor(),
    ownerPage.locator('.pick-after-visit > summary').waitFor(),
    memberPage.locator('.pick-after-visit > summary').waitFor(),
  ])
  const visitedMemberStatus = memberPage.locator('.pick-status-summary')
  assert.equal(await visitedMemberStatus.count(), 1)
  assert.equal(await visitedMemberStatus.getAttribute('role'), 'status')
  assert.equal(await visitedMemberStatus.getAttribute('aria-live'), 'polite')
  assert.equal(await visitedMemberStatus.getAttribute('aria-atomic'), 'true')
  await visitedMemberStatus.getByText('PICK SYNC FAMILY · 2 GOING', { exact: true }).waitFor()
  await memberPage.getByRole('heading', { name: 'Everyone has a reason to go.', level: 2 }).waitFor()
  const [visitedMapsPopup] = await Promise.all([
    memberPage.waitForEvent('popup'),
    memberPage.getByRole('link', { name: /Open in Google Maps/ }).click(),
  ])
  await visitedMapsPopup.getByText('Google Maps handoff stub', { exact: true }).waitFor()

  await ownerPage.locator('.pick-after-visit > summary').click()
  await ownerPage.getByRole('button', { name: 'We went', exact: true }).click()
  const visitedMemberHeading = memberPage.getByRole('heading', { name: 'The group went.', level: 2 })
  await visitedMemberHeading.waitFor({ timeout: 15_000 })
  const visitedOwnerHeading = ownerPage.getByRole('heading', { name: 'The group went.', level: 2 })
  await visitedOwnerHeading.waitFor()
  await ownerPage.waitForFunction(() => document.activeElement?.textContent?.trim() === 'The group went.')
  const visitedOwnerHeadingBox = await visitedOwnerHeading.boundingBox()
  assert(visitedOwnerHeadingBox && visitedOwnerHeadingBox.y >= 0 && visitedOwnerHeadingBox.y + visitedOwnerHeadingBox.height <= 844,
    'The local visited heading must be focused within the 390×844 viewport.')
  assert.equal(await visitedMemberHeading.evaluate(element => document.activeElement === element), false,
    'A remote terminal update must announce without stealing the background member’s focus.')
  await visitedMemberStatus.getByText('PICK SYNC FAMILY · 2 WERE ON THE PLAN', { exact: true }).waitFor()
  await visitedMemberStatus.getByText('Each person chooses Tried or Loved only for their own Keep.', { exact: true }).waitFor()
  await memberPage.getByText('WHY IT WAS PICKED', { exact: true }).waitFor()
  await memberPage.getByText('How was it for you? Only your Keep changes.', { exact: true }).waitFor()
  assert.equal(await memberPage.getByRole('heading', { name: 'Everyone has a reason to go.', level: 2 }).count(), 0)
  assert.equal(await memberPage.getByText(/GOING/).count(), 0)
  assert.equal(await memberPage.getByRole('button', { name: 'We went', exact: true }).count(), 0)
  assert.equal(await memberPage.getByRole('button', { name: 'Not for us', exact: true }).count(), 0)
  assert.equal(await memberPage.getByRole('link', { name: /Open in Google Maps/ }).count(), 0)
  assert.equal(await memberPage.getByRole('button', { name: 'Keep as Tried', exact: true }).count(), 1)
  assert.equal(await memberPage.getByRole('button', { name: 'Keep as Loved', exact: true }).count(), 1)
  assert.equal(await memberPage.getByRole('button', { name: 'Share Pick', exact: true }).count(), 1,
    'A visited Pick keeps its still-valid 30-day receipt available to members.')
  assert.equal(await memberPage.getByRole('button', { name: 'Revoke link', exact: true }).count(), 1)
  await memberPage.getByText(
    'A 30-day no-sign-in link says the group went, shows the broad reason, and says how many were on the plan. No names, notes, or taste history.',
    { exact: true },
  ).waitFor()
  assert.equal(await memberPage.getByRole('group', { name: 'Save as' }).count(), 0)
  const visitedOutcomeBox = await memberPage.locator('.pick-personal-outcome').boundingBox()
  assert(visitedOutcomeBox && visitedOutcomeBox.y + visitedOutcomeBox.height <= 844,
    'Visited private outcomes must fit the initial 390×844 viewport.')
  assert.equal(await memberPage.getByRole('navigation', { name: 'Primary' }).count(), 0)
  assert.equal(
    await memberPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    true,
  )
  await memberPage.screenshot({
    path: path.join(artifactDir, 'pick-sync-visited-member-mobile.png'),
    fullPage: true,
  })

  const firstClosureEvents = await waitUntil(
    'one client-side Pick closure event after the true visited transition',
    newPickClosureEvents,
    events => events.length === 1,
  )
  assert.equal(firstClosureEvents[0]?.actor, 'owner')
  assert.equal(firstClosureEvents[0]?.properties?.status, 'visited')

  await visitedMapsPopup.close()
  await memberPage.bringToFront()
  await memberPage.getByRole('button', { name: 'Keep as Tried', exact: true }).click()
  await memberPage.getByRole('heading', { name: 'What do you call this place?' }).waitFor()
  await memberPage.getByRole('button', { name: 'Keep as Tried for me', exact: true }).click()
  const visitedMemberSaveRef = db.collection('saves').doc(`${member.localId}__${visitedMemory.placeId}`)
  const visitedMemberSave = await waitUntil(
    'the second attendee private Tried outcome',
    async () => {
      const snapshot = await visitedMemberSaveRef.get()
      return snapshot.exists ? snapshot.data() : null
    },
    Boolean,
  )
  assert.equal(visitedMemberSave.tag, 'tried')
  assert.equal(visitedMemberSave.visibility, 'private')
  assert.deepEqual(visitedMemberSave.memory, visitedMemory)
  assert.equal((await db.collection('saves').doc(`${owner.localId}__${visitedMemory.placeId}`).get()).exists, false,
    'Closing the shared Pick must not write the closer’s personal Keep.')
  assert.equal((await db.collection('groups').doc(visitedGroupId).collection('signals').get()).size, 0,
    'A private post-visit outcome must not create group evidence.')
  const visitedPick = (await db.collection('picks').doc(visitedPickId).get()).data()
  const visitedReceipt = await db.collection('pickReceipts').doc(visitedShareToken).get()
  const visitedReceiptRef = await db.collection('groups').doc(visitedGroupId)
    .collection('receiptRefs').doc(visitedShareToken).get()
  const visitedGroup = (await db.collection('groups').doc(visitedGroupId).get()).data()
  assert.equal(visitedPick?.status, 'visited')
  assert.equal(visitedPick?.shareToken, visitedShareToken)
  assert.equal(visitedReceipt.exists, true)
  assert.equal(visitedReceipt.data()?.status, 'visited')
  assert.equal(visitedReceiptRef.exists, true)
  assert.equal(visitedGroup?.activePick, undefined)
  assert.equal(visitedGroup?.recentPick?.id, visitedPickId)
  assert.equal(visitedGroup?.receiptCount, 1)
  assert.equal((await newPickClosureEvents()).length, 1,
    'A personal Keep outcome must not duplicate the shared Pick closure event.')
  console.log('PASS a background attendee receives visited live, loses selected actions, and records only their private Tried outcome')

  const dismissedGroupId = 'pick-sync-dismissed-group'
  const dismissedPickId = 'pick-sync-dismissed'
  const dismissedShareToken = 'pick-sync-dismissed-receipt'
  const dismissedMemory = {
    placeId: 'g:ChIJPickSyncDismissed01',
    label: 'Passed Sync Supper',
    category: 'food',
    area: 'Cresskill, NJ',
    hex: '#704739',
    provenance: 'user_confirmed',
  }
  await seedPickSyncFixture({
    groupId: dismissedGroupId,
    pickId: dismissedPickId,
    shareToken: dismissedShareToken,
    memory: dismissedMemory,
  })
  const dismissedUrl = `${origin}/p/${encodeURIComponent(dismissedMemory.placeId)}?pick=${dismissedPickId}`
  await Promise.all([
    ownerPage.goto(dismissedUrl, { waitUntil: 'domcontentloaded' }),
    memberPage.goto(dismissedUrl, { waitUntil: 'domcontentloaded' }),
  ])
  await Promise.all([
    ownerPage.getByRole('heading', { name: dismissedMemory.label, level: 1 }).waitFor(),
    memberPage.getByRole('heading', { name: dismissedMemory.label, level: 1 }).waitFor(),
    ownerPage.locator('.pick-after-visit > summary').waitFor(),
    memberPage.locator('.pick-after-visit > summary').waitFor(),
  ])
  const dismissedMemberStatus = memberPage.locator('.pick-status-summary')
  assert.equal(await dismissedMemberStatus.count(), 1)
  assert.equal(await dismissedMemberStatus.getAttribute('role'), 'status')
  assert.equal(await dismissedMemberStatus.getAttribute('aria-live'), 'polite')
  assert.equal(await dismissedMemberStatus.getAttribute('aria-atomic'), 'true')
  await dismissedMemberStatus.getByText('PICK SYNC FAMILY · 2 GOING', { exact: true }).waitFor()
  await memberPage.getByRole('heading', { name: 'Everyone has a reason to go.', level: 2 }).waitFor()
  const [dismissedMapsPopup] = await Promise.all([
    memberPage.waitForEvent('popup'),
    memberPage.getByRole('link', { name: /Open in Google Maps/ }).click(),
  ])
  await dismissedMapsPopup.getByText('Google Maps handoff stub', { exact: true }).waitFor()
  await memberPage.getByRole('button', { name: 'Revoke link', exact: true }).click()
  await memberPage.getByRole('alertdialog', { name: 'Stop this Pick link?' }).waitFor()

  await ownerPage.locator('.pick-after-visit > summary').click()
  await ownerPage.getByRole('button', { name: 'Not for us', exact: true }).click()
  await ownerPage.getByRole('alertdialog').getByRole('button', { name: 'Close as Not for us', exact: true }).click()
  const dismissedMemberHeading = memberPage.getByRole('heading', { name: 'Not for us.', level: 2 })
  await dismissedMemberHeading.waitFor({ timeout: 15_000 })
  const dismissedOwnerHeading = ownerPage.getByRole('heading', { name: 'Not for us.', level: 2 })
  await dismissedOwnerHeading.waitFor()
  await ownerPage.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Not for us.')
  const dismissedOwnerHeadingBox = await dismissedOwnerHeading.boundingBox()
  assert(dismissedOwnerHeadingBox && dismissedOwnerHeadingBox.y >= 0 && dismissedOwnerHeadingBox.y + dismissedOwnerHeadingBox.height <= 844,
    'The local dismissal heading must be focused within the 390×844 viewport.')
  assert.equal(await dismissedMemberHeading.evaluate(element => document.activeElement === element), false,
    'A remote dismissal must announce without stealing the background member’s focus.')
  await dismissedMemberStatus.getByText('PICK SYNC FAMILY · PICK CLOSED', { exact: true }).waitFor()
  await dismissedMemberStatus.getByText(
    "Nobody's Keep changed. Anything you choose below stays only in your Keep.",
    { exact: true },
  ).waitFor()
  await memberPage.getByText('WHY IT HAD BEEN CONSIDERED', { exact: true }).waitFor()
  assert.equal(await memberPage.getByRole('heading', { name: 'Everyone has a reason to go.', level: 2 }).count(), 0)
  assert.equal(await memberPage.getByText(/GOING/).count(), 0)
  assert.equal(await memberPage.getByRole('button', { name: 'We went', exact: true }).count(), 0)
  assert.equal(await memberPage.getByRole('button', { name: 'Not for us', exact: true }).count(), 0)
  assert.equal(await memberPage.getByRole('button', { name: 'Keep as Tried', exact: true }).count(), 0)
  assert.equal(await memberPage.getByRole('button', { name: 'Keep as Loved', exact: true }).count(), 0)
  assert.equal(await memberPage.getByRole('link', { name: /Open in Google Maps/ }).count(), 0)
  assert.equal(await memberPage.getByRole('button', { name: 'Share Pick', exact: true }).count(), 0)
  assert.equal(await memberPage.getByRole('button', { name: 'Revoke link', exact: true }).count(), 0)
  assert.equal(await memberPage.getByText('SEND TO THE CHAT', { exact: true }).count(), 0)
  assert.equal(await memberPage.getByRole('alertdialog', { name: 'Stop this Pick link?' }).count(), 0,
    'A remote dismissal must close any now-invalid receipt confirmation.')
  const dismissedPrivateSave = memberPage.getByRole('group', { name: 'Save privately to your Keep as' })
  assert.equal(await dismissedPrivateSave.getByRole('button').count(), 3)
  const dismissedDirections = memberPage.getByRole('link', {
    name: 'Directions for me in Google Maps (opens a new tab)',
  })
  assert.equal(
    await dismissedDirections.evaluate(element => element.classList.contains('pill-ghost') && !element.classList.contains('pill-primary')),
    true,
  )
  const [dismissedPrivateSaveBox, dismissedDirectionsBox] = await Promise.all([
    dismissedPrivateSave.boundingBox(),
    dismissedDirections.boundingBox(),
  ])
  assert(
    dismissedPrivateSaveBox && dismissedDirectionsBox
      && dismissedPrivateSaveBox.y + dismissedPrivateSaveBox.height <= 844
      && dismissedDirectionsBox.y + dismissedDirectionsBox.height <= 844,
    'Dismissed private controls must fit the initial 390×844 viewport.',
  )
  assert.equal(await memberPage.getByRole('navigation', { name: 'Primary' }).count(), 0)
  assert.equal(
    await memberPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    true,
  )
  await memberPage.screenshot({
    path: path.join(artifactDir, 'pick-sync-dismissed-member-mobile.png'),
    fullPage: true,
  })

  const dismissedPick = (await waitUntil(
    'the dismissed Pick transaction',
    async () => {
      const snapshot = await db.collection('picks').doc(dismissedPickId).get()
      return snapshot.data()
    },
    value => value?.status === 'dismissed',
  ))
  const dismissedGroup = (await db.collection('groups').doc(dismissedGroupId).get()).data()
  assert.equal(dismissedPick.status, 'dismissed')
  assert.equal(dismissedPick.shareToken, undefined)
  assert.equal((await db.collection('pickReceipts').doc(dismissedShareToken).get()).exists, false)
  assert.equal((await db.collection('groups').doc(dismissedGroupId)
    .collection('receiptRefs').doc(dismissedShareToken).get()).exists, false)
  assert.equal(dismissedGroup?.activePick, undefined)
  assert.equal(dismissedGroup?.recentPick, undefined)
  assert.equal(dismissedGroup?.receiptCount, 0)
  assert.equal((await db.collection('saves').doc(`${owner.localId}__${dismissedMemory.placeId}`).get()).exists, false)
  assert.equal((await db.collection('saves').doc(`${member.localId}__${dismissedMemory.placeId}`).get()).exists, false)
  assert.equal((await db.collection('groups').doc(dismissedGroupId).collection('signals').get()).size, 0)
  const allClosureEvents = await waitUntil(
    'one client event per true terminal transition',
    newPickClosureEvents,
    events => events.length === 2,
  )
  assert.deepEqual(
    allClosureEvents.map(event => ({ actor: event.actor, status: event.properties?.status }))
      .sort((a, b) => String(a.status).localeCompare(String(b.status))),
    [
      { actor: 'owner', status: 'dismissed' },
      { actor: 'owner', status: 'visited' },
    ],
  )
  await dismissedMapsPopup.close()
  assert.equal(placesCalls.length, pickPlacesBaseline,
    'Durable Pick memory must prevent every background Place Details request across auth and live-status transitions.')
  console.log('PASS a background attendee receives dismissal live and the receipt, selected controls, and personal-outcome affordance disappear')

  assert.deepEqual(errors, [])
  await Promise.all([ownerContext.close(), memberContext.close()])
  console.log('PASS two production-mode browsers synchronize one attributed draft pass without sharing auth or local state')
} finally {
  if (browser) await browser.close()
  if (!preview.killed) preview.kill()
}
