import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import {
  PICK_RECEIPT_LIFETIME_MS,
  renderPickReceiptHtml,
  renderUnavailablePickReceiptHtml,
} from '../v2-functions/lib/pick-receipt.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const port = 4174
const origin = `http://127.0.0.1:${port}`
const artifactDir = path.join(root, 'output', 'playwright')
const vite = path.join(root, 'v2', 'node_modules', 'vite', 'bin', 'vite.js')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function waitForServer(server, timeoutMs = 20_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (server.exitCode !== null) throw new Error(`Preview exited early with code ${server.exitCode}.`)
    try {
      const response = await fetch(origin)
      if (response.ok) return
    } catch {
      // The preview process is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  throw new Error('Timed out waiting for the canonical v2 development fixture.')
}

async function assertNoHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))
  assert(
    dimensions.document <= dimensions.viewport && dimensions.body <= dimensions.viewport,
    `${label} overflowed horizontally: ${JSON.stringify(dimensions)}`,
  )
}

async function assertFocused(locator, message) {
  await locator.waitFor()
  const focused = await locator.evaluate(element => new Promise(resolve => {
    let frames = 0
    const check = () => {
      if (element === document.activeElement) resolve(true)
      else if (frames >= 120) resolve(false)
      else {
        frames += 1
        window.requestAnimationFrame(check)
      }
    }
    check()
  }))
  assert(focused, message)
}

async function inspectGroupAudienceConfirmation(page, {
  memberNames,
  invitationsOpen = true,
  safeLabel = invitationsOpen ? 'Wait for everyone' : 'Keep private',
  commitLabel,
  includedCopy,
}) {
  const dialog = page.getByRole('dialog', { name: 'Confirm sharing circle' })
  await dialog.waitFor()
  assert(await dialog.getAttribute('aria-modal') === 'true', 'The sharing-circle review must be a modal dialog.')
  await dialog.getByText(`EXACTLY THESE ${memberNames.length}`, { exact: true }).waitFor()
  for (const memberName of memberNames) {
    const name = dialog.getByText(memberName, { exact: true })
    await name.waitFor()
    assert(await name.isVisible(), `The exact sharing-circle review hid ${memberName}.`)
    assert(
      await name.evaluate(element => getComputedStyle(element).whiteSpace !== 'nowrap'),
      `The exact sharing-circle review must allow ${memberName} to wrap instead of truncating it.`,
    )
  }
  if (includedCopy) await dialog.getByText(includedCopy, { exact: true }).waitFor()
  const safeAction = dialog.getByRole('button', { name: safeLabel, exact: true })
  const commit = dialog.getByRole('button', {
    name: commitLabel ?? (invitationsOpen
      ? `Share with these ${memberNames.length} & close invitations`
      : `Share with these ${memberNames.length}`),
    exact: true,
  })
  await assertFocused(safeAction, 'The sharing-circle modal must initially focus its safe action.')
  const [safeBox, commitBox] = await Promise.all([
    safeAction.boundingBox(),
    commit.boundingBox(),
  ])
  const dock = page.locator('.dock')
  const dockBox = await dock.count() > 0 ? await dock.boundingBox() : null
  if (dockBox) {
    assert(
      safeBox && commitBox
        && safeBox.y + safeBox.height <= dockBox.y
        && commitBox.y + commitBox.height <= dockBox.y,
      'Sharing-circle controls must remain above the mobile dock.',
    )
  }
  await assertNoHorizontalOverflow(page, '390×844 exact sharing-circle review')
  return { dialog, safeAction, commit }
}

async function assertCompactPickResolution(page, label, maxHeight = 150) {
  const resolution = page.getByRole('complementary', { name: 'Selected place confirmation' })
  await resolution.getByText(/READY FOR GROUP PICK · \d+ GOING/).waitFor()
  const primary = resolution.getByRole('button', { name: 'Make this the Pick' })
  const secondary = resolution.getByRole('button', { name: 'Choose another' })
  const [resolutionBox, primaryBox, secondaryBox] = await Promise.all([
    resolution.boundingBox(),
    primary.boundingBox(),
    secondary.boundingBox(),
  ])
  assert(
    resolutionBox && resolutionBox.height <= maxHeight,
    `${label} selection tray must stay within its ${maxHeight}px evidence-aware height budget.`,
  )
  assert(
    primaryBox && secondaryBox && Math.abs(primaryBox.y - secondaryBox.y) <= 2,
    `${label} selection actions must stay side by side at 390×844.`,
  )
  await assertFocused(primary, `${label} selection must move focus directly to its explicit commitment action.`)
  return resolution
}

async function verifyPublicPickReceipt(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const receiptPage = await context.newPage()
  const errors = []
  const requests = []
  receiptPage.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  receiptPage.on('pageerror', error => errors.push(error.message))
  receiptPage.on('request', request => requests.push(request.url()))
  const createdAt = Date.now()
  const receipt = {
    placeId: 'g:ChIJreceiptproof',
    placeName: 'Supper Club',
    primaryType: 'Restaurant',
    neighborhood: 'Cresskill, NJ',
    reason: '5 of 6 want or love this.',
    context: 'Food',
    attendeeCount: 6,
    status: 'selected',
    createdAt,
    expiresAt: createdAt + PICK_RECEIPT_LIFETIME_MS,
  }
  try {
    await receiptPage.setContent(renderPickReceiptHtml(receipt, 'https://this.is/pick/opaque-proof-token'))
    await receiptPage.getByRole('heading', { name: 'Supper Club', level: 1 }).waitFor()
    await receiptPage.getByText('this.is · Food', { exact: true }).waitFor()
    await receiptPage.getByText('Restaurant · Cresskill, NJ', { exact: true }).waitFor()
    await receiptPage.getByText('5 of 6 want or love this.', { exact: true }).waitFor()
    await receiptPage.getByText('6 going', { exact: true }).waitFor()
    assert(await receiptPage.locator('main[aria-labelledby="pick-title"]').count() === 1, 'A public receipt must expose one named main region.')
    assert(
      await receiptPage.locator('meta[property="og:title"]').getAttribute('content') === 'Supper Club · 6 going',
      'The chat unfurl must use the same bounded place and status as the visible receipt.',
    )
    assert(
      await receiptPage.locator('link[rel="canonical"]').getAttribute('href') === 'https://this.is/pick/opaque-proof-token',
      'The public receipt must keep one opaque canonical URL.',
    )
    const mapsLink = receiptPage.getByRole('link', { name: 'Open Supper Club in Google Maps' })
    assert(
      await mapsLink.getAttribute('href') === 'https://www.google.com/maps/search/?api=1&query=Supper%20Club&query_place_id=ChIJreceiptproof',
      'The public receipt must hand off the user-confirmed label and exact Google Place ID only to Maps.',
    )
    assert(await mapsLink.getAttribute('target') === '_blank', 'Maps must open without discarding the receipt.')
    assert(await mapsLink.evaluate(element => element.getBoundingClientRect().height) >= 44, 'The public Maps action must retain a 44px touch target.')
    const visibleReceiptText = await receiptPage.locator('body').innerText()
    for (const privateValue of ['Candidate Evidence Lab', 'Mika', 'Vivian', 'Noa', 'quiet enough to talk', 'private note']) {
      assert(!visibleReceiptText.includes(privateValue), `Public receipt leaked private fixture value ${privateValue}.`)
    }
    assert(requests.length === 0, `Rendering a receipt must make no background request; received ${requests.join(' | ')}.`)
    await assertNoHorizontalOverflow(receiptPage, '390×844 selected public receipt')
    const selectedMain = await receiptPage.locator('main').boundingBox()
    assert(selectedMain && selectedMain.y >= 16 && selectedMain.y + selectedMain.height <= 828, 'The complete selected receipt must fit the initial 390×844 viewport.')
    await receiptPage.screenshot({ path: path.join(artifactDir, 'pick-receipt-selected-mobile.png') })

    await receiptPage.setContent(renderPickReceiptHtml({ ...receipt, status: 'visited' }, 'https://this.is/pick/opaque-proof-token'))
    await receiptPage.getByText('The group went', { exact: true }).waitFor()
    await receiptPage.getByText('6 were on the plan', { exact: true }).waitFor()
    assert(await receiptPage.getByText('6 going', { exact: true }).count() === 0, 'A visited receipt must not say the plan is still open.')
    await assertNoHorizontalOverflow(receiptPage, '390×844 visited public receipt')
    await receiptPage.screenshot({ path: path.join(artifactDir, 'pick-receipt-visited-mobile.png') })

    await receiptPage.setContent(renderUnavailablePickReceiptHtml())
    await receiptPage.getByRole('heading', { name: 'That Pick link is no longer available.', level: 1 }).waitFor()
    await receiptPage.getByText('It may have expired, or someone in the group may have turned it off. Ask the sender for the current plan.').waitFor()
    assert(await receiptPage.getByRole('link').count() === 0, 'An unavailable no-install receipt must not manufacture an account or navigation task.')
    await assertNoHorizontalOverflow(receiptPage, '390×844 unavailable public receipt')
    await receiptPage.screenshot({ path: path.join(artifactDir, 'pick-receipt-unavailable-mobile.png') })

    await receiptPage.setViewportSize({ width: 320, height: 568 })
    await receiptPage.setContent(renderPickReceiptHtml({
      ...receipt,
      placeName: 'A Very Long User-Confirmed Neighborhood Restaurant Name',
      reason: 'A truthful reason can stay readable without forcing the receipt wider than a small phone.',
    }, 'https://this.is/pick/opaque-proof-token'))
    await assertNoHorizontalOverflow(receiptPage, '320×568 long-content public receipt')
    assert(errors.length === 0, `Public receipt browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }

}

async function verifyResponsiveSurface(browser, viewport, artifactName) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  const responsivePage = await context.newPage()
  const errors = []
  responsivePage.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  responsivePage.on('pageerror', error => errors.push(error.message))
  try {
    await responsivePage.goto(`${origin}/together?prototype=group`, { waitUntil: 'networkidle' })
    await responsivePage.getByRole('heading', { name: 'Who are we getting together?' }).waitFor()
    await assertNoHorizontalOverflow(responsivePage, `${viewport.width}×${viewport.height} group index`)
    await responsivePage.getByRole('link', { name: /Candidate Evidence Lab/ }).click()
    await responsivePage.getByRole('heading', { name: 'Three places. Real reasons.' }).waitFor()
    await responsivePage.locator('.group-candidate-card').first().waitFor()
    const candidateCount = await responsivePage.locator('.group-candidate-card').count()
    assert(
      candidateCount === 3,
      `${viewport.width}×${viewport.height} fixture must retain exactly three candidates; received ${candidateCount}.`,
    )
    const firstCandidate = responsivePage.locator('.group-candidate-card').first()
    const sourceDisclosure = firstCandidate.locator('details.candidate-sources')
    const chooseControl = firstCandidate.getByRole('button', { name: 'Choose Supper Club for this plan' })
    const sourceControl = sourceDisclosure.getByRole('button', { name: 'How this card knows: Supper Club' })
    const passControl = firstCandidate.getByRole('button', { name: 'Not for us: Supper Club' })
    assert(
      await chooseControl.count() === 1 && await chooseControl.getAttribute('aria-pressed') === 'false',
      `${viewport.width}×${viewport.height} candidate choice must have one concise place-specific accessible name.`,
    )
    assert(
      await responsivePage.getByText('Choose →', { exact: true }).count() === 3,
      `${viewport.width}×${viewport.height} every candidate must visibly identify its reversible Choose action.`,
    )
    assert(
      await sourceControl.count() === 1 && await passControl.count() === 1,
      `${viewport.width}×${viewport.height} repeated evidence and pass actions must identify their place.`,
    )
    assert(await sourceDisclosure.evaluate(element => !element.open), `${viewport.width}×${viewport.height} source detail must start collapsed.`)
    const [sourceControlHeight, passControlHeight] = await Promise.all([
      sourceControl.evaluate(element => element.getBoundingClientRect().height),
      passControl.evaluate(element => element.getBoundingClientRect().height),
    ])
    assert(sourceControlHeight >= 44, `${viewport.width}×${viewport.height} source disclosure must be touch-sized.`)
    assert(passControlHeight >= 44, `${viewport.width}×${viewport.height} pass action must be touch-sized.`)
    await assertNoHorizontalOverflow(responsivePage, `${viewport.width}×${viewport.height} candidate list`)
    await responsivePage.screenshot({ path: path.join(artifactDir, artifactName), fullPage: true })
    assert(errors.length === 0, `${viewport.width}×${viewport.height} browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

const RESPONSIVE_SHELL_ROUTES = [
  { path: '/together', heading: 'Who are we getting together?', dock: true },
  { path: '/saved', heading: 'KEEP', dock: true },
  { path: '/people', heading: 'The people in your groups.', dock: true },
  { path: '/search', heading: 'ADD A NEW PLACE', dock: true, redirect: '/add' },
  { path: '/add', heading: 'ADD A NEW PLACE', dock: true },
  { path: '/settings', heading: 'SETTINGS', dock: true },
  { path: '/p/group-sunlight', heading: 'Sunlight Coffee', dock: true },
  { path: '/onboarding', heading: 'Who are you?', dock: false },
  { path: '/groups/new', heading: 'Give your group a name.', dock: false },
  { path: '/gi/prototype-four-person', heading: 'Join Family Sunday.', dock: false },
  { path: '/with/retired-person', heading: 'this.is', dock: true },
  { path: '/terms', heading: 'Terms of use', dock: false },
  { path: '/privacy', heading: 'Privacy policy', dock: false },
]

async function verifyResponsiveShell(browser, viewport, capturePath, artifactName) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  const shellPage = await context.newPage()
  const errors = []
  shellPage.on('console', message => {
    if (message.type() === 'error') errors.push(`${shellPage.url()}: ${message.text()}`)
  })
  shellPage.on('pageerror', error => errors.push(`${shellPage.url()}: ${error.message}`))
  try {
    for (const route of RESPONSIVE_SHELL_ROUTES) {
      await shellPage.goto(`${origin}${route.path}?prototype=group`, { waitUntil: 'networkidle' })
      await shellPage.getByRole('heading', { name: route.heading, exact: true }).waitFor()
      await shellPage.locator('.page:not([aria-busy="true"])').waitFor()
      if (route.redirect) {
        assert(new URL(shellPage.url()).pathname === route.redirect, `${route.path} must recover into ${route.redirect}.`)
      }
      assert(await shellPage.locator('h1').count() === 1, `${route.path} must expose exactly one page-level h1.`)
      assert(await shellPage.evaluate(() => window.scrollY === 0), `${route.path} must start at the top after route navigation.`)
      await assertNoHorizontalOverflow(shellPage, `${viewport.width}Ã—${viewport.height} ${route.path}`)

      const escapedControls = await shellPage.locator('a, button, input, textarea, select, summary').evaluateAll(elements =>
        elements.flatMap(element => {
          const rect = element.getBoundingClientRect()
          const style = window.getComputedStyle(element)
          const visible = style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
          if (!visible || (rect.left >= -1 && rect.right <= window.innerWidth + 1)) return []
          return [{
            tag: element.tagName,
            label: element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 60) || '',
            left: Math.round(rect.left),
            right: Math.round(rect.right),
          }]
        }),
      )
      assert(escapedControls.length === 0, `${route.path} has controls outside the viewport: ${JSON.stringify(escapedControls)}.`)

      const dock = shellPage.getByRole('navigation', { name: 'Primary' })
      assert(await dock.count() === (route.dock ? 1 : 0), `${route.path} dock policy must be ${route.dock ? 'persistent' : 'focused'}.`)
      if (route.dock) {
        const labels = (await dock.getByRole('link').allTextContents()).map(label => label.trim())
        assert(JSON.stringify(labels) === JSON.stringify(['TOGETHER', 'KEEP', 'PEOPLE']), `${route.path} must preserve the exact primary IA.`)
        const controlsTrappedByDock = await shellPage.evaluate(async () => {
          const primary = document.querySelector('nav[aria-label="Primary"]')
          if (!primary) return []
          const failures = []
          for (const element of document.querySelectorAll('a, button, input, textarea, select, summary')) {
            if (primary.contains(element)) continue
            const closedDetails = element.closest('details:not([open])')
            if (closedDetails && element !== closedDetails.querySelector(':scope > summary')) continue
            const style = window.getComputedStyle(element)
            if (style.display === 'none' || style.visibility === 'hidden') continue
            element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })
            await new Promise(resolve => window.requestAnimationFrame(resolve))
            const rect = element.getBoundingClientRect()
            if (rect.width <= 0 || rect.height <= 0) continue
            const dockRect = primary.getBoundingClientRect()
            const visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0))
            const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0))
            const visibleArea = visibleWidth * visibleHeight
            const dockIntersectionWidth = Math.max(0, Math.min(rect.right, dockRect.right) - Math.max(rect.left, dockRect.left))
            const dockIntersectionHeight = Math.max(0, Math.min(rect.bottom, dockRect.bottom) - Math.max(rect.top, dockRect.top))
            const targetArea = rect.width * rect.height
            const uncoveredArea = visibleArea - dockIntersectionWidth * dockIntersectionHeight
            const minimumUsableArea = Math.min(44 * 44, targetArea)
            if (uncoveredArea < minimumUsableArea) {
              failures.push(element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 60) || element.tagName)
            }
          }
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          await new Promise(resolve => window.requestAnimationFrame(resolve))
          return failures
        })
        assert(controlsTrappedByDock.length === 0, `${route.path} has controls that cannot scroll clear of the fixed dock: ${JSON.stringify(controlsTrappedByDock)}.`)
      }
      if (route.path === capturePath) {
        await shellPage.screenshot({ path: path.join(artifactDir, artifactName), fullPage: true })
      }
    }
    assert(errors.length === 0, `${viewport.width}Ã—${viewport.height} shell browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

const SIGNED_OUT_SHELL_ROUTES = [
  { path: '/together', heading: 'this.is' },
  { path: '/saved', heading: 'KEEP' },
  { path: '/people', heading: 'The people in your groups.' },
  { path: '/search', heading: 'ADD A NEW PLACE', redirect: '/add' },
  { path: '/add', heading: 'ADD A NEW PLACE' },
  { path: '/settings', heading: 'SETTINGS' },
  { path: '/onboarding', heading: 'First, it needs to be yours.' },
  { path: '/groups/new', heading: 'Sign in before you create a group.' },
  { path: '/g/prototype-evidence-lab', heading: 'Sign in to open your group.' },
  { path: '/gi/prototype-four-person', heading: 'Join Family Sunday.' },
  { path: '/with/retired-person', heading: 'this.is' },
  { path: '/terms', heading: 'Terms of use' },
  { path: '/privacy', heading: 'Privacy policy' },
]

async function verifySignedOutResponsiveShell(browser, viewport, capturePath, artifactName) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  const signedOutPage = await context.newPage()
  const errors = []
  signedOutPage.on('console', message => {
    if (message.type() === 'error') errors.push(`${signedOutPage.url()}: ${message.text()}`)
  })
  signedOutPage.on('pageerror', error => errors.push(`${signedOutPage.url()}: ${error.message}`))
  try {
    for (const route of SIGNED_OUT_SHELL_ROUTES) {
      await signedOutPage.goto(`${origin}${route.path}?prototype=group&prototypeAuth=invite-new`, { waitUntil: 'networkidle' })
      try {
        await signedOutPage.getByRole('heading', { name: route.heading, exact: true }).waitFor()
      } catch (error) {
        const visibleCopy = (await signedOutPage.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 700)
        throw new Error(`Signed-out ${route.path} did not render ${JSON.stringify(route.heading)}. Visible copy: ${visibleCopy}. Browser errors: ${errors.join(' | ')}`, { cause: error })
      }
      await signedOutPage.locator('.page:not([aria-busy="true"])').waitFor()
      if (route.redirect) {
        assert(new URL(signedOutPage.url()).pathname === route.redirect, `${route.path} signed-out recovery must enter ${route.redirect}.`)
      }
      assert(await signedOutPage.locator('h1').count() === 1, `${route.path} signed-out state must expose exactly one page-level h1.`)
      assert(await signedOutPage.getByRole('navigation', { name: 'Primary' }).count() === 0, `${route.path} must not show private app navigation before sign-in.`)
      assert(await signedOutPage.evaluate(() => window.scrollY === 0), `${route.path} signed-out state must start at the top.`)
      await assertNoHorizontalOverflow(signedOutPage, `${viewport.width}Ã—${viewport.height} signed-out ${route.path}`)

      const escapedControls = await signedOutPage.locator('a, button, input, textarea, select, summary').evaluateAll(elements =>
        elements.flatMap(element => {
          const rect = element.getBoundingClientRect()
          const style = window.getComputedStyle(element)
          const visible = style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
          if (!visible || (rect.left >= -1 && rect.right <= window.innerWidth + 1)) return []
          return [element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 60) || element.tagName]
        }),
      )
      assert(escapedControls.length === 0, `${route.path} signed-out controls escape the viewport: ${JSON.stringify(escapedControls)}.`)

      if (route.path === '/g/prototype-evidence-lab') {
        await signedOutPage.getByRole('button', { name: 'Continue with Google' }).waitFor()
        for (const privateText of ['Candidate Evidence Lab', 'Supper Club', 'Glass House', 'Nightjar Coffee', 'Ari']) {
          assert(await signedOutPage.getByText(privateText, { exact: false }).count() === 0, `Signed-out private group must not reveal ${privateText}.`)
        }
      }
      if (route.path === '/groups/new') {
        await signedOutPage.getByRole('button', { name: 'Continue with Google' }).waitFor()
        assert(await signedOutPage.getByRole('textbox').count() === 0, 'Signed-out group creation must not expose a form that can only fail.')
        assert(await signedOutPage.getByRole('button', { name: 'Create group' }).count() === 0, 'Signed-out group creation must require authentication before submission.')
      }
      if (route.path === capturePath) {
        await signedOutPage.screenshot({ path: path.join(artifactDir, artifactName), fullPage: true })
      }
    }
    assert(errors.length === 0, `${viewport.width}Ã—${viewport.height} signed-out shell browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

async function verifyPrimaryIa(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const iaPage = await context.newPage()
  const errors = []
  iaPage.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  iaPage.on('pageerror', error => errors.push(error.message))
  try {
    await iaPage.goto(`${origin}/together?prototype=group`, { waitUntil: 'networkidle' })
    await iaPage.getByRole('heading', { name: 'Who are we getting together?' }).waitFor()
    const dock = iaPage.getByRole('navigation', { name: 'Primary' })
    const dockLabels = (await dock.getByRole('link').allTextContents()).map(label => label.trim())
    assert(
      JSON.stringify(dockLabels) === JSON.stringify(['TOGETHER', 'KEEP', 'PEOPLE']),
      `Primary IA must remain exactly Together / Keep / People; received ${JSON.stringify(dockLabels)}.`,
    )
    assert(
      await dock.getByRole('link', { name: 'TOGETHER' }).getAttribute('aria-current') === 'page',
      'Together must expose the active primary-navigation state.',
    )
    await iaPage.getByText('Open a group to see what its explicitly shared taste can answer now.', { exact: true }).waitFor()
    const fridayCard = iaPage.getByRole('link', { name: /Friday Table/ })
    await fridayCard.getByText('12 shared place signals', { exact: true }).waitFor()
    assert(
      await fridayCard.locator('.group-avatars .avatar-initial').count() === 6,
      'Together must render all six members of a full group without truncating its people into a pair-like summary.',
    )
    await iaPage.getByRole('link', { name: /Brooklyn Friends/ }).getByText('4 shared place signals', { exact: true }).waitFor()
    await iaPage.getByRole('link', { name: /Candidate Evidence Lab/ }).getByText('4 shared place signals', { exact: true }).waitFor()
    await iaPage.getByRole('link', { name: /Empty Table/ }).getByText('No shared place signals yet', { exact: true }).waitFor()
    await iaPage.getByRole('link', { name: /Family Sunday/ }).getByText('Waiting for someone to join', { exact: true }).waitFor()
    assert(await iaPage.locator('.group-index-card.has-current-pick').count() === 0, 'Together must not visually feature an ordinary first group by array position.')
    assert(await iaPage.locator('.group-index-card.is-active').count() === 4, 'Ordinary active groups must share one equal visual treatment.')
    assert(await iaPage.locator('.group-index-card.is-forming').count() === 1, 'A forming group may carry only its truthful incomplete state.')
    const [ordinaryCardBoxes, dockBox] = await Promise.all([
      iaPage.locator('.group-index-card.is-active').evaluateAll(elements => elements.map(element => {
        const box = element.getBoundingClientRect()
        return { height: box.height, bottom: box.bottom }
      })),
      dock.boundingBox(),
    ])
    assert(
      ordinaryCardBoxes.every(box => box.height <= 170),
      `Ordinary groups must remain scan-sized at 390×844; received ${JSON.stringify(ordinaryCardBoxes)}.`,
    )
    assert(
      dockBox && ordinaryCardBoxes[2]?.bottom <= dockBox.y - 24,
      'Three complete ordinary groups must remain visible above the fixed dock at 390×844.',
    )
    await assertNoHorizontalOverflow(iaPage, '390×844 Together')
    await iaPage.screenshot({ path: path.join(artifactDir, 'group-ui-together-mobile.png'), fullPage: true })

    const warmTogetherPage = await context.newPage()
    const warmTogetherErrors = []
    warmTogetherPage.on('console', message => {
      if (message.type() === 'error') warmTogetherErrors.push(message.text())
    })
    warmTogetherPage.on('pageerror', error => warmTogetherErrors.push(error.message))
    await warmTogetherPage.goto(`${origin}/together?prototype=group&failure=together-refresh`, { waitUntil: 'networkidle' })
    assert(await warmTogetherPage.locator('.group-index-card').count() === 5, 'A warm Together refresh failure must preserve every last-authorized group.')
    const warmWarning = warmTogetherPage.getByRole('status').filter({ hasText: 'Group updates couldn’t be checked.' })
    await warmWarning.getByRole('button', { name: 'Check group updates' }).waitFor()
    assert(await warmTogetherPage.getByRole('heading', { name: 'We couldn’t load your groups.' }).count() === 0, 'A warm Together refresh failure must not replace authorized groups with the cold-failure screen.')
    const [warmGroupsBox, warmWarningBox] = await Promise.all([
      warmTogetherPage.getByRole('region', { name: 'Your groups' }).boundingBox(),
      warmWarning.boundingBox(),
    ])
    assert(warmGroupsBox && warmWarningBox && warmGroupsBox.y < warmWarningBox.y, 'Warm Together groups must remain visually primary above their refresh warning.')
    await warmTogetherPage.screenshot({ path: path.join(artifactDir, 'group-ui-together-warm-refresh-mobile.png'), fullPage: true })
    await warmWarning.getByRole('button', { name: 'Check group updates' }).click()
    await warmWarning.waitFor({ state: 'detached' })
    assert(!new URL(warmTogetherPage.url()).searchParams.has('failure'), 'Together group retry must leave the development failure state.')
    assert(warmTogetherErrors.length === 0, `Warm Together recovery browser errors: ${warmTogetherErrors.join(' | ')}`)
    await warmTogetherPage.close()

    const legacyTogetherPage = await context.newPage()
    const legacyTogetherErrors = []
    legacyTogetherPage.on('console', message => {
      if (message.type() === 'error') legacyTogetherErrors.push(message.text())
    })
    legacyTogetherPage.on('pageerror', error => legacyTogetherErrors.push(error.message))
    await legacyTogetherPage.goto(`${origin}/together?prototype=group&failure=together-legacy`, { waitUntil: 'networkidle' })
    assert(await legacyTogetherPage.locator('.group-index-card').count() === 5, 'A legacy-pair lookup failure must never block canonical groups.')
    const legacyWarning = legacyTogetherPage.getByRole('status').filter({ hasText: 'Older pairs couldn’t be checked.' })
    await legacyWarning.getByRole('button', { name: 'Check older pairs' }).waitFor()
    const [legacyGroupsBox, legacyWarningBox] = await Promise.all([
      legacyTogetherPage.getByRole('region', { name: 'Your groups' }).boundingBox(),
      legacyWarning.boundingBox(),
    ])
    assert(legacyGroupsBox && legacyWarningBox && legacyGroupsBox.y < legacyWarningBox.y, 'Canonical groups must remain visually primary above optional legacy recovery.')
    await legacyTogetherPage.screenshot({ path: path.join(artifactDir, 'group-ui-together-legacy-warning-mobile.png'), fullPage: true })
    await legacyWarning.getByRole('button', { name: 'Check older pairs' }).click()
    await legacyWarning.waitFor({ state: 'detached' })
    assert(!new URL(legacyTogetherPage.url()).searchParams.has('failure'), 'Together legacy retry must leave the development failure state.')
    assert(legacyTogetherErrors.length === 0, `Legacy Together recovery browser errors: ${legacyTogetherErrors.join(' | ')}`)
    await legacyTogetherPage.close()

    await dock.getByRole('link', { name: 'KEEP' }).click()
    await iaPage.locator('.page-header').getByText('KEEP', { exact: true }).waitFor()
    await iaPage.getByText('5 PLACES', { exact: true }).waitFor()
    const keepTabs = iaPage.getByRole('tablist', { name: 'Keep filter' })
    assert(await keepTabs.getByRole('tab').count() === 3, 'Keep must remain one flat Want / Tried / Loved memory.')
    assert(
      await keepTabs.getByRole('tab', { name: 'want 5' }).getAttribute('aria-selected') === 'true',
      'Want must announce the initial Keep filter.',
    )
    const keepCards = iaPage.locator('.pin-card')
    assert(await keepCards.count() === 5, 'Every prototype group projection owned by Mika must have one canonical personal Keep save.')
    const keepCardBoxes = await keepCards.evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect()
      return { x: box.x, y: box.y }
    }))
    assert(
      Math.abs(keepCardBoxes[0].y - keepCardBoxes[1].y) <= 2
        && keepCardBoxes[0].x < keepCardBoxes[1].x
        && Math.abs(keepCardBoxes[2].y - keepCardBoxes[3].y) <= 2
        && keepCardBoxes[2].x < keepCardBoxes[3].x
        && keepCardBoxes[2].y > keepCardBoxes[0].y,
      `Keep cards must render row-major so visual and focus order agree; received ${JSON.stringify(keepCardBoxes)}.`,
    )
    await keepTabs.getByRole('tab', { name: 'tried' }).click()
    await iaPage.getByText('Nothing tagged tried yet.').waitFor()
    assert(await iaPage.locator('.pin-card').count() === 0, 'An empty Keep filter must not borrow places from another status.')
    await keepTabs.getByRole('tab', { name: 'want 5' }).click()
    await assertNoHorizontalOverflow(iaPage, '390×844 Keep')
    await iaPage.screenshot({ path: path.join(artifactDir, 'group-ui-keep-mobile.png'), fullPage: true })

    const coldKeepPage = await context.newPage()
    const coldKeepErrors = []
    coldKeepPage.on('console', message => {
      if (message.type() === 'error') coldKeepErrors.push(message.text())
    })
    coldKeepPage.on('pageerror', error => coldKeepErrors.push(error.message))
    await coldKeepPage.goto(`${origin}/saved?prototype=group&failure=keep-permission`, { waitUntil: 'networkidle' })
    await coldKeepPage.getByRole('heading', { name: 'We couldn’t load your places.' }).waitFor()
    assert(await coldKeepPage.locator('.pin-card').count() === 0, 'A cold Keep permission failure must fail closed without personal place identities.')
    assert(await coldKeepPage.getByText('5 PLACES', { exact: true }).count() === 0, 'A cold Keep failure must not reveal the cached place count.')
    assert(await coldKeepPage.getByRole('heading', { name: 'Nothing kept yet.' }).count() === 0, 'Unavailable Keep data must never masquerade as an empty account.')
    assert(await coldKeepPage.getByRole('link', { name: 'Add a place' }).count() === 0, 'A cold Keep failure must lead with recovery instead of an unverified write path.')
    await assertNoHorizontalOverflow(coldKeepPage, '390×844 cold Keep recovery')
    await coldKeepPage.screenshot({ path: path.join(artifactDir, 'group-ui-keep-cold-recovery-mobile.png'), fullPage: true })
    await coldKeepPage.getByRole('button', { name: 'Try again' }).click()
    await coldKeepPage.getByText('5 PLACES', { exact: true }).waitFor()
    assert(!new URL(coldKeepPage.url()).searchParams.has('failure'), 'Keep retry must leave the development failure state and restore personal memory.')
    assert(await coldKeepPage.locator('.pin-card').count() === 5, 'Keep retry must restore every authorized personal place.')
    assert(coldKeepErrors.length === 0, `Cold Keep recovery browser errors: ${coldKeepErrors.join(' | ')}`)
    await coldKeepPage.close()

    const warmKeepPage = await context.newPage()
    const warmKeepErrors = []
    warmKeepPage.on('console', message => {
      if (message.type() === 'error') warmKeepErrors.push(message.text())
    })
    warmKeepPage.on('pageerror', error => warmKeepErrors.push(error.message))
    await warmKeepPage.goto(`${origin}/saved?prototype=group&failure=keep-refresh`, { waitUntil: 'networkidle' })
    assert(await warmKeepPage.locator('.pin-card').count() === 5, 'A warm Keep refresh failure must preserve every last-authorized personal place.')
    const keepWarning = warmKeepPage.getByRole('status').filter({ hasText: 'Keep updates couldn’t be checked.' })
    await keepWarning.getByRole('button', { name: 'Check Keep updates' }).waitFor()
    assert(await warmKeepPage.getByRole('heading', { name: 'We couldn’t load your places.' }).count() === 0, 'A warm Keep failure must not replace personal memory with the cold recovery screen.')
    const [keepGridBox, keepWarningBox] = await Promise.all([
      warmKeepPage.locator('.keep-grid').boundingBox(),
      keepWarning.boundingBox(),
    ])
    assert(keepGridBox && keepWarningBox && keepGridBox.y < keepWarningBox.y, 'Last-authorized Keep memory must remain visually primary above its refresh warning.')
    await warmKeepPage.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const [keepRetryBottom, keepDockTop] = await Promise.all([
      keepWarning.getByRole('button', { name: 'Check Keep updates' }).evaluate(element => element.getBoundingClientRect().bottom),
      warmKeepPage.getByRole('navigation', { name: 'Primary' }).evaluate(element => element.getBoundingClientRect().top),
    ])
    assert(keepRetryBottom <= keepDockTop, 'Keep refresh recovery must scroll fully above the fixed primary dock.')
    await warmKeepPage.screenshot({ path: path.join(artifactDir, 'group-ui-keep-warm-refresh-mobile.png'), fullPage: true })
    await keepWarning.getByRole('button', { name: 'Check Keep updates' }).click()
    await keepWarning.waitFor({ state: 'detached' })
    await warmKeepPage.getByText('5 PLACES', { exact: true }).waitFor()
    assert(!new URL(warmKeepPage.url()).searchParams.has('failure'), 'Keep refresh retry must leave the development failure state.')
    assert(await warmKeepPage.locator('.pin-card').count() === 5, 'Keep refresh retry must retain every authorized personal place.')
    assert(warmKeepErrors.length === 0, `Warm Keep recovery browser errors: ${warmKeepErrors.join(' | ')}`)
    await warmKeepPage.close()

    await dock.getByRole('link', { name: 'PEOPLE' }).click()
    await iaPage.getByRole('heading', { name: 'The people in your groups.' }).waitFor()
    assert(
      await dock.getByRole('link', { name: 'PEOPLE' }).getAttribute('aria-current') === 'page',
      'People must expose the active primary-navigation state.',
    )
    assert(await iaPage.locator('.people-card').count() === 5, 'People must deduplicate all five other members across the fixture’s explicit groups.')
    await iaPage.getByText('People appear here only through a group you explicitly share.').waitFor()
    assert(await iaPage.getByText('GROUP →', { exact: true }).count() === 0, 'People must not route a multi-group relationship through one arbitrary group.')
    const vivianCard = iaPage.locator('.people-card').filter({ hasText: 'Vivian' })
    const vivianGroups = vivianCard.locator('details.people-shared-groups')
    await vivianGroups.getByText('4 shared groups', { exact: true }).waitFor()
    assert(await vivianGroups.evaluate(element => !element.open), 'A multi-group relationship must start compact without hiding its group count.')
    await vivianGroups.locator('summary').click()
    const vivianGroupLinks = vivianGroups.getByRole('navigation', { name: 'Groups shared with Vivian' })
    assert(await vivianGroupLinks.getByRole('link').count() === 4, 'Every group shared with Vivian must be an explicit destination.')
    await vivianGroupLinks.getByRole('link', { name: 'Candidate Evidence Lab' }).waitFor()
    const lenaCard = iaPage.locator('.people-card').filter({ hasText: 'Lena' })
    const lenaGroupLink = lenaCard.getByRole('link', { name: 'Friday Table' })
    await lenaGroupLink.waitFor()
    const noaCard = iaPage.locator('.people-card').filter({ hasText: 'Noa' })
    const noaGroupLink = noaCard.getByRole('link', { name: 'Friday Table' })
    await noaGroupLink.waitFor()
    await assertNoHorizontalOverflow(iaPage, '390×844 People')
    await iaPage.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const [lastGroupBottom, dockTop] = await Promise.all([
      noaGroupLink.evaluate(element => element.getBoundingClientRect().bottom),
      dock.evaluate(element => element.getBoundingClientRect().top),
    ])
    assert(lastGroupBottom <= dockTop, 'The final People action must scroll fully above the fixed primary dock.')
    await iaPage.screenshot({ path: path.join(artifactDir, 'group-ui-people-expanded-mobile.png'), fullPage: true })
    await vivianGroups.locator('summary').click()
    await iaPage.evaluate(() => window.scrollTo(0, 0))
    await iaPage.screenshot({ path: path.join(artifactDir, 'group-ui-people-mobile.png'), fullPage: true })

    await vivianGroups.locator('summary').click()
    await vivianGroupLinks.getByRole('link', { name: 'Candidate Evidence Lab' }).click()
    await iaPage.getByRole('heading', { name: 'Three places. Real reasons.' }).waitFor()
    assert(
      await iaPage.getByRole('navigation', { name: 'Primary' }).count() === 0,
      'A focused group decision must remove the persistent dock rather than add a fourth IA destination.',
    )
    await iaPage.getByRole('button', { name: '← BACK' }).click()
    await iaPage.getByRole('heading', { name: 'The people in your groups.' }).waitFor()
    assert(errors.length === 0, `Primary IA browser errors: ${errors.join(' | ')}`)

    const formingPage = await context.newPage()
    const formingErrors = []
    formingPage.on('console', message => {
      if (message.type() === 'error') formingErrors.push(message.text())
    })
    formingPage.on('pageerror', error => formingErrors.push(error.message))
    await formingPage.goto(`${origin}/people?prototype=group&prototypeState=forming-only`, { waitUntil: 'networkidle' })
    await formingPage.getByRole('heading', { name: 'The people in your groups.' }).waitFor()
    assert(await formingPage.locator('.people-card').count() === 0, 'A one-person forming group must not invent another member.')
    await formingPage.getByRole('heading', { name: 'Your group is ready for people.' }).waitFor()
    await formingPage.getByText('Nothing from Keep is shared until you choose it.', { exact: false }).waitFor()
    const formingLink = formingPage.getByRole('link', { name: /Family Sunday/ })
    assert(
      await formingLink.getAttribute('href') === '/g/prototype-forming-family',
      'People must route a one-person forming group to its truthful invitation boundary.',
    )
    const formingDock = formingPage.getByRole('navigation', { name: 'Primary' })
    const [formingLinkBox, formingDockBox] = await Promise.all([formingLink.boundingBox(), formingDock.boundingBox()])
    assert(
      formingLinkBox && formingDockBox && formingLinkBox.y + formingLinkBox.height <= formingDockBox.y - 24,
      'The first-group invitation recovery must remain fully visible above the fixed dock at 390×844.',
    )
    await assertNoHorizontalOverflow(formingPage, '390×844 forming People')
    await formingPage.screenshot({ path: path.join(artifactDir, 'group-ui-people-forming-mobile.png'), fullPage: true })
    await formingLink.click()
    await formingPage.getByRole('heading', { name: 'Invite your people. Nothing shared yet.' }).waitFor()
    await formingPage.getByText('1 PERSON · FAMILY SUNDAY', { exact: true }).waitFor()
    await formingPage.getByText('ONE LINK · ONE PERSON', { exact: true }).waitFor()
    await formingPage.getByText('Make a separate private link for each person.', { exact: false }).waitFor()
    await formingPage.getByRole('button', { name: 'Make one-person link' }).waitFor()
    assert(formingErrors.length === 0, `Forming People browser errors: ${formingErrors.join(' | ')}`)
    await formingPage.close()

    const peopleErrorPage = await context.newPage()
    const peopleErrorMessages = []
    peopleErrorPage.on('console', message => {
      if (message.type() === 'error') peopleErrorMessages.push(message.text())
    })
    peopleErrorPage.on('pageerror', error => peopleErrorMessages.push(error.message))
    await peopleErrorPage.goto(`${origin}/people?prototype=group&failure=people-permission`, { waitUntil: 'networkidle' })
    await peopleErrorPage.getByRole('heading', { name: 'We couldn’t load your people.' }).waitFor()
    await peopleErrorPage.getByText('No group names or membership were shown.', { exact: false }).waitFor()
    await peopleErrorPage.getByRole('button', { name: 'Try again' }).waitFor()
    assert(await peopleErrorPage.locator('.people-card').count() === 0, 'A cold People permission failure must fail closed without member identities.')
    assert(await peopleErrorPage.getByText('Vivian', { exact: true }).count() === 0, 'A cold People permission failure must not leak cached member names.')
    assert(await peopleErrorPage.getByText('Friday Table', { exact: true }).count() === 0, 'A cold People permission failure must not leak cached group names.')
    await assertNoHorizontalOverflow(peopleErrorPage, '390×844 People permission recovery')
    await peopleErrorPage.screenshot({ path: path.join(artifactDir, 'group-ui-people-permission-mobile.png'), fullPage: true })
    await peopleErrorPage.getByRole('button', { name: 'Try again' }).click()
    await peopleErrorPage.getByText('Vivian', { exact: true }).waitFor()
    assert(!new URL(peopleErrorPage.url()).searchParams.has('failure'), 'People retry must leave the development failure state and restore the authorized directory.')
    assert(peopleErrorMessages.length === 0, `People permission recovery browser errors: ${peopleErrorMessages.join(' | ')}`)
    await peopleErrorPage.close()
  } finally {
    await context.close()
  }
}

async function verifySixPersonPlanning(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const errors = []
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(`${origin}/g/prototype-friday-table?prototype=group`, { waitUntil: 'networkidle' })
    await page.getByText('6 PEOPLE · FRIDAY TABLE', { exact: true }).waitFor()
    await page.getByRole('heading', { name: 'Three places. Real reasons.' }).waitFor()
    const attendeePicker = page.locator('.group-attendee-picker')
    const memberControls = attendeePicker.locator('.group-attendee:not(.group-guest-attendee)')
    assert(await memberControls.count() === 6, 'A full group plan must expose all six real members as attendee controls.')
    assert(
      (await memberControls.evaluateAll(elements => elements.map(element => element.getAttribute('aria-pressed'))))
        .every(value => value === 'true'),
      'All six current members must begin included in their recurring group plan.',
    )
    await page.getByText('These 6 people’s shared taste · no location profile.', { exact: true }).waitFor()
    await page.getByText('Why for us: 5 of 6 want or love this.', { exact: true }).waitFor()
    const noaControl = attendeePicker.getByRole('button', { name: 'Noa' })
    await noaControl.click()
    await page.getByText('These 5 people’s shared taste · no location profile.', { exact: true }).waitFor()
    await page.getByText('Why for us: All 5 want this.', { exact: true }).waitFor()
    assert(await noaControl.getAttribute('aria-pressed') === 'false', 'Removing the unknown member must visibly update their attendance state.')
    await noaControl.click()
    await page.getByText('Why for us: 5 of 6 want or love this.', { exact: true }).waitFor()
    assert(await noaControl.getAttribute('aria-pressed') === 'true', 'Restoring the unknown member must restore the truthful six-person denominator.')
    await assertNoHorizontalOverflow(page, '390×844 six-person group plan')
    await page.screenshot({ path: path.join(artifactDir, 'group-ui-six-person-plan-mobile.png'), fullPage: true })
    await page.getByRole('button', { name: 'Choose Sunlight Coffee for this plan' }).click()
    let resolution = await assertCompactPickResolution(page, 'Six-person Pick')
    const selectedCandidate = page.getByRole('button', { name: 'Sunlight Coffee selected for this plan' })
    await selectedCandidate.getByText('Chosen ✓', { exact: true }).waitFor()
    assert(await selectedCandidate.getAttribute('aria-pressed') === 'true', 'The visible Chosen state and accessible pressed state must agree before commitment.')
    await resolution.getByText('5 of 6 want or love this.', { exact: true }).waitFor()
    const chooseAnother = resolution.getByRole('button', { name: 'Choose another' })
    await chooseAnother.click()
    const originalChoice = page.getByRole('button', { name: 'Choose Sunlight Coffee for this plan' })
    await assertFocused(originalChoice, 'Choose another must restore focus to the exact candidate that opened the tray.')
    assert(await page.getByRole('complementary', { name: 'Selected place confirmation' }).count() === 0, 'Choose another must remove the uncommitted confirmation tray.')
    await originalChoice.click()
    resolution = await assertCompactPickResolution(page, 'Six-person Pick after reconsidering')
    await page.screenshot({ path: path.join(artifactDir, 'group-ui-six-person-selected-mobile.png'), fullPage: false })
    await resolution.getByRole('button', { name: 'Make this the Pick' }).click()
    await page.waitForURL(/\/p\/group-sunlight\?pick=prototype-group-pick-group-sunlight$/)
    await page.getByRole('heading', { name: 'Sunlight Coffee', level: 1 }).waitFor()
    await page.getByText('FRIDAY TABLE · 6 GOING', { exact: true }).waitFor()
    await page.getByRole('heading', { name: '5 of 6 want or love this.', level: 2 }).waitFor()
    const storedPick = await page.evaluate(() => {
      const pickId = new URL(window.location.href).searchParams.get('pick')
      const value = pickId ? window.sessionStorage.getItem(`__this_is_pick:${pickId}`) : null
      return value ? JSON.parse(value) : null
    })
    assert(
      storedPick?.memberUids?.length === 6
        && storedPick.attendeeUids?.length === 6
        && (storedPick.guestCount ?? 0) === 0
        && storedPick.groupName === 'Friday Table'
        && storedPick.shareToken === 'prototype-receipt-group-sunlight',
      `A max-group Pick must persist all six attendees and one private receipt boundary; received ${JSON.stringify(storedPick)}.`,
    )
    await page.goto(`${origin}/together?prototype=group`, { waitUntil: 'networkidle' })
    const currentGroup = page.getByRole('link', { name: /Friday Table/ })
    await currentGroup.getByText('Current Pick · Sunlight Coffee', { exact: true }).waitFor()
    assert(
      await currentGroup.locator('.group-avatars .avatar-initial').count() === 6,
      'Together must recover a six-person current Pick without truncating its group identity.',
    )
    await page.screenshot({ path: path.join(artifactDir, 'group-ui-six-person-current-pick-mobile.png'), fullPage: true })
    await currentGroup.click()
    await page.getByText('CURRENT PICK · 6 GOING', { exact: true }).waitFor()
    assert(await page.locator('.group-attendee-picker').count() === 0, 'A six-person current Pick must replace a second mutable attendee draft.')
    assert(errors.length === 0, `Six-person plan browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

async function verifyShareTargetCapture(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const errors = []
  const paidOrResolverRequests = []
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => {
    if (/places\.googleapis\.com|\/resolveMapsUrl(?:\?|$)/.test(request.url())) {
      paidOrResolverRequests.push(request.url())
    }
  })
  try {
    await page.goto(`${origin}/add?prototype=group`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: 'Paste the link, or type the name.' }).waitFor()
    await page.getByText('Google search waits for three letters.', { exact: false }).waitFor()
    await page.getByText('Choosing a result opens a review—it does not save the place yet.', { exact: false }).waitFor()
    await page.getByText('You confirm your own label, category, and experience before the place reaches Keep.').waitFor()
    assert(paidOrResolverRequests.length === 0, 'Opening empty Google capture must not spend Places quota or resolve a link.')
    const captureGuide = page.locator('.add-capture-guide')
    const captureDock = page.getByRole('navigation', { name: 'Primary' })
    const [guideBox, captureDockBox] = await Promise.all([captureGuide.boundingBox(), captureDock.boundingBox()])
    assert(
      guideBox && captureDockBox && guideBox.y + guideBox.height <= captureDockBox.y - 24,
      'The complete capture review boundary must remain visible above the fixed dock at 390×844.',
    )
    await assertNoHorizontalOverflow(page, '390×844 empty Google capture')
    await page.screenshot({ path: path.join(artifactDir, 'group-ui-add-empty-mobile.png'), fullPage: true })

    const sharedUrl = 'https://maps.app.goo.gl/AbCdEf123456'
    await page.goto(
      `${origin}/add?prototype=group&title=Cafe%20Mogador&text=${encodeURIComponent(`Cafe Mogador ${sharedUrl}`)}`,
      { waitUntil: 'networkidle' },
    )
    const input = page.getByRole('textbox')
    await input.waitFor()
    const receivedInput = await input.inputValue()
    assert(receivedInput === sharedUrl, `Share target must prefer the bounded Google Maps URL; received ${JSON.stringify(receivedInput)}.`)
    await page.getByText('Shared here from another app. Review it before adding.').waitFor()
    await page.getByRole('button', { name: 'Use this Google Maps link' }).waitFor()
    assert(paidOrResolverRequests.length === 0, 'Receiving a shared place must not resolve it or spend Places quota before review.')
    await page.waitForFunction(() => !location.search.includes('title=') && !location.search.includes('text='))
    assert(new URL(page.url()).searchParams.get('prototype') === 'group', 'Share-target cleanup must preserve unrelated route state.')
    await assertNoHorizontalOverflow(page, '390Ã—844 share-target capture')

    await page.goto(`${origin}/add?group=prototype-zero-history&prototype=group&failure=add-group-read`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: 'We couldn’t check this group.' }).waitFor()
    await page.getByText('No group name or sharing audience was shown.', { exact: false }).waitFor()
    assert(await page.getByText('Empty Table', { exact: true }).count() === 0, 'A failed Add audience lookup must reveal no cached group name.')
    assert(await page.getByRole('textbox', { name: 'Place name or Google Maps link…' }).count() === 0, 'A failed Add audience lookup must not mount provider capture.')
    assert(await page.getByRole('heading', { name: 'What do you call this place?' }).count() === 0, 'A failed Add audience lookup must stop before memory confirmation.')
    assert(await page.getByRole('button', { name: /Keep.*share/i }).count() === 0, 'A failed Add audience lookup must expose no persistence action.')
    assert(paidOrResolverRequests.length === 0, 'Checking a private group audience must not spend Places quota or resolve a link.')
    const failedAudienceSignal = await page.evaluate(() => window.sessionStorage.getItem('__this_is_signal:group-mika:g:prototype-memory'))
    assert(failedAudienceSignal === null, 'A failed Add audience lookup must not create a personal save or group projection.')
    await assertNoHorizontalOverflow(page, '390×844 failed Add audience lookup')
    await page.screenshot({ path: path.join(artifactDir, 'group-ui-add-group-check-recovery-mobile.png'), fullPage: true })
    await page.getByRole('button', { name: 'Try again' }).click()
    await page.getByRole('heading', { name: 'ADD FOR EMPTY TABLE' }).waitFor()
    await page.getByRole('heading', { name: 'Paste the link, or type the name.' }).waitFor()
    assert(!new URL(page.url()).searchParams.has('failure'), 'Add audience retry must restore the exact authorized group before capture.')

    await page.goto(`${origin}/add?group=prototype-missing&prototype=group&failure=place-memory`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: 'That group isn’t available.' }).waitFor()
    await page.getByText('Nothing has been saved or shared.', { exact: false }).waitFor()
    assert(await page.getByRole('heading', { name: 'What do you call this place?' }).count() === 0, 'An unresolved group audience must fail closed before memory confirmation.')
    assert(await page.getByRole('button', { name: /Keep.*share/i }).count() === 0, 'An unresolved group audience must expose no sharing action.')
    const unavailableSignal = await page.evaluate(() => window.sessionStorage.getItem('__this_is_signal:group-mika:g:prototype-memory'))
    assert(unavailableSignal === null, 'An unresolved group audience must not create a private save as a hidden fallback.')
    await page.getByRole('button', { name: 'Back to Together' }).click()
    await page.waitForURL(/\/together$/)
    assert(errors.length === 0, `Share-target browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

async function verifySignedOutProductTruth(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const errors = []
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(`${origin}/together?prototype=group&prototypeAuth=invite-new`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: 'Bring back the places your people already trust.' }).waitFor()
    await page.getByText('Invite the two to six people you actually plan with.', { exact: false }).waitFor()
    const evidence = page.getByRole('region', { name: 'Example group evidence' })
    await evidence.getByRole('heading', { name: 'Ari can introduce the group.' }).waitFor()
    assert(await evidence.locator('.group-demo-avatars span').count() === 4, 'Signed-out evidence must present a group rather than implying a pair-only product.')
    await evidence.getByText('The other three stay unknown until they weigh in.', { exact: false }).waitFor()
    assert(await page.getByRole('navigation', { name: 'Primary' }).count() === 0, 'Primary app navigation must not cover or advertise signed-in destinations on acquisition.')
    const evidenceBox = await evidence.boundingBox()
    assert(evidenceBox && evidenceBox.y + evidenceBox.height <= 844, 'The complete signed-out evidence card must remain visible at the mobile decision height.')
    assert(await page.getByText('The group chat already has the answer.').count() === 0, 'Signed-out acquisition must not claim an answer exists before evidence.')
    assert(await page.getByText('3 places already make sense.').count() === 0, 'Signed-out acquisition must not fabricate candidate density.')
    await assertNoHorizontalOverflow(page, '390×844 signed-out product truth')
    await page.screenshot({ path: path.join(artifactDir, 'group-ui-signed-out-mobile.png'), fullPage: true })
    assert(errors.length === 0, `Signed-out product browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

async function verifyGroupAssemblyCopy(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const assemblyPage = await context.newPage()
  const errors = []
  assemblyPage.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  assemblyPage.on('pageerror', error => errors.push(error.message))
  try {
    await assemblyPage.goto(`${origin}/groups/new?prototype=group`, { waitUntil: 'networkidle' })
    await assemblyPage.getByRole('heading', { name: 'Give your group a name.' }).waitFor()
    await assemblyPage.getByText('Use the name already familiar in chat. You’ll make a separate private link for each person next.').waitFor()
    await assemblyPage.getByText('Creating or joining never exposes personal Keep.', { exact: false }).waitFor()
    await assemblyPage.getByText('After everyone accepts, the first shared hint or place closes invitations so the audience cannot change.', { exact: false }).waitFor()
    const groupName = assemblyPage.getByRole('textbox', { name: 'GROUP NAME' })
    const createGroup = assemblyPage.getByRole('button', { name: 'Create group' })
    assert(await createGroup.isDisabled(), 'Group creation must wait for a deliberate group name.')
    await groupName.fill('F')
    assert(await createGroup.isDisabled(), 'A one-character group name must remain invalid.')
    await groupName.fill('Friday Table')
    assert(await createGroup.isEnabled(), 'A valid familiar group name must make the creation action available.')
    await assertNoHorizontalOverflow(assemblyPage, '390×844 group assembly')
    await assemblyPage.screenshot({ path: path.join(artifactDir, 'group-ui-create-group-mobile.png'), fullPage: true })

    await assemblyPage.goto(`${origin}/groups/new?prototype=group&failure=create-group-response`, { waitUntil: 'networkidle' })
    const retryName = assemblyPage.getByRole('textbox', { name: 'GROUP NAME' })
    await retryName.fill('Friday Table')
    await assemblyPage.getByRole('button', { name: 'Create group' }).click()
    await assemblyPage.getByRole('alert').getByText('We couldn’t confirm the result. Nothing from Keep was shared, and trying again won’t make a duplicate.').waitFor()
    assert(await retryName.inputValue() === 'Friday Table', 'An ambiguous group-creation response must preserve the exact reviewed name for retry.')
    await assemblyPage.getByRole('button', { name: 'Try creating again' }).waitFor()
    assert(new URL(assemblyPage.url()).pathname === '/groups/new', 'A failed group-creation response must not invent a group destination.')
    await assertNoHorizontalOverflow(assemblyPage, '390×844 group creation retry')
    await assemblyPage.screenshot({ path: path.join(artifactDir, 'group-ui-create-group-retry-mobile.png'), fullPage: true })

    const unresolvedPage = await context.newPage()
    await unresolvedPage.goto(`${origin}/groups/new?prototype=group&prototypeAuth=unknown`, { waitUntil: 'networkidle' })
    await unresolvedPage.getByLabel('Checking your account').waitFor()
    assert(await unresolvedPage.getByRole('textbox', { name: 'GROUP NAME' }).count() === 0, 'Unresolved authentication must not expose the group mutation form.')
    assert(await unresolvedPage.getByRole('button', { name: 'Create group' }).count() === 0, 'Unresolved authentication must not expose group creation.')
    assert(await unresolvedPage.getByRole('button', { name: 'Continue with Google' }).count() === 0, 'Unknown authentication must not be mislabeled as signed out.')
    await assertNoHorizontalOverflow(unresolvedPage, '390×844 unresolved group-creation auth')
    await unresolvedPage.screenshot({ path: path.join(artifactDir, 'group-ui-create-group-auth-pending-mobile.png'), fullPage: true })
    await unresolvedPage.close()
    assert(errors.length === 0, `Group assembly browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

async function verifyPairMigrationResponseTruth(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const errors = []
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(`${origin}/together?prototype=group&failure=pair-migration-response`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: 'Who are we getting together?' }).waitFor()
    const migration = page.getByRole('region', { name: 'Bring them into Together.' })
    const pairRow = migration.locator('.group-pair-migration-card').filter({ hasText: 'You & Sol' })
    await pairRow.getByRole('button', { name: 'Move' }).click()
    await pairRow.getByText(/couldn’t confirm whether you and Sol moved/).waitFor()
    const checkGroup = pairRow.getByRole('button', { name: 'Check group with Sol' })
    await assertFocused(checkGroup, 'An ambiguous pair migration must focus its exact Check group action.')
    await pairRow.getByText(/same two-person group; it cannot add people or move private places or notes/).waitFor()
    assert(await page.getByRole('link', { name: /Mika & Sol/ }).count() === 0, 'An ambiguous migration must not fabricate a visible group before exact recovery.')
    assert(await pairRow.getByRole('button', { name: 'Move' }).count() === 0, 'An ambiguous migration must not retain a fresh Move action.')
    await assertNoHorizontalOverflow(page, '390×844 ambiguous pair migration')
    await page.screenshot({ path: path.join(artifactDir, 'group-ui-pair-migration-recovery-mobile.png'), fullPage: true })
    await checkGroup.click()
    await page.waitForURL(url => url.pathname === '/g/prototype-pair-mika-sol')
    await page.getByText('SHARING CIRCLE · 2 PEOPLE', { exact: true }).waitFor()
    await page.getByRole('heading', { name: 'Nothing honest fits yet.' }).waitFor()
    await page.getByText('No one has shared a place or Quick start hint with this group. Nothing from anyone’s private Keep appears automatically.').waitFor()
    assert(errors.length === 0, `Pair-migration recovery browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

async function verifyGroupInviteConsent(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const invitePage = await context.newPage()
  const errors = []
  invitePage.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  invitePage.on('pageerror', error => errors.push(error.message))
  try {
    await invitePage.goto(`${origin}/gi/prototype-four-person?prototype=group`, { waitUntil: 'networkidle' })
    await invitePage.getByRole('heading', { name: 'Join Family Sunday.' }).waitFor()
    await invitePage.getByText('When Ari made this link, 3 people were in the group. Membership may have changed since then.', { exact: false }).waitFor()
    await invitePage.getByText('Joining shares your name and avatar with whoever is there now. Your personal Keep stays private.', { exact: false }).waitFor()
    const promises = invitePage.getByRole('list', { name: 'What joining shares' })
    await promises.getByText('Nothing is copied from Keep.').waitFor()
    await promises.getByText('You choose whether to share an exact place or a broad Quick start.').waitFor()
    await promises.getByText('You can leave later; your personal Keep stays yours.').waitFor()
    await invitePage.getByText('This private link works once and expires after seven days. Membership is limited to six people.').waitFor()
    await assertNoHorizontalOverflow(invitePage, '390×844 four-person invite consent')
    await invitePage.screenshot({ path: path.join(artifactDir, 'group-ui-invite-consent-mobile.png'), fullPage: true })

    await invitePage.getByRole('button', { name: 'Join Family Sunday' }).click()
    await invitePage.waitForURL(/\/g\/prototype-invite-family\?welcome=1$/)
    await invitePage.getByRole('heading', { name: 'Help this group learn what you like.' }).waitFor()
    await invitePage.getByText('4 PEOPLE · FAMILY SUNDAY', { exact: true }).waitFor()
    await invitePage.getByText('No place comes to mind? That’s fine. Choose one broad kind, add a place you already know, or skip. Nothing from your private Keep is shared automatically.').waitFor()
    await invitePage.getByRole('button').filter({ hasText: 'Not now' }).click()
    await invitePage.getByText('INVITATIONS OPEN · 4 OF 6 PEOPLE', { exact: true }).waitFor()
    await invitePage.getByRole('heading', { name: 'Nothing honest fits yet.' }).waitFor()
    assert(
      await invitePage.locator('.group-candidate-card').count() === 0,
      'Joining a four-person group must not manufacture or expose taste evidence.',
    )
    await assertNoHorizontalOverflow(invitePage, '390×844 joined four-person welcome')
    assert(errors.length === 0, `Group-invite consent browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

async function verifyNewRecipientInviteContinuity(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const recipientPage = await context.newPage()
  const errors = []
  recipientPage.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  recipientPage.on('pageerror', error => errors.push(error.message))
  try {
    await recipientPage.goto(`${origin}/gi/prototype-new-recipient?prototype=group&prototypeAuth=invite-new`, { waitUntil: 'networkidle' })
    await recipientPage.getByRole('heading', { name: 'Join Family Sunday.' }).waitFor()
    await recipientPage.getByRole('button', { name: 'Continue with Google' }).click()
    await recipientPage.getByRole('button', { name: 'Set up your name' }).waitFor()
    await recipientPage.getByRole('button', { name: 'Set up your name' }).click()
    await recipientPage.waitForURL(/\/onboarding\?groupInvite=prototype-new-recipient$/)

    const name = recipientPage.getByRole('textbox', { name: 'Your name' })
    await name.fill('Nora')
    const continueToInvite = recipientPage.getByRole('button', { name: 'Continue to invite' })
    const continueBox = await continueToInvite.boundingBox()
    assert(
      continueBox && continueBox.y + continueBox.height <= 844 - 24,
      'Invite identity setup must return to consent from the initial 390×844 viewport.',
    )
    await assertNoHorizontalOverflow(recipientPage, '390×844 invite identity onboarding')
    await recipientPage.screenshot({ path: path.join(artifactDir, 'group-ui-onboarding-invite-identity-mobile.png'), fullPage: true })
    await continueToInvite.click()
    await recipientPage.waitForURL(/\/gi\/prototype-new-recipient$/)
    assert(
      await recipientPage.getByRole('heading', { name: 'Add a place if one comes to mind.' }).count() === 0,
      'Invite onboarding must not ask for a private place immediately before the group asks for an optional contribution.',
    )

    await recipientPage.getByRole('button', { name: 'Join Family Sunday' }).click()
    await recipientPage.getByRole('heading', { name: 'Help this group learn what you like.' }).waitFor()
    await recipientPage.getByText('4 PEOPLE · FAMILY SUNDAY', { exact: true }).waitFor()
    await recipientPage.getByRole('button').filter({ hasText: 'Not now' }).click()
    await recipientPage.getByText('INVITATIONS OPEN · 4 OF 6 PEOPLE', { exact: true }).waitFor()
    await recipientPage.getByText('No one has shared a place or Quick start hint with this group. Nothing from anyone’s private Keep appears automatically.').waitFor()
    assert(
      await recipientPage.locator('.group-candidate-card').count() === 0,
      'A new recipient must return from identity setup to the same invite without creating taste evidence.',
    )
    await assertNoHorizontalOverflow(recipientPage, '390×844 new-recipient invite continuity')
    await recipientPage.screenshot({ path: path.join(artifactDir, 'group-ui-invite-new-recipient-mobile.png'), fullPage: true })
    assert(errors.length === 0, `New-recipient invite browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

async function verifyRevokedGroupInvite(browser) {
  const context = await browser.newContext({
    viewport: { width: 320, height: 568 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const revokedPage = await context.newPage()
  const errors = []
  revokedPage.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  revokedPage.on('pageerror', error => errors.push(error.message))
  try {
    await revokedPage.goto(`${origin}/gi/prototype-revoked-invite?prototype=group&failure=invite-locked`, { waitUntil: 'networkidle' })
    await revokedPage.getByRole('heading', { name: 'This group link can’t be opened.' }).waitFor()
    await revokedPage.getByText('It may have expired, been used, or the group’s membership may have changed.').waitFor()
    assert(await revokedPage.getByText('Family Sunday', { exact: false }).count() === 0, 'A revoked invite must reveal no group identity.')
    assert(await revokedPage.getByText('Ari', { exact: false }).count() === 0, 'A revoked invite must reveal no inviter identity.')
    await revokedPage.getByRole('button', { name: 'Open this.is' }).waitFor()
    await assertNoHorizontalOverflow(revokedPage, '320×568 revoked group invite')
    await revokedPage.screenshot({ path: path.join(artifactDir, 'group-ui-invite-revoked-narrow.png'), fullPage: true })
    assert(errors.length === 0, `Revoked-invite browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

async function verifyInviteReadRecovery(browser) {
  const context = await browser.newContext({
    viewport: { width: 320, height: 568 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const errors = []
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(`${origin}/gi/prototype-read-failure?prototype=group&failure=invite-read`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: 'We couldn’t check this link.' }).waitFor()
    await page.getByText('The invite may still be active. Check your connection and try again.').waitFor()
    assert(await page.getByText('Family Sunday', { exact: false }).count() === 0, 'A failed invite lookup must reveal no group identity.')
    assert(await page.getByText('Ari', { exact: false }).count() === 0, 'A failed invite lookup must reveal no inviter identity.')
    await page.getByRole('button', { name: 'Retry link' }).click()
    await page.getByRole('heading', { name: 'We couldn’t check this link.' }).waitFor()
    await assertNoHorizontalOverflow(page, '320×568 invite lookup recovery')
    await page.screenshot({ path: path.join(artifactDir, 'group-ui-invite-read-recovery-narrow.png'), fullPage: true })
    assert(errors.length === 0, `Invite-read recovery browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

async function verifyInviteProfileRecovery(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const errors = []
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(`${origin}/gi/prototype-profile-failure?prototype=group&failure=invite-profile`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: 'Join Family Sunday.' }).waitFor()
    const recovery = page.getByRole('alert')
    await recovery.getByText('We couldn’t check your account, so joining is paused. No group membership or place sharing changed.').waitFor()
    await recovery.getByRole('button', { name: 'Retry account' }).click()
    assert(await page.getByRole('button', { name: 'Join Family Sunday' }).count() === 0, 'A failed profile read must not offer group acceptance.')
    assert(await page.getByRole('button', { name: 'Set up your name' }).count() === 0, 'A failed profile read must not be mistaken for a missing profile.')
    await assertNoHorizontalOverflow(page, '390×844 invite account recovery')
    await page.screenshot({ path: path.join(artifactDir, 'group-ui-invite-profile-recovery-mobile.png'), fullPage: true })
    assert(errors.length === 0, `Invite-profile recovery browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

async function verifyInviteAcceptanceRecovery(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const errors = []
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(`${origin}/gi/prototype-accept-recovery?prototype=group&failure=invite-accept-response`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Join Family Sunday' }).click()
    await page.getByRole('alert').getByText('We couldn’t confirm the result. Checking again won’t join you twice or share places.').waitFor()
    assert(new URL(page.url()).pathname === '/gi/prototype-accept-recovery', 'An ambiguous acceptance response must remain at consent until membership is recovered.')
    assert(await page.getByRole('button', { name: 'Join Family Sunday' }).count() === 0, 'An ambiguous acceptance response must not present the retry as a fresh Join.')
    await page.getByRole('button', { name: 'Check membership' }).click()
    await page.waitForURL(/\/g\/prototype-invite-family\?welcome=1$/)
    await page.getByText('4 PEOPLE · FAMILY SUNDAY', { exact: true }).waitFor()
    await page.goto(`${origin}/gi/prototype-accepted-reload?prototype=group&failure=invite-already-accepted`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: 'You already joined Family Sunday.' }).waitFor()
    await page.getByText('This link’s one seat was accepted by your account. Opening the group will not share anything else from Keep.').waitFor()
    assert(await page.getByRole('button', { name: 'Join Family Sunday' }).count() === 0, 'An already accepted recipient must never see a second Join action.')
    await assertNoHorizontalOverflow(page, '390×844 accepted invite recovery')
    await page.screenshot({ path: path.join(artifactDir, 'group-ui-invite-accept-recovery-mobile.png'), fullPage: true })
    await page.getByRole('button', { name: 'Open Family Sunday' }).click()
    await page.waitForURL(/\/g\/prototype-invite-family\?prototype=group$/)
    await page.getByText('4 PEOPLE · FAMILY SUNDAY', { exact: true }).waitFor()
    assert(errors.length === 0, `Invite-accept recovery browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

async function verifyInviteCapacity(browser) {
  const context = await browser.newContext({
    viewport: { width: 320, height: 568 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const capacityPage = await context.newPage()
  const errors = []
  capacityPage.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  capacityPage.on('pageerror', error => errors.push(error.message))
  try {
    await capacityPage.goto(`${origin}/g/prototype-zero-history?prototype=group&failure=invite-capacity`, { waitUntil: 'networkidle' })
    await capacityPage.getByRole('button', { name: 'Invite one person' }).click()
    await capacityPage.getByRole('status').getByText('Every remaining seat already has a live invite link. Wait for someone to join or for a link to expire.').waitFor()
    assert(await capacityPage.getByRole('textbox', { name: 'Invite link' }).count() === 0, 'Invite capacity must not fabricate another token.')
    await assertNoHorizontalOverflow(capacityPage, '320×568 reserved invite capacity')
    assert(errors.length === 0, `Invite-capacity browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

async function verifyInviteCreationRecovery(browser) {
  const context = await browser.newContext({
    viewport: { width: 320, height: 568 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const errors = []
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(`${origin}/g/prototype-zero-history?prototype=group&failure=invite-create-response`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Invite one person' }).click()
    await page.getByRole('alert').getByText('We couldn’t confirm whether the link was made. Trying again won’t reserve another seat.').waitFor()
    assert(await page.locator('.group-invite-card').count() === 0, 'An ambiguous invite response must not fabricate a usable link.')
    const firstAttemptKey = await page.evaluate(() => window.sessionStorage.getItem('__this_is_pending_invite:prototype-zero-history'))
    assert(typeof firstAttemptKey === 'string' && firstAttemptKey.length >= 16, 'An ambiguous invite response must retain one opaque retry identity.')
    await page.getByRole('button', { name: 'Try making link again' }).click()
    const retryKey = await page.evaluate(() => window.sessionStorage.getItem('__this_is_pending_invite:prototype-zero-history'))
    assert(retryKey === firstAttemptKey, 'Retrying an ambiguous invite response must reuse the same operation identity.')
    assert(await page.locator('.group-invite-card').count() === 0, 'A repeated ambiguous response must not display a second link.')
    await assertNoHorizontalOverflow(page, '320×568 invite creation recovery')
    await page.screenshot({ path: path.join(artifactDir, 'group-ui-invite-create-recovery-narrow.png'), fullPage: true })
    assert(errors.length === 0, `Invite-create recovery browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

async function verifyConsumedInviteClosure(browser) {
  const context = await browser.newContext({
    viewport: { width: 320, height: 568 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const consumedPage = await context.newPage()
  const errors = []
  consumedPage.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  consumedPage.on('pageerror', error => errors.push(error.message))
  try {
    await consumedPage.goto(`${origin}/g/prototype-zero-history?prototype=group&failure=invite-consumed`, { waitUntil: 'networkidle' })
    await consumedPage.getByRole('button', { name: 'Invite one person' }).click()
    await consumedPage.getByRole('status').getByText('That invite is no longer active. Make another only if you still need a seat.').waitFor()
    assert(await consumedPage.getByRole('textbox', { name: 'Invite link' }).count() === 0, 'A consumed invite must disappear instead of leaving a stale shareable URL.')
    await consumedPage.getByRole('button', { name: 'Invite one person' }).waitFor()
    await assertNoHorizontalOverflow(consumedPage, '320×568 consumed invite closure')
    assert(errors.length === 0, `Consumed-invite browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

async function verifyLeaveGroup(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const leavePage = await context.newPage()
  const errors = []
  leavePage.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  leavePage.on('pageerror', error => errors.push(error.message))
  try {
    await leavePage.goto(`${origin}/g/prototype-evidence-lab?prototype=group`, { waitUntil: 'networkidle' })
    await leavePage.getByRole('heading', { name: 'Three places. Real reasons.' }).waitFor()
    const leaveButton = leavePage.getByRole('button', { name: 'Leave group' })
    await leaveButton.click()
    const dialog = leavePage.getByRole('alertdialog')
    await dialog.getByRole('heading', { name: 'Leave this group?' }).waitFor()
    await dialog.getByText('You lose access immediately. Your group evidence and public Pick links are removed; everyone’s personal Keep stays their own.').waitFor()
    const stay = dialog.getByRole('button', { name: 'Stay' })
    await assertFocused(stay, 'Leave confirmation must focus the safe Stay action first.')
    await leavePage.screenshot({ path: path.join(artifactDir, 'group-ui-leave-confirm-mobile.png') })
    await leavePage.keyboard.press('Escape')
    await assertFocused(leaveButton, 'Escape must close leave confirmation and restore its trigger.')

    await leaveButton.click()
    await dialog.getByRole('button', { name: 'Confirm leave' }).click()
    await leavePage.getByRole('heading', { name: 'Who are we getting together?' }).waitFor()
    assert(
      await leavePage.getByRole('link', { name: /Candidate Evidence Lab/ }).count() === 0,
      'A left group must disappear from the current person’s Together list.',
    )
    await leavePage.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'KEEP' }).click()
    await leavePage.getByText('5 PLACES', { exact: true }).waitFor()
    assert(await leavePage.locator('.pin-card').count() === 5, 'Leaving a group must not remove personal Keep history.')
    await assertNoHorizontalOverflow(leavePage, '390×844 after leaving group')
    assert(errors.length === 0, `Leave-group browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }

  const recoveryContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const recoveryPage = await recoveryContext.newPage()
  const recoveryErrors = []
  recoveryPage.on('console', message => {
    if (message.type() === 'error') recoveryErrors.push(message.text())
  })
  recoveryPage.on('pageerror', error => recoveryErrors.push(error.message))
  try {
    await recoveryPage.goto(`${origin}/g/prototype-evidence-lab?prototype=group&failure=leave-group-response`, { waitUntil: 'networkidle' })
    await recoveryPage.getByRole('button', { name: 'Leave group' }).click()
    const recoveryDialog = recoveryPage.getByRole('alertdialog', { name: 'Leave this group?' })
    await recoveryDialog.getByRole('button', { name: 'Confirm leave' }).click()
    await recoveryDialog.getByRole('alert').getByText(/confirm whether you left\. Checking again can only finish leaving/).waitFor()
    assert(await recoveryDialog.getByText('Nothing changed', { exact: false }).count() === 0, 'An ambiguous leave response must not claim that membership is unchanged.')
    assert(await recoveryPage.getByRole('alert').count() === 1, 'Leave recovery must not announce the same ambiguity behind and inside its dialog.')
    assert(await recoveryPage.getByRole('button', { name: 'Confirm leave' }).count() === 0, 'An ambiguous leave response must not present a fresh leave action.')
    const committed = await recoveryPage.evaluate(() =>
      window.sessionStorage.getItem('__this_is_pending_group_leave:prototype-evidence-lab'))
    assert(committed === 'committed', 'The lost-response fixture must commit group departure before hiding its response.')
    await recoveryDialog.getByRole('button', { name: 'Close for now' }).click()
    const checkMembership = recoveryPage.getByRole('button', { name: 'Check membership' })
    await assertFocused(checkMembership, 'Closing ambiguous leave recovery must focus its one Check membership action.')
    assert(await recoveryPage.getByRole('button', { name: 'Leave group' }).count() === 0, 'Unresolved departure must not fall back to a fresh Leave group action.')
    await assertNoHorizontalOverflow(recoveryPage, '390Ã—844 group-leave recovery')
    await recoveryPage.screenshot({ path: path.join(artifactDir, 'group-ui-leave-recovery-mobile.png'), fullPage: true })
    await checkMembership.click()
    await recoveryPage.getByRole('alertdialog', { name: 'Leave this group?' }).getByRole('button', { name: 'Check membership' }).click()
    await recoveryPage.getByRole('heading', { name: 'Who are we getting together?' }).waitFor()
    assert(await recoveryPage.getByRole('link', { name: /Candidate Evidence Lab/ }).count() === 0, 'Confirmed leave recovery must remove the group once.')
    assert(
      await recoveryPage.evaluate(() => window.sessionStorage.getItem('__this_is_pending_group_leave:prototype-evidence-lab')) === null,
      'Confirmed leave recovery must clear its pending development operation marker.',
    )
    assert(recoveryErrors.length === 0, `Leave-group recovery browser errors: ${recoveryErrors.join(' | ')}`)
  } finally {
    await recoveryContext.close()
  }
}

async function verifyPracticalNeedCapture(browser) {
  const capture = async includeUsefulDetails => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
    })
    const page = await context.newPage()
    const errors = []
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', error => errors.push(error.message))
    try {
      await page.goto(`${origin}/g/prototype-evidence-lab?prototype=group`, { waitUntil: 'networkidle' })
      await page.getByRole('heading', { name: 'Three places. Real reasons.' }).waitFor()
      const planDetails = page.locator('.group-plan-details')
      await planDetails.locator('summary').click()
      await page.getByRole('textbox', { name: 'Area for this plan' }).fill('Cresskill, NJ')
      await planDetails.getByRole('button', { name: 'Easy parking', exact: true }).click()
      await page.getByRole('heading', { name: 'Nothing confirms Easy parking in Cresskill, NJ.' }).waitFor()
      await page.getByRole('button', { name: 'Choose or find a place' }).click()
      await page.getByRole('heading', { name: 'DISCOVER FOR CANDIDATE EVIDENCE LAB', level: 1 }).waitFor()
      const discoveryArea = page.getByRole('textbox', { name: 'Area for discovery' })
      await discoveryArea.waitFor()
      assert(await discoveryArea.inputValue() === 'Cresskill, NJ', 'Practical-need discovery must retain the temporary plan area without serializing it.')
      await page.locator('.personal-discovery-prompts').getByRole('button', { name: /Coffee/ }).click()
      const result = page.locator('.add-suggestion').filter({ hasText: 'Copper Cup Coffee' }).first()
      await result.waitFor()
      await result.click()
      await page.getByRole('heading', { name: 'What do you call this place?' }).waitFor()
      await page.getByRole('button', { name: 'Loved', exact: true }).click()
      const answerAction = page.getByRole('button', { name: 'Answer the current plan detail', exact: true })
      assert(await answerAction.isDisabled(), 'A current practical need must require an explicit Yes, No, or Not sure before persistence.')
      const practicalNeed = page.locator('.place-memory-practical-need')
      await practicalNeed.getByText('Does this place fit “Easy parking”?', { exact: true }).waitFor()
      await practicalNeed.getByRole('button', { name: 'Yes', exact: true }).click()
      const detailConsent = practicalNeed.getByRole('checkbox', { name: 'Include my useful details with Candidate Evidence Lab' })
      assert(!(await detailConsent.isChecked()), 'A plan answer must remain private unless the named group is explicitly selected.')
      if (!includeUsefulDetails) {
        await mkdir(artifactDir, { recursive: true })
        await practicalNeed.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'auto' }))
        await page.screenshot({ path: path.join(artifactDir, 'group-ui-practical-need-private-review-mobile.png') })
      } else {
        await detailConsent.check()
      }
      await page.getByRole('button', { name: 'Keep & share as Loved', exact: true }).click()
      await page.waitForURL(/\/g\/prototype-evidence-lab(?:\?|$)/)
      await page.getByText('Your temporary plan is back, recomputed from the group’s current shared taste.', { exact: true }).waitFor()
      const stored = await page.evaluate(() => {
        const value = window.sessionStorage.getItem('__this_is_signal:group-mika:g:prototype-discovery-coffee')
        return value ? JSON.parse(value) : null
      })
      assert(stored?.observations?.easy_parking?.value === 'yes', 'Successful Add review must persist the explicit Yes in canonical Keep.')
      assert(stored?.observations?.easy_parking?.audience === 'private', 'Named-group consent must never widen the canonical personal observation.')
      const candidate = page.locator('.group-candidate-card').filter({ hasText: 'Copper Cup Coffee' })
      if (includeUsefulDetails) {
        await page.getByRole('heading', { name: 'One place. A real reason.' }).waitFor()
        await candidate.getByText('Easy parking', { exact: true }).waitFor()
        await candidate.getByText('Mika: yes', { exact: true }).waitFor()
      } else {
        await page.getByRole('heading', { name: 'Nothing confirms Easy parking in Cresskill, NJ.' }).waitFor()
        await page.getByRole('button', { name: 'Clear need' }).click()
        await candidate.waitFor()
        assert(
          await candidate.getByText('Easy parking', { exact: true }).count() === 0,
          'The place may reach the group while its private practical answer does not.',
        )
      }
      assert(errors.length === 0, `Practical-need capture browser errors: ${errors.join(' | ')}`)
    } finally {
      await context.close()
    }
  }

  await capture(false)
  await capture(true)
}

async function verifyKeepInputLoop(browser) {
  const searchContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const searchPage = await searchContext.newPage()
  const searchErrors = []
  searchPage.on('console', message => {
    if (message.type() === 'error') searchErrors.push(message.text())
  })
  searchPage.on('pageerror', error => searchErrors.push(error.message))
  try {
    await searchPage.goto(`${origin}/search?prototype=group`, { waitUntil: 'networkidle' })
    await searchPage.waitForURL(`${origin}/add?prototype=group`)
    await searchPage.getByText('ADD A NEW PLACE', { exact: true }).waitFor()
    await searchPage.getByRole('heading', { name: 'Paste the link, or type the name.' }).waitFor()
    assert(
      await searchPage.getByText('cozy wine, listening bar, a name…', { exact: true }).count() === 0,
      'The capture lane must not advertise unavailable vibe discovery.',
    )
    await searchPage.goto(`${origin}/saved?prototype=group`, { waitUntil: 'networkidle' })
    const result = searchPage.locator('.pin-card[aria-label="Sunlight Coffee"]')
    await result.waitFor()
    assert(await result.getAttribute('href') === '/p/group-sunlight', 'Keep recall must open the canonical personal memory directly.')
    await result.click()
    await searchPage.getByRole('heading', { name: 'Sunlight Coffee', level: 1 }).waitFor()
    assert(
      await searchPage.getByText('FROM YOUR PEOPLE', { exact: true }).count() === 0,
      'A personal Keep place must not render unscoped connection or cross-group evidence.',
    )
    assert(
      await searchPage.getByText(/^(Vivian|Ari|Dev|Lena)$/).count() === 0,
      'A personal place route must not expose member identities without one named group audience.',
    )
    const personalMemoryTop = await searchPage.locator('.closeup-personal-memory.is-primary').boundingBox()
    assert(
      personalMemoryTop && personalMemoryTop.y < 844,
      'Removing unscoped people evidence must return the person’s own Keep memory to the initial mobile viewport.',
    )
    const saveAs = searchPage.getByRole('group', { name: 'Save as' })
    const loved = saveAs.getByRole('button', { name: 'loved' })
    assert(await saveAs.getByRole('button', { name: 'want' }).getAttribute('aria-pressed') === 'true', 'Known place must open with its current Want state.')
    await loved.click()
    await saveAs.locator('button[aria-pressed="true"]', { hasText: 'loved' }).waitFor()
    assert(await loved.getAttribute('aria-pressed') === 'true', 'Explicitly choosing Loved must update the personal memory state.')
    const legacySharing = searchPage.getByRole('region', { name: 'Still shared outside groups' })
    await legacySharing.getByText('OLDER SHARING', { exact: true }).waitFor()
    await legacySharing.getByText('This older save may still be visible to accepted connections.', { exact: false }).waitFor()
    await searchPage.getByRole('textbox', { name: 'A note shared with legacy connections' }).waitFor()
    const [legacyBox, groupSharingBox, noteBox, cleanupBox, dockBox] = await Promise.all([
      legacySharing.boundingBox(),
      searchPage.locator('.group-signal-sharing').boundingBox(),
      searchPage.locator('.place-note-editor').boundingBox(),
      legacySharing.getByRole('button', { name: 'Make this place private' }).boundingBox(),
      searchPage.getByRole('navigation', { name: 'Primary' }).boundingBox(),
    ])
    assert(
      Boolean(legacyBox && groupSharingBox && noteBox && legacyBox.y < groupSharingBox.y && groupSharingBox.y < noteBox.y),
      'Legacy privacy cleanup must precede exact-group sharing, which must precede optional note editing.',
    )
    assert(
      Boolean(cleanupBox && dockBox && cleanupBox.y + cleanupBox.height <= dockBox.y - 12),
      'The legacy privacy cleanup action must remain fully visible above the fixed dock at 390×844.',
    )
    assert(await searchPage.getByText('Your people', { exact: true }).count() === 0, 'Legacy circle visibility must not remain a selectable forward audience.')
    await legacySharing.getByRole('button', { name: 'Make this place private' }).click()
    await legacySharing.waitFor({ state: 'detached' })
    await searchPage.getByRole('textbox', { name: 'A private note' }).waitFor()
    await searchPage.getByText('PRIVATE NOTE', { exact: true }).waitFor()
    await searchPage.getByRole('button', { name: 'Stop sharing with Friday Table' }).waitFor()
    await searchPage.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'KEEP' }).click()
    const keepTabs = searchPage.getByRole('tablist', { name: 'Keep filter' })
    await keepTabs.getByRole('tab', { name: 'want 4' }).waitFor()
    await keepTabs.getByRole('tab', { name: 'loved 1' }).click()
    await searchPage.locator('.pin-card[aria-label="Sunlight Coffee"]').waitFor()
    assert(await searchPage.locator('.pin-card').count() === 1, 'Loved filter must contain only the explicitly changed place.')
    await assertNoHorizontalOverflow(searchPage, '390×844 Search to Loved Keep')
    await searchPage.screenshot({ path: path.join(artifactDir, 'group-ui-keep-loved-mobile.png'), fullPage: true })
    assert(searchErrors.length === 0, `Keep recall browser errors: ${searchErrors.join(' | ')}`)
  } finally {
    await searchContext.close()
  }

  const privacyRecoveryContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const privacyRecoveryPage = await privacyRecoveryContext.newPage()
  const privacyRecoveryErrors = []
  privacyRecoveryPage.on('console', message => {
    if (message.type() === 'error') privacyRecoveryErrors.push(message.text())
  })
  privacyRecoveryPage.on('pageerror', error => privacyRecoveryErrors.push(error.message))
  try {
    await privacyRecoveryPage.goto(`${origin}/p/group-sunlight?prototype=group&failure=keep-privacy-response`, { waitUntil: 'networkidle' })
    const recoverySaveAs = privacyRecoveryPage.getByRole('group', { name: 'Save as' })
    const recoveryLoved = recoverySaveAs.getByRole('button', { name: 'loved' })
    await recoveryLoved.click()
    await recoverySaveAs.locator('button[aria-pressed="true"]', { hasText: 'loved' }).waitFor()
    const legacySharing = privacyRecoveryPage.getByRole('region', { name: 'Still shared outside groups' })
    const makePrivate = legacySharing.getByRole('button', { name: 'Make this place private' })
    await makePrivate.click()
    const checkPrivacy = legacySharing.getByRole('button', { name: 'Check privacy' })
    await checkPrivacy.waitFor()
    await assertFocused(checkPrivacy, 'An ambiguous privacy response must focus its one exact recovery action.')
    assert(await privacyRecoveryPage.locator('.toast').count() === 0, 'Privacy recovery must dismiss an earlier tag Undo that could change the save underneath the exact check.')
    await legacySharing.getByRole('alert').getByText(
      'We couldn’t confirm whether older connection sharing was removed. Checking again can only repeat this same privacy change; it cannot remove the place from Keep or any group.',
      { exact: true },
    ).waitFor()
    const firstCommittedPrivacy = await privacyRecoveryPage.evaluate(() => ({
      signal: window.sessionStorage.getItem('__this_is_signal:group-mika:group-sunlight'),
      visibility: window.sessionStorage.getItem('__this_is_signal_visibility:group-mika:group-sunlight'),
    }))
    assert(
      firstCommittedPrivacy.signal && JSON.parse(firstCommittedPrivacy.signal).visibility === 'private',
      'The lost-response fixture must commit the exact private state before withholding confirmation.',
    )
    assert(firstCommittedPrivacy.visibility === 'private', 'The private visibility override must commit once before recovery.')
    assert(
      await privacyRecoveryPage.getByRole('group', { name: 'Save as' }).locator('button:enabled').count() === 0,
      'Taste changes must pause while legacy privacy is unconfirmed.',
    )
    assert(await privacyRecoveryPage.getByRole('button', { name: 'Edit' }).isDisabled(), 'Place-memory editing must pause during privacy recovery.')
    assert(await privacyRecoveryPage.getByRole('textbox', { name: 'A note shared with legacy connections' }).isDisabled(), 'Note editing must pause during privacy recovery.')
    assert(await privacyRecoveryPage.getByRole('button', { name: 'Remove from Keep' }).isDisabled(), 'Removal must pause so exact privacy recovery remains possible.')
    assert(
      await privacyRecoveryPage.locator('.group-share-item button:enabled').count() === 0,
      'Group projection changes must pause while personal legacy visibility is unconfirmed.',
    )
    await assertNoHorizontalOverflow(privacyRecoveryPage, '390×844 personal privacy response recovery')
    await privacyRecoveryPage.screenshot({ path: path.join(artifactDir, 'group-ui-keep-privacy-recovery-mobile.png'), fullPage: true })
    await checkPrivacy.click()
    await legacySharing.waitFor({ state: 'detached' })
    await privacyRecoveryPage.getByRole('textbox', { name: 'A private note' }).waitFor()
    const confirmedPrivacy = await privacyRecoveryPage.evaluate(() => ({
      signal: window.sessionStorage.getItem('__this_is_signal:group-mika:group-sunlight'),
      visibility: window.sessionStorage.getItem('__this_is_signal_visibility:group-mika:group-sunlight'),
    }))
    assert(
      confirmedPrivacy.signal === firstCommittedPrivacy.signal && confirmedPrivacy.visibility === firstCommittedPrivacy.visibility,
      'Checking the exact privacy change must be a byte-stable no-op after the first commit.',
    )
    assert(privacyRecoveryErrors.length === 0, `Keep privacy recovery browser errors: ${privacyRecoveryErrors.join(' | ')}`)
  } finally {
    await privacyRecoveryContext.close()
  }

  const keepWriteRecoveryContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const keepWriteRecoveryPage = await keepWriteRecoveryContext.newPage()
  const keepWriteRecoveryErrors = []
  keepWriteRecoveryPage.on('console', message => {
    if (message.type() === 'error') keepWriteRecoveryErrors.push(message.text())
  })
  keepWriteRecoveryPage.on('pageerror', error => keepWriteRecoveryErrors.push(error.message))
  try {
    await keepWriteRecoveryPage.goto(`${origin}/p/group-sunlight?prototype=group&failure=keep-tag-response`, { waitUntil: 'networkidle' })
    const recoverySaveAs = keepWriteRecoveryPage.getByRole('group', { name: 'Save as' })
    await recoverySaveAs.getByRole('button', { name: 'loved' }).click()
    const tagRecovery = keepWriteRecoveryPage.getByRole('alert', { name: 'Keep change not confirmed' })
    const checkLoved = tagRecovery.getByRole('button', { name: 'Check loved' })
    await checkLoved.waitFor()
    await assertFocused(checkLoved, 'A lost Keep-tag response must focus its exact check action.')
    await tagRecovery.getByText(
      'We couldn’t confirm whether Sunlight Coffee changed to loved. Checking again can only repeat that exact choice; it cannot share the place with a new group or change another place.',
      { exact: true },
    ).waitFor()
    assert(await recoverySaveAs.getByRole('button', { name: 'want' }).getAttribute('aria-pressed') === 'true', 'An unconfirmed tag response must not optimistically relabel the visible Keep state.')
    const committedLoved = await keepWriteRecoveryPage.evaluate(() => window.sessionStorage.getItem('__this_is_signal:group-mika:group-sunlight'))
    assert(committedLoved && JSON.parse(committedLoved).tag === 'loved', 'The tag recovery fixture must commit Loved before withholding its response.')
    assert(await recoverySaveAs.locator('button:enabled').count() === 0, 'Competing taste changes must pause during exact tag recovery.')
    assert(await keepWriteRecoveryPage.getByRole('button', { name: 'Edit' }).isDisabled(), 'Memory editing must pause during exact tag recovery.')
    assert(await keepWriteRecoveryPage.getByRole('button', { name: 'Make this place private' }).isDisabled(), 'Privacy cleanup must pause during exact tag recovery.')
    assert(await keepWriteRecoveryPage.getByRole('textbox', { name: 'A note shared with legacy connections' }).isDisabled(), 'Note editing must pause during exact tag recovery.')
    assert(await keepWriteRecoveryPage.getByRole('button', { name: 'Remove from Keep' }).isDisabled(), 'Removal must pause during exact tag recovery.')
    assert(await keepWriteRecoveryPage.locator('.group-share-item button:enabled').count() === 0, 'Group sharing must pause during exact tag recovery.')
    await assertNoHorizontalOverflow(keepWriteRecoveryPage, '390×844 Keep tag response recovery')
    await keepWriteRecoveryPage.screenshot({ path: path.join(artifactDir, 'group-ui-keep-tag-recovery-mobile.png'), fullPage: true })
    await checkLoved.click()
    await tagRecovery.waitFor({ state: 'detached' })
    assert(await recoverySaveAs.getByRole('button', { name: 'loved' }).getAttribute('aria-pressed') === 'true', 'Exact tag recovery must reveal the committed Loved state once.')
    const confirmedLoved = await keepWriteRecoveryPage.evaluate(() => window.sessionStorage.getItem('__this_is_signal:group-mika:group-sunlight'))
    assert(confirmedLoved === committedLoved, 'Checking the exact tag must preserve the first commit timestamp and stored bytes.')

    await keepWriteRecoveryPage.evaluate(() => {
      window.history.pushState({}, '', '/p/group-sunlight?prototype=group&failure=keep-memory-response')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await keepWriteRecoveryPage.getByRole('button', { name: 'Edit' }).click()
    const areaInput = keepWriteRecoveryPage.getByRole('textbox', { name: 'Area for this place' })
    await areaInput.fill('Cresskill, NJ')
    await keepWriteRecoveryPage.getByRole('button', { name: 'Save place details' }).click()
    const memoryRecovery = keepWriteRecoveryPage.getByRole('alert', { name: 'Place details not confirmed' })
    const checkDetails = memoryRecovery.getByRole('button', { name: 'Check details' })
    await keepWriteRecoveryPage.waitForTimeout(500)
    if (await checkDetails.count() === 0) {
      throw new Error(`Place-memory recovery did not render at ${keepWriteRecoveryPage.url()}: ${await keepWriteRecoveryPage.locator('body').innerText()}`)
    }
    await checkDetails.waitFor()
    await assertFocused(checkDetails, 'A lost place-memory response must focus its exact check action.')
    await memoryRecovery.getByText('We couldn’t confirm the reviewed label, kind, and area for Sunlight Coffee.', { exact: false }).waitFor()
    assert(await areaInput.isDisabled(), 'The exact reviewed place details must freeze while their response is unconfirmed.')
    assert(await areaInput.inputValue() === 'Cresskill, NJ', 'Place-detail recovery must preserve the exact reviewed area.')
    const committedMemory = await keepWriteRecoveryPage.evaluate(() => window.sessionStorage.getItem('__this_is_signal:group-mika:group-sunlight'))
    assert(committedMemory && JSON.parse(committedMemory).memory?.area === 'Cresskill, NJ', 'The place-memory fixture must commit the reviewed area before withholding its response.')
    assert(JSON.parse(committedMemory).ts === JSON.parse(committedLoved).ts, 'Editing place details must not refresh taste evidence during an ambiguous response.')
    await keepWriteRecoveryPage.screenshot({ path: path.join(artifactDir, 'group-ui-keep-memory-recovery-mobile.png'), fullPage: true })
    await checkDetails.click()
    await memoryRecovery.waitFor({ state: 'detached' })
    await keepWriteRecoveryPage.getByText('coffee · Cresskill, NJ · user-confirmed', { exact: true }).waitFor()
    const confirmedMemory = await keepWriteRecoveryPage.evaluate(() => window.sessionStorage.getItem('__this_is_signal:group-mika:group-sunlight'))
    assert(confirmedMemory === committedMemory, 'Checking exact place details must not rewrite the first committed memory.')

    await keepWriteRecoveryPage.evaluate(() => {
      window.history.pushState({}, '', '/p/group-sunlight?prototype=group&failure=keep-note-response')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    const noteInput = keepWriteRecoveryPage.getByRole('textbox', { name: 'A note shared with legacy connections' })
    await noteInput.fill('Order the cardamom bun after practice.')
    await noteInput.press('Tab')
    const noteRecovery = keepWriteRecoveryPage.getByRole('alert', { name: 'Private note not confirmed' })
    const checkNote = noteRecovery.getByRole('button', { name: 'Check note' })
    await checkNote.waitFor()
    await assertFocused(checkNote, 'A lost private-note response must focus its exact check action.')
    assert(await noteInput.isDisabled(), 'The exact note must freeze while its response is unconfirmed.')
    assert(await noteInput.inputValue() === 'Order the cardamom bun after practice.', 'Note recovery must preserve the exact reviewed text.')
    const committedNote = await keepWriteRecoveryPage.evaluate(() => window.sessionStorage.getItem('__this_is_signal:group-mika:group-sunlight'))
    assert(committedNote && JSON.parse(committedNote).note === 'Order the cardamom bun after practice.', 'The note fixture must commit exact text before withholding its response.')
    assert(JSON.parse(committedNote).ts === JSON.parse(committedLoved).ts, 'Editing a note must not refresh taste evidence.')
    await keepWriteRecoveryPage.screenshot({ path: path.join(artifactDir, 'group-ui-keep-note-recovery-mobile.png'), fullPage: true })
    await checkNote.click()
    await noteRecovery.waitFor({ state: 'detached' })
    const confirmedNote = await keepWriteRecoveryPage.evaluate(() => window.sessionStorage.getItem('__this_is_signal:group-mika:group-sunlight'))
    assert(confirmedNote === committedNote, 'Checking the exact note must be a byte-stable no-op after commit.')

    await keepWriteRecoveryPage.evaluate(() => {
      window.history.pushState({}, '', '/p/group-sunlight?prototype=group&failure=keep-observation-response')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await keepWriteRecoveryPage.getByText('What would help your people choose?').click()
    const parkingDetail = keepWriteRecoveryPage.getByRole('group', { name: 'Easy parking' })
    await parkingDetail.getByRole('button', { name: 'No' }).click()
    const observationRecovery = keepWriteRecoveryPage.getByRole('alert', { name: 'Useful detail not confirmed' })
    const checkDetail = observationRecovery.getByRole('button', { name: 'Check detail' })
    await checkDetail.waitFor()
    await assertFocused(checkDetail, 'A lost useful-detail response must focus its exact check action.')
    await observationRecovery.getByText('We couldn’t confirm Easy parking → No.', { exact: false }).waitFor()
    assert(await parkingDetail.getByRole('button', { name: 'No' }).getAttribute('aria-pressed') === 'false', 'An unconfirmed useful detail must roll back to the last confirmed visible choice.')
    const committedObservation = await keepWriteRecoveryPage.evaluate(() => window.sessionStorage.getItem('__this_is_signal:group-mika:group-sunlight'))
    assert(committedObservation && JSON.parse(committedObservation).observations?.easy_parking?.value === 'no', 'The useful-detail fixture must commit No before withholding its response.')
    assert(JSON.parse(committedObservation).ts === JSON.parse(committedLoved).ts, 'Editing a useful detail must not refresh taste evidence.')
    await keepWriteRecoveryPage.screenshot({ path: path.join(artifactDir, 'group-ui-keep-detail-recovery-mobile.png'), fullPage: true })
    await checkDetail.click()
    await observationRecovery.waitFor({ state: 'detached' })
    assert(await parkingDetail.getByRole('button', { name: 'No' }).getAttribute('aria-pressed') === 'true', 'Exact detail recovery must reveal the committed No choice.')
    const confirmedObservation = await keepWriteRecoveryPage.evaluate(() => window.sessionStorage.getItem('__this_is_signal:group-mika:group-sunlight'))
    assert(confirmedObservation === committedObservation, 'Checking the exact useful detail must not rewrite its first commit.')

    await keepWriteRecoveryPage.evaluate(() => {
      window.history.pushState({}, '', '/p/group-sunlight?prototype=group&failure=keep-remove-response')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await keepWriteRecoveryPage.getByRole('button', { name: 'Remove from Keep' }).click()
    const removalRecovery = keepWriteRecoveryPage.getByRole('alert', { name: 'Keep removal not confirmed' })
    const checkRemoval = removalRecovery.getByRole('button', { name: 'Check removal' })
    await checkRemoval.waitFor()
    await assertFocused(checkRemoval, 'A lost Keep-removal response must focus its exact check action.')
    await removalRecovery.getByText(
      'We couldn’t confirm whether Sunlight Coffee was removed. Checking again can only finish removing this place from Keep and its existing group shares; it cannot remove another place or group membership.',
      { exact: true },
    ).waitFor()
    assert(await keepWriteRecoveryPage.evaluate(() => window.sessionStorage.getItem('__this_is_signal:group-mika:group-sunlight')) === null, 'The removal recovery fixture must delete the personal save before withholding its response.')
    assert(await recoverySaveAs.getByRole('button', { name: 'loved' }).getAttribute('aria-pressed') === 'true', 'An unconfirmed removal must not claim the visible Keep memory is already gone.')
    assert(await keepWriteRecoveryPage.getByRole('button', { name: 'Remove from Keep' }).isDisabled(), 'A fresh second deletion must not appear during removal recovery.')
    await assertNoHorizontalOverflow(keepWriteRecoveryPage, '390×844 Keep removal response recovery')
    await keepWriteRecoveryPage.screenshot({ path: path.join(artifactDir, 'group-ui-keep-remove-recovery-mobile.png'), fullPage: true })
    await checkRemoval.click()
    await removalRecovery.waitFor({ state: 'detached' })
    assert(await keepWriteRecoveryPage.locator('.closeup-personal-memory').count() === 0, 'Exact removal recovery must remove the personal memory once confirmed.')
    assert(await keepWriteRecoveryPage.locator('.group-signal-sharing').count() === 0, 'Confirmed canonical deletion must remove its exact group-sharing controls too.')
    assert(await keepWriteRecoveryPage.evaluate(() => window.sessionStorage.getItem('__this_is_signal:group-mika:group-sunlight')) === null, 'Checking deletion must leave the already-absent save absent.')
    assert(keepWriteRecoveryErrors.length === 0, `Keep tag/removal recovery browser errors: ${keepWriteRecoveryErrors.join(' | ')}`)
  } finally {
    await keepWriteRecoveryContext.close()
  }

  const keepCaptureRecoveryContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const keepCaptureRecoveryPage = await keepCaptureRecoveryContext.newPage()
  const keepCaptureRecoveryErrors = []
  keepCaptureRecoveryPage.on('console', message => {
    if (message.type() === 'error') keepCaptureRecoveryErrors.push(message.text())
  })
  keepCaptureRecoveryPage.on('pageerror', error => keepCaptureRecoveryErrors.push(error.message))
  try {
    await keepCaptureRecoveryPage.goto(`${origin}/add?group=prototype-zero-history&prototype=group&failure=keep-tag-response`, { waitUntil: 'networkidle' })
    const category = keepCaptureRecoveryPage.getByRole('group', { name: 'What kind of place is it?' })
    await category.getByRole('button', { name: 'Coffee' }).click()
    const experience = keepCaptureRecoveryPage.getByRole('group', { name: 'Keep this place as' })
    await experience.getByRole('button', { name: 'Loved' }).click()
    await keepCaptureRecoveryPage.getByRole('button', { name: 'Keep & share as Loved' }).click()
    const keepRecoveryAudience = await inspectGroupAudienceConfirmation(keepCaptureRecoveryPage, {
      memberNames: ['Mika', 'Vivian'],
    })
    assert(
      await keepCaptureRecoveryPage.evaluate(() => window.sessionStorage.getItem('__this_is_signal:group-mika:g:prototype-memory')) === null,
      'The first unlocked-group click must not write private Keep before the exact circle is confirmed.',
    )
    await keepRecoveryAudience.commit.click()
    const captureRecovery = keepCaptureRecoveryPage.getByRole('alert', { name: 'Keep save not confirmed' })
    const checkKeep = captureRecovery.getByRole('button', { name: 'Check Keep' })
    await checkKeep.waitFor()
    await assertFocused(checkKeep, 'A lost new-Keep response must focus its exact private-save check.')
    await captureRecovery.getByText('It does not share with Empty Table yet; that is the next separate step.', { exact: false }).waitFor()
    const committedCapture = await keepCaptureRecoveryPage.evaluate(() => window.sessionStorage.getItem('__this_is_signal:group-mika:g:prototype-memory'))
    assert(committedCapture && JSON.parse(committedCapture).tag === 'loved', 'New capture must commit the exact private Loved memory before withholding its response.')
    assert(await keepCaptureRecoveryPage.getByRole('textbox', { name: 'Your label for this place' }).isDisabled(), 'The reviewed label must freeze during new-Keep recovery.')
    assert(await category.locator('button:enabled').count() === 0, 'The reviewed place kind must freeze during new-Keep recovery.')
    assert(await experience.locator('button:enabled').count() === 0, 'The reviewed experience must freeze during new-Keep recovery.')
    assert(await keepCaptureRecoveryPage.getByText('Nothing honest yet.').count() === 0, 'An ambiguous private save must not advance to a fabricated group result.')
    await assertNoHorizontalOverflow(keepCaptureRecoveryPage, '390×844 new Keep capture response recovery')
    await keepCaptureRecoveryPage.screenshot({ path: path.join(artifactDir, 'group-ui-keep-capture-recovery-mobile.png'), fullPage: true })
    await checkKeep.click()
    await keepCaptureRecoveryPage.waitForURL(/\/g\/prototype-zero-history$/)
    await keepCaptureRecoveryPage.getByRole('heading', { name: 'One place. A real reason.' }).waitFor()
    await keepCaptureRecoveryPage.locator('.group-candidate-card').getByText('coffee after practice', { exact: true }).waitFor()
    const confirmedCapture = await keepCaptureRecoveryPage.evaluate(() => window.sessionStorage.getItem('__this_is_signal:group-mika:g:prototype-memory'))
    assert(confirmedCapture === committedCapture, 'Checking new Keep must preserve its first timestamp before the separate group share runs.')
    assert(keepCaptureRecoveryErrors.length === 0, `New Keep capture recovery browser errors: ${keepCaptureRecoveryErrors.join(' | ')}`)
  } finally {
    await keepCaptureRecoveryContext.close()
  }

  const onboardingKeepRecoveryContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  await onboardingKeepRecoveryContext.addInitScript(() => {
    window.sessionStorage.setItem('__this_is_signal:group-mika:g:prototype-onboarding', JSON.stringify({
      id: 'group-mika__g:prototype-onboarding',
      uid: 'group-mika',
      placeId: 'g:prototype-onboarding',
      tag: 'want',
      visibility: 'circle',
      ts: 1,
      memory: {
        placeId: 'g:prototype-onboarding',
        label: 'Legacy connection-visible label',
        category: 'coffee',
        hex: '#704739',
        provenance: 'user_confirmed',
      },
    }))
  })
  const onboardingKeepRecoveryPage = await onboardingKeepRecoveryContext.newPage()
  const onboardingKeepRecoveryErrors = []
  onboardingKeepRecoveryPage.on('console', message => {
    if (message.type() === 'error') onboardingKeepRecoveryErrors.push(message.text())
  })
  onboardingKeepRecoveryPage.on('pageerror', error => onboardingKeepRecoveryErrors.push(error.message))
  try {
    await onboardingKeepRecoveryPage.goto(`${origin}/onboarding?prototype=group&failure=keep-tag-response`, { waitUntil: 'networkidle' })
    const nameInput = onboardingKeepRecoveryPage.getByRole('textbox', { name: 'Your name' })
    if (!(await nameInput.inputValue()).trim()) await nameInput.fill('Mika')
    await onboardingKeepRecoveryPage.getByRole('button', { name: 'Next' }).click()
    await onboardingKeepRecoveryPage.getByRole('heading', { name: 'Keep one place you already love.' }).waitFor()
    await onboardingKeepRecoveryPage.getByRole('group', { name: 'What kind of place is it?' }).getByRole('button', { name: 'Coffee' }).click()
    await onboardingKeepRecoveryPage.getByRole('button', { name: 'Keep as Loved' }).click()
    const onboardingRecovery = onboardingKeepRecoveryPage.getByRole('alert', { name: 'Onboarding Keep save not confirmed' })
    const checkOnboardingKeep = onboardingRecovery.getByRole('button', { name: 'Check Keep' })
    await checkOnboardingKeep.waitFor()
    await assertFocused(checkOnboardingKeep, 'Onboarding must focus the exact private-Keep check after a lost response.')
    const committedOnboarding = await onboardingKeepRecoveryPage.evaluate(() => window.sessionStorage.getItem('__this_is_signal:group-mika:g:prototype-onboarding'))
    const committedOnboardingSignal = JSON.parse(committedOnboarding ?? '{}')
    assert(committedOnboardingSignal.tag === 'loved', 'Onboarding must commit the exact Loved memory before withholding its response.')
    assert(committedOnboardingSignal.visibility === 'private',
      'Onboarding capture must override a colliding legacy connection-visible save to private.')
    assert(await onboardingKeepRecoveryPage.getByRole('textbox', { name: 'Your label for this place' }).isDisabled(), 'Onboarding must freeze the reviewed memory during recovery.')
    await assertNoHorizontalOverflow(onboardingKeepRecoveryPage, '390×844 onboarding Keep response recovery')
    await onboardingKeepRecoveryPage.screenshot({ path: path.join(artifactDir, 'group-ui-onboarding-keep-recovery-mobile.png'), fullPage: true })
    await checkOnboardingKeep.click()
    await onboardingRecovery.waitFor({ state: 'detached' })
    await onboardingKeepRecoveryPage.getByText('1 saved', { exact: true }).waitFor()
    const confirmedOnboarding = await onboardingKeepRecoveryPage.evaluate(() => window.sessionStorage.getItem('__this_is_signal:group-mika:g:prototype-onboarding'))
    assert(confirmedOnboarding === committedOnboarding, 'Checking onboarding Keep must preserve its first committed bytes.')
    assert(onboardingKeepRecoveryErrors.length === 0, `Onboarding Keep recovery browser errors: ${onboardingKeepRecoveryErrors.join(' | ')}`)
  } finally {
    await onboardingKeepRecoveryContext.close()
  }

  const toastKeepRecoveryContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const toastKeepRecoveryPage = await toastKeepRecoveryContext.newPage()
  const toastKeepRecoveryErrors = []
  toastKeepRecoveryPage.on('console', message => {
    if (message.type() === 'error') toastKeepRecoveryErrors.push(message.text())
  })
  toastKeepRecoveryPage.on('pageerror', error => toastKeepRecoveryErrors.push(error.message))
  try {
    await toastKeepRecoveryPage.goto(`${origin}/p/group-sunlight?prototype=group`, { waitUntil: 'networkidle' })
    const saveAs = toastKeepRecoveryPage.getByRole('group', { name: 'Save as' })
    await saveAs.getByRole('button', { name: 'loved' }).click()
    const toastTagChoices = toastKeepRecoveryPage.getByRole('group', { name: 'Change tag' })
    await toastTagChoices.waitFor()
    await toastKeepRecoveryPage.evaluate(() => {
      window.history.pushState({}, '', '/p/group-sunlight?prototype=group&failure=keep-tag-response')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await toastTagChoices.getByRole('button', { name: 'tried' }).click()
    const toastRecovery = toastKeepRecoveryPage.getByRole('alert', { name: 'Toast Keep change not confirmed' })
    const checkToastKeep = toastRecovery.getByRole('button', { name: 'Check Keep' })
    await checkToastKeep.waitFor()
    await assertFocused(checkToastKeep, 'A lost toast retag response must focus its exact check action.')
    assert(await saveAs.getByRole('button', { name: 'loved' }).getAttribute('aria-pressed') === 'true', 'Toast retag recovery must retain the last confirmed page state.')
    const committedToastTag = await toastKeepRecoveryPage.evaluate(() => window.sessionStorage.getItem('__this_is_signal:group-mika:group-sunlight'))
    assert(committedToastTag && JSON.parse(committedToastTag).tag === 'tried', 'Toast retag must commit Tried before withholding its response.')
    await checkToastKeep.click()
    await toastRecovery.waitFor({ state: 'detached' })
    await saveAs.locator('button[aria-pressed="true"]', { hasText: 'tried' }).waitFor()
    assert(await saveAs.getByRole('button', { name: 'tried' }).getAttribute('aria-pressed') === 'true', 'Exact toast recovery must reveal Tried once confirmed.')
    const confirmedToastTag = await toastKeepRecoveryPage.evaluate(() => window.sessionStorage.getItem('__this_is_signal:group-mika:group-sunlight'))
    assert(confirmedToastTag === committedToastTag, 'Checking the toast retag must preserve its first committed bytes.')
    assert(toastKeepRecoveryErrors.length === 0, `Toast Keep recovery browser errors: ${toastKeepRecoveryErrors.join(' | ')}`)
  } finally {
    await toastKeepRecoveryContext.close()
  }

  const captureContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const capturePage = await captureContext.newPage()
  const captureErrors = []
  capturePage.on('console', message => {
    if (message.type() === 'error') captureErrors.push(message.text())
  })
  capturePage.on('pageerror', error => captureErrors.push(error.message))
  try {
    await capturePage.goto(`${origin}/add?prototype=group&failure=place-memory`, { waitUntil: 'networkidle' })
    await capturePage.getByRole('heading', { name: 'What do you call this place?' }).waitFor()
    await capturePage.getByText('Google Maps place: Juniper Cafe').waitFor()
    await capturePage.getByText('Your own short label stays with your taste history. Google’s place facts do not.').waitFor()
    const personalLabel = capturePage.getByRole('textbox', { name: 'Your label for this place' })
    assert(await personalLabel.inputValue() === 'coffee after practice', 'Capture fixture must begin with the person’s own editable label.')
    await capturePage.getByText('PLACE KIND', { exact: true }).waitFor()
    await capturePage.getByText('Choose one broad kind so it can fit a future plan.', { exact: true }).waitFor()
    const initialSaveAction = capturePage.getByRole('button', { name: 'Choose Want, Tried, or Loved' })
    assert(await initialSaveAction.isDisabled(), 'Capture must not silently treat Other as a confirmed place kind.')
    assert(
      await capturePage.getByRole('group', { name: 'What kind of place is it?' }).locator('[aria-pressed="true"]').count() === 0,
      'A new provider result must begin without a fabricated category choice.',
    )
    const optionalArea = capturePage.locator('details.place-memory-area-disclosure')
    assert(await optionalArea.getAttribute('open') === null, 'Optional area must not lead new place capture ahead of truthful experience.')
    assert(await capturePage.getByRole('textbox', { name: 'Area for this place' }).count() === 0, 'Collapsed optional area must remove its input from the initial capture tab order.')
    await capturePage.screenshot({ path: path.join(artifactDir, 'group-ui-place-kind-required-mobile.png'), fullPage: true })
    await optionalArea.getByText('OPTIONAL PLACE DETAIL', { exact: true }).click()
    await capturePage.getByRole('textbox', { name: 'Area for this place' }).fill('North Jersey')
    await capturePage.getByText('It never becomes your home or a location profile.', { exact: false }).waitFor()
    const coffeeCategory = capturePage.getByRole('group', { name: 'What kind of place is it?' }).getByRole('button', { name: 'Coffee' })
    await coffeeCategory.click()
    await coffeeCategory.waitFor()
    assert(await coffeeCategory.getAttribute('aria-pressed') === 'true', 'The capture artifact must show the confirmed Coffee category.')
    assert(await initialSaveAction.isDisabled(), 'Place kind alone must not fabricate future intent or past experience.')
    const experience = capturePage.getByRole('group', { name: 'Keep this place as' })
    const wantExperience = experience.getByRole('button', { name: 'Want' })
    const triedExperience = experience.getByRole('button', { name: 'Tried' })
    const lovedExperience = experience.getByRole('button', { name: 'Loved' })
    assert(
      await experience.locator('[aria-pressed="true"]').count() === 0,
      'Ordinary capture must begin without fabricating Want, Tried, or Loved.',
    )
    assert(await wantExperience.getAttribute('aria-pressed') === 'false', 'Want must wait for the person’s explicit choice.')
    await capturePage.getByText('Choose the closest truth. Nothing is saved yet.', { exact: true }).waitFor()
    await triedExperience.click()
    await capturePage.getByText('You have been, but this alone does not support choosing it.', { exact: true }).waitFor()
    await lovedExperience.click()
    await capturePage.getByText('You would return or recommend it. This is the strongest support.', { exact: true }).waitFor()
    assert(await lovedExperience.getAttribute('aria-pressed') === 'true', 'A person must be able to record Loved during capture instead of correcting it later.')
    const lovedSaveAction = capturePage.getByRole('button', { name: 'Keep privately as Loved' })
    assert(await lovedSaveAction.isEnabled(), 'A deliberate experience choice must complete the truthful capture fields.')
    await lovedSaveAction.evaluate(element => element.scrollIntoView({ block: 'center' }))
    await capturePage.evaluate(() => new Promise(resolve => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))
    }))
    const dockBox = await capturePage.getByRole('navigation', { name: 'Primary' }).boundingBox()
    const actionBox = await lovedSaveAction.boundingBox()
    assert(
      Boolean(dockBox && actionBox && actionBox.y + actionBox.height <= dockBox.y - 12),
      'The chosen experience action must scroll fully above the fixed dock at 390×844.',
    )
    await capturePage.screenshot({ path: path.join(artifactDir, 'group-ui-place-experience-mobile.png') })
    await capturePage.evaluate(() => new Promise(resolve => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))
    }))
    await assertNoHorizontalOverflow(capturePage, '390×844 user-confirmed place area')
    await capturePage.screenshot({ path: path.join(artifactDir, 'group-ui-place-area-confirmation-mobile.png'), fullPage: true })
    await lovedSaveAction.click()
    const capturedSignal = await capturePage.evaluate(() => {
      const value = window.sessionStorage.getItem('__this_is_signal:group-mika:g:prototype-memory')
      return value ? JSON.parse(value) : null
    })
    assert(capturedSignal?.visibility === 'private', 'A newly captured personal place must default to private.')
    assert(capturedSignal?.tag === 'loved', 'Ordinary capture must persist the explicitly chosen Loved experience.')
    await capturePage.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'KEEP' }).click()
    await capturePage.getByText('6 PLACES', { exact: true }).waitFor()
    await capturePage.getByRole('tablist', { name: 'Keep filter' }).getByRole('tab', { name: 'loved 1' }).click()
    const capturedKeepCard = capturePage.locator('.pin-card[aria-label="coffee after practice"]')
    await capturedKeepCard.waitFor()
    await capturedKeepCard.getByText('North Jersey', { exact: false }).waitFor()
    assert(
      await capturedKeepCard.getAttribute('href') === '/p/g%3Aprototype-memory',
      'Keep cards must be real links to the canonical memory route.',
    )
    assert(
      await capturePage.getByText('Juniper Cafe', { exact: true }).count() === 0,
      'Keep must render the confirmed personal label rather than the Google result label.',
    )
    await capturePage.screenshot({
      path: path.join(artifactDir, 'group-ui-keep-personal-context-mobile.png'),
      fullPage: true,
    })
    await capturedKeepCard.click()
    await capturePage.getByRole('heading', { name: 'coffee after practice', level: 1 }).waitFor()
    assert(
      await capturePage.getByText('Juniper Cafe', { exact: true }).count() === 0,
      'Reopening a captured place must not resurrect the discarded Google label.',
    )
    assert(await capturePage.getByText('Your people', { exact: true }).count() === 0, 'Group-native capture must not offer the retired all-connections audience.')
    await capturePage.getByText('coffee · North Jersey · user-confirmed', { exact: true }).waitFor()
    await capturePage.locator('.toast').waitFor({ state: 'detached', timeout: 10_000 })
    const beforeMemoryEdit = await capturePage.evaluate(() => {
      const value = window.sessionStorage.getItem('__this_is_signal:group-mika:g:prototype-memory')
      return value ? JSON.parse(value) : null
    })
    await capturePage.getByRole('button', { name: 'Edit' }).click()
    await capturePage.waitForURL(/\/p\/g%3Aprototype-memory\?edit=details$/i)
    await capturePage.getByRole('heading', { name: 'What do you call this place?' }).waitFor()
    await capturePage.goBack()
    await capturePage.waitForURL(/\/p\/g(?::|%3A)prototype-memory$/i)
    await capturePage.getByText('coffee · North Jersey · user-confirmed', { exact: true }).waitFor()
    await capturePage.getByRole('navigation', { name: 'Primary' }).waitFor()
    await capturePage.getByRole('button', { name: 'Edit' }).click()
    await capturePage.waitForURL(/\/p\/g%3Aprototype-memory\?edit=details$/i)
    assert(await capturePage.getByRole('textbox', { name: 'Your label for this place' }).inputValue() === 'coffee after practice', 'Editing must preserve the personal label.')
    assert(await capturePage.getByRole('button', { name: 'Coffee' }).getAttribute('aria-pressed') === 'true', 'Editing must preserve the chosen category.')
    assert(await capturePage.getByRole('textbox', { name: 'A private note' }).count() === 0, 'Focused place-detail editing must hide unrelated note controls.')
    assert(await capturePage.getByText('SHARE WITH A GROUP', { exact: true }).count() === 0, 'Focused place-detail editing must hide unrelated sharing controls.')
    assert(await capturePage.getByRole('navigation', { name: 'Primary' }).count() === 0, 'Focused place-detail editing must remove the dock from its actions.')
    await capturePage.getByRole('textbox', { name: 'Area for this place' }).fill('Cresskill, NJ')
    const placeMemoryEditor = capturePage.locator('.place-memory-confirm')
    await placeMemoryEditor.scrollIntoViewIfNeeded()
    await placeMemoryEditor.screenshot({ path: path.join(artifactDir, 'group-ui-place-area-edit-mobile.png') })
    await capturePage.getByRole('button', { name: 'Save place details' }).click()
    await capturePage.waitForURL(/\/p\/g%3Aprototype-memory$/i)
    await capturePage.getByText('Place details updated.').waitFor()
    const afterMemoryEdit = await capturePage.evaluate(() => {
      const value = window.sessionStorage.getItem('__this_is_signal:group-mika:g:prototype-memory')
      return value ? JSON.parse(value) : null
    })
    assert(afterMemoryEdit?.memory?.area === 'Cresskill, NJ', 'A corrected area must replace only the durable place memory.')
    assert(afterMemoryEdit?.tag === beforeMemoryEdit?.tag && afterMemoryEdit?.ts === beforeMemoryEdit?.ts, 'Editing place facts must not refresh or change taste evidence.')
    assert(afterMemoryEdit?.visibility === beforeMemoryEdit?.visibility, 'Editing place facts must not widen visibility.')
    await capturePage.getByText('Only groups you choose below can see this place. Joining a group never exposes it.').waitFor()
    await capturePage.getByText('What would help your people choose?').click()
    const quietDetail = capturePage.getByRole('group', { name: 'Quiet enough to talk' })
    await quietDetail.getByRole('button', { name: 'Yes' }).click()
    await quietDetail.getByRole('button', { name: 'Yes' }).waitFor()
    const parkingDetail = capturePage.getByRole('group', { name: 'Easy parking' })
    await parkingDetail.getByRole('button', { name: 'No' }).click()
    await capturePage.locator('.place-observations [role="status"]').waitFor({ state: 'detached' })
    const observedSignal = await capturePage.evaluate(() => {
      const value = window.sessionStorage.getItem('__this_is_signal:group-mika:g:prototype-memory')
      return value ? JSON.parse(value) : null
    })
    assert(observedSignal?.observations?.quiet?.audience === 'private', 'Useful details must remain private in canonical Keep memory.')
    assert(observedSignal?.observations?.easy_parking?.value === 'no', 'Useful details must preserve explicit negative evidence instead of absence.')
    await assertNoHorizontalOverflow(capturePage, '390×844 private useful-details editor')
    await capturePage.locator('.toast').waitFor({ state: 'detached', timeout: 10_000 })
    const usefulDetailsPanel = capturePage.locator('.place-observations')
    await usefulDetailsPanel.scrollIntoViewIfNeeded()
    await usefulDetailsPanel.screenshot({ path: path.join(artifactDir, 'group-ui-useful-details-mobile.png') })
    const privateNote = capturePage.getByRole('textbox', { name: 'A private note' })
    await capturePage.getByText('What to order, when it works, or why you’d return.', { exact: false }).waitFor()
    await capturePage.getByText('candidate cards show at most 180 characters.', { exact: false }).waitFor()
    assert(await privateNote.getAttribute('maxlength') === '280', 'The practical note must enforce the canonical private-note limit before save.')
    await privateNote.fill('Order the cardamom bun after practice.')
    await capturePage.getByLabel('38 of 280 characters').waitFor()
    await capturePage.locator('.place-note-editor').screenshot({ path: path.join(artifactDir, 'group-ui-practical-note-mobile.png') })
    const emptyTableSharing = capturePage.locator('.group-share-item[aria-label="Empty Table sharing"]')
    await emptyTableSharing.getByRole('checkbox', { name: 'Include my current note with Empty Table' }).check()
    await emptyTableSharing.getByRole('checkbox', { name: 'Include my useful details with Empty Table' }).check()
    const fridayTableSharing = capturePage.locator('.group-share-item[aria-label="Friday Table sharing"]')
    assert(
      !await fridayTableSharing.getByRole('checkbox', { name: 'Include my current note with Friday Table' }).isChecked()
        && !await fridayTableSharing.getByRole('checkbox', { name: 'Include my useful details with Friday Table' }).isChecked(),
      'Included note and useful-detail choices must remain independent for each named group.',
    )
    const shareEmptyTable = capturePage.getByRole('button', { name: 'Share with Empty Table' })
    await shareEmptyTable.click()
    const explicitShareReview = await inspectGroupAudienceConfirmation(capturePage, {
      memberNames: ['Mika', 'Vivian'],
      includedCopy: 'This shares the reviewed place + current note + useful details. Everything else in your private Keep stays private.',
    })
    await explicitShareReview.commit.click()
    const stopSharingEmptyTable = emptyTableSharing.getByRole('button', { name: 'Stop sharing with Empty Table' })
    await stopSharingEmptyTable.waitFor()
    await emptyTableSharing.getByText('Shared · note + useful details included', { exact: true }).waitFor()
    assert(await stopSharingEmptyTable.textContent() === 'Stop sharing', 'A shared audience must expose its actual removal action instead of a misleading state label.')
    assert(
      await fridayTableSharing.getByText('Not shared with this group', { exact: true }).count() === 1,
      'Sharing with one group must not silently select another group.',
    )
    await capturePage.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'TOGETHER' }).click()
    await capturePage.getByRole('link', { name: /Empty Table/ }).click()
    try {
      await capturePage.getByRole('heading', { name: 'One place. A real reason.' }).waitFor()
    } catch (error) {
      await capturePage.screenshot({ path: path.join(artifactDir, 'group-ui-place-memory-resolution-failure.png'), fullPage: true })
      const visibleCopy = (await capturePage.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 700)
      throw new Error(`The confirmed Love did not resolve in Empty Table at ${capturePage.url()}. Visible copy: ${visibleCopy}`, { cause: error })
    }
    await capturePage.getByText('MEMBER INTRODUCTION · 1 OF 2', { exact: true }).waitFor()
    await capturePage.getByText('Why for us: Mika loved this; 1 person hasn’t weighed in.', { exact: true }).waitFor()
    await capturePage.getByText('coffee after practice', { exact: true }).waitFor()
    await capturePage.getByText('Cresskill, NJ', { exact: true }).waitFor()
    const candidateSources = capturePage.locator('details.candidate-sources').first()
    assert(await candidateSources.evaluate(element => !element.open), 'Card provenance must use progressive disclosure by default.')
    await candidateSources.locator('summary').click()
    await candidateSources.locator('.candidate-source-list span').filter({ hasText: 'Area · Confirmed by a group member' }).waitFor()
    await capturePage.getByText('“Order the cardamom bun after practice.”', { exact: true }).waitFor()
    await capturePage.getByText('— Mika', { exact: true }).waitFor()
    await capturePage.locator('.group-candidate-card').getByText('Quiet enough to talk', { exact: true }).waitFor()
    await capturePage.getByText('Mika: yes', { exact: true }).waitFor()
    await capturePage.locator('.group-candidate-card').getByText('Easy parking', { exact: true }).waitFor()
    await capturePage.getByText('Mika: no', { exact: true }).waitFor()
    await candidateSources.getByText('Details · Attributed member observations', { exact: true }).waitFor()
    await capturePage.getByRole('button', { name: 'Coffee', exact: true }).click()
    assert(
      await capturePage.getByRole('button', { name: 'Coffee', exact: true }).getAttribute('aria-pressed') === 'true',
      'The current plan context must remain explicit before discovery.',
    )
    const planDetails = capturePage.locator('.group-plan-details')
    assert(await planDetails.evaluate(element => !element.open), 'Optional plan details must start collapsed so candidates lead the default draft.')
    await planDetails.locator('summary').click()
    const planAreaInput = capturePage.getByRole('textbox', { name: 'Area for this plan' })
    assert(await planAreaInput.getAttribute('maxlength') === '80', 'Temporary plan geography must stay bounded.')
    await capturePage.getByText('Used for this draft only; never saved to a person or group.', { exact: false }).waitFor()
    await planAreaInput.fill('Piscataway')
    await capturePage.getByRole('heading', { name: 'No confirmed places match Piscataway.' }).waitFor()
    await capturePage.getByText('Places with no confirmed area stay unknown.', { exact: false }).waitFor()
    assert(await capturePage.locator('.group-candidate-card').count() === 0, 'A mismatched explicit plan area must not leak a candidate from another city.')
    await capturePage.screenshot({ path: path.join(artifactDir, 'group-ui-plan-area-empty-mobile.png'), fullPage: true })
    await capturePage.getByRole('button', { name: 'Clear area' }).click()
    await capturePage.getByText('coffee after practice', { exact: true }).waitFor()
    assert(await planAreaInput.inputValue() === '', 'Clearing temporary geography must immediately restore the unfiltered draft.')
    await planAreaInput.fill('Cresskill')
    await capturePage.getByText('coffee after practice', { exact: true }).waitFor()
    await capturePage.getByText('Showing only places whose member-confirmed area matches “Cresskill”; missing area stays unknown. No location profile.', { exact: false }).waitFor()
    await capturePage.getByRole('button', { name: 'Easy parking', exact: true }).click()
    await capturePage.getByRole('heading', { name: 'Nothing confirms Easy parking in Cresskill.' }).waitFor()
    await capturePage.getByText('This needs at least one attributed group-shared Yes and no conflicting No.', { exact: false }).waitFor()
    assert(await capturePage.locator('.group-candidate-card').count() === 0, 'A group-shared No must fail a temporary practical requirement closed.')
    await capturePage.getByRole('button', { name: 'Choose or find a place' }).click()
    await capturePage.getByRole('heading', { name: 'DISCOVER FOR EMPTY TABLE', level: 1 }).waitFor()
    assert(!new URL(capturePage.url()).searchParams.has('area'), 'Temporary plan geography must not be serialized into the discovery URL.')
    const continuedArea = capturePage.getByRole('textbox', { name: 'Area for discovery' })
    try {
      await capturePage.waitForFunction(() => {
        const input = document.querySelector('input[aria-label="Area for discovery"]')
        return input instanceof HTMLInputElement && input.value === 'Cresskill'
      }, undefined, { timeout: 5_000 })
    } catch (error) {
      await capturePage.screenshot({ path: path.join(artifactDir, 'group-ui-plan-continuity-failure.png'), fullPage: true })
      const visibleCopy = (await capturePage.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 1_000)
      throw new Error(`The temporary group plan did not reach discovery. Visible copy: ${visibleCopy}`, { cause: error })
    }
    assert(await continuedArea.inputValue() === 'Cresskill', 'Discovery must continue with the explicit temporary plan area.')
    const continuedCoffee = capturePage.locator('.personal-discovery-prompts').getByRole('button', { name: /Coffee/ })
    assert(
      await continuedCoffee.getAttribute('aria-pressed') === 'true',
      'Discovery must visibly suggest the matching explicit group-plan context without searching yet.',
    )
    await capturePage.getByText(/Coffee · Cresskill · Easy parking/, { exact: false }).waitFor()
    assert(await capturePage.locator('.add-suggestion').count() === 0, 'Continuing a group plan must not make a provider request before a person chooses a direction.')
    assert(await capturePage.getByText(/One Google search for/).count() === 0, 'A restored plan suggestion is not itself a Places search.')
    await capturePage.goBack({ waitUntil: 'networkidle' })
    await capturePage.waitForURL(/\/g\/prototype-zero-history(?:\?|$)/)
    try {
      await capturePage.getByText('Your temporary plan is back, recomputed from the group’s current shared taste.', { exact: true }).waitFor({ timeout: 5_000 })
    } catch (error) {
      await capturePage.screenshot({ path: path.join(artifactDir, 'group-ui-plan-return-failure.png'), fullPage: true })
      const visibleCopy = (await capturePage.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 1_000)
      throw new Error(`The temporary group plan did not return from discovery. Visible copy: ${visibleCopy}`, { cause: error })
    }
    await capturePage.getByRole('heading', { name: 'Nothing confirms Easy parking in Cresskill.' }).waitFor()
    await planDetails.locator('summary').click()
    assert(await planAreaInput.inputValue() === 'Cresskill', 'Returning from discovery must restore the temporary plan area.')
    assert(
      await capturePage.getByRole('button', { name: 'Coffee', exact: true }).getAttribute('aria-pressed') === 'true',
      'Returning from discovery must restore the explicit group-plan context.',
    )
    assert(
      await capturePage.getByRole('button', { name: 'Easy parking', exact: true }).getAttribute('aria-pressed') === 'true',
      'Returning from discovery must restore the temporary practical need.',
    )
    await capturePage.screenshot({ path: path.join(artifactDir, 'group-ui-plan-need-empty-mobile.png'), fullPage: true })
    await capturePage.getByRole('button', { name: 'Clear need' }).click()
    await capturePage.getByText('coffee after practice', { exact: true }).waitFor()
    await capturePage.getByRole('button', { name: 'Quiet enough to talk', exact: true }).click()
    await capturePage.getByText('coffee after practice', { exact: true }).waitFor()
    await capturePage.getByText('Requiring Quiet enough to talk from attributed group-shared details; disagreement fails closed.', { exact: false }).waitFor()
    assert(await capturePage.getByRole('button', { name: 'Quiet enough to talk', exact: true }).getAttribute('aria-pressed') === 'true', 'A qualifying temporary need must remain visibly selected.')
    await planDetails.locator('summary').click()
    await planDetails.getByText('Area: Cresskill · Need: Quiet enough to talk', { exact: true }).waitFor()
    await capturePage.locator('.toast').waitFor({ state: 'detached', timeout: 10_000 })
    await capturePage.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }))
    await capturePage.screenshot({ path: path.join(artifactDir, 'group-ui-explicit-share-mobile.png'), fullPage: true })

    await capturePage.getByRole('button', { name: '← BACK' }).click()
    await capturePage.getByRole('heading', { name: 'Who are we getting together?' }).waitFor()
    await capturePage.goBack({ waitUntil: 'networkidle' })
    await capturePage.getByRole('heading', { name: 'coffee after practice', level: 1 }).waitFor()
    assert(
      await capturePage.getByRole('textbox', { name: 'A private note' }).inputValue() === 'Order the cardamom bun after practice.',
      'Removing group sharing must not remove the canonical personal note.',
    )
    const retainedObservations = await capturePage.evaluate(() => {
      const value = window.sessionStorage.getItem('__this_is_signal:group-mika:g:prototype-memory')
      return value ? JSON.parse(value).observations : null
    })
    assert(retainedObservations?.quiet?.audience === 'private', 'Removing group sharing must preserve private useful details.')
    await emptyTableSharing.getByText('Shared · note + useful details included', { exact: true }).waitFor()
    await emptyTableSharing.getByRole('checkbox', { name: 'Include my current note with Empty Table' }).uncheck()
    await emptyTableSharing.getByRole('checkbox', { name: 'Include my useful details with Empty Table' }).uncheck()
    await emptyTableSharing.getByRole('button', { name: 'Update Empty Table: place only' }).click()
    await emptyTableSharing.getByText('Shared · place only', { exact: true }).waitFor()
    await emptyTableSharing.getByRole('checkbox', { name: 'Include my current note with Empty Table' }).check()
    await emptyTableSharing.getByRole('checkbox', { name: 'Include my useful details with Empty Table' }).check()
    await emptyTableSharing.getByRole('button', { name: 'Update Empty Table: note + useful details' }).click()
    await emptyTableSharing.getByText('Shared · note + useful details included', { exact: true }).waitFor()
    await capturePage.getByRole('button', { name: 'Stop sharing with Empty Table' }).click()
    await capturePage.getByRole('button', { name: 'Share with Empty Table' }).waitFor()
    await capturePage.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'TOGETHER' }).click()
    await capturePage.getByRole('link', { name: /Empty Table/ }).click()
    await capturePage.getByRole('heading', { name: 'Nothing honest fits yet.' }).waitFor()
    assert(await capturePage.locator('.group-candidate-card').count() === 0, 'Removing exact group sharing must remove only that group projection.')
    await assertNoHorizontalOverflow(capturePage, '390×844 confirmed place memory')
    await capturePage.screenshot({ path: path.join(artifactDir, 'group-ui-place-memory-mobile.png'), fullPage: true })
    assert(captureErrors.length === 0, `Place-memory browser errors: ${captureErrors.join(' | ')}`)
  } finally {
    await captureContext.close()
  }
}

async function openZeroHistoryWelcome(page) {
  await page.goto(`${origin}/g/prototype-zero-history?welcome=1&prototype=group`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Help this group learn what you like.' }).waitFor()
  await page.getByText('No place comes to mind? That’s fine. Choose one broad kind, add a place you already know, or skip. Nothing from your private Keep is shared automatically.').waitFor()
  await page.getByText('Can’t name a place? Choose Food, Coffee, or Things to do. Sharing a hint closes invitations.').waitFor()
  await page.getByText('Start with a private Want or Loved memory, search a temporary area, or name somewhere you know. Only the reviewed place can be shared; sharing closes invitations.').waitFor()
  await page.getByText('Share nothing yet. You can add taste later, and invitations stay open.').waitFor()
}

async function verifyGroupShareResponseTruth(browser) {
  const readContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const readPage = await readContext.newPage()
  const readErrors = []
  readPage.on('console', message => {
    if (message.type() === 'error') readErrors.push(message.text())
  })
  readPage.on('pageerror', error => readErrors.push(error.message))
  try {
    await readPage.goto(`${origin}/p/group-radio?prototype=group&failure=group-share-read`, { waitUntil: 'networkidle' })
    await readPage.getByRole('heading', { name: 'Radio Bakery', level: 1 }).waitFor()
    await readPage.getByRole('alert').getByText('Group sharing couldn’t be checked.', { exact: true }).waitFor()
    await readPage.getByText('No group is being labeled shared or not shared. Nothing was changed.', { exact: true }).waitFor()
    assert(await readPage.locator('.group-share-item').count() === 0, 'An unavailable group-share read must expose no fabricated per-group status.')
    assert(await readPage.getByRole('button', { name: /Share with|Stop sharing with/ }).count() === 0, 'An unavailable group-share read must expose no fresh sharing mutation.')
    await assertNoHorizontalOverflow(readPage, '390×844 unavailable group-share read')
    await readPage.screenshot({ path: path.join(artifactDir, 'group-ui-share-read-recovery-mobile.png'), fullPage: true })
    await readPage.getByRole('button', { name: 'Check sharing' }).click()
    await readPage.waitForURL(url => !url.searchParams.has('failure'))
    await readPage.locator('.group-share-item[aria-label="Friday Table sharing"]').getByText('Shared · place only', { exact: true }).waitFor()
    assert(readErrors.length === 0, `Group-share read recovery browser errors: ${readErrors.join(' | ')}`)
  } finally {
    await readContext.close()
  }

  const saveContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const savePage = await saveContext.newPage()
  const saveErrors = []
  savePage.on('console', message => {
    if (message.type() === 'error') saveErrors.push(message.text())
  })
  savePage.on('pageerror', error => saveErrors.push(error.message))
  try {
    await savePage.goto(`${origin}/p/group-radio?prototype=group&failure=group-share-save-response`, { waitUntil: 'networkidle' })
    const emptyTableSharing = savePage.locator('.group-share-item[aria-label="Empty Table sharing"]')
    await savePage.locator('.closeup-note').fill('Meet by the front window.')
    await emptyTableSharing.getByRole('checkbox', { name: 'Include my current note with Empty Table' }).check()
    await emptyTableSharing.getByRole('button', { name: 'Share with Empty Table' }).click()
    const firstPlaceReview = await inspectGroupAudienceConfirmation(savePage, {
      memberNames: ['Mika', 'Vivian'],
      includedCopy: 'This shares the reviewed place + current note. Everything else in your private Keep stays private.',
    })
    await firstPlaceReview.safeAction.click()
    await emptyTableSharing.getByText('Not shared with this group', { exact: true }).waitFor()
    assert(await emptyTableSharing.getByRole('button', { name: 'Share with Empty Table' }).isEnabled(), 'Canceling place audience review must not create or lock the projection.')
    await emptyTableSharing.getByRole('button', { name: 'Share with Empty Table' }).click()
    const lostPlaceReview = await inspectGroupAudienceConfirmation(savePage, {
      memberNames: ['Mika', 'Vivian'],
      includedCopy: 'This shares the reviewed place + current note. Everything else in your private Keep stays private.',
    })
    await lostPlaceReview.commit.click()
    await emptyTableSharing.getByText('Share status unknown', { exact: true }).waitFor()
    const checkSharing = emptyTableSharing.getByRole('button', { name: 'Check sharing with Empty Table' })
    await assertFocused(checkSharing, 'An ambiguous group share must focus its one exact recovery action.')
    await emptyTableSharing.getByRole('alert').getByText(/couldn’t confirm whether Radio Bakery was shared with Empty Table/).waitFor()
    assert(await emptyTableSharing.getByRole('button', { name: 'Share with Empty Table' }).count() === 0, 'An ambiguous group share must not remain a fresh Share action.')
    assert(await emptyTableSharing.getByRole('button', { name: 'Stop sharing with Empty Table' }).count() === 0, 'An ambiguous group share must not guess that the place is now shared.')
    assert(await savePage.locator('.group-share-update').count() === 0, 'Included-detail updates must stay frozen while one group share is unknown.')
    const fridayAction = savePage.locator('.group-share-item[aria-label="Friday Table sharing"]').getByRole('button').first()
    assert(await fridayAction.isDisabled(), 'Other group sharing actions must freeze until the exact uncertain share resolves.')
    await assertNoHorizontalOverflow(savePage, '390×844 ambiguous group share')
    await savePage.screenshot({ path: path.join(artifactDir, 'group-ui-share-save-recovery-mobile.png'), fullPage: true })
    await checkSharing.click()
    await emptyTableSharing.getByText('Shared · note included', { exact: true }).waitFor()
    await emptyTableSharing.getByRole('button', { name: 'Stop sharing with Empty Table' }).waitFor()
    assert(saveErrors.length === 0, `Group-share save recovery browser errors: ${saveErrors.join(' | ')}`)
  } finally {
    await saveContext.close()
  }

  const staleContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const stalePage = await staleContext.newPage()
  const staleErrors = []
  stalePage.on('console', message => {
    if (message.type() === 'error') staleErrors.push(message.text())
  })
  stalePage.on('pageerror', error => staleErrors.push(error.message))
  try {
    await stalePage.goto(`${origin}/p/group-supper-club?prototype=group&failure=group-share-audience-changed`, { waitUntil: 'networkidle' })
    const staleSharing = stalePage.locator('.group-share-item[aria-label="Empty Table sharing"]')
    await staleSharing.getByRole('checkbox', { name: 'Include my useful details with Empty Table' }).check()
    await staleSharing.getByRole('button', { name: 'Share with Empty Table' }).click()
    const stalePlaceReview = await inspectGroupAudienceConfirmation(stalePage, {
      memberNames: ['Mika', 'Vivian'],
      includedCopy: 'This shares the reviewed place + useful details. Everything else in your private Keep stays private.',
    })
    await stalePlaceReview.commit.click()
    const freshPlaceReview = await inspectGroupAudienceConfirmation(stalePage, {
      memberNames: ['Mika', 'Vivian', 'Ari'],
      includedCopy: 'This shares the reviewed place + useful details. Everything else in your private Keep stays private.',
    })
    await freshPlaceReview.dialog.getByText('SHARING CIRCLE CHANGED', { exact: true }).waitFor()
    await freshPlaceReview.dialog.getByText(/changed before this place could be confirmed/).waitFor()
    await stalePage.screenshot({ path: path.join(artifactDir, 'group-ui-audience-place-changed-mobile.png'), fullPage: true })
    await freshPlaceReview.commit.click()
    await staleSharing.getByText('Shared · useful details included', { exact: true }).waitFor()
    assert(staleErrors.length === 0, `Changed place-share audience browser errors: ${staleErrors.join(' | ')}`)
  } finally {
    await staleContext.close()
  }

  const updateContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const updatePage = await updateContext.newPage()
  const updateErrors = []
  updatePage.on('console', message => {
    if (message.type() === 'error') updateErrors.push(message.text())
  })
  updatePage.on('pageerror', error => updateErrors.push(error.message))
  try {
    await updatePage.goto(`${origin}/p/group-radio?prototype=group&failure=group-share-audience-changed`, { waitUntil: 'networkidle' })
    const brooklynSharing = updatePage.locator('.group-share-item[aria-label="Brooklyn Friends sharing"]')
    await updatePage.locator('.closeup-note').fill('Meet by the front window.')
    await brooklynSharing.getByRole('checkbox', { name: 'Include my current note with Brooklyn Friends' }).check()
    await brooklynSharing.getByRole('button', { name: 'Update Brooklyn Friends: note' }).click()
    const changedUpdateReview = await inspectGroupAudienceConfirmation(updatePage, {
      memberNames: ['Mika', 'Vivian', 'Ari', 'Dev', 'Lena'],
      invitationsOpen: false,
      safeLabel: 'Keep current sharing',
      commitLabel: 'Update included details for these 5',
      includedCopy: 'This shares the reviewed place + current note. Everything else in your private Keep stays private.',
    })
    await changedUpdateReview.dialog.getByText('SHARING CIRCLE CHANGED', { exact: true }).waitFor()
    await changedUpdateReview.dialog.getByText(/changed before the included-detail update could be confirmed/).waitFor()
    await changedUpdateReview.dialog.getByText(/place remains shared with its last confirmed details/).waitFor()
    await updatePage.screenshot({ path: path.join(artifactDir, 'group-ui-audience-update-changed-mobile.png'), fullPage: true })
    await changedUpdateReview.commit.click()
    await brooklynSharing.getByText('Shared · note included', { exact: true }).waitFor()
    assert(updateErrors.length === 0, `Changed included-detail audience browser errors: ${updateErrors.join(' | ')}`)
  } finally {
    await updateContext.close()
  }

  const removeContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const removePage = await removeContext.newPage()
  const removeErrors = []
  removePage.on('console', message => {
    if (message.type() === 'error') removeErrors.push(message.text())
  })
  removePage.on('pageerror', error => removeErrors.push(error.message))
  try {
    await removePage.goto(`${origin}/p/group-radio?prototype=group&failure=group-share-remove-response`, { waitUntil: 'networkidle' })
    const fridaySharing = removePage.locator('.group-share-item[aria-label="Friday Table sharing"]')
    await fridaySharing.getByRole('button', { name: 'Stop sharing with Friday Table' }).click()
    await fridaySharing.getByText('Share status unknown', { exact: true }).waitFor()
    const checkRemoval = fridaySharing.getByRole('button', { name: 'Check removal with Friday Table' })
    await assertFocused(checkRemoval, 'An ambiguous group-share removal must focus its one exact recovery action.')
    await fridaySharing.getByRole('alert').getByText(/same removal; it cannot remove the place from Keep or another group/).waitFor()
    assert(await fridaySharing.getByRole('button', { name: 'Stop sharing with Friday Table' }).count() === 0, 'An ambiguous removal must not remain a fresh Stop sharing action.')
    assert(await fridaySharing.getByRole('button', { name: 'Share with Friday Table' }).count() === 0, 'An ambiguous removal must not guess that sharing stopped.')
    await assertNoHorizontalOverflow(removePage, '390×844 ambiguous group-share removal')
    await removePage.screenshot({ path: path.join(artifactDir, 'group-ui-share-remove-recovery-mobile.png'), fullPage: true })
    await checkRemoval.click()
    await fridaySharing.getByText('Not shared with this group', { exact: true }).waitFor()
    await fridaySharing.getByRole('button', { name: 'Share with Friday Table' }).waitFor()
    assert(removeErrors.length === 0, `Group-share removal recovery browser errors: ${removeErrors.join(' | ')}`)
  } finally {
    await removeContext.close()
  }

  const addContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const addPage = await addContext.newPage()
  const addErrors = []
  addPage.on('console', message => {
    if (message.type() === 'error') addErrors.push(message.text())
  })
  addPage.on('pageerror', error => addErrors.push(error.message))
  try {
    await addPage.goto(`${origin}/add?group=prototype-zero-history&prototype=group&failure=add-group-share-response`, { waitUntil: 'networkidle' })
    await addPage.getByRole('button', { name: 'Coffee' }).click()
    await addPage.getByRole('group', { name: 'Keep this place as' }).getByRole('button', { name: 'Loved' }).click()
    await addPage.getByRole('button', { name: 'Keep & share as Loved' }).click()
    const addLostResponseReview = await inspectGroupAudienceConfirmation(addPage, {
      memberNames: ['Mika', 'Vivian'],
      includedCopy: 'Your private Keep stays private. Only this reviewed place is shared with the people above.',
    })
    await addLostResponseReview.commit.click()
    await addPage.getByRole('alert', { name: 'Group sharing not confirmed' }).waitFor()
    const checkAddSharing = addPage.getByRole('button', { name: 'Check sharing', exact: true })
    await assertFocused(checkAddSharing, 'Ambiguous Add sharing must focus its exact in-memory replay action.')
    const [checkAddSharingBox, addDockBox] = await Promise.all([
      checkAddSharing.boundingBox(),
      addPage.getByRole('navigation', { name: 'Primary' }).boundingBox(),
    ])
    assert(
      checkAddSharingBox && addDockBox
        && checkAddSharingBox.y + checkAddSharingBox.height <= addDockBox.y - 8,
      'The exact Add sharing recovery action must remain fully visible above the fixed dock.',
    )
    await addPage.getByText('Checking again can only repeat this exact share with the circle you reviewed. It will not rebuild the audience or change your private Keep.', { exact: true }).waitFor()
    assert(await addPage.getByRole('dialog', { name: 'Confirm sharing circle' }).count() === 0, 'An unchanged ambiguous Add replay must retain its original stamp instead of requesting a new audience review.')
    const personalSignal = await addPage.evaluate(() => {
      const value = window.sessionStorage.getItem('__this_is_signal:group-mika:g:prototype-memory')
      return value ? JSON.parse(value) : null
    })
    assert(personalSignal?.visibility === 'private' && personalSignal?.tag === 'loved', 'Ambiguous group delivery must not change the canonical private Keep result.')
    await assertNoHorizontalOverflow(addPage, '390×844 Add exact group-share recovery')
    await addPage.screenshot({ path: path.join(artifactDir, 'group-ui-add-share-response-recovery-mobile.png'), fullPage: true })
    await checkAddSharing.click()
    await addPage.waitForURL(/\/g\/prototype-zero-history$/)
    await addPage.getByText('SHARING CIRCLE · 2 PEOPLE', { exact: true }).waitFor()
    assert(addErrors.length === 0, `Add group-share handoff browser errors: ${addErrors.join(' | ')}`)
  } finally {
    await addContext.close()
  }

  const staleAddContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const staleAddPage = await staleAddContext.newPage()
  const staleAddErrors = []
  staleAddPage.on('console', message => {
    if (message.type() === 'error') staleAddErrors.push(message.text())
  })
  staleAddPage.on('pageerror', error => staleAddErrors.push(error.message))
  try {
    await staleAddPage.goto(`${origin}/add?group=prototype-zero-history&prototype=group&failure=add-group-audience-changed`, { waitUntil: 'networkidle' })
    await staleAddPage.getByRole('button', { name: 'Coffee' }).click()
    await staleAddPage.getByRole('group', { name: 'Keep this place as' }).getByRole('button', { name: 'Loved' }).click()
    await staleAddPage.getByRole('button', { name: 'Keep & share as Loved' }).click()
    const initialAddReview = await inspectGroupAudienceConfirmation(staleAddPage, {
      memberNames: ['Mika', 'Vivian'],
      includedCopy: 'Your private Keep stays private. Only this reviewed place is shared with the people above.',
    })
    await initialAddReview.commit.click()
    const changedAddReview = await inspectGroupAudienceConfirmation(staleAddPage, {
      memberNames: ['Mika', 'Vivian', 'Ari'],
      includedCopy: 'Your private Keep stays private. Only this reviewed place is shared with the people above.',
    })
    await changedAddReview.dialog.getByText('SHARING CIRCLE CHANGED', { exact: true }).waitFor()
    await changedAddReview.dialog.getByText(/This place is already in your private Keep/).waitFor()
    const privateSignal = await staleAddPage.evaluate(() => {
      const value = window.sessionStorage.getItem('__this_is_signal:group-mika:g:prototype-memory')
      return value ? JSON.parse(value) : null
    })
    assert(privateSignal?.visibility === 'private' && privateSignal?.tag === 'loved', 'A changed Add audience must retain the completed private Loved save while it waits for fresh group review.')
    await staleAddPage.screenshot({ path: path.join(artifactDir, 'group-ui-audience-add-private-saved-mobile.png'), fullPage: true })
    await changedAddReview.commit.click()
    await staleAddPage.waitForURL(/\/g\/prototype-zero-history$/)
    await staleAddPage.getByText('SHARING CIRCLE · 3 PEOPLE', { exact: true }).waitFor()
    assert(staleAddErrors.length === 0, `Changed Add audience browser errors: ${staleAddErrors.join(' | ')}`)
  } finally {
    await staleAddContext.close()
  }
}

async function verifyDraftPassResponseTruth(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const errors = []
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(`${origin}/g/prototype-evidence-lab?prototype=group&failure=draft-pass-save-response`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: 'Three places. Real reasons.' }).waitFor()
    await page.getByRole('button', { name: 'Not for us: Supper Club' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm pass' }).click()
    await page.getByRole('heading', { name: 'Pass status unknown.' }).waitFor()
    const checkPass = page.getByRole('button', { name: 'Check pass' })
    await assertFocused(checkPass, 'An ambiguous attributed pass must focus its exact Check pass action.')
    await page.getByText(/same attributed pass for the reviewed people and plan; it cannot change anyone’s Keep/).waitFor()
    assert(await page.getByRole('button', { name: 'Confirm pass' }).count() === 0, 'An ambiguous pass must not retain a fresh confirmation action.')
    assert(await page.getByRole('button', { name: 'Guest' }).isDisabled(), 'Attendee changes must freeze while a reviewed pass is unknown.')
    assert(await page.getByRole('button', { name: 'Food', exact: true }).isDisabled(), 'Context changes must freeze while a reviewed pass is unknown.')
    assert(await page.getByRole('button', { name: 'Leave group' }).isDisabled(), 'Audience changes must freeze while a reviewed pass is unknown.')
    const frozenPassActions = page.getByRole('button', { name: /^Not for us:/ })
    assert(await frozenPassActions.count() === 3, 'The uncertain pass must not guess that the candidate disappeared.')
    for (let index = 0; index < await frozenPassActions.count(); index += 1) {
      assert(await frozenPassActions.nth(index).isDisabled(), 'Every competing pass action must stay frozen during exact recovery.')
    }
    await assertNoHorizontalOverflow(page, '390×844 ambiguous attributed pass')
    await page.screenshot({ path: path.join(artifactDir, 'group-ui-draft-pass-save-recovery-mobile.png'), fullPage: true })
    await checkPass.click()
    const ledger = page.getByRole('region', { name: 'Places passed on in this draft' })
    await ledger.getByText('Mika passed on Supper Club.').waitFor()
    const undo = ledger.getByRole('button', { name: 'Undo' })
    await assertFocused(undo, 'Checking the exact pass must converge on its reversible authoritative action.')
    assert(await page.locator('.group-candidate-card').count() === 2, 'Exact pass recovery must remove only the reviewed candidate.')

    await page.evaluate(() => {
      const url = new URL(window.location.href)
      url.searchParams.set('failure', 'draft-pass-undo-response')
      window.history.replaceState(window.history.state, '', url)
    })
    await undo.click()
    await page.getByRole('heading', { name: 'Undo status unknown.' }).waitFor()
    const checkUndo = page.getByRole('button', { name: 'Check undo' })
    await assertFocused(checkUndo, 'An ambiguous pass undo must focus its exact Check undo action.')
    await page.getByText(/same undo for the reviewed people and plan; it cannot change anyone’s Keep/).waitFor()
    await ledger.getByText('Mika passed on Supper Club.').waitFor()
    assert(await page.locator('.group-candidate-card').count() === 2, 'An ambiguous undo must not guess that the candidate returned.')
    assert(await undo.isDisabled(), 'The original Undo action must freeze while its result is unknown.')
    await assertNoHorizontalOverflow(page, '390×844 ambiguous attributed pass undo')
    await page.screenshot({ path: path.join(artifactDir, 'group-ui-draft-pass-undo-recovery-mobile.png'), fullPage: true })
    await checkUndo.click()
    const restoredPass = page.getByRole('button', { name: 'Not for us: Supper Club' })
    await restoredPass.waitFor()
    await assertFocused(restoredPass, 'Checking the exact undo must return focus to the restored candidate action.')
    assert(await page.locator('.group-candidate-card').count() === 3, 'Exact undo recovery must restore only the reviewed candidate.')
    assert(errors.length === 0, `Draft-pass recovery browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

async function verifySparseEvidenceRecovery(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const errors = []
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(`${origin}/g/prototype-sparse-family?prototype=group&prototypeState=sparse-only`, { waitUntil: 'networkidle' })
    await page.getByText('SHARING CIRCLE · 4 PEOPLE', { exact: true }).waitFor()
    await page.getByRole('heading', { name: 'One shared place needs your honest answer.' }).waitFor()
    await page.getByText('Vivian wants to try Nightjar Coffee. If Coffee generally sounds good to you, Quick start can let this.is show it with both reasons named. Otherwise, add a place you honestly want or love.').waitFor()
    assert(await page.locator('.group-candidate-card').count() === 0, 'A lone Want must remain absent before an independent answer.')
    assert(await page.locator('.group-attendees, .group-context').count() === 0, 'Planning controls must remain absent while no place is eligible.')
    const answer = page.getByRole('button', { name: 'Answer with Quick start' })
    const answerBox = await answer.boundingBox()
    assert(answerBox && answerBox.y + answerBox.height <= 844, 'The one useful sparse-evidence response must remain in the initial phone viewport.')
    await assertNoHorizontalOverflow(page, '390×844 sparse group recovery')
    await page.screenshot({ path: path.join(artifactDir, 'group-ui-sparse-recovery-mobile.png'), fullPage: true })

    await answer.click()
    await page.waitForURL(url => url.searchParams.get('welcome') === 'quick')
    assert(new URL(page.url()).searchParams.get('prototypeState') === 'sparse-only', 'The focused Quick start route must preserve the development fixture state across its remount.')
    await page.getByRole('heading', { name: 'Give Family Sunday one light hint.' }).waitFor()
    await page.getByText('Vivian shared Nightjar Coffee as a Want. Choose Coffee only if it generally sounds good to you; then this.is can show the place with both reasons named.').waitFor()
    const coffee = page.getByRole('button', { name: 'Coffee', exact: true })
    assert(await coffee.getAttribute('aria-pressed') === 'false', 'The useful category must never be preselected for the member.')
    const share = page.getByRole('button', { name: 'Share hint' })
    assert(await share.isDisabled(), 'No hint can be shared before the member explicitly chooses it.')
    await coffee.click()
    assert(await share.isEnabled(), 'One deliberate broad answer enables sharing.')
    await share.click()

    await page.getByRole('heading', { name: 'One place. A real reason.' }).waitFor()
    const resolvedCandidateCards = page.locator('.group-candidate-card')
    await resolvedCandidateCards.first().waitFor()
    const resolvedCandidateCount = await resolvedCandidateCards.count()
    assert(resolvedCandidateCount === 1, `One explicit Want plus another member’s deliberate matching hint admits exactly one place; found ${resolvedCandidateCount}.`)
    const namedAnswer = page.getByText('Nightjar Coffee is the only place with enough shared evidence right now.', { exact: true })
    await namedAnswer.waitFor()
    const namedAnswerBox = await namedAnswer.boundingBox()
    assert(namedAnswerBox && namedAnswerBox.y + namedAnswerBox.height <= 844, 'A larger group’s one truthful answer must be named in the initial phone viewport.')
    await page.getByText('Nightjar Coffee', { exact: true }).waitFor()
    await page.getByText("Why for us: Vivian wants this; it fits Mika's coffee hint.", { exact: true }).waitFor()
    await page.getByText('WEAK FIT · 1 EXACT SIGNAL + 1 HINT', { exact: true }).waitFor()
    await assertNoHorizontalOverflow(page, '390×844 sparse group resolved')
    await page.screenshot({ path: path.join(artifactDir, 'group-ui-sparse-resolved-mobile.png'), fullPage: true })
    assert(errors.length === 0, `Sparse-evidence browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

async function verifyZeroHistoryEntry(browser) {
  const notNowContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const notNowPage = await notNowContext.newPage()
  const notNowErrors = []
  notNowPage.on('console', message => {
    if (message.type() === 'error') notNowErrors.push(message.text())
  })
  notNowPage.on('pageerror', error => notNowErrors.push(error.message))
  try {
    await openZeroHistoryWelcome(notNowPage)
    const notNowChoice = notNowPage.getByRole('button').filter({ hasText: 'Not now' })
    const notNowBox = await notNowChoice.boundingBox()
    assert(notNowBox && notNowBox.y + notNowBox.height <= 844, 'Not now must remain an immediate first-viewport completion path, not buried after optional taste work.')
    await notNowPage.screenshot({ path: path.join(artifactDir, 'group-ui-zero-history-entry-mobile.png'), fullPage: true })
    await notNowPage.getByRole('button').filter({ hasText: 'Choose or find a place' }).click()
    await notNowPage.waitForURL(/\/add\?mode=discover&group=prototype-zero-history$/)
    await notNowPage.goBack({ waitUntil: 'networkidle' })
    await notNowPage.getByRole('heading', { name: 'Help this group learn what you like.' }).waitFor()
    await notNowPage.getByRole('button').filter({ hasText: 'Not now' }).click()
    await notNowPage.getByRole('heading', { name: 'Nothing honest fits yet.' }).waitFor()
    await notNowPage.getByText('INVITATIONS OPEN · 2 OF 6 PEOPLE', { exact: true }).waitFor()
    await notNowPage.getByText('No one has shared a place or Quick start hint with this group. Nothing from anyone’s private Keep appears automatically.').waitFor()
    assert(
      await notNowPage.locator('.group-candidate-card').count() === 0,
      'Not now must not create taste evidence or candidates.',
    )
    await notNowPage.getByRole('button', { name: 'Invite one person' }).click()
    await notNowPage.getByText('ONE PERSON · LINK 1', { exact: true }).waitFor()
    await notNowPage.getByText('ONE LINK · ONE PERSON', { exact: true }).waitFor()
    await notNowPage.getByText('Make a separate private link for each person. Each stops working after one person joins and expires in seven days.').waitFor()
    const firstDisclosure = notNowPage.locator('details.group-invite-url-disclosure').first()
    const inviteLink = firstDisclosure.getByRole('textbox', { name: 'Invite link' })
    const disclosureToggle = firstDisclosure.getByRole('button', { name: 'Show or hide full invite link' })
    assert(!await firstDisclosure.evaluate(element => element.open), 'A private invite token must stay concealed until the organizer deliberately asks to inspect it.')
    assert(!await inviteLink.isVisible(), 'A raw invite URL must not appear in the default forming-group view.')
    assert(await disclosureToggle.evaluate(element => element.getBoundingClientRect().height) >= 44, 'Show full link must remain touch-sized even though it is visually secondary.')
    await disclosureToggle.click()
    assert(await inviteLink.isVisible(), 'Show full link must preserve an exact manual-copy fallback.')
    assert(
      (await inviteLink.inputValue()).endsWith('/gi/prototype-prototype-zero-history-1'),
      'The organizer must be able to inspect the exact one-person link deliberately.',
    )
    await notNowPage.getByRole('button', { name: 'Copy link' }).waitFor()
    const firstInviteUrl = await inviteLink.inputValue()
    await disclosureToggle.click()
    await notNowPage.getByRole('button', { name: 'Make link for someone else' }).click()
    await notNowPage.getByText('ONE PERSON · LINK 2', { exact: true }).waitFor()
    assert(await notNowPage.locator('.group-invite-url').count() === 2, 'An organizer must be able to prepare separate one-person links for a larger group.')
    assert(
      (await notNowPage.locator('details.group-invite-url-disclosure').evaluateAll(elements => elements.every(element => !element.open))),
      'Every recovered or newly created invite token must default to concealed.',
    )
    await assertNoHorizontalOverflow(notNowPage, '390×844 open-membership invite card')
    await notNowPage.screenshot({ path: path.join(artifactDir, 'group-ui-invite-card-mobile.png'), fullPage: true })
    const cancelLink = notNowPage.getByRole('button', { name: 'Cancel link 1' })
    await cancelLink.click()
    const revokeDialog = notNowPage.getByRole('alertdialog')
    await revokeDialog.getByRole('heading', { name: 'Revoke this invite link?' }).waitFor()
    const keepLink = revokeDialog.getByRole('button', { name: 'Keep link' })
    await assertFocused(keepLink, 'Invite revocation must focus the safe Keep link action first.')
    await notNowPage.keyboard.press('Escape')
    await assertFocused(cancelLink, 'Escape must close invite revocation and restore its trigger.')
    await cancelLink.click()
    await revokeDialog.getByRole('button', { name: 'Revoke link' }).click()
    await notNowPage.getByRole('status').getByText('Invite link revoked. Make another only if you still need a seat.').waitFor()
    assert(await notNowPage.locator('.group-invite-url').count() === 1, 'Revoking one link must preserve the other larger-group invitation.')
    assert(await notNowPage.locator('.group-invite-url').inputValue() !== firstInviteUrl, 'The specifically revoked URL must disappear immediately.')
    await notNowPage.getByRole('button', { name: 'Cancel link' }).click()
    await notNowPage.getByRole('alertdialog').getByRole('button', { name: 'Revoke link' }).click()
    assert(await notNowPage.locator('.group-invite-url').count() === 0, 'Manual revocation must remove the final usable invite link immediately.')
    await notNowPage.getByRole('button', { name: 'Invite one person' }).waitFor()
    assert(notNowErrors.length === 0, `Open-membership invite browser errors: ${notNowErrors.join(' | ')}`)
  } finally {
    await notNowContext.close()
  }

  const revokeRecoveryContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const revokeRecoveryPage = await revokeRecoveryContext.newPage()
  const revokeRecoveryErrors = []
  revokeRecoveryPage.on('console', message => {
    if (message.type() === 'error') revokeRecoveryErrors.push(message.text())
  })
  revokeRecoveryPage.on('pageerror', error => revokeRecoveryErrors.push(error.message))
  try {
    await revokeRecoveryPage.goto(`${origin}/g/prototype-zero-history?prototype=group&failure=invite-revoke-response`, { waitUntil: 'networkidle' })
    await revokeRecoveryPage.getByRole('heading', { name: 'Nothing honest fits yet.' }).waitFor()
    await revokeRecoveryPage.getByRole('button', { name: 'Invite one person' }).click()
    await revokeRecoveryPage.getByText('ONE PERSON · LINK 1', { exact: true }).waitFor()
    await revokeRecoveryPage.getByRole('button', { name: 'Cancel link' }).click()
    const recoveryDialog = revokeRecoveryPage.getByRole('alertdialog', { name: 'Revoke this invite link?' })
    await recoveryDialog.getByRole('button', { name: 'Revoke link' }).click()
    await recoveryDialog.getByRole('alert').getByText(/confirm whether this invite was revoked\. Checking again can only revoke this same link/).waitFor()
    await assertFocused(recoveryDialog.getByRole('button', { name: 'Close for now' }), 'An ambiguous invite revocation must move focus away from the just-used destructive action.')
    assert(await revokeRecoveryPage.getByRole('alert').count() === 1, 'Invite-revocation recovery must not announce the same ambiguity behind and inside its dialog.')
    assert(await revokeRecoveryPage.getByRole('button', { name: 'Check link' }).count() === 1, 'Invite-revocation recovery must expose only its one dialog action while the modal is open.')
    assert(await revokeRecoveryPage.getByRole('button', { name: 'Make link for someone else' }).count() === 0, 'Invite-revocation recovery must hide competing link creation while its modal is open.')
    assert(await revokeRecoveryPage.getByText('The link is unchanged', { exact: false }).count() === 0, 'An ambiguous invite revocation must not claim that the link is unchanged.')
    assert(await revokeRecoveryPage.getByRole('button', { name: 'Revoke link' }).count() === 0, 'An ambiguous invite revocation must not present a fresh revoke action.')
    assert(await revokeRecoveryPage.getByRole('button', { name: 'Copy link' }).count() === 0, 'An invite with uncertain revocation must not remain copyable.')
    assert(await revokeRecoveryPage.getByRole('button', { name: 'Share link' }).count() === 0, 'An invite with uncertain revocation must not remain shareable.')
    assert(await revokeRecoveryPage.getByText('Show full link', { exact: true }).count() === 0, 'An invite with uncertain revocation must not expose its manual-copy fallback.')
    assert(
      await revokeRecoveryPage.evaluate(() => window.sessionStorage.getItem('__this_is_pending_invite_revoke:prototype-zero-history')) === 'committed',
      'The lost-response fixture must revoke the invite before hiding its response.',
    )
    await recoveryDialog.getByRole('button', { name: 'Close for now' }).click()
    const checkLink = revokeRecoveryPage.getByRole('button', { name: 'Check link' })
    await assertFocused(checkLink, 'Closing ambiguous invite-revocation recovery must focus its one Check link action.')
    assert(await revokeRecoveryPage.getByRole('button', { name: 'Cancel link' }).count() === 0, 'Unresolved invite revocation must not fall back to a fresh Cancel link action.')
    await assertNoHorizontalOverflow(revokeRecoveryPage, '390×844 invite-revocation recovery')
    await revokeRecoveryPage.screenshot({ path: path.join(artifactDir, 'group-ui-invite-revoke-recovery-mobile.png'), fullPage: true })
    await checkLink.click()
    await revokeRecoveryPage.getByRole('alertdialog', { name: 'Revoke this invite link?' }).getByRole('button', { name: 'Check link' }).click()
    await revokeRecoveryPage.getByRole('status').getByText('Invite link revoked. Make another only if you still need a seat.').waitFor()
    assert(await revokeRecoveryPage.locator('.group-invite-url').count() === 0, 'Confirmed invite-revocation recovery must remove the uncertain link once.')
    assert(
      await revokeRecoveryPage.evaluate(() => window.sessionStorage.getItem('__this_is_pending_invite_revoke:prototype-zero-history')) === null,
      'Confirmed invite-revocation recovery must clear its pending development marker.',
    )
    assert(revokeRecoveryErrors.length === 0, `Invite-revocation recovery browser errors: ${revokeRecoveryErrors.join(' | ')}`)
  } finally {
    await revokeRecoveryContext.close()
  }

  const quickContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const quickPage = await quickContext.newPage()
  const errors = []
  quickPage.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  quickPage.on('pageerror', error => errors.push(error.message))
  try {
    await openZeroHistoryWelcome(quickPage)
    await quickPage.getByRole('button').filter({ hasText: 'Quick start' }).click()
    await quickPage.getByRole('heading', { name: 'Give Empty Table one light hint.' }).waitFor()
    await quickPage.getByText('Visible only to Mika, Vivian. Sharing this hint closes invitations for this group.').waitFor()
    const laterHints = quickPage.locator('details.group-quick-later')
    const laterToggle = laterHints.getByRole('button', { name: 'Plan-fit hints for later' })
    assert(!await laterHints.evaluate(element => element.open), 'Future-only Quick start constraints must stay collapsed on entry.')
    assert(await quickPage.getByRole('button', { name: 'Quiet', exact: true }).count() === 0, 'Collapsed future hints must not appear as current-value work in the accessibility tree.')
    assert(await laterToggle.evaluate(element => element.getBoundingClientRect().height) >= 44, 'Optional future hints must retain one touch-sized disclosure.')
    const save = quickPage.getByRole('button', { name: 'Share hint' })
    assert(await save.isDisabled(), 'Quick start cannot save an empty hint set.')
    await quickPage.getByRole('button', { name: 'Coffee' }).click()
    assert(await save.isEnabled(), 'One explicit broad hint should enable Quick start.')
    await quickPage.screenshot({ path: path.join(artifactDir, 'group-ui-quick-start-mobile.png'), fullPage: true })
    await laterToggle.click()
    await quickPage.getByText('Saved with this group for later retrieval. These do not change current suggestions yet.').waitFor()
    await quickPage.getByRole('button', { name: 'Quiet', exact: true }).waitFor()
    await quickPage.screenshot({ path: path.join(artifactDir, 'group-ui-quick-start-later-mobile.png'), fullPage: true })
    await laterToggle.click()
    await save.click()
    const firstQuickReview = await inspectGroupAudienceConfirmation(quickPage, {
      memberNames: ['Mika', 'Vivian'],
      includedCopy: 'Your private Keep stays private. Only this reviewed hint is shared with the people above.',
    })
    await quickPage.screenshot({ path: path.join(artifactDir, 'group-ui-audience-quick-start-mobile.png'), fullPage: true })
    await firstQuickReview.safeAction.click()
    assert(await quickPage.getByRole('dialog', { name: 'Confirm sharing circle' }).count() === 0, 'Waiting for everyone must close the first-share review.')
    assert(await save.isEnabled(), 'Canceling first-share review must not save or lock the Quick-start hint.')
    await save.click()
    const confirmedQuickReview = await inspectGroupAudienceConfirmation(quickPage, {
      memberNames: ['Mika', 'Vivian'],
    })
    await confirmedQuickReview.commit.click()
    await quickPage.getByRole('heading', { name: 'Nothing honest fits yet.' }).waitFor()
    await quickPage.getByText('SHARING CIRCLE · 2 PEOPLE', { exact: true }).waitFor()
    assert(
      await quickPage.getByRole('heading', { name: 'Three places. Real reasons.' }).count() === 0,
      'A zero-candidate group must not lead with a shortlist promise it cannot currently support.',
    )
    const addPlaceBox = await quickPage.locator('.plan-empty').getByRole('button', { name: 'Choose or find a place' }).boundingBox()
    assert(
      addPlaceBox && addPlaceBox.y + addPlaceBox.height <= 844,
      'The primary zero-candidate remedy must be visible in the initial 390×844 viewport.',
    )
    assert(
      await quickPage.locator('.group-attendees, .group-context').count() === 0,
      'A group with zero shared places must not show planning controls that cannot change its empty answer.',
    )
    assert(
      await quickPage.getByRole('button', { name: 'Edit Quick start', exact: true }).count() === 1,
      'Zero history must offer one optional hint-edit action, not duplicate it around unusable controls.',
    )
    assert(
      await quickPage.locator('.group-candidate-card').count() === 0,
      'Quick start without an exact place signal must not invent a candidate.',
    )
    await assertNoHorizontalOverflow(quickPage, 'zero-history Quick start result')
    await quickPage.screenshot({ path: path.join(artifactDir, 'group-ui-zero-history-mobile.png'), fullPage: true })
    assert(errors.length === 0, `Zero-history browser errors: ${errors.join(' | ')}`)
  } finally {
    await quickContext.close()
  }

  const staleQuickContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const staleQuickPage = await staleQuickContext.newPage()
  const staleQuickErrors = []
  staleQuickPage.on('console', message => {
    if (message.type() === 'error') staleQuickErrors.push(message.text())
  })
  staleQuickPage.on('pageerror', error => staleQuickErrors.push(error.message))
  try {
    await staleQuickPage.goto(`${origin}/g/prototype-zero-history?welcome=quick&prototype=group&failure=quick-start-audience-changed`, { waitUntil: 'networkidle' })
    await staleQuickPage.getByRole('button', { name: 'Coffee', exact: true }).click()
    await staleQuickPage.getByRole('button', { name: 'Share hint' }).click()
    const staleQuickReview = await inspectGroupAudienceConfirmation(staleQuickPage, {
      memberNames: ['Mika', 'Vivian'],
    })
    await staleQuickReview.commit.click()
    const freshQuickReview = await inspectGroupAudienceConfirmation(staleQuickPage, {
      memberNames: ['Mika', 'Vivian', 'Ari'],
    })
    await freshQuickReview.dialog.getByText('SHARING CIRCLE CHANGED', { exact: true }).waitFor()
    await freshQuickReview.dialog.getByText(/changed before this hint could be confirmed/).waitFor()
    assert(
      await freshQuickReview.dialog.getByText('3 PEOPLE · INVITATIONS OPEN', { exact: true }).count() === 0,
      'A changed review must use its serious changed-state label instead of hiding the conflict as a normal first review.',
    )
    await staleQuickPage.screenshot({ path: path.join(artifactDir, 'group-ui-audience-quick-start-changed-mobile.png'), fullPage: true })
    await freshQuickReview.commit.click()
    await staleQuickPage.getByText('SHARING CIRCLE · 3 PEOPLE', { exact: true }).waitFor()
    assert(await staleQuickPage.getByRole('button', { name: 'Invite one person' }).count() === 0, 'Freshly confirmed Quick start must close invitations only after the three-person review succeeds.')
    assert(staleQuickErrors.length === 0, `Changed Quick-start audience browser errors: ${staleQuickErrors.join(' | ')}`)
  } finally {
    await staleQuickContext.close()
  }

  const quickSaveRecoveryContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const quickSaveRecoveryPage = await quickSaveRecoveryContext.newPage()
  const quickSaveRecoveryErrors = []
  quickSaveRecoveryPage.on('console', message => {
    if (message.type() === 'error') quickSaveRecoveryErrors.push(message.text())
  })
  quickSaveRecoveryPage.on('pageerror', error => quickSaveRecoveryErrors.push(error.message))
  try {
    await quickSaveRecoveryPage.goto(`${origin}/g/prototype-zero-history?welcome=quick&prototype=group&failure=quick-start-save-response`, { waitUntil: 'networkidle' })
    await quickSaveRecoveryPage.getByRole('heading', { name: 'Give Empty Table one light hint.' }).waitFor()
    const coffee = quickSaveRecoveryPage.getByRole('button', { name: 'Coffee', exact: true })
    await coffee.click()
    await quickSaveRecoveryPage.getByRole('button', { name: 'Share hint' }).click()
    const lostResponseReview = await inspectGroupAudienceConfirmation(quickSaveRecoveryPage, {
      memberNames: ['Mika', 'Vivian'],
    })
    await lostResponseReview.commit.click()
    await quickSaveRecoveryPage.getByRole('alert').getByText(/confirm whether your hint was shared\. Checking again can only save these same choices/).waitFor()
    await assertFocused(quickSaveRecoveryPage.getByRole('button', { name: 'Close for now' }), 'An ambiguous Quick start save must move focus away from the just-used share action.')
    assert(await quickSaveRecoveryPage.getByRole('button', { name: 'Share hint' }).count() === 0, 'An ambiguous Quick start save must not present a fresh Share hint action.')
    assert(await quickSaveRecoveryPage.getByRole('button', { name: 'Check hint' }).count() === 1, 'An ambiguous Quick start save must expose one exact Check hint action.')
    assert(await coffee.isDisabled(), 'Quick start choices must stay frozen while the exact save result is unknown.')
    assert(await coffee.getAttribute('aria-pressed') === 'true', 'Quick start recovery must preserve the exact reviewed category choice.')
    assert(
      await quickSaveRecoveryPage.evaluate(() => window.sessionStorage.getItem('__this_is_pending_quick_start:prototype-zero-history')) === 'save-committed',
      'The lost-response fixture must save the hint and lock its audience before hiding the response.',
    )
    await assertNoHorizontalOverflow(quickSaveRecoveryPage, '390×844 Quick start save recovery')
    await quickSaveRecoveryPage.screenshot({ path: path.join(artifactDir, 'group-ui-quick-start-save-recovery-mobile.png'), fullPage: true })
    await quickSaveRecoveryPage.getByRole('button', { name: 'Close for now' }).click()
    await quickSaveRecoveryPage.getByRole('heading', { name: 'Nothing honest fits yet.' }).waitFor()
    await quickSaveRecoveryPage.getByText('SHARING CIRCLE · 2 PEOPLE', { exact: true }).waitFor()
    assert(await quickSaveRecoveryPage.getByRole('button', { name: 'Invite one person' }).count() === 0, 'A committed Quick start with a lost response must not keep invitations visibly open after closing recovery.')
    await quickSaveRecoveryPage.getByRole('button', { name: 'Edit Quick start', exact: true }).click()
    await quickSaveRecoveryPage.getByRole('button', { name: 'Check hint' }).click()
    await quickSaveRecoveryPage.getByRole('heading', { name: 'Nothing honest fits yet.' }).waitFor()
    await quickSaveRecoveryPage.getByText('SHARING CIRCLE · 2 PEOPLE', { exact: true }).waitFor()
    assert(
      await quickSaveRecoveryPage.evaluate(() => window.sessionStorage.getItem('__this_is_pending_quick_start:prototype-zero-history')) === null,
      'Confirmed Quick start save recovery must clear its pending development marker.',
    )
    assert(quickSaveRecoveryErrors.length === 0, `Quick start save-recovery browser errors: ${quickSaveRecoveryErrors.join(' | ')}`)
  } finally {
    await quickSaveRecoveryContext.close()
  }

  const quickRemoveRecoveryContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const quickRemoveRecoveryPage = await quickRemoveRecoveryContext.newPage()
  const quickRemoveRecoveryErrors = []
  quickRemoveRecoveryPage.on('console', message => {
    if (message.type() === 'error') quickRemoveRecoveryErrors.push(message.text())
  })
  quickRemoveRecoveryPage.on('pageerror', error => quickRemoveRecoveryErrors.push(error.message))
  try {
    await openZeroHistoryWelcome(quickRemoveRecoveryPage)
    await quickRemoveRecoveryPage.getByRole('button').filter({ hasText: 'Quick start' }).click()
    await quickRemoveRecoveryPage.getByRole('button', { name: 'Coffee', exact: true }).click()
    await quickRemoveRecoveryPage.getByRole('button', { name: 'Share hint' }).click()
    const removeSetupReview = await inspectGroupAudienceConfirmation(quickRemoveRecoveryPage, {
      memberNames: ['Mika', 'Vivian'],
    })
    await removeSetupReview.commit.click()
    await quickRemoveRecoveryPage.getByRole('heading', { name: 'Nothing honest fits yet.' }).waitFor()
    await quickRemoveRecoveryPage.evaluate(() => {
      const url = new URL(window.location.href)
      url.searchParams.set('failure', 'quick-start-remove-response')
      window.history.replaceState({}, '', url)
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await quickRemoveRecoveryPage.getByRole('button', { name: 'Edit Quick start', exact: true }).click()
    await quickRemoveRecoveryPage.getByRole('button', { name: 'Remove my hints' }).click()
    await quickRemoveRecoveryPage.getByRole('alert').getByText(/confirm whether your hints were removed\. Checking again can only remove those same group hints/).waitFor()
    await assertFocused(quickRemoveRecoveryPage.getByRole('button', { name: 'Close for now' }), 'An ambiguous Quick start removal must move focus away from the just-used removal action.')
    assert(await quickRemoveRecoveryPage.getByRole('button', { name: 'Remove my hints' }).count() === 0, 'An ambiguous Quick start removal must not present a fresh remove action.')
    assert(await quickRemoveRecoveryPage.getByRole('button', { name: 'Check removal' }).count() === 1, 'An ambiguous Quick start removal must expose one exact Check removal action.')
    assert(await quickRemoveRecoveryPage.getByRole('button', { name: 'Coffee', exact: true }).isDisabled(), 'Quick start choices must stay frozen while removal is unknown.')
    assert(
      await quickRemoveRecoveryPage.evaluate(() => window.sessionStorage.getItem('__this_is_pending_quick_start:prototype-zero-history')) === 'remove-committed',
      'The lost-response fixture must remove the group hints before hiding its response.',
    )
    await assertNoHorizontalOverflow(quickRemoveRecoveryPage, '390×844 Quick start removal recovery')
    await quickRemoveRecoveryPage.screenshot({ path: path.join(artifactDir, 'group-ui-quick-start-remove-recovery-mobile.png'), fullPage: true })
    await quickRemoveRecoveryPage.getByRole('button', { name: 'Close for now' }).click()
    await quickRemoveRecoveryPage.getByRole('heading', { name: 'Nothing honest fits yet.' }).waitFor()
    await quickRemoveRecoveryPage.getByText('SHARING CIRCLE · 2 PEOPLE', { exact: true }).waitFor()
    assert(await quickRemoveRecoveryPage.getByRole('button', { name: 'Invite one person' }).count() === 0, 'Removing Quick start must never reopen the fixed audience after closing recovery.')
    await quickRemoveRecoveryPage.getByRole('button', { name: 'Quick start', exact: true }).click()
    await quickRemoveRecoveryPage.getByRole('button', { name: 'Check removal' }).click()
    await quickRemoveRecoveryPage.getByRole('heading', { name: 'Nothing honest fits yet.' }).waitFor()
    await quickRemoveRecoveryPage.getByText('SHARING CIRCLE · 2 PEOPLE', { exact: true }).waitFor()
    assert(
      await quickRemoveRecoveryPage.evaluate(() => window.sessionStorage.getItem('__this_is_pending_quick_start:prototype-zero-history')) === null,
      'Confirmed Quick start removal recovery must clear its pending development marker.',
    )
    assert(quickRemoveRecoveryErrors.length === 0, `Quick start removal-recovery browser errors: ${quickRemoveRecoveryErrors.join(' | ')}`)
  } finally {
    await quickRemoveRecoveryContext.close()
  }

  const captureContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const capturePage = await captureContext.newPage()
  const captureErrors = []
  capturePage.on('console', message => {
    if (message.type() === 'error') captureErrors.push(message.text())
  })
  capturePage.on('pageerror', error => captureErrors.push(error.message))
  try {
    await capturePage.goto(`${origin}/add?group=prototype-zero-history&prototype=group&failure=place-memory`, { waitUntil: 'networkidle' })
    await capturePage.getByRole('heading', { name: 'ADD FOR EMPTY TABLE' }).waitFor()
    await capturePage.getByRole('heading', { name: 'What do you call this place?' }).waitFor()
    assert(
      await capturePage.locator('details.place-memory-area-disclosure').getAttribute('open') === null,
      'Group capture must keep optional geography behind the core evidence and audience decision.',
    )
    await capturePage.getByRole('button', { name: 'Cancel' }).click()
    await capturePage.getByRole('heading', { name: 'Paste the link, or type the name.' }).waitFor()
    const cancelledSignal = await capturePage.evaluate(() => window.sessionStorage.getItem('__this_is_signal:group-mika:g:prototype-memory'))
    assert(cancelledSignal === null, 'Cancelling group capture must leave no personal save or shareable group evidence.')

    await capturePage.goto(`${origin}/add?group=prototype-zero-history&prototype=group&failure=place-memory`, { waitUntil: 'networkidle' })
    await capturePage.getByRole('heading', { name: 'ADD FOR EMPTY TABLE' }).waitFor()
    await capturePage.getByRole('heading', { name: 'What do you call this place?' }).waitFor()
    const pendingGroupAction = capturePage.getByRole('button', { name: 'Choose Want, Tried, or Loved' })
    assert(
      await pendingGroupAction.isDisabled(),
      'Group capture must wait for explicit place-kind and experience choices before sharing.',
    )
    await capturePage.getByRole('button', { name: 'Coffee' }).click()
    const sharingAudience = capturePage.getByRole('region', { name: 'Group sharing boundary' })
    await sharingAudience.getByText('Nothing shared with Empty Table yet', { exact: true }).waitFor()
    await sharingAudience.getByText('Want or Loved introduces it to Empty Table. Tried keeps it private.', { exact: true }).waitFor()
    const [pendingAudienceBox, optionalAreaBox, pendingDockBox] = await Promise.all([
      sharingAudience.boundingBox(),
      capturePage.locator('details.place-memory-area-disclosure').boundingBox(),
      capturePage.getByRole('navigation', { name: 'Primary' }).boundingBox(),
    ])
    assert(
      Boolean(pendingAudienceBox && optionalAreaBox && pendingAudienceBox.y < optionalAreaBox.y),
      'The exact group audience must precede optional geography in capture reading order.',
    )
    assert(
      Boolean(pendingAudienceBox && pendingDockBox && pendingAudienceBox.y < pendingDockBox.y),
      'The named sharing boundary must begin before the fixed dock in the initial 390×844 decision view.',
    )
    assert(await sharingAudience.getByText('Friday Table', { exact: true }).count() === 0, 'Group capture must name only its exact authorized audience.')
    assert(await pendingGroupAction.isDisabled(), 'A category alone must not silently become group-visible Want evidence.')
    await capturePage.screenshot({ path: path.join(artifactDir, 'group-ui-group-capture-pending-mobile.png'), fullPage: true })
    const groupExperience = capturePage.getByRole('group', { name: 'Keep this place as' })
    await groupExperience.getByRole('button', { name: 'Tried' }).click()
    await capturePage.getByText('You have been, but this alone does not support choosing it.', { exact: true }).waitFor()
    await sharingAudience.getByText('Not shared with Empty Table', { exact: true }).waitFor()
    await sharingAudience.getByText('Choose Want or Loved to introduce it to Empty Table.', { exact: false }).waitFor()
    const triedGroupAction = capturePage.getByRole('button', { name: 'Keep privately as Tried' })
    await triedGroupAction.evaluate(element => element.scrollIntoView({ block: 'center' }))
    await capturePage.evaluate(() => new Promise(resolve => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))
    }))
    const [groupActionBox, groupDockBox] = await Promise.all([
      triedGroupAction.boundingBox(),
      capturePage.getByRole('navigation', { name: 'Primary' }).boundingBox(),
    ])
    assert(
      Boolean(groupActionBox && groupDockBox && groupActionBox.y + groupActionBox.height <= groupDockBox.y - 12),
      'The exact-audience sharing action must scroll fully above the fixed dock at 390×844.',
    )
    await capturePage.screenshot({ path: path.join(artifactDir, 'group-ui-group-capture-audience-mobile.png') })
    await triedGroupAction.click()
    await capturePage.getByRole('heading', { name: 'coffee after practice', level: 1 }).waitFor()
    assert(
      /\/p\/g(?::|%3A)prototype-memory$/i.test(new URL(capturePage.url()).pathname),
      'Private Tried capture must open the canonical place route.',
    )
    await capturePage.getByText('Kept privately. Choose Want or Loved to introduce it to Empty Table.', { exact: true }).waitFor()
    const privateTriedSignal = await capturePage.evaluate(() => {
      const value = window.sessionStorage.getItem('__this_is_signal:group-mika:g:prototype-memory')
      return value ? JSON.parse(value) : null
    })
    assert(privateTriedSignal?.tag === 'tried' && privateTriedSignal?.visibility === 'private', 'Bare Tried capture from a group must persist only truthful private history.')
    const privateEmptyTableSharing = capturePage.locator('.group-share-item[aria-label="Empty Table sharing"]')
    assert(
      await privateEmptyTableSharing.getByText('Not shared with this group', { exact: true }).count() === 1
        && await privateEmptyTableSharing.getByRole('button', { name: 'Share with Empty Table' }).count() === 1,
      'Bare Tried capture must not silently create the named group projection.',
    )
    await capturePage.goto(`${origin}/g/prototype-zero-history?prototype=group`, { waitUntil: 'networkidle' })
    await capturePage.getByRole('heading', { name: 'Nothing honest fits yet.' }).waitFor()
    assert(await capturePage.locator('.group-candidate-card').count() === 0, 'A private Tried memory must not manufacture a group candidate.')

    await capturePage.goto(`${origin}/add?group=prototype-zero-history&prototype=group&failure=place-memory`, { waitUntil: 'networkidle' })
    await capturePage.getByRole('heading', { name: 'ADD FOR EMPTY TABLE' }).waitFor()
    await capturePage.getByRole('button', { name: 'Coffee' }).click()
    await capturePage.getByRole('group', { name: 'Keep this place as' }).getByRole('button', { name: 'Want' }).click()
    await capturePage.getByRole('region', { name: 'Group sharing boundary' }).getByText('Empty Table', { exact: true }).waitFor()
    await capturePage.getByRole('button', { name: 'Keep & share as Want' }).click()
    const addAudienceReview = await inspectGroupAudienceConfirmation(capturePage, {
      memberNames: ['Mika', 'Vivian'],
      includedCopy: 'Your private Keep stays private. Only this reviewed place is shared with the people above.',
    })
    await addAudienceReview.safeAction.click()
    const signalAfterAudienceCancel = await capturePage.evaluate(() => {
      const value = window.sessionStorage.getItem('__this_is_signal:group-mika:g:prototype-memory')
      return value ? JSON.parse(value) : null
    })
    assert(signalAfterAudienceCancel?.tag === 'tried', 'Canceling Add audience review must not change the existing private Tried memory to Want.')
    assert(await capturePage.getByRole('button', { name: 'Keep & share as Want' }).isEnabled(), 'Canceling Add audience review must return to the unchanged reviewed place action.')
    await capturePage.getByRole('button', { name: 'Keep & share as Want' }).click()
    const confirmedAddAudience = await inspectGroupAudienceConfirmation(capturePage, {
      memberNames: ['Mika', 'Vivian'],
    })
    await capturePage.screenshot({ path: path.join(artifactDir, 'group-ui-audience-add-mobile.png'), fullPage: true })
    await confirmedAddAudience.commit.click()
    await capturePage.waitForURL(/\/g\/prototype-zero-history$/)
    await capturePage.getByRole('heading', { name: 'Your place needs one more reason.' }).waitFor()
    await capturePage.getByText('SHARING CIRCLE · 2 PEOPLE', { exact: true }).waitFor()
    await capturePage.waitForFunction(() => window.scrollY === 0)
    assert(await capturePage.evaluate(() => window.scrollY) === 0, 'Add-to-group navigation must land at the group header, not preserve the form scroll position.')
    const personalSignal = await capturePage.evaluate(() => {
      const value = window.sessionStorage.getItem('__this_is_signal:group-mika:g:prototype-memory')
      return value ? JSON.parse(value) : null
    })
    assert(personalSignal?.visibility === 'private', 'Adding for a group must keep the canonical personal save private.')
    assert(personalSignal?.tag === 'want', 'Group-scoped capture must persist the experience the person explicitly returned to.')
    assert(await capturePage.locator('.group-candidate-card').count() === 0, 'One explicit group-added Want must wait for independent support.')
    assert(
      await capturePage.locator('.group-attendees, .group-context').count() === 0,
      'Planning controls must stay hidden when no current setting can make a lone Want eligible.',
    )
    await capturePage.getByRole('link', { name: 'Review my Want' }).waitFor()
    await capturePage.getByRole('button', { name: 'Choose or find a place' }).waitFor()
    assert(
      await capturePage.getByRole('button', { name: /Quick start/i }).count() === 0,
      'A person must not be offered their own Quick start as corroboration for their own lone Want.',
    )
    await capturePage.getByText('You want to try coffee after practice. It can appear when another person also Wants or Loves it or independently chooses Coffee in Quick start. There is no need to upgrade your answer just to create a result.', { exact: true }).waitFor()
    await assertNoHorizontalOverflow(capturePage, 'zero-history lone Want waiting state')
    await capturePage.locator('.toast').waitFor({ state: 'detached', timeout: 10_000 })
    await capturePage.screenshot({ path: path.join(artifactDir, 'group-ui-zero-history-want-waiting-mobile.png'), fullPage: true })

    await capturePage.goto(`${origin}/add?group=prototype-zero-history&prototype=group&failure=place-memory`, { waitUntil: 'networkidle' })
    await capturePage.getByRole('button', { name: 'Coffee' }).click()
    await capturePage.getByRole('group', { name: 'Keep this place as' }).getByRole('button', { name: 'Loved' }).click()
    await capturePage.getByRole('button', { name: 'Keep & share as Loved' }).click()
    const memoryRecoveryAudience = await inspectGroupAudienceConfirmation(capturePage, {
      memberNames: ['Mika', 'Vivian'],
    })
    await memoryRecoveryAudience.commit.click()
    await capturePage.waitForURL(/\/g\/prototype-zero-history$/)
    await capturePage.getByRole('heading', { name: 'One place. A real reason.' }).waitFor()
    const lovedIntroductionCards = capturePage.locator('.group-candidate-card')
    await lovedIntroductionCards.first().waitFor()
    const lovedIntroductionCount = await lovedIntroductionCards.count()
    assert(lovedIntroductionCount === 1, `One explicit Love may introduce exactly one place to the group; found ${lovedIntroductionCount}.`)
    assert(
      await capturePage.locator('.group-attendees').count() === 1 && await capturePage.locator('.group-context').count() === 1,
      'Planning controls must return only after at least one place has an eligible reason.',
    )
    await capturePage.getByText('MEMBER INTRODUCTION · 1 OF 2', { exact: true }).waitFor()
    await capturePage.getByText('Why for us: Mika loved this; 1 person hasn’t weighed in.', { exact: true }).waitFor()
    await capturePage.getByText('coffee after practice', { exact: true }).waitFor()
    assert(await capturePage.getByText('Juniper Cafe', { exact: true }).count() === 0, 'The group projection must use the confirmed personal label, not the Google result.')
    const lovedSignal = await capturePage.evaluate(() => {
      const value = window.sessionStorage.getItem('__this_is_signal:group-mika:g:prototype-memory')
      return value ? JSON.parse(value) : null
    })
    assert(lovedSignal?.tag === 'loved' && lovedSignal?.visibility === 'private', 'The eligible introduction must remain a private canonical Love plus exact group projection.')
    await assertNoHorizontalOverflow(capturePage, 'zero-history exact group Love introduction')
    await capturePage.locator('.toast').waitFor({ state: 'detached', timeout: 10_000 })
    await capturePage.screenshot({ path: path.join(artifactDir, 'group-ui-zero-history-capture-mobile.png'), fullPage: true })
    assert(captureErrors.length === 0, `Zero-history group capture browser errors: ${captureErrors.join(' | ')}`)
  } finally {
    await captureContext.close()
  }
}

async function verifyOfflineRecovery(browser) {
  const context = await browser.newContext({
    viewport: { width: 320, height: 568 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const offlinePage = await context.newPage()
  const errors = []
  offlinePage.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  offlinePage.on('pageerror', error => errors.push(error.message))
  try {
    await offlinePage.goto(`${origin}/g/prototype-evidence-lab?prototype=group`, { waitUntil: 'networkidle' })
    await offlinePage.getByRole('heading', { name: 'Three places. Real reasons.' }).waitFor()
    assert(
      await offlinePage.locator('.group-candidate-card').count() === 3,
      'The warm offline transition must begin from a fully loaded truthful shortlist.',
    )

    await context.setOffline(true)
    const status = offlinePage.getByRole('status').filter({ hasText: 'Offline' })
    await status.getByText('Showing saved data when available. Changes sync after reconnecting.', { exact: false }).waitFor()
    await status.getByRole('button', { name: 'Retry' }).click()
    await status.getByText('Still offline.').waitFor()
    assert(
      await offlinePage.locator('.group-candidate-card').count() === 3,
      'Going offline after a warm load must not erase the visible shortlist.',
    )
    await assertNoHorizontalOverflow(offlinePage, '320×568 warm offline state')
    await offlinePage.screenshot({ path: path.join(artifactDir, 'group-ui-offline-narrow.png'), fullPage: true })

    await context.setOffline(false)
    await status.waitFor({ state: 'detached' })
    assert(
      await offlinePage.locator('.group-candidate-card').count() === 3,
      'Reconnecting must retain the loaded shortlist while queries resume.',
    )
    await assertNoHorizontalOverflow(offlinePage, '320×568 reconnected state')
    assert(errors.length === 0, `Offline recovery browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

async function verifySettingsDataRights(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const settingsPage = await context.newPage()
  const errors = []
  settingsPage.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  settingsPage.on('pageerror', error => errors.push(error.message))
  try {
    await settingsPage.goto(`${origin}/settings?prototype=group`, { waitUntil: 'networkidle' })
    await settingsPage.getByRole('heading', { name: 'SETTINGS' }).waitFor()
    const dataCard = settingsPage.getByRole('region', { name: 'PRIVACY & DATA' })
    await dataCard.getByText('group memberships and contributions', { exact: false }).waitFor()
    await dataCard.getByText('current receipt records', { exact: false }).waitFor()
    assert(await dataCard.getByText('connections', { exact: false }).count() === 0, 'Settings data rights must not lead with retired pair-model vocabulary.')
    const deleteTrigger = dataCard.getByRole('button', { name: 'Delete this account' })
    await deleteTrigger.evaluate(element => element.scrollIntoView({ block: 'center' }))
    const [triggerBox, dockBox] = await Promise.all([
      deleteTrigger.boundingBox(),
      settingsPage.getByRole('navigation', { name: 'Primary' }).boundingBox(),
    ])
    assert(
      Boolean(triggerBox && dockBox && triggerBox.y + triggerBox.height <= dockBox.y - 12),
      'The data export and deletion controls must scroll fully above the fixed dock at 390×844.',
    )
    await settingsPage.screenshot({ path: path.join(artifactDir, 'group-ui-settings-data-mobile.png') })

    await deleteTrigger.click()
    const dialog = settingsPage.getByRole('alertdialog', { name: 'Delete this account?' })
    await dialog.waitFor()
    await dialog.getByText('group memberships and contributions', { exact: false }).waitFor()
    await dialog.getByText('does not claim to erase that data yet.', { exact: false }).waitFor()
    assert(await dialog.getByText('v2 profile', { exact: false }).count() === 0, 'Account deletion must explain the current-app boundary without exposing version jargon.')
    const keepAccount = dialog.getByRole('button', { name: 'Keep my account' })
    await assertFocused(keepAccount, 'Account deletion confirmation must focus the safe Keep my account action first.')
    const permanentDelete = dialog.getByRole('button', { name: 'Permanently delete current account data' })
    assert(await permanentDelete.isDisabled(), 'Permanent deletion must stay disabled before the exact confirmation phrase.')
    await dialog.getByRole('textbox', { name: 'Type DELETE to confirm account deletion' }).fill('DELETE')
    assert(await permanentDelete.isEnabled(), 'The exact DELETE phrase must enable—but never automatically invoke—the destructive action.')
    await dialog.screenshot({ path: path.join(artifactDir, 'group-ui-settings-delete-boundary-mobile.png') })
    await settingsPage.keyboard.press('Escape')
    await dialog.waitFor({ state: 'detached' })
    await assertFocused(deleteTrigger, 'Escape must close account deletion and restore its trigger.')

    await deleteTrigger.click()
    await assertFocused(
      settingsPage.getByRole('alertdialog').getByRole('button', { name: 'Keep my account' }),
      'Reopened account deletion must retain safe initial focus.',
    )
    await settingsPage.getByRole('alertdialog').getByRole('button', { name: 'Keep my account' }).click()
    await assertFocused(deleteTrigger, 'Keep my account must close deletion and restore its trigger.')
    await assertNoHorizontalOverflow(settingsPage, '390×844 Settings data rights')
    assert(errors.length === 0, `Settings data-rights browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

async function verifyProfileResponseTruth(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const errors = []
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(`${origin}/settings?prototype=group&failure=profile-save-response`, { waitUntil: 'networkidle' })
    const profile = page.getByRole('region', { name: 'Your profile' })
    const name = profile.getByRole('textbox', { name: 'Your name' })
    await name.fill('Mika Chen')
    await name.press('Tab')

    const recovery = profile.getByRole('alert', { name: 'Profile change not confirmed' })
    await recovery.waitFor()
    const check = recovery.getByRole('button', { name: 'Check profile' })
    await assertFocused(check, 'An ambiguous profile response must focus its exact Check profile action.')
    assert(await name.inputValue() === 'Mika', 'Profile recovery must retain the last confirmed visible name.')
    assert(await name.isDisabled(), 'Profile recovery must freeze the name field.')
    const swatches = profile.getByRole('group', { name: 'Avatar color' }).getByRole('button')
    assert(await swatches.count() > 0, 'Profile fixture must expose avatar choices.')
    for (let index = 0; index < await swatches.count(); index += 1) {
      assert(await swatches.nth(index).isDisabled(), 'Profile recovery must freeze every competing avatar choice.')
    }
    await recovery.getByText('your name changed to “Mika Chen”', { exact: false }).waitFor()
    const committed = await page.evaluate(() => window.sessionStorage.getItem('__this_is_profile:group-mika'))
    assert(Boolean(committed), 'The profile response fixture must commit the exact attempted profile before withholding success.')
    await assertNoHorizontalOverflow(page, '390×844 profile response recovery')
    await mkdir(artifactDir, { recursive: true })
    await page.screenshot({ path: path.join(artifactDir, 'group-ui-profile-response-recovery-mobile.png'), fullPage: true })

    await check.click()
    await recovery.waitFor({ state: 'detached' })
    assert(await name.inputValue() === 'Mika Chen', 'Checking the exact profile change must reveal its authoritative name.')
    assert(await name.isEnabled(), 'Profile fields must unlock after the exact state is confirmed.')
    const confirmed = await page.evaluate(() => window.sessionStorage.getItem('__this_is_profile:group-mika'))
    assert(confirmed === committed, 'Checking an already-committed profile must preserve its first stored bytes.')
    assert(errors.length === 0, `Profile response-recovery browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

async function verifyOnboardingSetupResponseTruth(browser) {
  const gateContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const gatePage = await gateContext.newPage()
  const gateErrors = []
  gatePage.on('console', message => {
    if (message.type() === 'error') gateErrors.push(message.text())
  })
  gatePage.on('pageerror', error => gateErrors.push(error.message))
  try {
    await gatePage.goto(`${origin}/together?prototype=group&failure=onboarding-gate-read`, { waitUntil: 'networkidle' })
    await gatePage.getByRole('heading', { name: 'Who are we getting together?' }).waitFor()
    assert(new URL(gatePage.url()).pathname === '/together', 'A failed profile read must remain unknown and must not redirect to onboarding.')
    assert(await gatePage.getByRole('heading', { name: 'Who are you?' }).count() === 0, 'Unknown profile data must not masquerade as incomplete onboarding.')
    assert(gateErrors.length === 0, `Onboarding gate read-recovery browser errors: ${gateErrors.join(' | ')}`)
  } finally {
    await gateContext.close()
  }

  const identityContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const identityPage = await identityContext.newPage()
  const identityErrors = []
  identityPage.on('console', message => {
    if (message.type() === 'error') identityErrors.push(message.text())
  })
  identityPage.on('pageerror', error => identityErrors.push(error.message))
  try {
    await identityPage.goto(`${origin}/onboarding?prototype=group&groupInvite=prototype-new-recipient&failure=onboarding-identity-response`, { waitUntil: 'networkidle' })
    const name = identityPage.getByRole('textbox', { name: 'Your name' })
    await name.fill('Nora')
    await identityPage.getByRole('button', { name: 'Continue to invite' }).click()
    const recovery = identityPage.getByRole('alert', { name: 'Onboarding identity not confirmed' })
    await recovery.waitFor()
    const check = identityPage.getByRole('button', { name: 'Check setup' })
    await assertFocused(check, 'Ambiguous invite identity setup must focus its exact Check setup action.')
    assert(await name.inputValue() === 'Nora', 'Invite identity recovery must retain the exact reviewed name.')
    assert(await name.isDisabled(), 'Invite identity recovery must freeze the reviewed name.')
    const swatches = identityPage.getByRole('group', { name: 'Avatar color' }).getByRole('button')
    for (let index = 0; index < await swatches.count(); index += 1) {
      assert(await swatches.nth(index).isDisabled(), 'Invite identity recovery must freeze every avatar choice.')
    }
    await recovery.getByText('it cannot join a group or share Keep', { exact: false }).waitFor()
    const committed = await identityPage.evaluate(() => window.sessionStorage.getItem('__this_is_onboarding:group-mika'))
    assert(Boolean(committed), 'Invite identity response fixture must commit the reviewed identity before withholding success.')
    await assertNoHorizontalOverflow(identityPage, '390×844 invite identity response recovery')
    await mkdir(artifactDir, { recursive: true })
    await identityPage.screenshot({ path: path.join(artifactDir, 'group-ui-onboarding-identity-response-recovery-mobile.png'), fullPage: true })

    await check.click()
    await identityPage.waitForURL(/\/gi\/prototype-new-recipient$/)
    await identityPage.getByRole('button', { name: 'Join Family Sunday' }).waitFor()
    const confirmed = await identityPage.evaluate(() => window.sessionStorage.getItem('__this_is_onboarding:group-mika'))
    assert(confirmed === committed, 'Checking an already-committed invite identity must preserve its first stored bytes.')
    assert(identityErrors.length === 0, `Invite identity response-recovery browser errors: ${identityErrors.join(' | ')}`)
  } finally {
    await identityContext.close()
  }

  const finishContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const finishPage = await finishContext.newPage()
  const finishErrors = []
  finishPage.on('console', message => {
    if (message.type() === 'error') finishErrors.push(message.text())
  })
  finishPage.on('pageerror', error => finishErrors.push(error.message))
  const onboardingPlaceCalls = []
  await finishPage.route('**/__this_is_emulator_places/v1/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    assert(url.origin === origin, 'Onboarding Places proof must stay on the same-origin emulator stub.')
    if (url.pathname === '/__this_is_emulator_places/v1/places:autocomplete') {
      const headers = await request.allHeaders()
      const body = JSON.parse(request.postData() ?? '{}')
      assert(request.method() === 'POST', 'Onboarding autocomplete must use POST.')
      assert(headers['x-goog-api-key'] === 'emulator-only-no-google',
        'Onboarding browser proof must use only its dummy Places key.')
      assert(headers['x-goog-fieldmask'] === 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat.mainText',
        'Onboarding autocomplete must preserve the minimal display field mask.')
      assert(body.input === 'Long ID Cafe' && typeof body.sessionToken === 'string',
        'Onboarding autocomplete must send only the typed query in one session.')
      assert(!('locationBias' in body) && !('locationRestriction' in body),
        'Onboarding autocomplete must not add hidden location targeting.')
      onboardingPlaceCalls.push('autocomplete-unsupported')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          suggestions: [{
            placePrediction: {
              placeId: `ChIJ${'x'.repeat(300)}`,
              text: { text: 'Long ID Cafe, Cresskill, NJ' },
              structuredFormat: { mainText: { text: 'Long ID Cafe' } },
            },
          }],
        }),
      })
      return
    }
    onboardingPlaceCalls.push(`unexpected:${url.pathname}`)
    await route.abort()
  })
  try {
    await finishPage.goto(`${origin}/onboarding?prototype=group&failure=onboarding-finish-response`, { waitUntil: 'networkidle' })
    await finishPage.getByRole('textbox', { name: 'Your name' }).fill('Mika Chen')
    await finishPage.getByRole('button', { name: 'Next' }).click()
    await finishPage.getByRole('heading', { name: 'Keep one place you already love.' }).waitFor()
    assert(await finishPage.locator('.gmp-attribution').getByText('Google Maps', { exact: true }).count() === 1,
      'Onboarding Google autocomplete must carry adjacent Google Maps attribution.')
    await finishPage.getByPlaceholder('Name of a place…').fill('Long ID Cafe')
    await finishPage.getByText('Long ID Cafe, Cresskill, NJ', { exact: true }).waitFor()
    await finishPage.locator('.add-suggestion').getByText('WHY UNAVAILABLE', { exact: true }).click()
    await finishPage.getByText(
      'This Google result can’t be kept safely in this version yet. Choose another result for the same place, or add a different place for now.',
      { exact: true },
    ).waitFor()
    assert(JSON.stringify(onboardingPlaceCalls) === JSON.stringify(['autocomplete-unsupported'])
      && await finishPage.getByRole('heading', { name: 'What do you call this place?' }).count() === 0,
    'Onboarding unsupported provider identifiers must stop before Details or writes.')
    await finishPage.getByRole('button', { name: 'Skip for now' }).click()
    const recovery = finishPage.getByRole('alert', { name: 'Onboarding completion not confirmed' })
    await recovery.waitFor()
    const check = finishPage.getByRole('button', { name: 'Check setup' })
    await assertFocused(check, 'Ambiguous onboarding completion must focus its exact Check setup action.')
    await recovery.getByText('it cannot add a place, join a group, or share Keep', { exact: false }).waitFor()
    const committed = await finishPage.evaluate(() => window.sessionStorage.getItem('__this_is_onboarding:group-mika'))
    const parsed = JSON.parse(committed ?? '{}')
    assert(parsed.displayName === 'Mika Chen' && Number.isFinite(parsed.onboardedAt), 'Completion fixture must commit the exact identity and first onboarding timestamp before withholding success.')
    await assertNoHorizontalOverflow(finishPage, '390×844 onboarding completion response recovery')
    await finishPage.screenshot({ path: path.join(artifactDir, 'group-ui-onboarding-finish-response-recovery-mobile.png'), fullPage: true })

    await check.click()
    await finishPage.waitForURL(/\/together$/)
    const confirmed = await finishPage.evaluate(() => window.sessionStorage.getItem('__this_is_onboarding:group-mika'))
    assert(confirmed === committed, 'Checking completed onboarding must preserve its first stored bytes and timestamp.')
    assert(finishErrors.length === 0, `Onboarding completion response-recovery browser errors: ${finishErrors.join(' | ')}`)
  } finally {
    await finishContext.close()
  }
}

async function verifyAccountDeletionResponseTruth(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const errors = []
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(`${origin}/settings?prototype=group&failure=account-delete-response`, { waitUntil: 'networkidle' })
    const data = page.getByRole('region', { name: 'PRIVACY & DATA' })
    await data.getByRole('button', { name: 'Delete this account' }).click()
    const dialog = data.getByRole('alertdialog', { name: 'Delete this account?' })
    const confirmation = dialog.getByRole('textbox', { name: 'Type DELETE to confirm account deletion' })
    await confirmation.fill('DELETE')
    await dialog.getByRole('button', { name: 'Permanently delete current account data' }).click()

    const recovery = dialog.getByRole('alert', { name: 'Account deletion not confirmed' })
    await recovery.waitFor()
    const check = dialog.getByRole('button', { name: 'Check account deletion' })
    await assertFocused(check, 'An ambiguous account-deletion response must focus the exact Check deletion action.')
    assert(await confirmation.isDisabled(), 'Account-deletion recovery must freeze its destructive confirmation.')
    const started = dialog.getByRole('button', { name: 'Deletion started' })
    assert(await started.isDisabled(), 'Account deletion cannot still offer Keep my account after the irreversible lock may have committed.')
    await recovery.getByText('may already be gone', { exact: false }).waitFor()
    const committed = await page.evaluate(() => window.sessionStorage.getItem('__this_is_account_deletion'))
    assert(Boolean(committed), 'The deletion response fixture must commit its exact operation before withholding success.')
    await assertNoHorizontalOverflow(page, '390×844 account-deletion response recovery')
    await mkdir(artifactDir, { recursive: true })
    await page.screenshot({ path: path.join(artifactDir, 'group-ui-account-delete-response-recovery-mobile.png'), fullPage: true })

    await check.click()
    await recovery.waitFor({ state: 'detached' })
    await dialog.getByText('Deletion confirmed in this development fixture.').waitFor()
    const confirmed = await page.evaluate(() => window.sessionStorage.getItem('__this_is_account_deletion'))
    assert(confirmed === committed, 'Checking an already-started account deletion must preserve its first operation bytes.')
    assert(errors.length === 0, `Account-deletion response-recovery browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

async function verifyPrivacyRecovery(browser) {
  const context = await browser.newContext({
    viewport: { width: 320, height: 568 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const privacyPage = await context.newPage()
  const errors = []
  privacyPage.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  privacyPage.on('pageerror', error => errors.push(error.message))
  try {
    await privacyPage.goto(`${origin}/g/prototype-revoked?prototype=group&failure=permission`, { waitUntil: 'networkidle' })
    await privacyPage.getByRole('heading', { name: 'Your access to this group changed.' }).waitFor()
    await privacyPage.getByText('No group taste evidence was shown. Return to Together to see groups you currently belong to.').waitFor()
    assert(
      await privacyPage.locator('.group-candidate-card').count() === 0,
      'Revoked group access must render no candidate or taste evidence.',
    )
    await assertNoHorizontalOverflow(privacyPage, '320×568 revoked group access')
    await privacyPage.screenshot({ path: path.join(artifactDir, 'group-ui-access-changed-narrow.png'), fullPage: true })
    await privacyPage.getByRole('button', { name: 'Back to Together' }).click()
    await privacyPage.getByRole('heading', { name: 'Who are we getting together?' }).waitFor()

    await privacyPage.goto(`${origin}/p/prototype-missing?prototype=group`, { waitUntil: 'domcontentloaded' })
    await privacyPage.getByRole('heading', { name: 'We couldn’t find this place.' }).waitFor()
    await privacyPage.getByText('The link may be old, or Google may no longer return it. Nothing in your Keep was removed.').waitFor()
    assert(
      await privacyPage.getByRole('button', { name: /Want|Tried|Loved/ }).count() === 0,
      'An unavailable place must not expose a save mutation control.',
    )
    await assertNoHorizontalOverflow(privacyPage, '320×568 unavailable place')
    await privacyPage.screenshot({ path: path.join(artifactDir, 'group-ui-place-unavailable-narrow.png'), fullPage: true })
    await privacyPage.getByRole('link', { name: 'Find the place again' }).click()
    await privacyPage.waitForURL(/\/add$/)
    await privacyPage.getByRole('heading', { name: 'Paste the link, or type the name.' }).waitFor()
    assert(errors.length === 0, `Privacy recovery browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

async function verifyFocusedPlaceRecovery(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const errors = []
  const providerRequests = []
  const observe = page => {
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => {
      if (/places\.googleapis\.com/.test(request.url())) providerRequests.push(request.url())
    })
  }
  try {
    const memoryPage = await context.newPage()
    observe(memoryPage)
    await memoryPage.goto(`${origin}/p/group-sunlight?prototype=group&failure=closeup-memory`, { waitUntil: 'networkidle' })
    await memoryPage.getByRole('heading', { name: 'We couldn’t load this place.' }).waitFor()
    await memoryPage.getByText('No saved label, note, or sharing state was shown.', { exact: false }).waitFor()
    assert(await memoryPage.getByText('Sunlight Coffee', { exact: true }).count() === 0, 'A cold personal-place read must fail closed without the saved label.')
    assert(await memoryPage.getByRole('group', { name: 'Save as' }).count() === 0, 'A cold personal-place read must expose no save mutation controls.')
    assert(await memoryPage.getByText('PLACE UNAVAILABLE', { exact: true }).count() === 0, 'A private-memory read failure must not masquerade as a missing provider place.')
    assert(providerRequests.length === 0, 'A failed private-memory lookup must stop before paid Place Details.')
    await assertNoHorizontalOverflow(memoryPage, '390×844 private-place recovery')
    await memoryPage.screenshot({ path: path.join(artifactDir, 'group-ui-closeup-memory-recovery-mobile.png'), fullPage: true })
    await memoryPage.getByRole('button', { name: 'Try again' }).click()
    await memoryPage.getByRole('heading', { name: 'Sunlight Coffee', level: 1 }).waitFor()
    assert(!new URL(memoryPage.url()).searchParams.has('failure'), 'Private-place retry must leave the development failure state.')
    await memoryPage.close()

    const pickPage = await context.newPage()
    observe(pickPage)
    await pickPage.goto(`${origin}/p/group-sunlight?pick=prototype-focused-pick&prototype=group&failure=closeup-pick`, { waitUntil: 'networkidle' })
    await pickPage.getByRole('heading', { name: 'We couldn’t load this Pick.' }).waitFor()
    await pickPage.getByText('No place, group, attendee, or shared reason was shown.', { exact: false }).waitFor()
    assert(await pickPage.getByText('Sunlight Coffee', { exact: true }).count() === 0, 'A cold Pick read must reveal no place identity.')
    assert(await pickPage.getByText('Friday Table', { exact: true }).count() === 0, 'A cold Pick read must reveal no group identity.')
    assert(await pickPage.getByText('PLACE UNAVAILABLE', { exact: true }).count() === 0, 'A Pick read failure must not masquerade as a missing provider place.')
    assert(providerRequests.length === 0, 'A failed Pick lookup must stop before paid Place Details.')
    await assertNoHorizontalOverflow(pickPage, '390×844 private-Pick recovery')
    await pickPage.screenshot({ path: path.join(artifactDir, 'group-ui-closeup-pick-recovery-mobile.png'), fullPage: true })
    await pickPage.close()

    const pickKeepPage = await context.newPage()
    observe(pickKeepPage)
    await pickKeepPage.addInitScript(() => {
      window.sessionStorage.setItem('__this_is_pick:prototype-focused-pick', JSON.stringify({
        kind: 'group',
        id: 'prototype-focused-pick',
        groupId: 'prototype-friday-table',
        groupName: 'Friday Table',
        groupPermissionVersion: 1,
        createdBy: 'group-mika',
        memberUids: ['group-mika', 'group-vivian'],
        attendeeUids: ['group-mika', 'group-vivian'],
        attendees: [
          { uid: 'group-mika', displayName: 'Mika', avatarHex: '#8E5A6B' },
          { uid: 'group-vivian', displayName: 'Vivian', avatarHex: '#5A6B8E' },
        ],
        placeId: 'group-sunlight',
        memory: {
          placeId: 'group-sunlight', label: 'Sunlight Coffee', category: 'coffee',
          hex: '#5A463C', provenance: 'user_confirmed',
        },
        reasonCode: 'everyone_wants',
        reason: 'All 2 want this.',
        context: 'Anything',
        status: 'visited',
        createdAt: 1,
        updatedAt: 2,
      }))
    })
    await pickKeepPage.goto(`${origin}/p/group-sunlight?pick=prototype-focused-pick&prototype=group&failure=closeup-memory`, { waitUntil: 'networkidle' })
    await pickKeepPage.getByRole('heading', { name: 'Sunlight Coffee', level: 1 }).waitFor()
    await pickKeepPage.getByRole('heading', { name: 'The group went.', level: 2 }).waitFor()
    await pickKeepPage.getByText('All 2 want this.', { exact: true }).waitFor()
    const keepWarning = pickKeepPage.getByRole('status').filter({ hasText: 'Your Keep couldn’t be checked.' })
    await keepWarning.getByRole('button', { name: 'Check my Keep' }).waitFor()
    assert(await pickKeepPage.getByRole('button', { name: 'Keep as Tried' }).count() === 0, 'A visited Pick must not offer a personal outcome while private Keep is unavailable.')
    assert(await pickKeepPage.getByRole('group', { name: 'Save as' }).count() === 0, 'A loaded Pick must not expose alternate personal save controls while Keep is unavailable.')
    assert(providerRequests.length === 0, 'Durable Pick memory must lead without a paid Details fallback while private Keep is unavailable.')
    await assertNoHorizontalOverflow(pickKeepPage, '390×844 Pick with unavailable private Keep')
    await pickKeepPage.screenshot({ path: path.join(artifactDir, 'group-ui-closeup-pick-keep-warning-mobile.png'), fullPage: true })
    await keepWarning.getByRole('button', { name: 'Check my Keep' }).click()
    await pickKeepPage.getByRole('button', { name: 'Keep as Tried' }).waitFor()
    assert(!new URL(pickKeepPage.url()).searchParams.has('failure'), 'Pick Keep retry must restore personal outcome controls.')
    assert(errors.length === 0, `Focused place recovery browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

async function verifyNewAttendeePickMemory(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const outcomePage = await context.newPage()
  const errors = []
  outcomePage.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  outcomePage.on('pageerror', error => errors.push(error.message))
  try {
    await outcomePage.goto(`${origin}/g/prototype-evidence-lab?prototype=group`, { waitUntil: 'networkidle' })
    await outcomePage.getByRole('heading', { name: 'Three places. Real reasons.' }).waitFor()
    const glassHouse = outcomePage.locator('.group-candidate-card').filter({ hasText: 'Glass House' })
    await glassHouse.locator('.group-candidate-choice').click()
    const resolution = await assertCompactPickResolution(outcomePage, 'No-prior-save')
    await resolution.getByText('Glass House', { exact: true }).waitFor()
    await resolution.getByRole('button', { name: 'Make this the Pick' }).click()
    await outcomePage.waitForURL(/\/p\/group-glass-house\?pick=prototype-group-pick-group-glass-house$/)
    await outcomePage.getByRole('heading', { name: 'Glass House', level: 1 }).waitFor()
    await outcomePage.locator('.pick-after-visit > summary').click()
    await outcomePage.getByRole('button', { name: 'We went' }).click()
    await outcomePage.getByRole('heading', { name: 'The group went.', level: 2 }).waitFor()
    await outcomePage.getByText('How was it for you? Only your Keep changes.', { exact: true }).waitFor()
    await outcomePage.getByRole('button', { name: 'Keep as Loved' }).click()

    const confirmation = outcomePage.locator('.place-memory-confirm')
    await confirmation.getByRole('heading', { name: 'What do you call this place?' }).waitFor()
    await confirmation.getByText('This came from the group’s Pick. Confirm or rewrite it before it becomes your private place memory.').waitFor()
    assert(
      await confirmation.getByRole('textbox', { name: 'Your label for this place' }).inputValue() === 'Glass House',
      'A new attendee must receive the chosen Pick label as editable confirmation input.',
    )
    assert(
      await confirmation.getByRole('button', { name: 'Activity' }).getAttribute('aria-pressed') === 'true',
      'A new attendee must receive the chosen Pick category as editable confirmation input.',
    )
    assert(
      await confirmation.getByRole('textbox', { name: 'Area for this place' }).inputValue() === '',
      'Missing Pick area must stay unknown rather than being inferred from the attendee.',
    )
    assert(
      await confirmation.getByText(/Google Maps place:/).count() === 0,
      'A Pick-memory handoff must not misrepresent the group label as Google data.',
    )
    const beforeConfirm = await outcomePage.evaluate(() =>
      window.sessionStorage.getItem('__this_is_signal:group-mika:group-glass-house'))
    assert(beforeConfirm === null, 'Prefilling Pick memory must not save it before explicit confirmation.')
    await assertNoHorizontalOverflow(outcomePage, 'new-attendee Pick memory confirmation')
    await outcomePage.screenshot({
      path: path.join(artifactDir, 'group-ui-pick-new-memory-mobile.png'), fullPage: true,
    })

    await confirmation.getByRole('button', { name: 'Keep as Loved for me' }).click()
    await outcomePage.getByText('Your Keep says loved. Other people choose for themselves.').waitFor()
    const storedSignal = await outcomePage.evaluate(() => {
      const value = window.sessionStorage.getItem('__this_is_signal:group-mika:group-glass-house')
      return value ? JSON.parse(value) : null
    })
    assert(
      storedSignal?.tag === 'loved'
        && storedSignal.visibility === 'private'
        && storedSignal.memory?.label === 'Glass House'
        && storedSignal.memory?.category === 'activity'
        && storedSignal.memory?.area === undefined,
      `A confirmed Pick outcome must create only a private personal memory; received ${JSON.stringify(storedSignal)}.`,
    )
    const groupShare = outcomePage.locator('.group-share-item[aria-label="Candidate Evidence Lab sharing"]')
    await groupShare.getByRole('button', { name: 'Share with Candidate Evidence Lab' }).waitFor()
    assert(
      await groupShare.getByText('Not shared with this group', { exact: true }).count() === 1,
      'A personal Pick outcome must not silently project the place back into its group.',
    )
    await assertNoHorizontalOverflow(outcomePage, 'new-attendee saved Pick outcome')
    await outcomePage.screenshot({
      path: path.join(artifactDir, 'group-ui-pick-new-attendee-loved-mobile.png'), fullPage: true,
    })
    assert(errors.length === 0, `New-attendee Pick memory browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

async function verifyPickCreationRecovery(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const errors = []
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(`${origin}/g/prototype-evidence-lab?prototype=group&failure=pick-create-response`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: 'Three places. Real reasons.' }).waitFor()
    const supperClub = page.locator('.group-candidate-card').filter({ hasText: 'Supper Club' })
    await supperClub.locator('.group-candidate-choice').click()
    const resolution = await assertCompactPickResolution(page, 'Pick response recovery')
    await resolution.getByRole('button', { name: 'Make this the Pick' }).click()
    await resolution.getByRole('alert').getByText(/confirm whether the Pick was made\. Checking again .* make a second Pick\./).waitFor()
    assert(new URL(page.url()).pathname === '/g/prototype-evidence-lab', 'A lost Pick response must remain at the reviewed commitment until recovery finishes.')
    assert(await resolution.getByRole('button', { name: 'Make this the Pick' }).count() === 0, 'An ambiguous Pick response must not present the recovery as a fresh commitment.')
    const firstAttemptKey = await page.evaluate(() =>
      window.sessionStorage.getItem('__this_is_pending_group_pick:prototype-evidence-lab'))
    assert(Boolean(firstAttemptKey), 'An unresolved Pick response must retain one opaque operation identity.')
    await assertNoHorizontalOverflow(page, '390Ã—844 Pick response recovery')
    await page.screenshot({ path: path.join(artifactDir, 'group-ui-pick-create-recovery-mobile.png'), fullPage: true })

    await resolution.getByRole('button', { name: 'Check Pick' }).click()
    await page.waitForURL(/\/p\/group-supper-club\?pick=prototype-group-pick-group-supper-club$/)
    await page.getByRole('heading', { name: 'Supper Club', level: 1 }).waitFor()
    const pendingKeyAfterRecovery = await page.evaluate(() =>
      window.sessionStorage.getItem('__this_is_pending_group_pick:prototype-evidence-lab'))
    assert(pendingKeyAfterRecovery === null, 'Confirmed Pick recovery must clear its pending operation identity.')
    const storedPick = await page.evaluate(() =>
      window.sessionStorage.getItem('__this_is_pick:prototype-group-pick-group-supper-club'))
    assert(Boolean(storedPick), 'Pick recovery must open the one committed Pick rather than fabricate a second result.')
    assert(errors.length === 0, `Pick-response recovery browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

async function verifyPickCloseRecovery(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  await context.addInitScript(() => {
    const basePick = {
      kind: 'group',
      groupId: 'prototype-evidence-lab',
      groupName: 'Candidate Evidence Lab',
      groupPermissionVersion: 1,
      createdBy: 'group-mika',
      memberUids: ['group-mika', 'group-vivian', 'group-ari'],
      attendeeUids: ['group-mika', 'group-vivian', 'group-ari'],
      attendees: [
        { uid: 'group-mika', displayName: 'Mika', avatarHex: '#8E5A6B' },
        { uid: 'group-vivian', displayName: 'Vivian', avatarHex: '#5A6B8E' },
        { uid: 'group-ari', displayName: 'Ari', avatarHex: '#6B8E5A' },
      ],
      placeId: 'group-supper-club',
      memory: {
        placeId: 'group-supper-club', label: 'Supper Club', category: 'food', area: 'Cresskill, NJ',
        hex: '#704739', provenance: 'user_confirmed',
      },
      reasonCode: 'everyone_wants',
      reason: 'Everyone has a reason to go.',
      context: 'Anything',
      status: 'selected',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    for (const id of ['prototype-close-visited', 'prototype-close-dismissed']) {
      window.sessionStorage.setItem(`__this_is_pick:${id}`, JSON.stringify({
        ...basePick, id, shareToken: `prototype-receipt-${id}`,
      }))
    }
  })
  const errors = []
  const observe = page => {
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', error => errors.push(error.message))
  }
  try {
    const visitedPage = await context.newPage()
    observe(visitedPage)
    await visitedPage.goto(`${origin}/p/group-supper-club?pick=prototype-close-visited&prototype=group&failure=pick-close-response`, { waitUntil: 'networkidle' })
    await visitedPage.locator('.pick-after-visit > summary').click()
    await visitedPage.getByRole('button', { name: 'We went' }).click()
    await visitedPage.getByRole('alert').getByText(/confirm how the Pick closed\. Checking again .* close it twice or change the outcome\./).waitFor()
    assert(await visitedPage.getByRole('button', { name: 'We went' }).count() === 0, 'An ambiguous visited response must not offer a fresh closure action.')
    await visitedPage.getByRole('button', { name: 'Check outcome' }).waitFor()
    const visitedCommit = await visitedPage.evaluate(() => {
      const value = window.sessionStorage.getItem('__this_is_pick:prototype-close-visited')
      return value ? JSON.parse(value) : null
    })
    assert(visitedCommit?.status === 'visited', 'The lost-response fixture must commit visited before hiding its response.')
    await assertNoHorizontalOverflow(visitedPage, '390Ã—844 visited Pick recovery')
    await visitedPage.screenshot({ path: path.join(artifactDir, 'group-ui-pick-visited-recovery-mobile.png'), fullPage: true })
    await visitedPage.getByRole('button', { name: 'Check outcome' }).click()
    await visitedPage.getByRole('heading', { name: 'The group went.', level: 2 }).waitFor()
    await visitedPage.getByText('How was it for you? Only your Keep changes.', { exact: true }).waitFor()
    await visitedPage.close()

    const dismissedPage = await context.newPage()
    observe(dismissedPage)
    await dismissedPage.goto(`${origin}/p/group-supper-club?pick=prototype-close-dismissed&prototype=group&failure=pick-close-response`, { waitUntil: 'networkidle' })
    await dismissedPage.locator('.pick-after-visit > summary').click()
    await dismissedPage.getByRole('button', { name: 'Not for us' }).click()
    const dialog = dismissedPage.getByRole('alertdialog', { name: 'Close this Pick for everyone?' })
    await dialog.getByRole('button', { name: 'Close as Not for us' }).click()
    await dialog.getByRole('alert').getByText(/confirm how the Pick closed\. Checking again .* close it twice or change the outcome\./).waitFor()
    assert(await dialog.getByText('It is still open', { exact: false }).count() === 0, 'An ambiguous dismissal must not claim that the Pick remains open.')
    await dialog.getByRole('button', { name: 'Check outcome' }).waitFor()
    const dismissedCommit = await dismissedPage.evaluate(() => {
      const value = window.sessionStorage.getItem('__this_is_pick:prototype-close-dismissed')
      return value ? JSON.parse(value) : null
    })
    assert(
      dismissedCommit?.status === 'dismissed' && dismissedCommit.shareToken === undefined,
      'The lost-response fixture must commit dismissal and revoke its receipt before hiding the response.',
    )
    await assertNoHorizontalOverflow(dismissedPage, '390Ã—844 dismissed Pick recovery')
    await dismissedPage.screenshot({ path: path.join(artifactDir, 'group-ui-pick-dismiss-recovery-mobile.png'), fullPage: true })
    await dialog.getByRole('button', { name: 'Check outcome' }).click()
    await dismissedPage.getByRole('heading', { name: 'Not for us.', level: 2 }).waitFor()
    assert(errors.length === 0, `Pick-close recovery browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

async function verifyReceiptRevocationRecovery(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  await context.addInitScript(() => {
    window.sessionStorage.setItem('__this_is_pick:prototype-receipt-recovery', JSON.stringify({
      kind: 'group',
      id: 'prototype-receipt-recovery',
      groupId: 'prototype-evidence-lab',
      groupName: 'Candidate Evidence Lab',
      groupPermissionVersion: 1,
      createdBy: 'group-mika',
      memberUids: ['group-mika', 'group-vivian', 'group-ari'],
      attendeeUids: ['group-mika', 'group-vivian', 'group-ari'],
      attendees: [
        { uid: 'group-mika', displayName: 'Mika', avatarHex: '#8E5A6B' },
        { uid: 'group-vivian', displayName: 'Vivian', avatarHex: '#5A6B8E' },
        { uid: 'group-ari', displayName: 'Ari', avatarHex: '#6B8E5A' },
      ],
      placeId: 'group-supper-club',
      memory: {
        placeId: 'group-supper-club', label: 'Supper Club', category: 'food', area: 'Cresskill, NJ',
        hex: '#704739', provenance: 'user_confirmed',
      },
      reasonCode: 'everyone_wants',
      reason: 'Everyone has a reason to go.',
      context: 'Anything',
      shareToken: 'prototype-receipt-recovery-token',
      status: 'selected',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }))
  })
  const page = await context.newPage()
  const errors = []
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(`${origin}/p/group-supper-club?pick=prototype-receipt-recovery&prototype=group&failure=pick-receipt-revoke-response`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Revoke link' }).click()
    const dialog = page.getByRole('alertdialog', { name: 'Stop this Pick link?' })
    await dialog.getByRole('button', { name: 'Revoke public link' }).click()
    await dialog.getByRole('alert').getByText(/confirm whether the public link was revoked\. Checking again can only remove that same link/).waitFor()
    assert(await dialog.getByText('It still works', { exact: false }).count() === 0, 'An ambiguous receipt response must not claim that the public link still works.')
    assert(await page.getByRole('alert').count() === 1, 'Receipt recovery must not announce the same ambiguity behind and inside its dialog.')
    assert(await page.getByRole('button', { name: 'Share Pick' }).count() === 0, 'An unresolved revocation must not offer the uncertain link for sharing again.')
    const committed = await page.evaluate(() => {
      const value = window.sessionStorage.getItem('__this_is_pick:prototype-receipt-recovery')
      return value ? JSON.parse(value) : null
    })
    assert(committed && committed.shareToken === undefined, 'The lost-response fixture must revoke the receipt before hiding its response.')
    await dialog.getByRole('button', { name: 'Close for now' }).click()
    const checkLink = page.getByRole('button', { name: 'Check link' })
    await assertFocused(checkLink, 'Closing ambiguous receipt recovery must focus its one safe Check link action.')
    await assertNoHorizontalOverflow(page, '390Ã—844 Pick receipt revocation recovery')
    await page.screenshot({ path: path.join(artifactDir, 'group-ui-pick-link-revoke-recovery-mobile.png'), fullPage: true })
    await checkLink.click()
    await page.getByRole('alertdialog', { name: 'Stop this Pick link?' }).getByRole('button', { name: 'Check link' }).click()
    await page.getByText('Public link revoked.', { exact: true }).waitFor()
    assert(await page.getByRole('button', { name: 'Share Pick' }).count() === 0, 'Confirmed receipt recovery must remove its sharing controls.')
    assert(errors.length === 0, `Pick receipt revocation recovery browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

async function verifyPickLifecycle(browser, outcome) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
    permissions: ['clipboard-read', 'clipboard-write'],
  })
  const lifecyclePage = await context.newPage()
  await lifecyclePage.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
  })
  const errors = []
  lifecyclePage.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  lifecyclePage.on('pageerror', error => errors.push(error.message))
  try {
    await lifecyclePage.goto(`${origin}/g/prototype-evidence-lab?prototype=group`, { waitUntil: 'networkidle' })
    await lifecyclePage.getByRole('heading', { name: 'Three places. Real reasons.' }).waitFor()
    await lifecyclePage.locator('.group-plan-details summary').click()
    await lifecyclePage.getByRole('textbox', { name: 'Area for this plan' }).fill('Cresskill')
    await lifecyclePage.getByRole('button', { name: 'Quiet enough to talk', exact: true }).click()
    assert(await lifecyclePage.locator('.group-candidate-card').count() === 1, 'Plan context must narrow the lifecycle proof to one evidenced candidate.')
    await lifecyclePage.getByRole('heading', { name: 'One place. A real reason.' }).waitFor()
    await lifecyclePage.getByRole('button', { name: 'Guest' }).click()
    await lifecyclePage.locator('.group-candidate-choice').first().click()
    const resolution = await assertCompactPickResolution(lifecyclePage, `${outcome} Pick`, 210)
    await resolution.getByText('Cresskill', { exact: true }).waitFor()
    await resolution.getByText('Quiet enough to talk', { exact: true }).waitFor()
    await resolution.getByRole('button', { name: 'Make this the Pick' }).click()
    await lifecyclePage.waitForURL(/\/p\/group-supper-club\?pick=prototype-group-pick-group-supper-club$/)
    await lifecyclePage.getByRole('heading', { name: 'Supper Club', level: 1 }).waitFor()
    await lifecyclePage.getByText('CANDIDATE EVIDENCE LAB · 4 GOING').waitFor()
    await lifecyclePage.getByRole('heading', { name: '2 of 4 want or love this.', level: 2 }).waitFor()
    const pickReturn = lifecyclePage.locator('.pick-return')
    await pickReturn.getByText('Cresskill', { exact: true }).waitFor()
    await pickReturn.getByText('Quiet enough to talk', { exact: true }).waitFor()
    const storedPickContext = await lifecyclePage.evaluate(() => {
      const value = window.sessionStorage.getItem('__this_is_pick:prototype-group-pick-group-supper-club')
      const pick = value ? JSON.parse(value) : null
      return pick ? { planArea: pick.planArea, requiredObservation: pick.requiredObservation } : null
    })
    assert(storedPickContext?.planArea === 'Cresskill' && storedPickContext.requiredObservation === 'quiet', 'The temporary decision context must survive navigation as bounded Pick context.')
    await lifecyclePage.screenshot({ path: path.join(artifactDir, 'group-ui-pick-context-mobile.png'), fullPage: true })

    await lifecyclePage.goto(`${origin}/together?prototype=group`, { waitUntil: 'networkidle' })
    const groupCard = lifecyclePage.getByRole('link', { name: /Candidate Evidence Lab/ })
    await groupCard.getByText('Current Pick · Supper Club', { exact: true }).waitFor()
    assert(await groupCard.evaluate(element => element.classList.contains('has-current-pick')), 'Only a real current Pick may receive Together’s strong recovery treatment.')
    assert(
      await lifecyclePage.locator('.group-index-card').first().getAttribute('href') === '/g/prototype-evidence-lab',
      'A group with a current Pick must move ahead of ordinary groups as a recovery task.',
    )
    const [currentCardRight, currentArrowRight] = await Promise.all([
      groupCard.evaluate(element => element.getBoundingClientRect().right),
      groupCard.locator('.group-index-arrow').evaluate(element => element.getBoundingClientRect().right),
    ])
    assert(
      currentCardRight - currentArrowRight >= 16 && currentCardRight - currentArrowRight <= 24,
      'The current-Pick material must not dislodge its navigation arrow from the right edge.',
    )
    const [currentPickCardBox, ordinaryCardBox] = await Promise.all([
      groupCard.boundingBox(),
      lifecyclePage.locator('.group-index-card.is-active').first().boundingBox(),
    ])
    assert(
      currentPickCardBox && ordinaryCardBox
        && currentPickCardBox.height >= 210
        && ordinaryCardBox.height <= 170
        && currentPickCardBox.height - ordinaryCardBox.height >= 40,
      'A real current Pick must retain materially stronger recovery prominence than ordinary groups.',
    )
    await lifecyclePage.screenshot({ path: path.join(artifactDir, 'group-ui-together-current-pick-mobile.png'), fullPage: true })
    await groupCard.click()
    const currentPick = lifecyclePage.locator('.group-current-pick')
    await currentPick.getByText('CURRENT PICK · 4 GOING', { exact: true }).waitFor()
    await currentPick.getByRole('heading', { name: 'Supper Club' }).waitFor()
    await currentPick.getByText('Close this Pick after the outing before this group starts another.').waitFor()
    assert(
      await lifecyclePage.getByRole('heading', { name: 'Three places. Real reasons.' }).count() === 0,
      'An open Pick must replace the shortlist promise instead of appearing below stale planning copy.',
    )
    const [pickTop, audienceTop] = await Promise.all([
      currentPick.evaluate(element => element.getBoundingClientRect().top),
      lifecyclePage.locator('.group-audience-state').evaluate(element => element.getBoundingClientRect().top),
    ])
    assert(pickTop < audienceTop, 'The current Pick must lead the page before supporting audience detail.')
    assert(await lifecyclePage.getByRole('button', { name: 'Guest' }).count() === 0, 'An open Pick must replace a second unsynchronized plan draft.')
    if (outcome === 'dismissed') {
      await lifecyclePage.screenshot({ path: path.join(artifactDir, 'group-ui-current-pick-mobile.png'), fullPage: true })
    }
    await currentPick.getByRole('link', { name: 'Open current Pick' }).click()
    await lifecyclePage.getByRole('heading', { name: 'Supper Club', level: 1 }).waitFor()

    const pickStatusSummary = lifecyclePage.locator('.pick-status-summary')
    assert(await pickStatusSummary.getAttribute('role') === 'status', 'The Pick summary must expose one live status region.')
    assert(await pickStatusSummary.getAttribute('aria-live') === 'polite', 'The Pick summary must announce updates politely.')
    assert(await pickStatusSummary.getAttribute('aria-atomic') === 'true', 'The Pick summary must announce one atomic update.')
    assert(await lifecyclePage.locator('.pick-return .pick-status-summary').count() === 1, 'A Pick must expose exactly one terminal-status live region.')
    const mapsHandoff = lifecyclePage.getByRole('link', { name: 'Open in Google Maps ↗' })
    const mapsHandoffHref = await mapsHandoff.getAttribute('href')
    assert(Boolean(mapsHandoffHref), 'An open Pick must lead with one explicit Google Maps logistics handoff.')
    const directionsUrl = new URL(mapsHandoffHref)
    assert(
      directionsUrl.hostname === 'www.google.com'
        && directionsUrl.pathname === '/maps/search/'
        && directionsUrl.searchParams.get('query') === 'Supper Club',
      `The Pick Maps handoff must be a bounded Google Maps place search; received ${mapsHandoffHref}.`,
    )
    const personalMemory = lifecyclePage.locator('.closeup-personal-memory.is-secondary')
    const personalMemorySummary = personalMemory.locator(':scope > summary')
    await personalMemorySummary.getByText('YOUR PRIVATE KEEP', { exact: true }).waitFor()
    await personalMemorySummary.getByText('Want stays yours.', { exact: false }).waitFor()
    assert(
      await personalMemory.evaluate(element => !element.hasAttribute('open')),
      'An open shared Pick must keep personal-memory maintenance collapsed by default.',
    )
    const afterVisit = lifecyclePage.locator('.pick-after-visit')
    assert(
      await afterVisit.evaluate(element => element.tagName === 'DETAILS' && !element.hasAttribute('open')),
      'After-outing maintenance must start collapsed on a newly committed Pick.',
    )
    const [mapsBox, afterVisitBox, reasonBox] = await Promise.all([
      mapsHandoff.boundingBox(),
      afterVisit.boundingBox(),
      lifecyclePage.locator('.pick-status-summary > .t-row-title').boundingBox(),
    ])
    assert(
      mapsBox && afterVisitBox && mapsBox.y < afterVisitBox.y && mapsBox.y + mapsBox.height <= 844,
      'The Maps handoff must lead before after-outing controls and fit in the first mobile viewport.',
    )
    assert(
      reasonBox && mapsBox && reasonBox.y < mapsBox.y && reasonBox.y < 844,
      'The named group Pick reason must remain the first visible group evidence on its place route.',
    )
    await personalMemorySummary.click()
    assert(
      await personalMemory.evaluate(element => element.hasAttribute('open'))
        && await personalMemory.getByRole('button', { name: 'Edit' }).isVisible(),
      'Personal Keep must remain deliberately reachable while the shared Pick is open.',
    )
    await personalMemorySummary.click()
    assert(
      await personalMemory.evaluate(element => !element.hasAttribute('open')),
      'Closing the personal-memory disclosure must restore the focused Pick view.',
    )

    if (outcome === 'loved') {
      const receiptControls = lifecyclePage.locator('.pick-receipt-controls')
      await receiptControls.getByText('SEND TO THE CHAT', { exact: true }).waitFor()
      await receiptControls.getByText('A 30-day no-sign-in link shows this place, the broad reason, and how many are going.', { exact: false }).waitFor()
      await receiptControls.getByText('No names, notes, or taste history.', { exact: false }).waitFor()
      const sharePick = receiptControls.getByRole('button', { name: 'Share Pick' })
      await sharePick.click()
      await lifecyclePage.getByText('Pick link copied. Paste it into the chat.', { exact: true }).waitFor()
      const copiedPickUrl = await lifecyclePage.evaluate(() => navigator.clipboard.readText())
      assert(
        copiedPickUrl === `${origin}/pick/prototype-receipt-group-supper-club`,
        `The chat bridge must copy only the opaque public receipt URL; received ${copiedPickUrl}.`,
      )
      await lifecyclePage.screenshot({ path: path.join(artifactDir, 'group-ui-pick-chat-bridge-mobile.png'), fullPage: true })

      const revokeLink = receiptControls.getByRole('button', { name: 'Revoke link' })
      await revokeLink.click()
      const revokeDialog = lifecyclePage.getByRole('alertdialog')
      await revokeDialog.getByRole('heading', { name: 'Stop this Pick link?' }).waitFor()
      await revokeDialog.getByText('Anyone you sent it to will lose access. The Pick stays open, but this link cannot be restored or replaced.').waitFor()
      const keepLinkActive = revokeDialog.getByRole('button', { name: 'Keep link active' })
      await assertFocused(keepLinkActive, 'Receipt revocation must focus the safe Keep link active action first.')
      await lifecyclePage.keyboard.press('Escape')
      await assertFocused(revokeLink, 'Escape must close receipt revocation and restore its trigger.')
      await revokeLink.click()
      await lifecyclePage.screenshot({ path: path.join(artifactDir, 'group-ui-pick-link-revoke-mobile.png') })
      await lifecyclePage.getByRole('alertdialog').getByRole('button', { name: 'Revoke public link' }).click()
      await lifecyclePage.getByText('Public link revoked.', { exact: true }).waitFor()
      assert(await lifecyclePage.getByRole('button', { name: 'Share Pick' }).count() === 0, 'A revoked receipt must remove its sharing control.')
      const storedShareToken = await lifecyclePage.evaluate(() => {
        const value = window.sessionStorage.getItem('__this_is_pick:prototype-group-pick-group-supper-club')
        return value ? JSON.parse(value).shareToken ?? null : 'missing-pick'
      })
      assert(storedShareToken === null, 'Prototype revocation must persist across the same recovery boundary as the Pick.')
      await afterVisit.locator(':scope > summary').waitFor()
    }

    await afterVisit.locator(':scope > summary').click()
    assert(
      await afterVisit.evaluate(element => element.hasAttribute('open')),
      'After-outing controls must remain directly reachable when the plan is actually over.',
    )
    if (outcome === 'dismissed') {
      const dismissTrigger = lifecyclePage.getByRole('button', { name: 'Not for us' })
      await dismissTrigger.click()
      const dismissDialog = lifecyclePage.getByRole('alertdialog')
      await dismissDialog.getByRole('heading', { name: 'Close this Pick for everyone?' }).waitFor()
      await dismissDialog.getByText('This closes it for all 4 people going, revokes any public link, and will not show a Last Pick saying the group went. Nobody’s personal Keep changes. You can’t undo this.').waitFor()
      const keepPickOpen = dismissDialog.getByRole('button', { name: 'Keep Pick open' })
      await assertFocused(keepPickOpen, 'Pick dismissal confirmation must focus the safe Keep Pick open action first.')
      await lifecyclePage.keyboard.press('Escape')
      await assertFocused(dismissTrigger, 'Escape must close the Pick dismissal confirmation and restore its trigger.')
      assert(await lifecyclePage.getByRole('heading', { name: 'Not for us.', level: 2 }).count() === 0, 'Canceling Pick dismissal must leave the Pick open.')
      await dismissTrigger.click()
      await lifecyclePage.screenshot({ path: path.join(artifactDir, 'group-ui-pick-dismiss-confirm-mobile.png'), fullPage: true })
      await lifecyclePage.getByRole('alertdialog').getByRole('button', { name: 'Close as Not for us' }).click()
      const terminalHeading = lifecyclePage.getByRole('heading', { name: 'Not for us.', level: 2 })
      await terminalHeading.waitFor()
      await assertFocused(terminalHeading, 'A locally dismissed Pick must move focus to its truthful terminal heading.')
      const terminalHeadingBox = await terminalHeading.boundingBox()
      assert(
        terminalHeadingBox && terminalHeadingBox.y >= 0 && terminalHeadingBox.y + terminalHeadingBox.height <= 844,
        'A locally dismissed Pick must scroll its focused terminal heading into the 390×844 viewport.',
      )
      await pickStatusSummary.getByText('CANDIDATE EVIDENCE LAB · PICK CLOSED', { exact: true }).waitFor()
      await pickStatusSummary.getByText("Nobody's Keep changed. Anything you choose below stays only in your Keep.", { exact: true }).waitFor()
      await lifecyclePage.getByText('WHY IT HAD BEEN CONSIDERED', { exact: true }).waitFor()
      assert(
        await lifecyclePage.getByRole('heading', { name: '2 of 4 want or love this.', level: 2 }).count() === 0,
        'A dismissed Pick must preserve its old reason as history rather than an active heading.',
      )
      assert(await lifecyclePage.getByText(/GOING/, { exact: false }).count() === 0, 'A dismissed Pick must not retain planned-going language.')
      assert(
        await lifecyclePage.getByRole('button', { name: 'We went' }).count() === 0,
        'A dismissed Pick must not remain closable.',
      )
      assert(await lifecyclePage.locator('.pick-receipt-controls').count() === 0, 'A dismissed Pick must expose no receipt controls.')
      assert(await lifecyclePage.getByRole('link', { name: 'Open in Google Maps ↗' }).count() === 0, 'A dismissed Pick must expose no group Maps action.')
      const privateSave = lifecyclePage.getByRole('group', { name: 'Save privately to your Keep as' })
      await privateSave.getByRole('button', { name: 'want' }).waitFor()
      await privateSave.getByRole('button', { name: 'tried' }).waitFor()
      await privateSave.getByRole('button', { name: 'loved' }).waitFor()
      const personalDirections = lifecyclePage.getByRole('link', { name: 'Directions for me in Google Maps (opens a new tab)' })
      assert(
        await personalDirections.evaluate(element => element.classList.contains('pill-ghost') && !element.classList.contains('pill-primary')),
        'Dismissed directions must remain a secondary personal utility rather than a group-plan action.',
      )
      const [privateSaveBox, personalDirectionsBox] = await Promise.all([
        privateSave.boundingBox(),
        personalDirections.boundingBox(),
      ])
      assert(
        privateSaveBox && personalDirectionsBox
          && privateSaveBox.y + privateSaveBox.height <= 844
          && personalDirectionsBox.y + personalDirectionsBox.height <= 844,
        'Dismissed private Keep and personal directions must fit the initial 390×844 viewport.',
      )
    } else {
      await lifecyclePage.getByRole('button', { name: 'We went' }).click()
      const terminalHeading = lifecyclePage.getByRole('heading', { name: 'The group went.', level: 2 })
      await terminalHeading.waitFor()
      await assertFocused(terminalHeading, 'A locally visited Pick must move focus to its truthful terminal heading.')
      const terminalHeadingBox = await terminalHeading.boundingBox()
      assert(
        terminalHeadingBox && terminalHeadingBox.y >= 0 && terminalHeadingBox.y + terminalHeadingBox.height <= 844,
        'A locally visited Pick must scroll its focused terminal heading into the 390×844 viewport.',
      )
      await pickStatusSummary.getByText('CANDIDATE EVIDENCE LAB · 4 WERE ON THE PLAN', { exact: true }).waitFor()
      await pickStatusSummary.getByText('Each person chooses Tried or Loved only for their own Keep.', { exact: true }).waitFor()
      await lifecyclePage.getByText('WHY IT WAS PICKED', { exact: true }).waitFor()
      await lifecyclePage.getByText('How was it for you? Only your Keep changes.', { exact: true }).waitFor()
      assert(
        await lifecyclePage.getByRole('heading', { name: '2 of 4 want or love this.', level: 2 }).count() === 0,
        'A visited Pick must preserve its old reason as history rather than an active heading.',
      )
      assert(await lifecyclePage.getByText(/GOING/, { exact: false }).count() === 0, 'A visited Pick must not claim planned people are still going.')
      assert(await lifecyclePage.getByRole('group', { name: 'Save as' }).count() === 0, 'A visited Pick must expose one personal outcome system, not duplicate save controls.')
      const personalOutcomeBox = await lifecyclePage.locator('.pick-personal-outcome').boundingBox()
      assert(
        personalOutcomeBox && personalOutcomeBox.y + personalOutcomeBox.height <= 844,
        'Visited private outcome controls must fit the initial 390×844 viewport.',
      )
      await lifecyclePage.getByRole('button', { name: 'Keep as Loved' }).click()
      await lifecyclePage.getByText('Your Keep says loved. Other people choose for themselves.').waitFor()
      assert(
        await lifecyclePage.getByRole('button', { name: 'Not for us' }).count() === 0,
        'A visited Pick must not remain collectively dismissible after one person records taste.',
      )
    }
    assert(
      await lifecyclePage.getByRole('navigation', { name: 'Primary' }).count() === 0,
      'A focused Pick route must keep the primary dock out of terminal actions.',
    )
    const resolvedPersonalMemory = lifecyclePage.locator('.closeup-personal-memory.is-primary')
    assert(
      await resolvedPersonalMemory.count() === 1
        && await resolvedPersonalMemory.evaluate(element => element.hasAttribute('open'))
        && await resolvedPersonalMemory.getByRole('button', { name: 'Edit' }).isVisible(),
      'Once the shared Pick closes, ordinary personal-memory controls must return without another disclosure task.',
    )
    await assertNoHorizontalOverflow(lifecyclePage, `${outcome} Pick closeup`)
    await lifecyclePage.screenshot({
      path: path.join(artifactDir, `group-ui-pick-${outcome}-mobile.png`), fullPage: true,
    })
    await lifecyclePage.goto(`${origin}/together?prototype=group`, { waitUntil: 'networkidle' })
    const closedGroupCard = lifecyclePage.getByRole('link', { name: /Candidate Evidence Lab/ })
    assert(await closedGroupCard.getByText('Current Pick · Supper Club', { exact: true }).count() === 0, 'Closing the Pick must remove its recovery pointer from Together.')
    if (outcome === 'dismissed') {
      assert(await closedGroupCard.getByText('Last Pick · Supper Club', { exact: true }).count() === 0, 'A dismissed plan must not pretend the group visited.')
    } else {
      await closedGroupCard.getByText('Last Pick · Supper Club', { exact: true }).waitFor()
      await closedGroupCard.click()
      const recentPick = lifecyclePage.locator('.group-recent-pick')
      await recentPick.getByText('LAST PICK · THE GROUP WENT', { exact: true }).waitFor()
      await recentPick.getByText('Each person who went can keep their own Tried or Loved outcome.').waitFor()
      assert(await lifecyclePage.locator('.group-candidate-card').count() === 2, 'The visited Last Pick must be suppressed from the next bounded shortlist.')
      assert(
        await lifecyclePage.locator('.group-candidate-card').filter({ hasText: 'Supper Club' }).count() === 0,
        'The Last Pick must not immediately reappear as an ordinary fresh candidate.',
      )
      await lifecyclePage.getByRole('heading', { name: 'Two places. Real reasons.' }).waitFor()
      await lifecyclePage.getByRole('button', { name: 'Guest' }).waitFor()
      await lifecyclePage.screenshot({ path: path.join(artifactDir, 'group-ui-recent-pick-mobile.png'), fullPage: true })
    }
    assert(errors.length === 0, `${outcome} Pick browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

async function verifyPersonalDiscovery(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const errors = []
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(`${origin}/saved?prototype=group`, { waitUntil: 'networkidle' })
    await page.getByRole('link', { name: 'Discover' }).click()
    await page.waitForURL(/\/add\?mode=discover$/)
    await page.getByRole('heading', { name: 'Find somewhere worth keeping.' }).waitFor()
    const area = page.getByRole('textbox', { name: 'Area for discovery' })
    await assertFocused(area, 'Personal discovery must begin with the explicit temporary area.')
    const coffee = page.getByRole('button', { name: /Coffee/ })
    assert(await coffee.isDisabled(), 'Taste prompts must not search before an explicit area exists.')
    await page.getByText(/Want.*in your Keep/).first().waitFor()
    await area.fill('Cresskill, NJ')
    assert(!await coffee.isDisabled(), 'A valid explicit area must enable the taste prompt.')
    await coffee.click()
    assert(
      await page.getByPlaceholder('Or type your own place search…').inputValue() === 'coffee shops in Cresskill, NJ',
      'The prompt must produce one transparent category-plus-area query.',
    )
    await page.getByText('One Google search for coffee shops in Cresskill, NJ. Choose a result to review it.').waitFor()
    const result = page.getByRole('button', { name: /Copper Cup Coffee, Cresskill, NJ/ })
    await result.waitFor()
    await assertFocused(result, 'A completed discovery search must move focus to its first reviewable result.')
    const [resultBox, dockBox] = await Promise.all([
      result.boundingBox(),
      page.getByRole('navigation', { name: 'Primary' }).boundingBox(),
    ])
    assert(
      Boolean(resultBox && dockBox && resultBox.y + resultBox.height <= dockBox.y - 12),
      'The first discovery result must scroll fully above the fixed dock.',
    )
    await assertNoHorizontalOverflow(page, '390×844 personal discovery results')
    await mkdir(artifactDir, { recursive: true })
    await page.screenshot({ path: path.join(artifactDir, 'group-ui-personal-discovery-mobile.png'), fullPage: true })

    await result.click()
    await page.getByRole('heading', { name: 'What do you call this place?' }).waitFor()
    assert(
      await page.getByRole('textbox', { name: 'Your label for this place' }).inputValue() === 'Copper Cup Coffee',
      'Discovery review must expose the exact selected result for deliberate confirmation.',
    )
    await page.getByText(/coffee · Cresskill, NJ · Development result/).waitFor()
    assert(
      await page.getByRole('button', { name: 'Coffee', exact: true }).getAttribute('aria-pressed') === 'true',
      'The explicit discovery category must carry into review without becoming hidden inference.',
    )
    await page.getByText('Cresskill, NJ', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Want', exact: true }).click()
    await page.getByRole('button', { name: 'Keep privately as Want' }).click()
    const successHeading = page.getByRole('heading', { name: 'Kept privately', level: 2 })
    await successHeading.waitFor()
    await assertFocused(successHeading, 'A private discovery save must focus its explicit completion state.')
    await page.getByText('No new search starts until you choose Find another.', { exact: true }).waitFor()
    const findAnother = page.getByRole('button', { name: 'Find another Coffee', exact: true })
    await findAnother.waitFor()
    await page.getByRole('button', { name: 'Done — view Keep', exact: true }).waitFor()
    await findAnother.click()
    await page.getByRole('heading', { name: 'Find somewhere worth keeping.' }).waitFor()
    const stored = await page.evaluate(() => window.sessionStorage.getItem('__this_is_signal:group-mika:g:prototype-discovery-coffee'))
    const save = JSON.parse(stored ?? '{}')
    assert(save.visibility === 'private', 'Personal discovery must default the new place to private Keep.')
    assert(save.tag === 'want' && save.memory?.category === 'coffee' && save.memory?.area === 'Cresskill, NJ',
      'Personal discovery must persist only the reviewed Want and user-confirmed place memory.')
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'KEEP' }).click()
    await page.locator('.pin-card[aria-label="Copper Cup Coffee"]').waitFor()
    assert(errors.length === 0, `Personal discovery browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

async function verifyKeepToGroupBridge(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const errors = []
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(`${origin}/g/prototype-sparse-family?prototype=group&prototypeState=sparse-only`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Choose or find a place' }).click()
    await page.waitForURL(/\/add\?mode=discover&group=prototype-sparse-family$/)

    await page.getByText('FROM YOUR KEEP', { exact: false }).waitFor()
    await page.getByRole('heading', { name: 'Start with something you already know.' }).waitFor()
    await page.getByText(/Only you can see these private memories here/).waitFor()
    await page.getByText(/Notes and useful details stay hidden here/).waitFor()
    const memories = page.locator('.group-keep-memory')
    assert(await memories.count() === 2, 'The sparse fixture must offer only its two resolved private Want/Loved memories, capped below three.')
    assert(await memories.nth(0).getByText('Supper Club', { exact: true }).count() === 1,
      'The private Keep bridge must keep the newest Want first when no Loved memory is available.')
    assert(await page.getByText('Low light, enough room to actually talk.', { exact: true }).count() === 0,
      'The private bridge must never render notes from any personal memory.')
    await assertNoHorizontalOverflow(page, '390x844 private Keep group bridge')
    await mkdir(artifactDir, { recursive: true })
    await page.screenshot({ path: path.join(artifactDir, 'group-ui-keep-to-group-mobile.png'), fullPage: true })

    const before = await page.evaluate(() => ({
      bytes: window.sessionStorage.getItem('__this_is_signal:group-mika:group-nightjar'),
      count: Object.keys(window.sessionStorage)
        .filter(key => key === '__this_is_signal:group-mika:group-nightjar').length,
    }))
    assert(before.bytes && before.count === 1, 'The proof requires one existing canonical Nightjar Keep save before sharing.')

    await page.getByRole('button', { name: 'Review Nightjar Coffee for sharing with Family Sunday' }).click()
    await page.waitForURL(/\/p\/group-nightjar\?sharing=1$/)
    const handoff = await page.evaluate(() => window.history.state?.usr)
    assert(JSON.stringify(handoff) === JSON.stringify({
      checkGroupShare: 'prototype-sparse-family',
      returnToGroup: 'prototype-sparse-family',
    }), 'The place route must receive only one exact, bounded audience and matching return target.')
    await page.getByRole('heading', { name: 'Nightjar Coffee', level: 1 }).waitFor()
    const familyRow = page.getByLabel('Family Sunday sharing')
    await familyRow.getByText('Not shared with this group', { exact: true }).waitFor()
    await familyRow.getByRole('button', { name: 'Share with Family Sunday' }).click()

    await page.waitForURL(`${origin}/g/prototype-sparse-family`)
    await page.getByRole('heading', { name: 'One place. A real reason.' }).waitFor()
    await page.locator('.group-candidate-card').getByText('Nightjar Coffee', { exact: true }).waitFor()
    const after = await page.evaluate(() => ({
      bytes: window.sessionStorage.getItem('__this_is_signal:group-mika:group-nightjar'),
      count: Object.keys(window.sessionStorage)
        .filter(key => key === '__this_is_signal:group-mika:group-nightjar').length,
    }))
    assert(after.bytes === before.bytes && after.count === 1,
      'Explicit group sharing must not rewrite or duplicate the existing canonical private save.')
    assert(errors.length === 0, `Keep-to-group browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

const server = spawn(process.execPath, [
  vite,
  '--host', '127.0.0.1',
  '--port', String(port),
  '--strictPort',
  '--mode', 'emulator',
], {
  cwd: path.join(root, 'v2'),
  env: {
    ...process.env,
    THIS_IS_VERIFIED_GROUP_UI_DEV: 'true',
    VITE_USE_FIREBASE_EMULATORS: 'true',
    VITE_FIREBASE_PROJECT_ID: 'demo-this-is-v2',
    VITE_EMULATOR_PLACES_STUB: 'true',
    VITE_PLACES_ENABLED: 'false',
    VITE_PLACES_NEW_KEY: 'emulator-only-no-google',
    VITE_GROUP_PHOTOS_ENABLED: 'false',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let browser
let page
const unexpectedGooglePlacesRequests = []
const unexpectedEmulatorPlacesRequests = []
const serverErrors = []
server.stderr.on('data', chunk => serverErrors.push(String(chunk)))

function assertNoGooglePlacesRequests() {
  assert(unexpectedGooglePlacesRequests.length === 0,
    `Production fixture must never reach Google Places; received ${JSON.stringify(unexpectedGooglePlacesRequests)}.`)
  assert(unexpectedEmulatorPlacesRequests.length === 0,
    `Only an explicitly intercepted emulator Places proof may run; received ${JSON.stringify(unexpectedEmulatorPlacesRequests)}.`)
}

try {
  await waitForServer(server)
  const managedBrowserExists = existsSync(chromium.executablePath())
  browser = await chromium.launch({
    headless: true,
    ...(managedBrowserExists ? {} : { channel: 'chrome' }),
  })
  const createContext = browser.newContext.bind(browser)
  browser.newContext = async (...args) => {
    const context = await createContext(...args)
    await context.route('https://places.googleapis.com/**', async route => {
      unexpectedGooglePlacesRequests.push(route.request().url())
      await route.abort()
    })
    await context.route('**/__this_is_emulator_places/**', async route => {
      unexpectedEmulatorPlacesRequests.push(route.request().url())
      await route.abort()
    })
    return context
  }
  if (process.env.THIS_IS_GROUP_UI_SCOPE === 'keep') {
    await verifyKeepInputLoop(browser)
    assertNoGooglePlacesRequests()
    console.log('PASS focused Keep capture and response-recovery journey')
    await browser.close()
    browser = undefined
    server.kill()
    process.exit(0)
  }
  if (process.env.THIS_IS_GROUP_UI_SCOPE === 'practical-need') {
    await verifyPracticalNeedCapture(browser)
    assertNoGooglePlacesRequests()
    console.log('PASS focused practical-need capture, private default, and named-group consent journey')
    await browser.close()
    browser = undefined
    server.kill()
    process.exit(0)
  }
  if (process.env.THIS_IS_GROUP_UI_SCOPE === 'profile') {
    await verifyProfileResponseTruth(browser)
    assertNoGooglePlacesRequests()
    console.log('PASS focused profile response-recovery journey')
    await browser.close()
    browser = undefined
    server.kill()
    process.exit(0)
  }
  if (process.env.THIS_IS_GROUP_UI_SCOPE === 'account') {
    await verifyAccountDeletionResponseTruth(browser)
    assertNoGooglePlacesRequests()
    console.log('PASS focused account-deletion response-recovery journey')
    await browser.close()
    browser = undefined
    server.kill()
    process.exit(0)
  }
  if (process.env.THIS_IS_GROUP_UI_SCOPE === 'onboarding') {
    await verifyOnboardingSetupResponseTruth(browser)
    assertNoGooglePlacesRequests()
    console.log('PASS focused onboarding identity and completion response-recovery journeys')
    await browser.close()
    browser = undefined
    server.kill()
    process.exit(0)
  }
  if (process.env.THIS_IS_GROUP_UI_SCOPE === 'discovery') {
    await verifyPersonalDiscovery(browser)
    assertNoGooglePlacesRequests()
    console.log('PASS focused personal discovery and private Keep journey')
    await browser.close()
    browser = undefined
    server.kill()
    process.exit(0)
  }
  if (process.env.THIS_IS_GROUP_UI_SCOPE === 'keep-to-group') {
    await verifyKeepToGroupBridge(browser)
    assertNoGooglePlacesRequests()
    console.log('PASS focused private Keep to exact named group journey without provider requests or duplicate save')
    await browser.close()
    browser = undefined
    server.kill()
    process.exit(0)
  }
  if (process.env.THIS_IS_GROUP_UI_SCOPE === 'audience') {
    await verifyGroupShareResponseTruth(browser)
    await verifyZeroHistoryEntry(browser)
    assertNoGooglePlacesRequests()
    console.log('PASS focused exact-audience first share, cancellation, stale-circle review, and exact replay journeys')
    await browser.close()
    browser = undefined
    server.kill()
    process.exit(0)
  }
  if (process.env.THIS_IS_GROUP_UI_SCOPE === 'signed-out') {
    await verifySignedOutResponsiveShell(browser, { width: 320, height: 568 }, '/g/prototype-evidence-lab', 'group-ui-signed-out-private-group-narrow.png')
    assertNoGooglePlacesRequests()
    console.log('PASS focused signed-out responsive shell journey')
    await browser.close()
    browser = undefined
    server.kill()
    process.exit(0)
  }
  if (process.env.THIS_IS_GROUP_UI_SCOPE === 'pair-migration') {
    await verifyPairMigrationResponseTruth(browser)
    assertNoGooglePlacesRequests()
    console.log('PASS focused pair-migration response-recovery journey')
    await browser.close()
    browser = undefined
    server.kill()
    process.exit(0)
  }
  if (process.env.THIS_IS_GROUP_UI_SCOPE === 'pick') {
    await verifyFocusedPlaceRecovery(browser)
    await verifyPublicPickReceipt(browser)
    await verifyPickCreationRecovery(browser)
    await verifyPickCloseRecovery(browser)
    await verifyReceiptRevocationRecovery(browser)
    await verifyNewAttendeePickMemory(browser)
    await verifyPickLifecycle(browser, 'dismissed')
    await verifyPickLifecycle(browser, 'loved')
    assertNoGooglePlacesRequests()
    console.log('PASS focused selected, visited, dismissed, receipt, recovery, and private Pick outcomes')
    await browser.close()
    browser = undefined
    server.kill()
    process.exit(0)
  }
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  })
  page = await context.newPage()
  const consoleErrors = []
  const pageErrors = []
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', error => pageErrors.push(error.message))

  await page.goto(`${origin}/together?prototype=group`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Who are we getting together?' }).waitFor()
  await assertNoHorizontalOverflow(page, 'group index')

  await page.getByRole('link', { name: /Candidate Evidence Lab/ }).click()
  await page.getByRole('heading', { name: 'Three places. Real reasons.' }).waitFor()
  await page.getByText('SHARING CIRCLE · 3 PEOPLE', { exact: true }).waitFor()
  assert(await page.locator('.group-candidate-card').count() === 3, 'Evidence fixture must render exactly three candidates.')
  const firstCandidateTitleBox = await page.locator('.group-candidate-card').first()
    .getByText('Supper Club', { exact: true })
    .boundingBox()
  assert(
    firstCandidateTitleBox && firstCandidateTitleBox.y < 844,
    'The first truthful place name must be visible in the initial 390×844 decision viewport.',
  )
  const defaultPlanDetails = page.locator('.group-plan-details')
  assert(await defaultPlanDetails.evaluate(element => !element.open), 'Optional plan details must stay collapsed on a fresh group draft.')
  await defaultPlanDetails.getByText('Area or one practical need', { exact: true }).waitFor()
  await page.screenshot({ path: path.join(artifactDir, 'group-ui-plan-default-mobile.png'), fullPage: true })
  await page.getByText('“Ari would bring the group here.”', { exact: true }).waitFor()
  await page.getByText('— Ari', { exact: true }).waitFor()
  await assertNoHorizontalOverflow(page, 'candidate list')

  await page.getByRole('button', { name: 'Guest' }).click()
  await page.getByText('Guest counts as unknown for this plan. No name, profile, or taste is stored.').waitFor()
  await page.getByText('These 4 people’s shared taste · no location profile.').waitFor()
  await page.getByText('KNOWN MATCH · 2 OF 4').waitFor()
  assert(
    await page.getByText('Why for us: 2 of 4 want or love this.').count() === 1,
    'Guest must increase the denominator without adding support.',
  )

  const firstPass = page.getByRole('button', { name: 'Not for us: Supper Club' })
  await firstPass.click()
  const dialog = page.getByRole('alertdialog')
  await dialog.getByText('Pass on Supper Club?').waitFor()
  await dialog.getByText(/This draft will show “Mika passed.”/).waitFor()
  const keepIt = dialog.getByRole('button', { name: 'Keep it' })
  await assertFocused(keepIt, 'Pass confirmation must focus the safe Keep it action first.')
  await page.keyboard.press('Escape')
  await assertFocused(firstPass, 'Escape must close the pass confirmation and restore its trigger.')

  await firstPass.click()
  await dialog.getByText('Pass on Supper Club?').waitFor()
  await keepIt.click()
  await assertFocused(firstPass, 'Keep it must restore focus to the candidate pass control.')
  assert(await page.locator('.group-candidate-card').count() === 3, 'Canceling a pass must keep the candidate.')

  await firstPass.click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm pass' }).click()
  const ledger = page.getByRole('region', { name: 'Places passed on in this draft' })
  await ledger.getByText('Mika passed').waitFor()
  const undo = ledger.getByRole('button', { name: 'Undo' })
  await assertFocused(undo, 'Confirming a pass must focus its reversible ledger action.')
  assert(await page.locator('.group-candidate-card').count() === 2, 'Confirmed pass must remove one candidate.')
  await page.getByRole('heading', { name: 'Two places. Real reasons.' }).waitFor()
  await undo.click()
  await assertFocused(firstPass, 'Undo must restore focus to the returned candidate pass control.')
  assert(await page.locator('.group-candidate-card').count() === 3, 'Undo must restore the candidate.')
  await page.getByRole('heading', { name: 'Three places. Real reasons.' }).waitFor()

  for (let index = 0; index < 3; index += 1) {
    await page.getByRole('button', { name: /^Not for us:/ }).first().click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm pass' }).click()
  }
  await page.getByRole('heading', { name: 'Nothing left in this draft.' }).waitFor()
  await page.getByText('You passed on every current candidate. Undo one above, or change who is going or what fits this time.').waitFor()
  assert(
    await page.locator('.group-refractive-field').count() === 0,
    'A current draft with no visible candidates must not keep a stale shortlist-count hero.',
  )
  await assertNoHorizontalOverflow(page, 'all-passed recovery')

  await page.getByRole('button', { name: 'Food' }).click()
  assert(
    await page.getByRole('region', { name: 'Places passed on in this draft' }).count() === 0,
    'Changing context must start a fresh draft.',
  )
  assert(await page.locator('.group-candidate-card').count() === 1, 'Food context must recover its one truthful fixture candidate.')
  await page.getByRole('heading', { name: 'One place. A real reason.' }).waitFor()
  await assertNoHorizontalOverflow(page, 'fresh Food draft')

  await page.getByRole('button', { name: 'Drinks' }).click()
  await page.getByRole('heading', { name: 'Nothing honest fits yet.' }).waitFor()
  await page.getByText('Try Anything. The group needs more explicit evidence before this can answer.').waitFor()
  assert(await page.getByRole('button', { name: /Quick start/i }).count() === 0, 'Context recovery must not offer unrelated hint work.')
  const showAnything = page.getByRole('button', { name: 'Show Anything' })
  await showAnything.waitFor()
  await showAnything.click()
  await page.getByRole('heading', { name: 'Three places. Real reasons.' }).waitFor()
  assert(await page.locator('.group-candidate-card').count() === 3, 'Show Anything must restore the eligible unfiltered shortlist.')

  await mkdir(artifactDir, { recursive: true })
  await page.screenshot({ path: path.join(artifactDir, 'group-ui-regression-mobile.png'), fullPage: true })
  assert(consoleErrors.length === 0, `Browser console errors: ${consoleErrors.join(' | ')}`)
  assert(pageErrors.length === 0, `Uncaught page errors: ${pageErrors.join(' | ')}`)
  await verifyResponsiveSurface(browser, { width: 320, height: 568 }, 'group-ui-regression-narrow.png')
  await verifyResponsiveSurface(browser, { width: 768, height: 1024 }, 'group-ui-regression-tablet.png')
  await verifyResponsiveShell(browser, { width: 320, height: 568 }, '/settings', 'group-ui-shell-narrow.png')
  await verifyResponsiveShell(browser, { width: 768, height: 1024 }, '/onboarding', 'group-ui-shell-tablet.png')
  await verifySignedOutResponsiveShell(browser, { width: 320, height: 568 }, '/g/prototype-evidence-lab', 'group-ui-signed-out-private-group-narrow.png')
  await verifySignedOutResponsiveShell(browser, { width: 768, height: 1024 }, '/groups/new', 'group-ui-signed-out-create-group-tablet.png')
  await verifyPrimaryIa(browser)
  await verifySixPersonPlanning(browser)
  await verifyShareTargetCapture(browser)
  await verifySignedOutProductTruth(browser)
  await verifyGroupAssemblyCopy(browser)
  await verifyPairMigrationResponseTruth(browser)
  await verifyGroupInviteConsent(browser)
  await verifyNewRecipientInviteContinuity(browser)
  await verifyRevokedGroupInvite(browser)
  await verifyInviteReadRecovery(browser)
  await verifyInviteProfileRecovery(browser)
  await verifyInviteAcceptanceRecovery(browser)
  await verifyInviteCreationRecovery(browser)
  await verifyInviteCapacity(browser)
  await verifyConsumedInviteClosure(browser)
  await verifyLeaveGroup(browser)
  await verifyKeepInputLoop(browser)
  await verifyPracticalNeedCapture(browser)
  await verifyPersonalDiscovery(browser)
  await verifyKeepToGroupBridge(browser)
  await verifyGroupShareResponseTruth(browser)
  await verifyDraftPassResponseTruth(browser)
  await verifyOfflineRecovery(browser)
  await verifySettingsDataRights(browser)
  await verifyProfileResponseTruth(browser)
  await verifyOnboardingSetupResponseTruth(browser)
  await verifyAccountDeletionResponseTruth(browser)
  await verifyPrivacyRecovery(browser)
  await verifyFocusedPlaceRecovery(browser)
  await verifyPublicPickReceipt(browser)
  await verifySparseEvidenceRecovery(browser)
  await verifyZeroHistoryEntry(browser)
  await verifyPickCreationRecovery(browser)
  await verifyPickCloseRecovery(browser)
  await verifyReceiptRevocationRecovery(browser)
  await verifyNewAttendeePickMemory(browser)
  await verifyPickLifecycle(browser, 'dismissed')
  await verifyPickLifecycle(browser, 'loved')
  assertNoGooglePlacesRequests()
  console.log('PASS primary IA, no-install receipts, and group UI are truthful across responsive shell routes, Keep capture, navigation, privacy recovery, warm offline recovery, optional zero-history entry, Maps handoff, and one-way Pick closure')
} catch (error) {
  await mkdir(artifactDir, { recursive: true }).catch(() => {})
  if (page) {
    await page.screenshot({ path: path.join(artifactDir, 'group-ui-regression-failure.png'), fullPage: true }).catch(() => {})
  }
  if (serverErrors.length) console.error(serverErrors.join(''))
  throw error
} finally {
  if (browser) await browser.close()
  server.kill()
}
