import assert from 'node:assert/strict'
import {
  EMULATOR_PROJECT_ID,
  assertSafeLocalServe,
  createEmulatorFunctionProxy,
  emulatorHttpFunctionNames,
} from '../vite.safety.mjs'
import {
  FAMILY_ALPHA_ENV_KEYS,
  FAMILY_ALPHA_LEGACY_ENV_FILENAMES,
  FAMILY_ALPHA_VITE_ENV_KEYS,
  FAMILY_ALPHA_VITE_ENV_PREFIX,
  assertSafeFamilyAlphaBuild,
  familyAlphaAmbientKeys,
  familyAlphaEnvironmentIssues,
  familyAlphaViteDefines,
  formatFamilyAlphaIssue,
  parseFamilyAlphaEnvText,
} from '../family-alpha.safety.mjs'

const safeEnv = {
  VITE_USE_FIREBASE_EMULATORS: 'true',
  VITE_FIREBASE_PROJECT_ID: EMULATOR_PROJECT_ID,
  VITE_EMULATOR_PLACES_STUB: 'false',
  VITE_PLACES_ENABLED: 'false',
  VITE_GROUP_PHOTOS_ENABLED: 'false',
}

assert.doesNotThrow(() => assertSafeLocalServe({
  command: 'serve',
  mode: 'emulator',
  env: safeEnv,
}))

for (const unsafe of [
  { command: 'serve', mode: 'development', env: safeEnv },
  { command: 'serve', mode: 'emulator', env: { ...safeEnv, VITE_USE_FIREBASE_EMULATORS: 'false' } },
  { command: 'serve', mode: 'emulator', env: { ...safeEnv, VITE_FIREBASE_PROJECT_ID: 'this-is-76332' } },
]) {
  assert.throws(
    () => assertSafeLocalServe(unsafe),
    /Refusing unsafe Vite emulator\/serve configuration/,
  )
}

assert.throws(() => assertSafeLocalServe({
  command: 'build',
  mode: 'emulator',
  env: { ...safeEnv, VITE_FIREBASE_PROJECT_ID: 'this-is-76332' },
}), /Refusing unsafe Vite emulator\/serve configuration/)
assert.throws(() => assertSafeLocalServe({
  command: 'serve',
  mode: 'emulator',
  env: safeEnv,
  isPreview: true,
}), /Refusing Vite preview because it can serve a bundle built for another backend/)
assert.doesNotThrow(() => assertSafeLocalServe({
  command: 'serve',
  mode: 'emulator',
  env: { ...safeEnv, THIS_IS_VERIFIED_EMULATOR_PREVIEW: 'true' },
  isPreview: true,
}))

assert.doesNotThrow(() => assertSafeLocalServe({
  command: 'build',
  mode: 'production',
  env: {},
}))

const proxy = createEmulatorFunctionProxy()
const contexts = Object.keys(proxy)
assert.equal(contexts.length, 2)
assert.equal(emulatorHttpFunctionNames.length, 18)

const functionContext = contexts.find(context => context.includes('resolveMapsUrl'))
assert.ok(functionContext)
const functionProxy = proxy[functionContext]
for (const functionName of emulatorHttpFunctionNames) {
  assert.match(`/${functionName}`, new RegExp(functionContext))
  assert.equal(
    functionProxy.rewrite(`/${functionName}`),
    `/demo-this-is-v2/us-central1/${functionName}`,
  )
}
assert.equal(functionProxy.target, 'http://127.0.0.1:5001')
assert.equal(functionProxy.changeOrigin, false)

const receiptProxy = proxy['^/pick(?:/|$)']
assert.equal(
  receiptProxy.rewrite('/pick/opaque-token'),
  '/demo-this-is-v2/us-central1/pickReceipt/pick/opaque-token',
)

const firebaseBrowserKey = `AIza${'A'.repeat(35)}`
const placesBrowserKey = `AIza${'B'.repeat(35)}`
const exposedBrowserKey = `AIza${'C'.repeat(35)}`
const familyAlphaSource = `
THIS_IS_FAMILY_ALPHA_PROJECT_ID=this-is-family-alpha
VITE_RELEASE_CHANNEL=family-alpha
VITE_FIREBASE_API_KEY="${firebaseBrowserKey}"
VITE_FIREBASE_AUTH_DOMAIN=this-is-family-alpha.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=this-is-family-alpha
VITE_FIREBASE_STORAGE_BUCKET=this-is-family-alpha.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
VITE_USE_FIREBASE_EMULATORS=false
VITE_EMULATOR_PLACES_STUB=false
VITE_PLACES_ENABLED=true
VITE_PLACES_NEW_KEY=${placesBrowserKey}
VITE_GROUP_PHOTOS_ENABLED=false
`
const familyAlpha = parseFamilyAlphaEnvText(familyAlphaSource)
assert.equal(familyAlpha.VITE_FIREBASE_API_KEY, firebaseBrowserKey)
assert.deepEqual(familyAlphaEnvironmentIssues(familyAlpha), [])
assert.doesNotThrow(() => assertSafeFamilyAlphaBuild({
  command: 'build',
  mode: 'family-alpha',
  env: familyAlpha,
}))
assert.throws(() => assertSafeFamilyAlphaBuild({
  command: 'build',
  mode: 'family-alpha',
  env: { ...familyAlpha, VITE_FIREBASE_PROJECT_ID: 'this-is-76332' },
}), /Refusing unsafe family-alpha build:.*forbidden:legacy-project/)
assert.throws(() => assertSafeFamilyAlphaBuild({
  command: 'serve',
  mode: 'family-alpha',
  env: familyAlpha,
}), /not served directly through Vite/)
assert.throws(() => assertSafeFamilyAlphaBuild({
  command: 'build',
  mode: 'family-alpha',
  env: familyAlpha,
  resolvedEnv: { ...familyAlpha, VITE_FIREBASE_PROJECT_ID: 'this-is-76332' },
}), /Refusing family-alpha environment override: VITE_FIREBASE_PROJECT_ID/)

assert.equal(FAMILY_ALPHA_VITE_ENV_PREFIX.startsWith('VITE_'), false,
  'family alpha must use a non-VITE automatic env prefix')
assert.deepEqual(
  FAMILY_ALPHA_LEGACY_ENV_FILENAMES,
  ['.env', '.env.local', '.env.production', '.env.temp'],
  'ignored .env.local key material must be compared alongside tracked legacy environments',
)
const familyAlphaDefines = familyAlphaViteDefines({
  ...familyAlpha,
  VITE_OPENAI_API_KEY: 'must-not-be-defined',
})
assert.deepEqual(
  Object.keys(familyAlphaDefines).sort(),
  FAMILY_ALPHA_VITE_ENV_KEYS.map(key => `import.meta.env.${key}`).sort(),
  'family alpha must explicitly define exactly its allowed client keys',
)
assert.equal('import.meta.env.THIS_IS_FAMILY_ALPHA_PROJECT_ID' in familyAlphaDefines, false)
assert.equal('import.meta.env.VITE_OPENAI_API_KEY' in familyAlphaDefines, false)
for (const key of FAMILY_ALPHA_VITE_ENV_KEYS) {
  assert.equal(JSON.parse(familyAlphaDefines[`import.meta.env.${key}`]), familyAlpha[key])
}

for (const [index, key] of FAMILY_ALPHA_ENV_KEYS.entries()) {
  const ambientValue = `ambient-secret-value-${index}`
  let ambientError
  try {
    assertSafeFamilyAlphaBuild({
      command: 'build',
      mode: 'family-alpha',
      env: familyAlpha,
      ambientEnv: { [key]: ambientValue },
    })
  } catch (error) {
    ambientError = error
  }
  assert.ok(ambientError instanceof Error, `${key} must be refused when inherited from the shell`)
  assert.match(ambientError.message, new RegExp(`Refusing ambient family-alpha environment:.*${key}`))
  assert.equal(ambientError.message.includes(ambientValue), false,
    'ambient family-alpha values must never appear in errors')
}
assert.throws(() => assertSafeFamilyAlphaBuild({
  command: 'build',
  mode: 'family-alpha',
  env: familyAlpha,
  ambientEnv: { VITE_FIREBASE_PROJECT_ID: familyAlpha.VITE_FIREBASE_PROJECT_ID },
}), /Refusing ambient family-alpha environment: VITE_FIREBASE_PROJECT_ID/,
'even an ambient value equal to the dedicated value must be refused')
const sentinelAmbientName = `${FAMILY_ALPHA_VITE_ENV_PREFIX}SHOULD_NOT_REACH_CLIENT`
assert.deepEqual(
  familyAlphaAmbientKeys({ [sentinelAmbientName]: 'must-not-be-bundled' }),
  [sentinelAmbientName],
)
assert.throws(() => assertSafeFamilyAlphaBuild({
  command: 'build',
  mode: 'family-alpha',
  env: familyAlpha,
  ambientEnv: { [sentinelAmbientName]: 'must-not-be-bundled' },
}), new RegExp(`Refusing ambient family-alpha environment: ${sentinelAmbientName}`),
'the disabled automatic Vite prefix must itself be impossible to poison from the shell')

const exactSchemaCases = [
  [`${familyAlphaSource}\nVITE_OPENAI_API_KEY=should-never-load\n`, 'unknown:VITE_OPENAI_API_KEY'],
  [`${familyAlphaSource}\nVITE_PLACES_ENABLED=true\n`, 'duplicate:VITE_PLACES_ENABLED'],
  [`${familyAlphaSource}\nthis is not an assignment\n`, 'malformed:line:'],
  [`${familyAlphaSource}\nVITE_PLACES_NEW_KEY="unterminated\n`, 'malformed:line:'],
]
for (const [source, expectedIssue] of exactSchemaCases) {
  assert.ok(
    familyAlphaEnvironmentIssues(parseFamilyAlphaEnvText(source))
      .some(issue => issue.startsWith(expectedIssue)),
    `family-alpha env text must reject ${expectedIssue}`,
  )
}

for (const [key, value, expectedIssue] of [
  ['VITE_FIREBASE_API_KEY', 'not-a-browser-key', 'invalid:VITE_FIREBASE_API_KEY'],
  ['VITE_PLACES_NEW_KEY', 'not-a-browser-key', 'invalid:VITE_PLACES_NEW_KEY'],
  ['VITE_FIREBASE_MESSAGING_SENDER_ID', 'abc', 'invalid:VITE_FIREBASE_MESSAGING_SENDER_ID'],
  ['VITE_FIREBASE_APP_ID', 'not-an-app-id', 'invalid:VITE_FIREBASE_APP_ID'],
]) {
  assert.ok(familyAlphaEnvironmentIssues({ ...familyAlpha, [key]: value }).includes(expectedIssue))
}
assert.ok(familyAlphaEnvironmentIssues({
  ...familyAlpha,
  VITE_FIREBASE_APP_ID: '1:999999999999:web:abcdef123456',
}).includes('mismatch:firebase-app-sender'))
assert.ok(familyAlphaEnvironmentIssues({
  ...familyAlpha,
  VITE_PLACES_NEW_KEY: firebaseBrowserKey,
}).includes('reused:firebase-and-places-api-key'))

for (const key of ['VITE_FIREBASE_API_KEY', 'VITE_PLACES_NEW_KEY']) {
  const issues = familyAlphaEnvironmentIssues(
    { ...familyAlpha, [key]: exposedBrowserKey },
    { additionalExposedApiKeys: [exposedBrowserKey] },
  )
  assert.ok(issues.includes(`reused:tracked-api-key:${key}`))
  assert.equal(
    issues.some(issue => issue.includes(exposedBrowserKey)
      || formatFamilyAlphaIssue(issue).includes(exposedBrowserKey)),
    false,
    'credential values must never appear in validator issue codes or formatted output',
  )
}

console.log('PASS local serving is emulator-only, Functions stay same-origin, and family alpha is isolated')
