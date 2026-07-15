import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exportedFunctionNames } from './family-alpha-surface-core.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const functionsRoot = resolve(root, 'v2-functions')
const compiledRoot = resolve(functionsRoot, 'lib')
const outputRoot = resolve(functionsRoot, '.family-alpha-deploy')
const outputLib = resolve(outputRoot, 'lib')
if (dirname(outputRoot) !== functionsRoot || !outputRoot.endsWith('.family-alpha-deploy')) {
  throw new Error('Refusing an unexpected family-alpha Functions output path.')
}

const surface = JSON.parse(await readFile(resolve(root, 'family-alpha-deploy-surface.json'), 'utf8'))
const expected = [...surface.deployFunctions].sort((left, right) => left.localeCompare(right))
if (surface.authClaim !== 'familyAlpha') throw new Error('Refusing an unreviewed family-alpha claim name.')

function removeLine(source, pattern, label) {
  const matches = source.match(pattern)
  if (!matches || matches.length !== 1) throw new Error(`Expected one ${label} in compiled Functions entry.`)
  return source.replace(pattern, '')
}

function replaceOnce(source, pattern, replacement, label) {
  const matches = source.match(pattern)
  if (!matches || matches.length !== 1) throw new Error(`Expected one ${label} in compiled Functions entry.`)
  return source.replace(pattern, replacement)
}

function removeEndpoint(source, endpoint, nextEndpoint) {
  const startMarker = `export const ${endpoint} =`
  const endMarker = `export const ${nextEndpoint} =`
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start + startMarker.length)
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`Cannot isolate ${endpoint} from the compiled Functions entry.`)
  }
  return `${source.slice(0, start)}${source.slice(end)}`
}

let entry = await readFile(resolve(compiledRoot, 'index.js'), 'utf8')
entry = removeLine(entry, /^import \{ defineSecret \} from 'firebase-functions\/params';\r?\n/m, 'secret import')
entry = removeLine(entry, /^import \{ buildPairGroupMigration,[^\n]+from '\.\/pair-migration\.js';\r?\n/m, 'pair-migration import')
entry = removeLine(entry, /^import \{ canReservePlacePhoto,[^\n]+from '\.\/place-photo\.js';\r?\n/m, 'place-photo import')
entry = removeLine(entry, /^const placesServerKey = defineSecret\('PLACES_SERVER_KEY'\);\r?\n/m, 'Places secret declaration')
entry = replaceOnce(
  entry,
  /^        return await getAuth\(\)\.verifyIdToken\(token, true\);$/gm,
  [
    '        const identity = await getAuth().verifyIdToken(token, true);',
    `        if (identity.${surface.authClaim} !== true)`,
    '            return null;',
    '        return identity;',
  ].join(entry.includes('\r\n') ? '\r\n' : '\n'),
  'authenticatedUid identity boundary',
)
entry = removeEndpoint(entry, 'placePhoto', 'searchPlanAreas')
entry = removeEndpoint(entry, 'migratePairToGroup', 'updateGroupDraftPass')

const actual = exportedFunctionNames(entry).sort((left, right) => left.localeCompare(right))
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error('Generated family-alpha Functions exports do not match the reviewed deploy surface.')
}
for (const forbidden of [
  'defineSecret',
  'PLACES_SERVER_KEY',
  'placePhoto',
  'place-photo.js',
  'migratePairToGroup',
  'pair-migration.js',
]) {
  if (entry.includes(forbidden)) throw new Error(`Generated family-alpha Functions retained ${forbidden}.`)
}
if (!entry.includes(`identity.${surface.authClaim} !== true`)
  || entry.includes('return await getAuth().verifyIdToken(token, true);')) {
  throw new Error('Generated family-alpha Functions did not enforce the reviewed identity claim.')
}

await rm(outputRoot, { recursive: true, force: true })
await mkdir(outputLib, { recursive: true })
const compiledEntries = await readdir(compiledRoot, { withFileTypes: true })
for (const item of compiledEntries) {
  if (!item.isFile() || !item.name.endsWith('.js') || item.name.endsWith('.test.js')) continue
  if (['index.js', 'place-photo.js', 'pair-migration.js'].includes(item.name)) continue
  await copyFile(resolve(compiledRoot, item.name), resolve(outputLib, item.name))
}
await writeFile(resolve(outputLib, 'index.js'), entry)

const canonicalPackage = JSON.parse(await readFile(resolve(functionsRoot, 'package.json'), 'utf8'))
const canonicalLock = JSON.parse(await readFile(resolve(functionsRoot, 'package-lock.json'), 'utf8'))
const canonicalLockRoot = canonicalLock.packages?.['']
if (canonicalPackage.name !== canonicalLock.name
  || canonicalPackage.version !== canonicalLock.version
  || canonicalPackage.name !== canonicalLockRoot?.name
  || canonicalPackage.version !== canonicalLockRoot?.version) {
  throw new Error('Canonical Functions package and lockfile identity have drifted.')
}
const alphaPackage = {
  ...canonicalPackage,
  scripts: { build: 'node verify-surface.mjs' },
}
await writeFile(resolve(outputRoot, 'package.json'), `${JSON.stringify(alphaPackage, null, 2)}\n`)
await copyFile(resolve(functionsRoot, 'package-lock.json'), resolve(outputRoot, 'package-lock.json'))
await writeFile(resolve(outputRoot, 'deploy-surface.json'), `${JSON.stringify(surface, null, 2)}\n`)
await writeFile(resolve(outputRoot, 'verify-surface.mjs'), `import { readFileSync } from 'node:fs'
const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const packageLock = JSON.parse(readFileSync(new URL('./package-lock.json', import.meta.url), 'utf8'))
const surface = JSON.parse(readFileSync(new URL('./deploy-surface.json', import.meta.url), 'utf8'))
const source = readFileSync(new URL('./lib/index.js', import.meta.url), 'utf8')
const actual = [...source.matchAll(/^export const ([A-Za-z][A-Za-z0-9_]*)\\s*=/gm)].map(match => match[1]).sort()
const expected = [...surface.deployFunctions].sort()
const forbidden = ['defineSecret', 'PLACES_SERVER_KEY', 'placePhoto', 'place-photo.js', 'migratePairToGroup', 'pair-migration.js']
const claimBoundary = \`identity.\${surface.authClaim} !== true\`
if (JSON.stringify(actual) !== JSON.stringify(expected)
  || packageJson.name !== packageLock.name
  || packageJson.version !== packageLock.version
  || packageJson.name !== packageLock.packages?.['']?.name
  || packageJson.version !== packageLock.packages?.['']?.version
  || forbidden.some(value => source.includes(value))
  || !source.includes(claimBoundary)
  || source.includes('return await getAuth().verifyIdToken(token, true);')) {
  console.error('Refusing drifted family-alpha Functions package.')
  process.exit(1)
}
console.log('Family-alpha Functions package exposes only the reviewed secret-free, claim-gated surface.')
`)

console.log(`Built ignored family-alpha Functions package with ${actual.length} exact, claim-gated exports and no photo secret.`)
console.log('No network request or deployment was performed.')
