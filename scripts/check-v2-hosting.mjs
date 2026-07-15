import { existsSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const origin = 'http://127.0.0.1:5199'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const artifactDir = path.join(root, 'output', 'playwright')
const paths = ['/', '/together', '/with/deep-link-proof', '/i/invite-link-proof', '/terms', '/privacy']

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

for (const path of paths) {
  const response = await fetch(origin + path, { redirect: 'manual' })
  const body = await response.text()
  const canonicalShell = body.includes('<title>this.is</title>')
    && body.includes('Find the place your people already agree on.')
    && body.includes('/manifest.webmanifest')
  if (response.status !== 200 || !canonicalShell) {
    console.error(`FAIL ${path}: status=${response.status}, canonical shell=${body.includes('<title>this.is</title>')}`)
    process.exit(1)
  }
  console.log(`PASS ${path} serves the canonical shell`)
}

const manifestResponse = await fetch(origin + '/manifest.webmanifest')
const manifest = await manifestResponse.json()
if (
  manifestResponse.status !== 200
  || manifest.start_url !== '/together'
  || manifest.description !== 'Find the place your people already agree on.'
  || manifest.icons?.[0]?.src !== '/icon.svg'
) {
  console.error('FAIL canonical web manifest')
  process.exit(1)
}
console.log('PASS canonical web manifest')

const iconResponse = await fetch(origin + '/icon.svg')
const icon = await iconResponse.text()
if (iconResponse.status !== 200 || !icon.includes('#CC3D52') || !icon.includes('<circle')) {
  console.error('FAIL convergence app icon')
  process.exit(1)
}
console.log('PASS convergence app icon')

const precacheResponse = await fetch(origin + '/precache-manifest.json')
const precache = await precacheResponse.json()
assert(precacheResponse.status === 200, 'Canonical precache manifest must be hosted.')
assert(precache.schemaVersion === 1 && /^[a-f0-9]{16}$/.test(precache.buildId), 'Precache manifest must carry one content-derived build id.')
assert(Array.isArray(precache.assets) && precache.assets.includes('/index.html'), 'Precache manifest must include the canonical navigation shell.')
assert(precache.assets.every(asset => typeof asset === 'string' && (
  asset === '/index.html'
  || asset === '/icon.svg'
  || asset === '/manifest.webmanifest'
  || asset.startsWith('/assets/')
)), 'Precache manifest may contain only owned build assets.')
console.log('PASS canonical precache manifest is content-addressed and owned-asset-only')

const workerResponse = await fetch(origin + '/sw-v2.js')
const worker = await workerResponse.text()
assert(workerResponse.status === 200 && worker.includes(`const BUILD_ID = '${precache.buildId}'`), 'Hosted worker and precache manifest must identify the same build.')
assert(!worker.includes('__THIS_IS_BUILD_ID__'), 'Hosted worker must not retain its build placeholder.')
const workerCacheControl = workerResponse.headers.get('cache-control')
if (workerCacheControl) assert(workerCacheControl.includes('no-cache'), `A reported worker cache policy must require revalidation; received ${workerCacheControl}.`)
const hosting = JSON.parse(await readFile(path.join(root, 'firebase.v2.json'), 'utf8'))
const workerHeader = hosting.hosting?.headers?.find(item => item.source === '/sw-v2.js')
  ?.headers?.find(header => header.key.toLowerCase() === 'cache-control')?.value
assert(workerHeader?.includes('no-cache') && workerHeader.includes('no-store'), 'Production Hosting must require worker revalidation even though the local emulator omits custom response headers.')
console.log('PASS canonical service worker is version-matched and revalidated')

const browser = await chromium.launch({
  headless: true,
  ...(existsSync(chromium.executablePath()) ? {} : { channel: 'chrome' }),
})
try {
  const context = await browser.newContext({
    viewport: { width: 320, height: 568 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
    serviceWorkers: 'allow',
  })
  const page = await context.newPage()
  const errors = []
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(origin + '/together', { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Bring back the places your people already trust.' }).waitFor()
  await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.endsWith('/sw-v2.js'))

  const shellState = await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations()
    const cacheNames = await caches.keys()
    const cachedUrls = (await Promise.all(cacheNames.map(async name => {
      const cache = await caches.open(name)
      return (await cache.keys()).map(request => request.url)
    }))).flat()
    return {
      registrationPaths: registrations.map(registration => {
        const worker = registration.active ?? registration.waiting ?? registration.installing
        return worker ? new URL(worker.scriptURL).pathname : null
      }),
      cacheNames,
      cachedPaths: cachedUrls.map(url => new URL(url).pathname).sort(),
    }
  })
  assert(JSON.stringify(shellState.registrationPaths) === JSON.stringify(['/sw-v2.js']), `Only the canonical worker may remain; received ${JSON.stringify(shellState.registrationPaths)}.`)
  assert(shellState.cacheNames.length === 1 && shellState.cacheNames[0] === `this-is-v2-shell-${precache.buildId}`, `Only this build's owned shell cache may remain; received ${JSON.stringify(shellState.cacheNames)}.`)
  const expectedCachedPaths = [...precache.assets, '/precache-manifest.json'].sort()
  assert(JSON.stringify(shellState.cachedPaths) === JSON.stringify(expectedCachedPaths), 'The browser cache must contain exactly the generated owned-asset manifest and nothing else.')

  await context.setOffline(true)
  const offlineResponse = await page.goto(origin + '/privacy', { waitUntil: 'domcontentloaded' })
  assert(offlineResponse?.headers()['x-this-is-offline-shell'] === '1', 'Cold offline navigation must come from the marked cached shell, not an emulator network response.')
  await page.getByRole('heading', { name: 'Privacy policy' }).waitFor()
  await page.getByText('Offline', { exact: true }).waitFor()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  assert(!overflow, 'Cold offline Privacy must not overflow at 320px.')
  await mkdir(artifactDir, { recursive: true })
  await page.screenshot({ path: path.join(artifactDir, 'cold-offline-shell-narrow.png'), fullPage: true })
  assert(errors.length === 0, `Cold offline shell emitted browser errors: ${errors.join(' | ')}`)

  await context.setOffline(false)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Privacy policy' }).waitFor()
  assert(await page.getByText('Offline', { exact: true }).count() === 0, 'The offline banner must clear after a connected reload.')
  await context.close()
  console.log('PASS an unvisited canonical deep link renders from the privacy-bounded shell while cold offline')
} finally {
  await browser.close()
}

console.log('Canonical Hosting deep-link verification passed.')
