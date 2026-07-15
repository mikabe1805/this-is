import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { summarizeAreaGazetteerManifest, validateAreaGazetteerManifest } from './area-gazetteer-manifest-core.mjs'

if (process.argv.includes('--help')) {
  console.log('Usage: npm run gazetteer:plan -- [--file area-gazetteer-manifest.local.json] [--require-indexed]')
  console.log('Read-only: validates one local manifest and prints a bounded summary. It does not download, write, index, deploy, enable search, or contact GeoNames.')
  process.exit(0)
}
const fileArg = process.argv.indexOf('--file')
const file = resolve(process.cwd(), fileArg >= 0 ? process.argv[fileArg + 1] ?? '' : 'area-gazetteer-manifest.local.json')
let manifest
try {
  manifest = JSON.parse(await readFile(file, 'utf8'))
} catch (error) {
  console.error(`Could not read area gazetteer manifest: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
const issues = validateAreaGazetteerManifest(manifest, { requireIndexed: process.argv.includes('--require-indexed') })
if (issues.length) {
  console.error('Area gazetteer manifest is not ready:')
  issues.forEach(issue => console.error(`- ${issue}`))
  process.exit(1)
}
console.log(JSON.stringify(summarizeAreaGazetteerManifest(manifest), null, 2))
