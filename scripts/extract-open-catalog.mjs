import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildOpenCatalogDuckDbSql,
  runOpenCatalogAcquisition,
} from './open-catalog-acquisition-core.mjs'
import { validateOpenCatalogManifest } from './open-catalog-manifest-core.mjs'
import {
  buildOpenCatalogArtifact,
  serializeOpenCatalogArtifact,
} from '../v2/.domain-test/domain/openCatalogArtifact.js'
import { extractOpenCatalogRows } from '../v2/.domain-test/domain/openCatalogExtraction.js'

const workspaceRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const argument = name => {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

if (process.argv.includes('--help')) {
  console.log('Usage: npm run catalog:extract -- --file open-catalog-manifest.local.json --duckdb C:\\path\\duckdb.exe --confirm-network [--output output/open-catalog/release.json]')
  console.log('Use --print-sql for a no-network review. The command never installs extensions, uploads, activates serving, or edits the manifest.')
  process.exit(0)
}

const manifestPath = resolve(argument('--file') ?? 'open-catalog-manifest.local.json')
if (!existsSync(manifestPath)) {
  console.error(`Open-catalog manifest is missing: ${manifestPath}`)
  process.exit(1)
}
let manifest
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
} catch {
  console.error(`Open-catalog manifest is not valid JSON: ${manifestPath}`)
  process.exit(1)
}
const issues = validateOpenCatalogManifest(manifest)
if (issues.length || manifest.stage !== 'planned') {
  ;[...issues, ...(manifest.stage === 'planned' ? [] : ['manifest.stage must be planned for acquisition.'])]
    .forEach(issue => console.error(`FAIL ${issue}`))
  process.exit(1)
}

const output = argument('--output') ?? `output/open-catalog/overture-${manifest.release.releaseId}.json`
if (process.argv.includes('--print-sql')) {
  console.log(buildOpenCatalogDuckDbSql(manifest, '<TEMP_RAW_NDJSON>'))
  process.exit(0)
}
if (!process.argv.includes('--confirm-network')) {
  console.error('Refusing network acquisition without --confirm-network. Use --print-sql to review first.')
  process.exit(1)
}
const duckdbValue = argument('--duckdb') ?? process.env.DUCKDB_BIN
if (!duckdbValue || !isAbsolute(duckdbValue)) {
  console.error('Provide one reviewed absolute DuckDB executable path with --duckdb or DUCKDB_BIN.')
  process.exit(1)
}
const duckdbCommand = resolve(duckdbValue)

try {
  const summary = runOpenCatalogAcquisition({
    manifest,
    workspaceRoot,
    artifactOutputPath: output,
    duckdbCommand,
    domain: { extractOpenCatalogRows, buildOpenCatalogArtifact, serializeOpenCatalogArtifact },
  })
  console.log(JSON.stringify(summary, null, 2))
  console.log('Review this summary, then copy its artifact/count fields into a separate extracted manifest. Nothing was uploaded or activated.')
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Open-catalog acquisition failed.')
  process.exit(1)
}
