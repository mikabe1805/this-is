import { createHash } from 'node:crypto'

const OPEN_ID = /^o:\S{1,180}$/
const GOOGLE_ID = /^\S{1,500}$/
const DOCUMENT_ID = /^[a-f0-9]{64}$/
const MAX_ALIAS_READS = 100
const MAX_OPEN_IDS_PER_ALIAS = 4

export interface ServerPlaceAliasDocument {
  schemaVersion: 1
  status: 'confirmed' | 'conflicted'
  ownedPlaceIds: Array<`o:${string}`>
  confirmedAt: number
}

export interface ServerPlaceAliasSnapshot {
  id: string
  data: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value)
  return actual.length === keys.length && actual.every(key => keys.includes(key))
}

function rawGooglePlaceId(placeId: string): string | null {
  if (!placeId.startsWith('g:')) return null
  const raw = placeId.slice(2)
  return GOOGLE_ID.test(raw) && !raw.startsWith('g:') ? raw : null
}

export function googlePlaceAliasDocumentId(googlePlaceId: string): string {
  const raw = googlePlaceId.trim()
  if (!GOOGLE_ID.test(raw) || raw.startsWith('g:')) {
    throw new Error('Alias hashing requires one raw Google Place ID.')
  }
  return createHash('sha256').update(`this-is-place-alias-v1\u0000${raw}`).digest('hex')
}

export function buildServerPlaceAliasDocument(input: {
  ownedPlaceIds: readonly string[]
  confirmedAt: number
}): ServerPlaceAliasDocument {
  const ownedPlaceIds = [...new Set(input.ownedPlaceIds)].sort()
  if (ownedPlaceIds.length < 1 || ownedPlaceIds.length > MAX_OPEN_IDS_PER_ALIAS
    || !ownedPlaceIds.every(placeId => OPEN_ID.test(placeId))
    || !Number.isFinite(input.confirmedAt) || input.confirmedAt <= 0) {
    throw new Error('Server alias evidence is invalid.')
  }
  return {
    schemaVersion: 1,
    status: ownedPlaceIds.length === 1 ? 'confirmed' : 'conflicted',
    ownedPlaceIds: ownedPlaceIds as Array<`o:${string}`>,
    confirmedAt: input.confirmedAt,
  }
}

export function parseServerPlaceAliasDocument(value: unknown, documentId: string): ServerPlaceAliasDocument | null {
  if (!DOCUMENT_ID.test(documentId) || !isRecord(value)
    || !exactKeys(value, ['schemaVersion', 'status', 'ownedPlaceIds', 'confirmedAt'])
    || value.schemaVersion !== 1
    || !['confirmed', 'conflicted'].includes(String(value.status))
    || !Array.isArray(value.ownedPlaceIds)
    || typeof value.confirmedAt !== 'number' || !Number.isFinite(value.confirmedAt)
    || value.confirmedAt <= 0) return null
  const ownedPlaceIds = value.ownedPlaceIds
  if (ownedPlaceIds.length < 1 || ownedPlaceIds.length > MAX_OPEN_IDS_PER_ALIAS
    || !ownedPlaceIds.every(placeId => typeof placeId === 'string' && OPEN_ID.test(placeId))
    || new Set(ownedPlaceIds).size !== ownedPlaceIds.length
    || [...ownedPlaceIds].sort().some((placeId, index) => placeId !== ownedPlaceIds[index])
    || (value.status === 'confirmed' && ownedPlaceIds.length !== 1)
    || (value.status === 'conflicted' && ownedPlaceIds.length < 2)) return null
  return value as unknown as ServerPlaceAliasDocument
}

/** Plans bounded point reads only. Raw Google IDs never become document names. */
export function planServerPlaceAliasReads(knownPlaceIds: Iterable<string>): string[] {
  const ids = new Set<string>()
  for (const placeId of knownPlaceIds) {
    const raw = rawGooglePlaceId(placeId)
    if (raw) ids.add(googlePlaceAliasDocumentId(raw))
    if (ids.size > MAX_ALIAS_READS) throw new Error('Alias read ceiling exceeded.')
  }
  return [...ids].sort()
}

/** Resolves server-owned documents after the caller has limited known IDs to
 * authorized group-visible evidence. Invalid or conflicted rows suppress none. */
export function resolveServerKnownOpenPlaceIds(input: {
  knownPlaceIds: Iterable<string>
  aliasDocuments: readonly ServerPlaceAliasSnapshot[]
}): { excludeOpenPlaceIds: Set<`o:${string}`>; conflictedAliasCount: number; invalidAliasCount: number } {
  const knownPlaceIds = [...input.knownPlaceIds]
  const plannedIds = new Set(planServerPlaceAliasReads(knownPlaceIds))
  const excludeOpenPlaceIds = new Set<`o:${string}`>()
  knownPlaceIds.forEach(placeId => {
    if (OPEN_ID.test(placeId)) excludeOpenPlaceIds.add(placeId as `o:${string}`)
  })

  let conflictedAliasCount = 0
  let invalidAliasCount = 0
  const duplicatedDocumentIds = new Set<string>()
  const observedDocumentIds = new Set<string>()
  for (const snapshot of input.aliasDocuments) {
    if (observedDocumentIds.has(snapshot.id)) duplicatedDocumentIds.add(snapshot.id)
    observedDocumentIds.add(snapshot.id)
  }
  const seenDocuments = new Set<string>()
  for (const snapshot of input.aliasDocuments) {
    if (seenDocuments.has(snapshot.id)) continue
    seenDocuments.add(snapshot.id)
    if (!plannedIds.has(snapshot.id) || duplicatedDocumentIds.has(snapshot.id)) {
      invalidAliasCount++
      continue
    }
    const alias = parseServerPlaceAliasDocument(snapshot.data, snapshot.id)
    if (!alias) {
      invalidAliasCount++
      continue
    }
    if (alias.status === 'conflicted') {
      conflictedAliasCount++
      continue
    }
    const [ownedPlaceId] = alias.ownedPlaceIds
    if (ownedPlaceId) excludeOpenPlaceIds.add(ownedPlaceId)
  }
  return { excludeOpenPlaceIds, conflictedAliasCount, invalidAliasCount }
}
