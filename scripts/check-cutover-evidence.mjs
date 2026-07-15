import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { validateCutoverEvidence } from './cutover-evidence-core.mjs'

const argument = name => {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}
const path = resolve(argument('--file') ?? 'cutover-evidence.local.json')
if (!existsSync(path)) {
  console.error(`Cutover evidence is missing: ${path}`)
  console.error('Copy cutover-evidence.template.json to cutover-evidence.local.json and replace every placeholder with reviewed evidence.')
  process.exit(1)
}

let evidence
try {
  evidence = JSON.parse(readFileSync(path, 'utf8'))
} catch {
  console.error(`Cutover evidence is not valid JSON: ${path}`)
  process.exit(1)
}
const issues = validateCutoverEvidence(evidence)
if (issues.length) {
  for (const issue of issues) console.error(`FAIL ${issue}`)
  process.exit(1)
}
console.log('PASS reviewed cutover evidence covers pilot, migration, live rules, TTL follow-up, rollback, owners, and external archival.')
