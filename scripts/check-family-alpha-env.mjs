import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import {
  familyAlphaAmbientKeys,
  familyAlphaEnvironmentIssues,
  formatFamilyAlphaIssue,
  parseFamilyAlphaEnvText,
} from '../v2/family-alpha.safety.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const envPath = resolve(root, '.env.family-alpha.local')

if (!existsSync(envPath)) {
  console.error('Family alpha is not configured. Copy .env.family-alpha.example to .env.family-alpha.local and use a separate Firebase project.')
  process.exit(1)
}

const env = parseFamilyAlphaEnvText(readFileSync(envPath, 'utf8'))
const issues = familyAlphaEnvironmentIssues(env)
const ambient = familyAlphaAmbientKeys(process.env)
if (ambient.length) {
  console.error(`Family-alpha configuration is blocked by ambient environment names: ${ambient.join(', ')}`)
  console.error('Move those values into the dedicated ignored file or remove them from this shell. Values were not printed.')
  process.exit(1)
}
if (issues.length) {
  console.error('Family-alpha configuration is blocked:')
  issues.forEach(issue => console.error(`- ${formatFamilyAlphaIssue(issue)}`))
  process.exit(1)
}

console.log('Family-alpha configuration is structurally safe: exact schema, distinct browser keys, separate project, live Places explicitly enabled, photos disabled.')
console.log('No network request or deployment was performed.')
