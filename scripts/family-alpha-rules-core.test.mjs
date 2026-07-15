import assert from 'node:assert/strict'
import { familyAlphaRulesIssues, generateFamilyAlphaRules } from './family-alpha-rules-core.mjs'

const canonical = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }
    function isOwner(uid) {
      return signedIn() && request.auth.uid == uid;
    }
  }
}
`

const generated = generateFamilyAlphaRules(canonical)
assert.match(generated, /'familyAlpha' in request\.auth\.token/)
assert.match(generated, /request\.auth\.token\.familyAlpha == true/)
assert.doesNotMatch(generated, /return request\.auth != null;/)
assert.deepEqual(familyAlphaRulesIssues({ canonicalSource: canonical, generatedSource: generated }), [])
assert.deepEqual(
  familyAlphaRulesIssues({ canonicalSource: canonical, generatedSource: `${generated}\n// drift` }),
  ['rules:generated-drift'],
)
assert.throws(
  () => generateFamilyAlphaRules(canonical.replace('return request.auth != null;', 'return true;')),
  /exactly one canonical signedIn/,
)
assert.throws(() => generateFamilyAlphaRules(canonical, 'admin'), /reviewed familyAlpha claim/)

console.log('PASS family-alpha rules strengthen only the exact canonical signedIn boundary')
