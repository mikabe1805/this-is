import assert from 'node:assert/strict'
import { familyAlphaSurfaceIssues } from './family-alpha-surface-core.mjs'

const surface = {
  schemaVersion: 2,
  codebase: 'family-alpha',
  authClaim: 'familyAlpha',
  deployFunctions: ['syncProjection', 'createGroup', 'pickReceipt'],
  hostingFunctions: ['createGroup', 'pickReceipt'],
  excludedFunctions: ['placePhoto', 'migratePairToGroup'],
}
const firebaseConfig = {
  firestore: { rules: 'v2/.family-alpha-rules/firestore.rules', indexes: 'v2/firestore.indexes.json' },
  functions: [{
    source: 'v2-functions/.family-alpha-deploy',
    codebase: 'family-alpha',
    predeploy: ['npm --prefix "$RESOURCE_DIR" run build'],
  }],
  hosting: {
    public: 'v2/.family-alpha-dist',
    ignore: ['firebase.family-alpha.json', '**/.*', '**/node_modules/**'],
    rewrites: [
      { source: '/createGroup', function: { functionId: 'createGroup', region: 'us-central1', pinTag: true } },
      { source: '/pick/**', function: { functionId: 'pickReceipt', region: 'us-central1', pinTag: true } },
      { source: '**', destination: '/index.html' },
    ],
  },
}
const functionsSource = `
export const syncProjection = 1
export const createGroup = 1
export const pickReceipt = 1
export const placePhoto = 1
export const migratePairToGroup = 1
`

assert.deepEqual(familyAlphaSurfaceIssues({ surface, firebaseConfig, functionsSource }), [])
assert.ok(familyAlphaSurfaceIssues({
  surface: { ...surface, deployFunctions: [...surface.deployFunctions, 'placePhoto'] },
  firebaseConfig,
  functionsSource,
}).includes('surface:place-photo-exposed'))
assert.ok(familyAlphaSurfaceIssues({
  surface,
  firebaseConfig: { ...firebaseConfig, hosting: { ...firebaseConfig.hosting, public: 'v2/dist' } },
  functionsSource,
}).includes('config:hosting-public'))
assert.ok(familyAlphaSurfaceIssues({
  surface,
  firebaseConfig: {
    ...firebaseConfig,
    hosting: {
      ...firebaseConfig.hosting,
      rewrites: [
        ...firebaseConfig.hosting.rewrites.slice(0, -1),
        { source: '/placePhoto', function: { functionId: 'placePhoto', region: 'us-central1', pinTag: true } },
        firebaseConfig.hosting.rewrites.at(-1),
      ],
    },
  },
  functionsSource,
}).includes('config:place-photo-rewrite'))
assert.ok(familyAlphaSurfaceIssues({
  surface,
  firebaseConfig,
  functionsSource: `${functionsSource}\nexport const newlyAddedFunction = 1\n`,
}).includes('surface:function-partition-drift'))

console.log('PASS family-alpha Hosting and Functions surface stay exact, isolated, and photo-secret-free')
