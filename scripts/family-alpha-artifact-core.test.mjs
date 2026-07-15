import assert from 'node:assert/strict'
import { familyAlphaArtifactIssues } from './family-alpha-artifact-core.mjs'

const firebaseKey = `AIza${'A'.repeat(35)}`
const placesKey = `AIza${'B'.repeat(35)}`
const legacyKey = `AIza${'C'.repeat(35)}`
const env = {
  VITE_FIREBASE_API_KEY: firebaseKey,
  VITE_FIREBASE_AUTH_DOMAIN: 'this-is-family-alpha.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'this-is-family-alpha',
  VITE_FIREBASE_STORAGE_BUCKET: 'this-is-family-alpha.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '123456789012',
  VITE_FIREBASE_APP_ID: '1:123456789012:web:abcdef123456',
  VITE_PLACES_NEW_KEY: placesKey,
}
const client = [
  'FAMILY ALPHA · PRIVATE DOGFOOD',
  ...Object.values(env),
].join('|')
const files = new Map([
  ['index.html', '<script src="/assets/app.js"></script>'],
  ['icon.svg', '<svg/>'],
  ['manifest.webmanifest', '{}'],
  ['precache-manifest.json', JSON.stringify({
    assets: ['/index.html', '/icon.svg', '/manifest.webmanifest', '/assets/app.js'],
  })],
  ['sw-v2.js', 'const cache = true'],
  ['assets/app.js', client],
])

assert.deepEqual(familyAlphaArtifactIssues({ files, env, legacyApiKeys: new Set([legacyKey]) }), [])
assert.ok(familyAlphaArtifactIssues({
  files: new Map([...files].filter(([path]) => path !== 'sw-v2.js')),
  env,
}).includes('artifact:missing:sw-v2.js'))
assert.ok(familyAlphaArtifactIssues({
  files: new Map(files).set('assets/app.js', client.replace('FAMILY ALPHA · PRIVATE DOGFOOD', 'ordinary build')),
  env,
}).includes('artifact:release-marker'))
assert.ok(familyAlphaArtifactIssues({
  files: new Map(files).set('assets/extra.js', legacyKey),
  env,
  legacyApiKeys: new Set([legacyKey]),
}).includes('artifact:legacy-browser-api-key'))
assert.ok(familyAlphaArtifactIssues({
  files: new Map(files).set('assets/photo.js', 'fetch("/placePhoto")'),
  env,
}).includes('artifact:place-photo-client-path'))
assert.ok(familyAlphaArtifactIssues({
  files: new Map(files).set('assets/app.js', client.replaceAll(env.VITE_FIREBASE_PROJECT_ID, 'missing-project')),
  env,
}).includes('artifact:missing-config:VITE_FIREBASE_PROJECT_ID'))

console.log('PASS family-alpha emitted artifact is exact, visibly marked, and free of legacy/photo leakage')
