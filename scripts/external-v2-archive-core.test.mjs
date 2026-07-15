import assert from 'node:assert/strict'
import { parsePorcelainV1Z, summarizeArchiveChanges } from './external-v2-archive-core.mjs'

const changes = parsePorcelainV1Z([
  ' M src/Home.tsx',
  'D  functions/src/old.ts',
  '?? VISION.md',
  'R  src/New.tsx',
  'src/Old.tsx',
  '',
].join('\0'))

assert.deepEqual(changes, [
  { status: ' M', path: 'src/Home.tsx' },
  { status: 'D ', path: 'functions/src/old.ts' },
  { status: '??', path: 'VISION.md' },
  { status: 'R ', path: 'src/New.tsx', originalPath: 'src/Old.tsx' },
])
assert.deepEqual(summarizeArchiveChanges(changes), {
  total: 4,
  modified: 1,
  added: 0,
  deleted: 1,
  renamedOrCopied: 1,
  untracked: 1,
})
assert.throws(() => parsePorcelainV1Z('R  new.ts\0'), /missing its original path/)
console.log('✓ external archive status parser preserves modifications, deletions, untracked files, and renames')
