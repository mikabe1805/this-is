import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { chromium } from 'playwright'

const projectId = 'demo-this-is-v2'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appRoot = path.join(root, 'v2')
const artifactDir = path.join(root, 'output', 'playwright')
const distIndex = path.join(appRoot, '.zero-api-dist', 'index.html')
const vite = path.join(appRoot, 'node_modules', 'vite', 'bin', 'vite.js')
const port = 4177
const origin = `http://127.0.0.1:${port}`
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST

if (!authHost || !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Run through Firebase Auth and Firestore emulators.')
}
if (!existsSync(distIndex)) {
  throw new Error('Missing v2/.zero-api-dist. Build the isolated production-mode emulator app with Places and its stub off first.')
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

async function waitForServer(server, output) {
  await waitUntil('the guarded emulator preview', async () => {
    if (server.exitCode !== null) {
      throw new Error(`Preview exited early with code ${server.exitCode}. ${output()}`)
    }
    try {
      return (await fetch(origin)).ok
    } catch {
      return false
    }
  }, Boolean, 20_000)
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

function watchErrors(page, errors) {
  page.on('console', message => {
    if (message.type() !== 'error') return
    const location = message.location().url
    const emulatorListenRestart = message.text().includes('400 (Bad Request)')
      && location.startsWith('http://127.0.0.1:8180/google.firestore.v1.Firestore/Listen/channel')
    if (!emulatorListenRestart) {
      errors.push(`${message.text()}${location ? ` (${location})` : ''}`)
    }
  })
  page.on('pageerror', error => errors.push(error.message))
}

async function assertControlAboveDock(page, control, label) {
  const [controlBox, dockBox] = await Promise.all([
    control.boundingBox(),
    page.getByRole('navigation', { name: 'Primary' }).boundingBox(),
  ])
  assert(controlBox && dockBox, `${label} and the primary dock must have measurable bounds.`)
  assert(controlBox.height >= 44, `${label} must retain at least a 44px touch target.`)
  assert(controlBox.y + controlBox.height <= dockBox.y,
    `${label} must be fully visible above the fixed primary dock.`)
}

const account = await signup(`zero-api-link-${Date.now()}@example.test`)
await db.collection('users').doc(account.localId).set({
  displayName: 'Mika',
  avatarHex: '#8E5A6B',
  onboardedAt: Date.now(),
})

let previewOutput = ''
const preview = spawn(process.execPath, [
  vite, 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort',
  '--outDir', '.zero-api-dist', '--mode', 'emulator', '--logLevel', 'error',
], {
  cwd: appRoot,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, THIS_IS_VERIFIED_EMULATOR_PREVIEW: 'true' },
})
preview.stdout.on('data', chunk => { previewOutput += String(chunk) })
preview.stderr.on('data', chunk => { previewOutput += String(chunk) })

let browser
try {
  await waitForServer(preview, () => previewOutput.trim())
  browser = await chromium.launch({
    headless: true,
    ...(existsSync(chromium.executablePath()) ? {} : { channel: 'chrome' }),
  })
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  })
  const page = await context.newPage()
  const errors = []
  const forbiddenRequests = []
  watchErrors(page, errors)
  page.on('request', request => {
    const url = new URL(request.url())
    if (url.hostname === 'places.googleapis.com'
      || url.pathname === '/resolveMapsUrl'
      || url.pathname.startsWith('/__this_is_emulator_places/')) {
      forbiddenRequests.push(request.url())
    }
  })
  await context.route('https://places.googleapis.com/**', route => route.abort('blockedbyclient'))
  await context.route(`${origin}/resolveMapsUrl`, route => route.fulfill({
    status: 418,
    contentType: 'application/json',
    body: '{"error":"zero-api-verifier"}',
  }))
  await context.route(`${origin}/__this_is_emulator_places/**`, route => route.fulfill({
    status: 418,
    contentType: 'application/json',
    body: '{"error":"zero-api-verifier"}',
  }))

  await installAuth(page, account, 'Mika')
  await page.goto(`${origin}/add?mode=discover`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'DISCOVER FOR KEEP', level: 1 }).waitFor()
  await page.getByRole('heading', { name: 'Find somewhere worth keeping.' }).waitFor()
  await page.getByText('TEMPORARY AREA · ZERO-API SEARCH', { exact: true }).waitFor()
  const area = page.getByRole('textbox', { name: 'Area for discovery' })
  await area.fill('Cresskill, NJ')
  await page.getByRole('button', { name: /Coffee/ }).click()
  const mapsSearch = page.getByRole('link', { name: /Explore in Google Maps/ })
  await mapsSearch.waitFor()
  await page.waitForFunction(() => document.activeElement?.textContent?.includes('Explore in Google Maps'))
  const returnButton = page.getByRole('button', { name: 'I found one — paste its link' })
  await assertControlAboveDock(page, mapsSearch, 'The Google Maps handoff')
  await assertControlAboveDock(page, returnButton, 'The visible discovery return action')
  const mapsSearchUrl = new URL(await mapsSearch.getAttribute('href'))
  assert.equal(mapsSearchUrl.origin, 'https://www.google.com')
  assert.equal(mapsSearchUrl.pathname, '/maps/search/')
  assert.equal(mapsSearchUrl.searchParams.get('api'), '1')
  assert.equal(mapsSearchUrl.searchParams.get('query'), 'coffee shops in Cresskill, NJ')
  await page.getByText(
    'Google Maps receives only “coffee shops in Cresskill, NJ”. Choose one exact place there; this.is keeps nothing until you return and confirm it.',
    { exact: true },
  ).waitFor()
  assert.equal((await db.collection('saves').where('uid', '==', account.localId).get()).size, 0,
    'Opening a zero-API discovery handoff must not create a save.')
  assert.equal(await page.locator('.add-suggestion').count(), 0)
  assert.equal(forbiddenRequests.length, 0, 'Zero-API discovery must not call Places or the link resolver.')
  await mkdir(artifactDir, { recursive: true })
  await page.screenshot({ path: path.join(artifactDir, 'zero-api-discovery-handoff-mobile.png') })

  await returnButton.click()
  const linkInput = page.getByPlaceholder('Paste the exact place link from Google Maps\u2026')
  await linkInput.waitFor()
  assert.equal(await linkInput.evaluate(element => document.activeElement === element), true,
    'Opening the return step should focus the exact-link input.')
  await assertControlAboveDock(page, linkInput, 'The focused exact-link return input')
  await page.screenshot({ path: path.join(artifactDir, 'zero-api-discovery-return-mobile.png') })

  const googlePlaceId = 'ChIJZeroApiLink01'
  const canonicalPlaceId = `g:${googlePlaceId}`
  const saveRef = db.collection('saves').doc(`${account.localId}__${canonicalPlaceId}`)
  const exactLongUrl = `https://www.google.com/maps/place/Juniper%20Archive/data=!4m6!3m5!1s${googlePlaceId}!8m2!3d40.9415!4d-73.9593`
  await linkInput.fill(exactLongUrl)
  await assertControlAboveDock(
    page,
    page.getByRole('button', { name: 'Use this Google Maps link' }),
    'The exact-link review action',
  )
  assert.equal((await saveRef.get()).exists, false, 'Typing an exact link must not create a save.')
  await page.getByRole('button', { name: 'Use this Google Maps link' }).click()

  await page.getByRole('heading', { name: 'What do you call this place?' }).waitFor()
  await page.getByText(
    'The link supplied one exact Google Maps identity. Coffee and Cresskill, NJ came from the choices you just made; review or change them before anything is kept. No Google Place Details request was made.',
    { exact: true },
  ).waitFor()
  const googleLabel = page.locator('.place-memory-google')
  await googleLabel.waitFor()
  assert.equal((await googleLabel.textContent())?.replace(/\s+/g, ' ').trim(), 'Google Maps place: Juniper Archive')
  const personalLabel = page.getByRole('textbox', { name: 'Your label for this place' })
  assert.equal(await personalLabel.inputValue(), 'Juniper Archive', 'The URL path label must seed the editable user label.')
  await personalLabel.fill('Juniper after practice')
  assert.equal(await personalLabel.inputValue(), 'Juniper after practice')
  assert.equal((await saveRef.get()).exists, false, 'Opening and editing review must not create a save.')
  assert.equal(forbiddenRequests.length, 0, 'An exact long link must be parsed locally without Places or resolver calls.')

  const coffeeCategory = page.getByRole('button', { name: 'Coffee', exact: true })
  assert.equal(await coffeeCategory.getAttribute('aria-pressed'), 'true',
    'The explicitly chosen discovery kind should be prefilled for editable review.')
  const areaDisclosure = page.locator('details.place-memory-area-disclosure')
  await areaDisclosure.getByText('Cresskill, NJ', { exact: true }).waitFor()
  await areaDisclosure.locator('summary').click()
  assert.equal(await page.getByRole('textbox', { name: 'Area for this place' }).inputValue(), 'Cresskill, NJ',
    'The explicitly typed discovery area should be prefilled for editable review.')
  await page.getByRole('button', { name: 'Want', exact: true }).click()
  const confirm = page.getByRole('button', { name: 'Keep privately as Want' })
  assert.equal(await confirm.isEnabled(), true)
  assert.equal((await saveRef.get()).exists, false, 'Choosing review fields must not write before confirmation.')
  await confirm.click()

  const saved = await waitUntil(
    'the exact private user-confirmed save',
    () => saveRef.get(),
    snapshot => snapshot.exists,
  )
  assert.deepEqual(Object.keys(saved.data()).sort(), [
    'memory', 'placeId', 'tag', 'ts', 'uid', 'visibility',
  ])
  assert.equal(saved.data().uid, account.localId)
  assert.equal(saved.data().placeId, canonicalPlaceId)
  assert.equal(saved.data().tag, 'want')
  assert.equal(saved.data().visibility, 'private')
  assert.equal(Number.isSafeInteger(saved.data().ts), true)
  assert.deepEqual(saved.data().memory, {
    placeId: canonicalPlaceId,
    label: 'Juniper after practice',
    area: 'Cresskill, NJ',
    category: 'coffee',
    hex: '#5A463C',
    provenance: 'user_confirmed',
  })
  assert.deepEqual(Object.keys(saved.data().memory).sort(), [
    'area', 'category', 'hex', 'label', 'placeId', 'provenance',
  ])
  assert.equal(forbiddenRequests.length, 0, 'Saving reviewed memory must not call Places or the link resolver.')

  await page.goto(`${origin}/add`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'Share the exact place from Google Maps.' }).waitFor()
  const coldPlaceId = 'ChIJColdExactLink02'
  const coldLongUrl = `https://www.google.com/maps/place/Cold%20Link%20Cafe/data=!4m6!3m5!1s${coldPlaceId}!8m2!3d40.9415!4d-73.9593`
  await page.getByPlaceholder('Paste an exact Google Maps place link\u2026').fill(coldLongUrl)
  await page.getByRole('button', { name: 'Use this Google Maps link' }).click()
  await page.getByText(
    'The link supplied one exact Google Maps identity. You supply every detail that is kept below; no Google Place Details request was made.',
    { exact: true },
  ).waitFor()
  assert.equal(await page.locator('.place-memory-category [aria-pressed="true"]').count(), 0,
    'A cold exact-link entry must not inherit a discovery category.')
  await page.locator('details.place-memory-area-disclosure').getByText('Add an area', { exact: true }).waitFor()
  assert.equal((await db.collection('saves').where('uid', '==', account.localId).get()).size, 1,
    'A cold exact link must remain unsaved until user confirmation.')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()

  const coordinateOnly = 'https://www.google.com/maps/search/?api=1&query=40.9415%2C-73.9593'
  await page.getByPlaceholder('Paste an exact Google Maps place link\u2026').fill(coordinateOnly)
  await page.getByRole('button', { name: 'Use this Google Maps link' }).click()
  await page.getByText('That link did not identify one place. In Google Maps, open the exact place, tap Share, and paste that place link.', { exact: true }).waitFor()
  assert.equal(await page.getByRole('heading', { name: 'What do you call this place?' }).count(), 0)

  const lookalike = 'https://www.google.com.evil.example/maps/place/Juniper%20Archive'
  await page.getByPlaceholder('Paste an exact Google Maps place link\u2026').fill(lookalike)
  await page.waitForTimeout(400)
  assert.equal(await page.getByRole('button', { name: 'Use this Google Maps link' }).count(), 0)
  assert.equal(await page.getByRole('heading', { name: 'What do you call this place?' }).count(), 0)
  assert.equal(
    (await db.collection('saves').where('uid', '==', account.localId).get()).size,
    1,
    'Rejected links must not create another save for this user.',
  )
  assert.equal(forbiddenRequests.length, 0, 'Rejected links must fail closed without Places or resolver calls.')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true)
  assert.deepEqual(errors, [])

  await context.close()
  console.log('PASS zero-API discovery and exact Maps-link capture work at 390x844 with no Places/Details/resolver requests and one private user-confirmed g: save')
} finally {
  if (browser) await browser.close()
  if (!preview.killed) preview.kill()
}
