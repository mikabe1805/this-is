import assert from 'node:assert/strict'
import {
  buildServerPlaceAliasDocument,
  googlePlaceAliasDocumentId,
  parseServerPlaceAliasDocument,
  planServerPlaceAliasReads,
  resolveServerKnownOpenPlaceIds,
} from './open-catalog-alias.js'

const googleId = 'ChIJexplicit'
const documentId = googlePlaceAliasDocumentId(googleId)
assert.match(documentId, /^[a-f0-9]{64}$/)
assert.equal(documentId.includes(googleId), false, 'raw provider identity is absent from the document key')
assert.equal(googlePlaceAliasDocumentId(googleId), documentId, 'alias keys are deterministic')
assert.throws(() => googlePlaceAliasDocumentId(`g:${googleId}`), /raw Google/)

const confirmed = buildServerPlaceAliasDocument({ ownedPlaceIds: ['o:known'], confirmedAt: 1 })
const conflicted = buildServerPlaceAliasDocument({ ownedPlaceIds: ['o:z', 'o:a', 'o:a'], confirmedAt: 2 })
assert.equal(confirmed.status, 'confirmed')
assert.deepEqual(conflicted.ownedPlaceIds, ['o:a', 'o:z'])
assert.equal(conflicted.status, 'conflicted')
assert.deepEqual(parseServerPlaceAliasDocument(confirmed, documentId), confirmed)
assert.equal(parseServerPlaceAliasDocument({ ...confirmed, uid: 'forbidden' }, documentId), null)
assert.equal(parseServerPlaceAliasDocument({ ...confirmed, ownedPlaceIds: ['o:b', 'o:a'] }, documentId), null)

assert.deepEqual(planServerPlaceAliasReads(['g:ChIJz', 'o:direct', 'g:ChIJa', 'g:ChIJa']), [
  googlePlaceAliasDocumentId('ChIJa'), googlePlaceAliasDocumentId('ChIJz'),
].sort())
assert.throws(() => planServerPlaceAliasReads(
  Array.from({ length: 101 }, (_, index) => `g:ChIJ${index}`),
), /ceiling/)

const resolved = resolveServerKnownOpenPlaceIds({
  knownPlaceIds: [`g:${googleId}`, 'o:direct'],
  aliasDocuments: [{ id: documentId, data: confirmed }],
})
assert.deepEqual([...resolved.excludeOpenPlaceIds].sort(), ['o:direct', 'o:known'])
assert.equal(resolved.conflictedAliasCount, 0)
assert.equal(resolved.invalidAliasCount, 0)

const unresolved = resolveServerKnownOpenPlaceIds({
  knownPlaceIds: [`g:${googleId}`],
  aliasDocuments: [
    { id: documentId, data: conflicted },
    { id: 'f'.repeat(64), data: confirmed },
  ],
})
assert.equal(unresolved.excludeOpenPlaceIds.size, 0, 'conflict and an unrequested document suppress nothing')
assert.equal(unresolved.conflictedAliasCount, 1)
assert.equal(unresolved.invalidAliasCount, 1)

const duplicated = resolveServerKnownOpenPlaceIds({
  knownPlaceIds: [`g:${googleId}`],
  aliasDocuments: [
    { id: documentId, data: confirmed },
    { id: documentId, data: confirmed },
  ],
})
assert.equal(duplicated.excludeOpenPlaceIds.size, 0, 'duplicate snapshots suppress nothing')
assert.equal(duplicated.invalidAliasCount, 1)

console.log('✓ server place aliases are hashed, exact-schema, bounded, conflict-visible, and fail open')
