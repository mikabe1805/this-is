import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fix = process.argv.includes('--fix')
const banner = '> **FROZEN V1 REFERENCE - NOT CURRENT PRODUCT AUTHORITY.** This file documents the retired root application and may contain obsolete costs, credentials guidance, commands, or deployment claims. Do not implement or deploy from it. Start with [README.md](README.md) and [CURRENT_STATE.md](docs/product-reset/CURRENT_STATE.md).\n\n'

const canonicalRoot = new Set(['AGENTS.md', 'CLAUDE.md', 'README.md'])
const legacyRoot = new Set([
  'DATABASE_CLEANUP_GUIDE.md',
  'DEPLOY_CHECKLIST.md',
  'EMERGENCY_ACTIONS.md',
  'FINALIZATION_GUIDE.md',
  'HOTFIX_COMPLETE.md',
  'MAKEOVER.md',
  'MIGRATION_COMPLETE_SUMMARY.md',
  'MIGRATION_STATUS.md',
  'PLACES_API_HOTFIX.md',
  'PLACES_API_NEW_SETUP.md',
  'PLACES_API_OPTIMIZATION.md',
  'PR_SUMMARY.md',
  'PR_SUMMARY_GENERATED.md',
  'QUICK_REFERENCE.md',
  'QUOTA_CRISIS_FIX.md',
  'README-maps.md',
  'ROADMAP.md',
  'STYLE_GUIDE.md',
  'TODO.md',
  'UI_UPDATES_SUMMARY.md',
  'plan.md',
])
const alreadyClassified = /FROZEN V1 REFERENCE|Superseded product direction|Historical v1 roadmap|Archived v1 task list|Archived v1 incident plan/i
const historicalAuditBanner = '> **HISTORICAL V1 AUDIT - NOT CURRENT PRODUCT AUTHORITY.** This file analyzes the retired root application. Preserve it as evidence, but do not use its goals, backlog, architecture, styling, or completion claims for canonical v2 work. See the repository documentation map at `docs/README.md`.\n\n'
const historicalTrees = [
  'benchmarks/thisis-search',
  'docs/status',
  'docs/system-dossier',
  'docs/ui-status',
]
const historicalFiles = ['docs/audit.md', 'docs/KNOWN_BUGS.md', 'scripts/database-structure.md']
const markdownFilesUnder = directory => {
  const files = []
  for (const entry of readdirSync(resolve(root, directory))) {
    const relative = `${directory}/${entry}`
    const path = resolve(root, relative)
    if (statSync(path).isDirectory()) files.push(...markdownFilesUnder(relative))
    else if (entry.toLowerCase().endsWith('.md')) files.push(relative)
  }
  return files
}
const historicalAuditFiles = [...historicalFiles, ...historicalTrees.flatMap(markdownFilesUnder)]

if (fix) {
  for (const file of legacyRoot) {
    const path = resolve(root, file)
    const source = readFileSync(path, 'utf8')
    if (!alreadyClassified.test(source.slice(0, 900))) writeFileSync(path, banner + source, 'utf8')
  }
  for (const file of historicalAuditFiles) {
    const path = resolve(root, file)
    const source = readFileSync(path, 'utf8')
    if (!source.startsWith(historicalAuditBanner)) writeFileSync(path, historicalAuditBanner + source, 'utf8')
  }
}

const failures = []
const rootMarkdown = readdirSync(root).filter(file => file.toLowerCase().endsWith('.md'))
for (const file of rootMarkdown) {
  if (!canonicalRoot.has(file) && !legacyRoot.has(file)) failures.push(`unclassified root document: ${file}`)
}
for (const file of [...canonicalRoot, ...legacyRoot]) {
  if (!rootMarkdown.includes(file)) failures.push(`classified document is missing: ${file}`)
}
for (const file of legacyRoot) {
  const source = readFileSync(resolve(root, file), 'utf8')
  if (!alreadyClassified.test(source.slice(0, 900))) failures.push(`legacy document lacks a frozen/superseded banner: ${file}`)
}
for (const file of historicalAuditFiles) {
  const source = readFileSync(resolve(root, file), 'utf8')
  if (!source.startsWith(historicalAuditBanner)) failures.push(`historical audit lacks a frozen banner: ${file}`)
}

for (const file of [
  'v2/BRIEF.md',
  'v2/DIRECTION.md',
  'v2/FRIENDS.md',
  'v2/ROADMAP.md',
  'v2/docs/READS.md',
  'v2/functions/README.md',
]) {
  const source = readFileSync(resolve(root, file), 'utf8')
  if (!/HISTORICAL|SUPERSEDED/i.test(source.slice(0, 900))) failures.push(`historical v2 strategy is not labeled: ${file}`)
}

const v2Claude = readFileSync(resolve(root, 'v2/CLAUDE.md'), 'utf8')
if (!v2Claude.includes('Use [`AGENTS.md`](AGENTS.md) as the authority')) {
  failures.push('v2/CLAUDE.md does not defer to canonical v2/AGENTS.md')
}

const uxArchitecture = readFileSync(resolve(root, 'docs/product-reset/UX_ARCHITECTURE.md'), 'utf8')
const retiredPairOnlyUx = [
  '### 1. First pair:',
  '### Pair Together view',
  'Connect with a real person',
  'For two people, score candidates',
  '| Rich pair |',
  'Pair return rate within 30 days',
  '| No signals | explain the three-state model | Keep 3 places |',
]
for (const instruction of retiredPairOnlyUx) {
  if (uxArchitecture.includes(instruction)) failures.push(`UX architecture revived retired pair-only instruction: ${instruction}`)
}
if (uxArchitecture.includes('Search and import a place.')) {
  failures.push('UX architecture revived an unreviewed bulk-import instruction')
}
for (const requirement of [
  '### Group decision view',
  '**Resolved Picks per active group per month**',
  'zero must never read as unfinished work',
  'A pair is simply a two-member group',
  'Search for one place or receive one share-sheet handoff; review it before saving.',
  'can never become an onboarding dependency',
]) {
  if (!uxArchitecture.includes(requirement)) failures.push(`UX architecture lacks group-native requirement: ${requirement}`)
}

const reset = readFileSync(resolve(root, 'docs/product-reset/THIS_IS_RESET.md'), 'utf8')
const historicalCheckpoint = '## Implementation checkpoint — July 10, 2026'
const activeReset = reset.split(historicalCheckpoint)[0]
if (!reset.includes(`${historicalCheckpoint}\n\n> **Historical implementation evidence, not current product instruction.**`)) {
  failures.push('THIS_IS_RESET.md does not isolate its pair-era implementation checkpoint as historical evidence')
}
for (const instruction of [
  'The app immediately computes pairwise overlap.',
  'Each relationship opens directly to an Overlap view.',
  'Pairwise Overlap as the primary experience:',
  '**Resolved Picks per active pair per month**',
  'Run the eight-pair, 14-day protocol',
  '### Phase 1 — make Overlap the product',
  'Small-group overlap beyond pairs.',
]) {
  if (activeReset.includes(instruction)) failures.push(`active product reset revived retired pair-only instruction: ${instruction}`)
}
for (const requirement of [
  '**Find the place your people already have a truthful reason to choose.**',
  '**this.is helps a recurring group find the place it already has a truthful reason to choose.**',
  '**Resolved Picks per active group per month**',
  'Family dogfooding may guide bugs, comprehension, and product judgment',
  'Those larger protocols remain optional future research infrastructure, not a prerequisite for continuing',
  'No automatic location inference or learned ranking without a new product decision.',
]) {
  if (!activeReset.includes(requirement)) failures.push(`active product reset lacks group-native requirement: ${requirement}`)
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`)
  process.exit(1)
}

console.log(`PASS ${canonicalRoot.size} canonical root documents are explicit`)
console.log(`PASS ${legacyRoot.size} root historical documents are classified`)
console.log(`PASS ${historicalAuditFiles.length} nested v1 audit documents are visibly historical`)
console.log('PASS every retained pre-reset v2 strategy/backend is visibly historical')
console.log('PASS v2 agent entry points agree on the canonical product')
console.log('PASS operative UX architecture is group-native and pair remains only a valid group size or migration/control concern')
console.log('PASS active product reset is group-native and its pair-era implementation checkpoint is explicitly historical')
