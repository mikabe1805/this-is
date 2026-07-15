import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { summarizeOpenCatalogManifest, validateOpenCatalogManifest } from './open-catalog-manifest-core.mjs'

const argument = name => {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

if (process.argv.includes('--help')) {
  console.log('Usage: npm run catalog:plan -- [--file open-catalog-manifest.local.json] [--require-extracted]')
  console.log('Reads and validates one local manifest. It does not download, write, deploy, activate, or contact Overture.')
  process.exit(0)
}

const path = resolve(argument('--file') ?? 'open-catalog-manifest.local.json')
if (!existsSync(path)) {
  console.error(`Open-catalog manifest is missing: ${path}`)
  console.error('Copy open-catalog-manifest.template.json to open-catalog-manifest.local.json and replace every placeholder with reviewed evidence.')
  process.exit(1)
}

let manifest
try {
  manifest = JSON.parse(readFileSync(path, 'utf8'))
} catch {
  console.error(`Open-catalog manifest is not valid JSON: ${path}`)
  process.exit(1)
}

const issues = validateOpenCatalogManifest(manifest, { requireExtracted: process.argv.includes('--require-extracted') })
if (issues.length) {
  issues.forEach(issue => console.error(`FAIL ${issue}`))
  process.exit(1)
}
console.log(JSON.stringify(summarizeOpenCatalogManifest(manifest), null, 2))
