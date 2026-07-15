import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = process.argv[2] ?? 'dist'
const allowedOutputs = new Set(['dist', '.family-alpha-dist'])
if (!allowedOutputs.has(outputDirectory)) {
  throw new Error(`Unsupported precache output directory: ${outputDirectory}`)
}
const dist = path.join(root, outputDirectory)

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(entry => {
    const absolute = path.join(directory, entry.name)
    return entry.isDirectory() ? filesBelow(absolute) : [absolute]
  }))
  return nested.flat()
}

const files = (await filesBelow(dist))
  .filter(file => !['sw-v2.js', 'precache-manifest.json'].includes(path.basename(file)))
  .sort((a, b) => a.localeCompare(b, 'en'))
const hash = createHash('sha256')
for (const file of files) {
  hash.update(path.relative(dist, file).replaceAll(path.sep, '/'))
  hash.update(await readFile(file))
}
const buildId = hash.digest('hex').slice(0, 16)
const assets = files.map(file => `/${path.relative(dist, file).replaceAll(path.sep, '/')}`)

await writeFile(
  path.join(dist, 'precache-manifest.json'),
  `${JSON.stringify({ schemaVersion: 1, buildId, assets }, null, 2)}\n`,
)

const workerPath = path.join(dist, 'sw-v2.js')
const worker = await readFile(workerPath, 'utf8')
if (!worker.includes('__THIS_IS_BUILD_ID__')) throw new Error('Missing service-worker build placeholder.')
await writeFile(workerPath, worker.replaceAll('__THIS_IS_BUILD_ID__', buildId))

console.log(`precache ${assets.length} owned assets as ${buildId}`)
