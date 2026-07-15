#!/usr/bin/env node
/**
 * family-alpha-claim — grant or revoke the `familyAlpha: true` custom claim for a
 * single Auth user on the SEPARATE family-alpha Firebase project.
 *
 * This is an OWNER action (§4/§5 of FAMILY_ALPHA_RUNBOOK.md). It is deliberately
 * NOT wired into package.json. It mutates real Auth state, so it defaults to a
 * DRY RUN and only writes with --apply.
 *
 * Prereqs (owner):
 *   1. A separate family-alpha Firebase project already deployed (never this-is-76332).
 *   2. GOOGLE_APPLICATION_CREDENTIALS pointing to a service-account key for THAT
 *      project (Firebase console → Project settings → Service accounts → Generate key).
 *      Never commit that key.
 *   3. The target person has completed Google sign-in once, so their Auth user exists.
 *      Copy their exact Auth UID from the alpha project's Authentication console.
 *
 * Usage (run from the v2-functions directory so firebase-admin resolves):
 *   # dry run (shows the exact claim change, writes nothing):
 *   node scripts/family-alpha-claim.mjs --project <alpha-project-id> --uid <authUid> --grant
 *   # apply it:
 *   node scripts/family-alpha-claim.mjs --project <alpha-project-id> --uid <authUid> --grant --apply
 *   # revoke (removes only familyAlpha, revokes refresh tokens):
 *   node scripts/family-alpha-claim.mjs --project <alpha-project-id> --uid <authUid> --revoke --apply
 */
import { readFileSync } from 'node:fs'
import process from 'node:process'
import admin from 'firebase-admin'

const FORBIDDEN_PROJECTS = new Set(['this-is-76332'])

function fail(message) {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}

function parseArgs(argv) {
  const args = { apply: false, grant: false, revoke: false, project: '', uid: '' }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--apply') args.apply = true
    else if (a === '--grant') args.grant = true
    else if (a === '--revoke') args.revoke = true
    else if (a === '--project') args.project = argv[++i] ?? ''
    else if (a === '--uid') args.uid = argv[++i] ?? ''
    else if (a === '--help' || a === '-h') args.help = true
    else fail(`Unknown argument "${a}". Run with --help.`)
  }
  return args
}

/** Cross-check against the owner's local env so a typo can't target the wrong project. */
function configuredAlphaProjectId() {
  try {
    const env = readFileSync(new URL('../../.env.family-alpha.local', import.meta.url), 'utf8')
    const match = env.match(/^THIS_IS_FAMILY_ALPHA_PROJECT_ID=(.+)$/m)
    return match?.[1]?.trim() || null
  } catch {
    return null
  }
}

const args = parseArgs(process.argv.slice(2))

if (args.help || (!args.grant && !args.revoke)) {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 39).join('\n').replace(/^ \*?\/?/gm, ''))
  process.exit(args.help ? 0 : 1)
}

if (args.grant && args.revoke) fail('Choose exactly one of --grant or --revoke.')
if (!args.project) fail('--project <alpha-project-id> is required (never this-is-76332).')
if (!args.uid) fail('--uid <authUid> is required. Copy it from the alpha project Auth console.')
if (FORBIDDEN_PROJECTS.has(args.project)) fail(`Refusing to touch "${args.project}" — this is the frozen legacy project.`)
if (/(^|[^a-z0-9])(demo|emulator)([^a-z0-9]|$)/i.test(args.project)) {
  fail(`"${args.project}" looks like an emulator/demo project. Use the real deployed alpha project.`)
}
const configured = configuredAlphaProjectId()
if (configured && configured !== args.project) {
  fail(`--project "${args.project}" does not match THIS_IS_FAMILY_ALPHA_PROJECT_ID ("${configured}") in .env.family-alpha.local.`)
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  fail('GOOGLE_APPLICATION_CREDENTIALS is not set. Point it at the alpha project service-account key (never committed).')
}

const mode = args.grant ? 'GRANT' : 'REVOKE'
console.log(`\n${args.apply ? '● APPLY' : '○ DRY RUN'} · ${mode} familyAlpha`)
console.log(`  project: ${args.project}`)
console.log(`  uid:     ${args.uid}\n`)

admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: args.project })
const auth = admin.auth()

let user
try {
  user = await auth.getUser(args.uid)
} catch (error) {
  fail(`Could not fetch user ${args.uid} on ${args.project}: ${error?.message ?? error}. ` +
    `Confirm they have signed in once and that the UID + project are correct.`)
}

const current = user.customClaims ?? {}
const next = { ...current }
if (args.grant) next.familyAlpha = true
else delete next.familyAlpha

console.log(`  current claims: ${JSON.stringify(current)}`)
console.log(`  next claims:    ${JSON.stringify(next)}`)
if (args.grant && current.familyAlpha === true) console.log('  (already granted — no change)')
if (args.revoke && !('familyAlpha' in current)) console.log('  (already absent — no change)')

if (!args.apply) {
  console.log('\n○ Dry run only. Re-run with --apply to write. Nothing was changed.\n')
  process.exit(0)
}

// setCustomUserClaims REPLACES the whole object — that is why we merged `next`.
await auth.setCustomUserClaims(args.uid, next)
const verify = (await auth.getUser(args.uid)).customClaims ?? {}
const ok = args.grant ? verify.familyAlpha === true : !('familyAlpha' in verify)
if (!ok) fail(`Verification failed. Claims after write: ${JSON.stringify(verify)}`)
console.log(`\n✓ ${mode} applied. Verified claims: ${JSON.stringify(verify)}`)

if (args.revoke) {
  await auth.revokeRefreshTokens(args.uid)
  console.log('✓ Refresh tokens revoked.')
  console.log('\n⚠ ID tokens already issued last up to ~1 hour and the Firestore rules read the JWT claim,')
  console.log('  so this is NOT an instant Firestore cutoff. For immediate cutoff, deploy a reviewed')
  console.log('  deny-all ruleset to THIS alpha project, then wait out the old token lifetime (runbook §5).')
  console.log('  Claim removal does not revoke public Pick receipts or delete group membership/data —')
  console.log('  handle those explicitly (runbook §5).')
} else {
  console.log('\n→ Next: the member must sign out and in again (or force an ID-token refresh) before access works —')
  console.log('  custom claims only appear in a newly issued ID token.')
  console.log('→ Then verify: one allowed Firestore read + one authenticated endpoint succeed for THEM, and')
  console.log('  confirm a different signed-in but UNclaimed account is still denied (runbook §4).')
}
console.log('')
