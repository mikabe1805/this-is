import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { familyAlphaRulesIssues, generateFamilyAlphaRules } from './family-alpha-rules-core.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const canonicalPath = resolve(root, 'v2/firestore.rules')
const outputRoot = resolve(root, 'v2/.family-alpha-rules')
const outputPath = resolve(outputRoot, 'firestore.rules')
if (dirname(outputRoot) !== resolve(root, 'v2') || !outputRoot.endsWith('.family-alpha-rules')) {
  throw new Error('Refusing an unexpected family-alpha rules output path.')
}

const surface = JSON.parse(await readFile(resolve(root, 'family-alpha-deploy-surface.json'), 'utf8'))
const canonicalSource = await readFile(canonicalPath, 'utf8')
const generatedSource = generateFamilyAlphaRules(canonicalSource, surface.authClaim)

await rm(outputRoot, { recursive: true, force: true })
await mkdir(outputRoot, { recursive: true })
await writeFile(outputPath, generatedSource)

const writtenSource = await readFile(outputPath, 'utf8')
const issues = familyAlphaRulesIssues({
  canonicalSource,
  generatedSource: writtenSource,
  claimName: surface.authClaim,
})
if (issues.length) throw new Error(`Refusing drifted family-alpha rules: ${issues.join(', ')}`)

console.log('Built ignored family-alpha Firestore rules by strengthening only signedIn with familyAlpha == true.')
console.log('No network request, claim provisioning, or deployment was performed.')
