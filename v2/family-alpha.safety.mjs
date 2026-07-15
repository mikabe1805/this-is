import { readFileSync } from 'node:fs'

export const FAMILY_ALPHA_ENV_KEYS = Object.freeze([
  'THIS_IS_FAMILY_ALPHA_PROJECT_ID',
  'VITE_RELEASE_CHANNEL',
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_USE_FIREBASE_EMULATORS',
  'VITE_EMULATOR_PLACES_STUB',
  'VITE_PLACES_ENABLED',
  'VITE_PLACES_NEW_KEY',
  'VITE_GROUP_PHOTOS_ENABLED',
])
export const FAMILY_ALPHA_VITE_ENV_KEYS = Object.freeze(
  FAMILY_ALPHA_ENV_KEYS.filter(key => key.startsWith('VITE_')),
)
export const FAMILY_ALPHA_VITE_ENV_PREFIX = 'THIS_IS_DISABLED_AUTO_CLIENT_ENV_'
export const FAMILY_ALPHA_LEGACY_ENV_FILENAMES = Object.freeze([
  '.env',
  '.env.local',
  '.env.production',
  '.env.temp',
])

const LEGACY_PROJECT_ID = 'this-is-76332'
const DEMO_PROJECT_ID = 'demo-this-is-v2'
const PLACEHOLDER = /^(?:replace|your-|example|todo|changeme|placeholder)/i
const PROJECT_ID = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/
const GOOGLE_BROWSER_API_KEY = /^AIza[A-Za-z0-9_-]{35}$/
const FIREBASE_SENDER_ID = /^[1-9][0-9]{5,19}$/
const FIREBASE_WEB_APP_ID = /^1:([1-9][0-9]{5,19}):web:([0-9a-f]{6,64})$/i
const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/
const FAMILY_ALPHA_ENV_KEY_SET = new Set(FAMILY_ALPHA_ENV_KEYS)
const PARSE_ISSUES = Symbol('family-alpha-env-parse-issues')
const LEGACY_ENV_URLS = Object.freeze(
  FAMILY_ALPHA_LEGACY_ENV_FILENAMES.map(filename => new URL(`../${filename}`, import.meta.url)),
)

function present(value) {
  return typeof value === 'string' && value.trim().length > 0 && !PLACEHOLDER.test(value.trim())
}

export function legacyBrowserApiKeys() {
  const keys = new Set()
  for (const url of LEGACY_ENV_URLS) {
    try {
      const source = readFileSync(url, 'utf8')
      for (const match of source.matchAll(/AIza[A-Za-z0-9_-]{35}/g)) keys.add(match[0])
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }
  return keys
}

/**
 * Names inherited from the shell are rejected even when their value matches
 * the dedicated file. The sentinel prefix is Vite's deliberately unused
 * automatic exposure prefix; rejecting the whole prefix prevents a future
 * `import.meta.env` object read from exposing an unrelated shell value.
 */
export function familyAlphaAmbientKeys(ambientEnv = {}) {
  return [...new Set(Object.keys(ambientEnv).filter(key =>
    FAMILY_ALPHA_ENV_KEY_SET.has(key) || key.startsWith(FAMILY_ALPHA_VITE_ENV_PREFIX)))]
    .sort()
}

function parseValue(rawValue, lineNumber, issues) {
  const value = rawValue.trim()
  if (!value) return ''
  const quote = value[0]
  if (quote === '"' || quote === "'") {
    if (value.length < 2 || value.at(-1) !== quote) {
      issues.push(`malformed:line:${lineNumber}`)
      return null
    }
    return value.slice(1, -1)
  }
  if (/\s/.test(value)) {
    issues.push(`malformed:line:${lineNumber}`)
    return null
  }
  return value
}

/**
 * Parse the dedicated family-alpha file without dotenv expansion or merging
 * any ordinary repository environment. The accepted grammar is deliberately
 * small: blank/comment lines and one exact KEY=value assignment per line.
 * Parse diagnostics are attached as symbol metadata so existing object-based
 * callers keep the same API while validation can reject the whole source.
 */
export function parseFamilyAlphaEnvText(source) {
  const result = {}
  const issues = []
  const seen = new Set()
  const lines = String(source).replace(/^\uFEFF/, '').split(/\r?\n/)
  for (const [index, rawLine] of lines.entries()) {
    const lineNumber = index + 1
    let line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    if (line.startsWith('export ')) line = line.slice(7).trimStart()
    const assignment = line.match(/^([^=]+)=(.*)$/)
    if (!assignment) {
      issues.push(`malformed:line:${lineNumber}`)
      continue
    }
    const key = assignment[1].trim()
    if (!ENV_KEY.test(key)) {
      issues.push(`malformed:line:${lineNumber}`)
      continue
    }
    if (!FAMILY_ALPHA_ENV_KEY_SET.has(key)) issues.push(`unknown:${key}`)
    if (seen.has(key)) issues.push(`duplicate:${key}`)
    seen.add(key)
    const value = parseValue(assignment[2], lineNumber, issues)
    if (value === null) continue
    result[key] = value
  }
  Object.defineProperty(result, PARSE_ISSUES, {
    value: Object.freeze([...new Set(issues)]),
    enumerable: true,
  })
  return result
}

/**
 * Validate only a dedicated `.env.family-alpha.local` record. Callers must not
 * merge the ordinary repo env first: falling back to the legacy v1 project is
 * the exact failure this boundary prevents.
 *
 * Issue codes contain key names, never values, so a failed check is safe to
 * paste into a review or CI log.
 */
export function familyAlphaEnvironmentIssues(env, { additionalExposedApiKeys = [] } = {}) {
  const issues = [...(env?.[PARSE_ISSUES] ?? [])]
  for (const key of FAMILY_ALPHA_ENV_KEYS) {
    if (!present(env[key])) issues.push(`missing:${key}`)
  }

  const declaredProject = env.THIS_IS_FAMILY_ALPHA_PROJECT_ID?.trim()
  const firebaseProject = env.VITE_FIREBASE_PROJECT_ID?.trim()
  if (present(declaredProject) && !PROJECT_ID.test(declaredProject)) {
    issues.push('invalid:THIS_IS_FAMILY_ALPHA_PROJECT_ID')
  }
  if (present(firebaseProject) && !PROJECT_ID.test(firebaseProject)) {
    issues.push('invalid:VITE_FIREBASE_PROJECT_ID')
  }
  if (declaredProject === LEGACY_PROJECT_ID || firebaseProject === LEGACY_PROJECT_ID) {
    issues.push('forbidden:legacy-project')
  }
  if (declaredProject === DEMO_PROJECT_ID || firebaseProject === DEMO_PROJECT_ID) {
    issues.push('forbidden:demo-project')
  }
  if (present(declaredProject) && present(firebaseProject) && declaredProject !== firebaseProject) {
    issues.push('mismatch:family-alpha-project')
  }

  if (env.VITE_RELEASE_CHANNEL !== 'family-alpha') issues.push('invalid:VITE_RELEASE_CHANNEL')
  if (env.VITE_USE_FIREBASE_EMULATORS !== 'false') issues.push('invalid:VITE_USE_FIREBASE_EMULATORS')
  if (env.VITE_EMULATOR_PLACES_STUB !== 'false') issues.push('invalid:VITE_EMULATOR_PLACES_STUB')
  if (env.VITE_PLACES_ENABLED !== 'true') issues.push('invalid:VITE_PLACES_ENABLED')
  if (env.VITE_GROUP_PHOTOS_ENABLED !== 'false') issues.push('invalid:VITE_GROUP_PHOTOS_ENABLED')

  const firebaseApiKey = env.VITE_FIREBASE_API_KEY?.trim()
  const placesApiKey = env.VITE_PLACES_NEW_KEY?.trim()
  if (present(firebaseApiKey) && !GOOGLE_BROWSER_API_KEY.test(firebaseApiKey)) {
    issues.push('invalid:VITE_FIREBASE_API_KEY')
  }
  if (present(placesApiKey) && !GOOGLE_BROWSER_API_KEY.test(placesApiKey)) {
    issues.push('invalid:VITE_PLACES_NEW_KEY')
  }
  if (present(firebaseApiKey) && present(placesApiKey) && firebaseApiKey === placesApiKey) {
    issues.push('reused:firebase-and-places-api-key')
  }

  const exposedApiKeys = legacyBrowserApiKeys()
  for (const key of additionalExposedApiKeys) {
    if (typeof key === 'string' && GOOGLE_BROWSER_API_KEY.test(key)) exposedApiKeys.add(key)
  }
  for (const [key, value] of [
    ['VITE_FIREBASE_API_KEY', firebaseApiKey],
    ['VITE_PLACES_NEW_KEY', placesApiKey],
  ]) {
    if (typeof value === 'string' && exposedApiKeys.has(value)) {
      issues.push(`reused:tracked-api-key:${key}`)
    }
  }

  const senderId = env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim()
  const appId = env.VITE_FIREBASE_APP_ID?.trim()
  if (present(senderId) && !FIREBASE_SENDER_ID.test(senderId)) {
    issues.push('invalid:VITE_FIREBASE_MESSAGING_SENDER_ID')
  }
  const appIdMatch = present(appId) ? appId.match(FIREBASE_WEB_APP_ID) : null
  if (present(appId) && !appIdMatch) issues.push('invalid:VITE_FIREBASE_APP_ID')
  if (FIREBASE_SENDER_ID.test(senderId ?? '') && appIdMatch && appIdMatch[1] !== senderId) {
    issues.push('mismatch:firebase-app-sender')
  }

  if (present(firebaseProject)) {
    const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN?.trim()
    if (present(authDomain) && authDomain !== `${firebaseProject}.firebaseapp.com`) {
      issues.push('mismatch:VITE_FIREBASE_AUTH_DOMAIN')
    }
    const bucket = env.VITE_FIREBASE_STORAGE_BUCKET?.trim()
    if (present(bucket) && bucket !== `${firebaseProject}.appspot.com`
      && bucket !== `${firebaseProject}.firebasestorage.app`) {
      issues.push('mismatch:VITE_FIREBASE_STORAGE_BUCKET')
    }
  }

  return [...new Set(issues)]
}

export function formatFamilyAlphaIssue(issue) {
  if (issue.startsWith('malformed:line:')) return `Line ${issue.slice(15)} is not a supported family-alpha KEY=value assignment.`
  if (issue.startsWith('unknown:')) return `${issue.slice(8)} is not allowed in the dedicated family-alpha environment.`
  if (issue.startsWith('duplicate:')) return `${issue.slice(10)} is declared more than once in the dedicated family-alpha environment.`
  if (issue.startsWith('missing:')) return `${issue.slice(8)} is missing or still a placeholder.`
  if (issue === 'forbidden:legacy-project') return 'The live legacy Firebase project is forbidden for family alpha.'
  if (issue === 'forbidden:demo-project') return 'The demo emulator project cannot be used as a cloud family alpha.'
  if (issue === 'mismatch:family-alpha-project') return 'The declared family-alpha project and Firebase project do not match.'
  if (issue === 'mismatch:firebase-app-sender') return 'VITE_FIREBASE_APP_ID does not belong to VITE_FIREBASE_MESSAGING_SENDER_ID.'
  if (issue === 'reused:firebase-and-places-api-key') return 'Firebase and Places must use distinct browser API keys.'
  if (issue.startsWith('reused:tracked-api-key:')) return `${issue.slice(23)} reuses browser-key material already present in tracked legacy environment files.`
  if (issue.startsWith('mismatch:')) return `${issue.slice(9)} does not match the dedicated family-alpha project.`
  if (issue.startsWith('invalid:')) return `${issue.slice(8)} has an invalid family-alpha value.`
  return 'The family-alpha environment is invalid.'
}

/** Compile only the explicit client values from the dedicated alpha record.
 * Vite's ordinary env loader is disabled for this mode, so neither root env
 * files nor shell VITE_* variables can add client-visible values. */
export function familyAlphaViteDefines(env) {
  return Object.fromEntries(FAMILY_ALPHA_VITE_ENV_KEYS.map(key => [
    `import.meta.env.${key}`,
    JSON.stringify(env[key]),
  ]))
}

export function assertSafeFamilyAlphaBuild({
  command,
  mode,
  env,
  resolvedEnv = env,
  ambientEnv = {},
}) {
  if (mode !== 'family-alpha') return
  if (command !== 'build') {
    throw new Error('Family alpha may be built for reviewed Hosting, not served directly through Vite.')
  }
  const ambient = familyAlphaAmbientKeys(ambientEnv)
  if (ambient.length) {
    throw new Error(`Refusing ambient family-alpha environment: ${ambient.join(', ')}`)
  }
  const issues = familyAlphaEnvironmentIssues(env)
  if (issues.length) {
    throw new Error(`Refusing unsafe family-alpha build: ${issues.join(', ')}`)
  }
  const overridden = FAMILY_ALPHA_ENV_KEYS.filter(key => resolvedEnv[key] !== env[key])
  if (overridden.length) {
    throw new Error(`Refusing family-alpha environment override: ${overridden.join(', ')}`)
  }
}
