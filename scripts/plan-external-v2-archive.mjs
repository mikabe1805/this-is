import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parsePorcelainV1Z, summarizeArchiveChanges } from './external-v2-archive-core.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const argument = name => {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

if (process.argv.includes('--help')) {
  console.log('Usage: npm run archive:plan -- [--path C:\\path\\to\\this-is-v2]')
  console.log('Reads Git metadata and hashes non-ignored files. It does not write, move, delete, stage, or commit anything.')
  process.exit(0)
}

const sourcePath = resolve(argument('--path') ?? resolve(root, '..', 'this-is-v2'))
const READ_ONLY_GIT_COMMANDS = new Set(['branch', 'ls-files', 'rev-parse', 'status'])
const assertReadOnlyGit = args => {
  if (!READ_ONLY_GIT_COMMANDS.has(args[0])) throw new Error(`Refusing non-read-only Git command: ${args[0]}`)
}
const git = (...args) => {
  assertReadOnlyGit(args)
  return execFileSync('git', ['-C', sourcePath, ...args], { encoding: 'utf8' }).trim()
}
const gitZ = (...args) => {
  assertReadOnlyGit(args)
  return execFileSync('git', ['-C', sourcePath, ...args]).toString('utf8')
}
const listZ = value => value.split('\0').filter(Boolean)
const safePath = path => {
  const absolute = resolve(sourcePath, path)
  if (absolute !== sourcePath && !absolute.startsWith(`${sourcePath}${sep}`)) {
    throw new Error(`Git returned a path outside the repository: ${path}`)
  }
  return absolute
}
const hashFile = path => createHash('sha256').update(readFileSync(path)).digest('hex')

if (!existsSync(sourcePath)) throw new Error(`External prototype does not exist: ${sourcePath}`)
const topLevel = resolve(git('rev-parse', '--show-toplevel'))
if (topLevel.toLowerCase() !== sourcePath.toLowerCase()) {
  throw new Error(`Expected a Git repository root at ${sourcePath}; found ${topLevel}.`)
}

const changes = parsePorcelainV1Z(gitZ('status', '--porcelain=v1', '-z'))
const tracked = listZ(gitZ('ls-files', '-z', '--cached'))
const untracked = listZ(gitZ('ls-files', '-z', '--others', '--exclude-standard'))
const trackedSet = new Set(tracked)
const files = [...new Set([...tracked, ...untracked])]
  .sort((left, right) => left.localeCompare(right))
  .flatMap(path => {
    const absolute = safePath(path)
    if (!existsSync(absolute) || !statSync(absolute).isFile()) return []
    const stat = statSync(absolute)
    return [{
      path,
      kind: trackedSet.has(path) ? 'tracked' : 'untracked',
      bytes: stat.size,
      sha256: hashFile(absolute),
    }]
  })

const output = {
  schemaVersion: 1,
  sourcePath,
  preservationDecision: 'owner-approval-required',
  git: {
    branch: git('branch', '--show-current') || null,
    head: git('rev-parse', 'HEAD'),
  },
  dirty: summarizeArchiveChanges(changes),
  changes,
  inventory: {
    fileCount: files.length,
    totalBytes: files.reduce((total, file) => total + file.bytes, 0),
    files,
  },
  ignoredSensitiveState: {
    localEnvironmentFilePresent: existsSync(resolve(sourcePath, '.env.local')),
    contentsReadOrHashed: false,
  },
  generatedDirectoriesPresent: ['dist', 'node_modules', 'test-results']
    .filter(path => existsSync(resolve(sourcePath, path))),
  relativeToCanonicalRepository: relative(root, sourcePath).replaceAll('\\', '/'),
}

console.log(JSON.stringify(output, null, 2))
