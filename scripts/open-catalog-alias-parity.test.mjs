import { strict as assert } from 'node:assert'

import {
  createPlaceAlias,
  resolveKnownOpenPlaceIds,
} from '../v2/.domain-test/domain/openCatalog.js'
import {
  buildServerPlaceAliasDocument,
  googlePlaceAliasDocumentId,
  resolveServerKnownOpenPlaceIds,
} from '../v2-functions/lib/open-catalog-alias.js'

const confirmed = (googlePlaceId, ownedPlaceId) => createPlaceAlias({
  googlePlaceId,
  ownedPlaceId,
  method: 'user_confirmed',
  confidence: 1,
  matchedAt: 1,
})

const serverSnapshot = (googlePlaceId, ownedPlaceIds) => ({
  id: googlePlaceAliasDocumentId(googlePlaceId),
  data: buildServerPlaceAliasDocument({ ownedPlaceIds, confirmedAt: 1 }),
})

const cases = [
  {
    name: 'direct open identity',
    knownPlaceIds: ['o:direct'],
    aliases: [],
    aliasDocuments: [],
  },
  {
    name: 'one explicitly confirmed provider alias',
    knownPlaceIds: ['g:google-one'],
    aliases: [confirmed('google-one', 'o:one')],
    aliasDocuments: [serverSnapshot('google-one', ['o:one'])],
  },
  {
    name: 'contradictory confirmations fail open',
    knownPlaceIds: ['g:google-conflict'],
    aliases: [
      confirmed('google-conflict', 'o:first'),
      confirmed('google-conflict', 'o:second'),
    ],
    aliasDocuments: [serverSnapshot('google-conflict', ['o:first', 'o:second'])],
  },
  {
    name: 'fuzzy proposal is not identity evidence',
    knownPlaceIds: ['g:google-fuzzy'],
    aliases: [createPlaceAlias({
      googlePlaceId: 'google-fuzzy',
      ownedPlaceId: 'o:fuzzy',
      method: 'name_geo',
      confidence: 0.99,
      matchedAt: 1,
    })],
    aliasDocuments: [],
  },
]

for (const fixture of cases) {
  const client = resolveKnownOpenPlaceIds({
    knownPlaceIds: fixture.knownPlaceIds,
    aliases: fixture.aliases,
  })
  const server = resolveServerKnownOpenPlaceIds({
    knownPlaceIds: fixture.knownPlaceIds,
    aliasDocuments: fixture.aliasDocuments,
  })
  assert.deepEqual(
    [...server.excludeOpenPlaceIds].sort(),
    [...client.excludeOpenPlaceIds].sort(),
    fixture.name,
  )
}

const ignored = resolveServerKnownOpenPlaceIds({
  knownPlaceIds: ['g:google-one'],
  aliasDocuments: [{
    id: googlePlaceAliasDocumentId('unrequested'),
    data: buildServerPlaceAliasDocument({ ownedPlaceIds: ['o:hidden'], confirmedAt: 1 }),
  }],
})
assert.deepEqual([...ignored.excludeOpenPlaceIds], [], 'unrequested server rows must fail open')
assert.equal(ignored.invalidAliasCount, 1)

console.log('✓ client and server place-alias resolution share one explicit-only, fail-open contract')
