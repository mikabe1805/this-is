import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  familyAlphaEnvironmentIssues,
  legacyBrowserApiKeys,
  parseFamilyAlphaEnvText,
} from '../v2/family-alpha.safety.mjs'
import { familyAlphaArtifactIssues } from './family-alpha-artifact-core.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const artifactRoot = resolve(root, 'v2', '.family-alpha-dist')
const envPath = resolve(root, '.env.family-alpha.local')

function emittedFiles(directory) {
  const files = new Map()
  const visit = current => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = resolve(current, entry.name)
      if (entry.isDirectory()) visit(absolute)
      else if (entry.isFile()) {
        files.set(relative(directory, absolute).split(sep).join('/'), readFileSync(absolute))
      } else {
        throw new Error('Family-alpha artifact may contain only ordinary files and directories.')
      }
    }
  }
  visit(directory)
  return files
}

if (!existsSync(envPath) || !existsSync(artifactRoot)) {
  console.error('Family-alpha artifact check requires the dedicated environment and v2/.family-alpha-dist build.')
  process.exit(1)
}
const env = parseFamilyAlphaEnvText(readFileSync(envPath, 'utf8'))
const envIssues = familyAlphaEnvironmentIssues(env)
if (envIssues.length) {
  console.error('Family-alpha artifact check refused an invalid dedicated environment.')
  process.exit(1)
}

const files = emittedFiles(artifactRoot)
const issues = familyAlphaArtifactIssues({ files, env, legacyApiKeys: legacyBrowserApiKeys() })
if (issues.length) {
  console.error('Family-alpha artifact is blocked:')
  issues.forEach(issue => console.error(`- ${issue}`))
  process.exit(1)
}

console.log(`Family-alpha artifact passed ${files.size} emitted-file checks: exact alpha config, visible marker, owned shell, no source maps, no legacy/unknown browser keys, and no photo client path.`)
console.log('No network request or deployment was performed.')
