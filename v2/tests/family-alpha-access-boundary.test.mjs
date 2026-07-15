import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const src = new URL('../src/', import.meta.url)
const [authWatch, app, gate, session] = await Promise.all([
  readFile(new URL('lib/authWatch.ts', src), 'utf8'),
  readFile(new URL('App.tsx', src), 'utf8'),
  readFile(new URL('components/FamilyAlphaAccessGate.tsx', src), 'utf8'),
  readFile(new URL('state/session.ts', src), 'utf8'),
])

assert.match(authWatch, /if \(familyAlphaRelease\)[\s\S]*onIdTokenChanged\(auth, receiveAuthUser\)/)
assert.match(authWatch, /getIdTokenResult\(user, forceRefresh\)/)
assert.match(authWatch, /if \(!hasFamilyAlphaAccess\(token\.claims\)\)/)
assert.match(authWatch, /setSession\(\{ status: 'access-pending', user: null, reason: 'not-approved' \}\)/)
assert.match(authWatch, /setSession\(\{ status: 'access-pending', user: null, reason: 'unavailable' \}\)/)
assert.match(authWatch, /export async function refreshFamilyAlphaAccess/)
assert.equal((authWatch.match(/ensureProfile\(/g) ?? []).length, 1,
  'profile bootstrap must remain centralized behind admitUser')

const claimCheck = authWatch.indexOf('if (!hasFamilyAlphaAccess(token.claims))')
const admissionAfterCheck = authWatch.indexOf('admitUser(user)', claimCheck)
assert.ok(claimCheck >= 0 && admissionAfterCheck > claimCheck,
  'family-alpha admission must occur only after the exact claim check')
assert.ok((authWatch.match(/queryClient\.clear\(\)/g) ?? []).length >= 4,
  'pending, unavailable, sign-out, and account-switch paths must clear private UI cache')

assert.match(session, /status: 'access-checking'; user: null/)
assert.match(session, /status: 'access-pending'; user: null/)
assert.match(app, /familyAlphaGateState\(import\.meta\.env\.VITE_RELEASE_CHANNEL, session\.status\)/)
assert.match(app, /VITE_RELEASE_CHANNEL === 'family-alpha'[\s\S]*lazy\(\(\) => import\('\.\/components\/FamilyAlphaAccessGate'\)/,
  'the alpha-only UI must stay out of canonical entry execution')
assert.ok(app.indexOf('if (alphaGate && FamilyAlphaAccessGate)') < app.indexOf('<OnboardingGate />'),
  'the closed alpha shell must return before onboarding or routes mount')
assert.match(gate, /await import\('\.\.\/lib\/authWatch'\)/,
  'Firebase auth must stay dynamically loaded')
assert.doesNotMatch(gate, /session\.user|displayName|photoURL/,
  'the pending shell must not render identity')

console.log('PASS family-alpha shell is wired ahead of every data-capable route')
