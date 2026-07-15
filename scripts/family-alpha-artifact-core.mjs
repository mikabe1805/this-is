const GOOGLE_BROWSER_API_KEY = /AIza[A-Za-z0-9_-]{35}/g
const REQUIRED_FILES = Object.freeze([
  'index.html',
  'icon.svg',
  'manifest.webmanifest',
  'precache-manifest.json',
  'sw-v2.js',
])
const EXPECTED_ENV_FIELDS = Object.freeze([
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_PLACES_NEW_KEY',
])

/** Inspect emitted bytes without returning or logging credential values. */
export function familyAlphaArtifactIssues({ files, env, legacyApiKeys = new Set() }) {
  const issues = []
  const normalizedFiles = files instanceof Map ? files : new Map(Object.entries(files ?? {}))
  for (const path of REQUIRED_FILES) {
    if (!normalizedFiles.has(path)) issues.push(`artifact:missing:${path}`)
  }
  if ([...normalizedFiles.keys()].some(path => path.endsWith('.map'))) {
    issues.push('artifact:source-map')
  }

  const emitted = [...normalizedFiles.values()].map(value => String(value)).join('\n')
  if (!emitted.includes('FAMILY ALPHA · PRIVATE DOGFOOD')) issues.push('artifact:release-marker')
  if (emitted.includes('/placePhoto')) issues.push('artifact:place-photo-client-path')
  for (const field of EXPECTED_ENV_FIELDS) {
    const value = env?.[field]
    if (typeof value !== 'string' || !value || !emitted.includes(value)) {
      issues.push(`artifact:missing-config:${field}`)
    }
  }

  const expectedKeys = new Set([
    env?.VITE_FIREBASE_API_KEY,
    env?.VITE_PLACES_NEW_KEY,
  ].filter(value => typeof value === 'string'))
  const emittedKeys = new Set(emitted.match(GOOGLE_BROWSER_API_KEY) ?? [])
  if ([...emittedKeys].some(key => !expectedKeys.has(key))) {
    issues.push('artifact:unexpected-browser-api-key')
  }
  if ([...emittedKeys].some(key => legacyApiKeys.has(key))) {
    issues.push('artifact:legacy-browser-api-key')
  }
  if (!expectedKeys.size || [...expectedKeys].some(key => !emittedKeys.has(key))) {
    issues.push('artifact:expected-browser-api-key-missing')
  }

  const precache = normalizedFiles.get('precache-manifest.json')
  if (precache !== undefined) {
    try {
      const parsed = JSON.parse(String(precache))
      const assets = Array.isArray(parsed?.assets) ? parsed.assets : []
      if (!assets.includes('/index.html')
        || !assets.includes('/icon.svg')
        || !assets.includes('/manifest.webmanifest')) {
        issues.push('artifact:precache-owned-shell')
      }
    } catch {
      issues.push('artifact:precache-json')
    }
  }

  return [...new Set(issues)]
}
