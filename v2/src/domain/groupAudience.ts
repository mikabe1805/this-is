export interface GroupAudienceStamp {
  permissionVersion: number
  memberUids: string[]
}

export interface GroupAudienceSource {
  permissionVersion: unknown
  memberUids: unknown
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function boundedMemberUid(value: unknown): string | null {
  if (typeof value !== 'string' || value !== value.trim() || value.length < 1 || value.length > 128) {
    return null
  }
  if (value === '.' || value === '..' || value.includes('/') || /^__.*__$/.test(value)) return null
  return [...value].some(character => {
    const code = character.charCodeAt(0)
    return code <= 31 || code === 127
  }) ? null : value
}

function normalizeMemberUids(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > 6) return null
  const normalized = value.map(boundedMemberUid)
  if (normalized.some(uid => uid === null)) return null
  const memberUids = normalized as string[]
  if (new Set(memberUids).size !== memberUids.length) return null
  return [...memberUids].sort()
}

/**
 * Normalize the exact, reviewable audience payload sent with a group write.
 * Extra keys fail closed so the stamp cannot quietly grow into a second
 * source of group state.
 */
export function normalizeGroupAudienceStamp(value: unknown): GroupAudienceStamp | null {
  const data = record(value)
  if (!data || Object.keys(data).sort().join('|') !== 'memberUids|permissionVersion') return null
  return buildGroupAudienceStamp({
    permissionVersion: data.permissionVersion,
    memberUids: data.memberUids,
  })
}

/** Build a canonical stamp from an already-loaded group-like source. */
export function buildGroupAudienceStamp(source: GroupAudienceSource): GroupAudienceStamp | null {
  const memberUids = normalizeMemberUids(source.memberUids)
  if (
    typeof source.permissionVersion !== 'number'
    || !Number.isSafeInteger(source.permissionVersion)
    || source.permissionVersion < 1
    || !memberUids
  ) return null
  return { permissionVersion: source.permissionVersion, memberUids }
}

/** Compare an exact submitted stamp with the current group audience. */
export function groupAudienceStampMatches(
  stamp: unknown,
  current: GroupAudienceSource,
): boolean {
  const reviewed = normalizeGroupAudienceStamp(stamp)
  const live = buildGroupAudienceStamp(current)
  return Boolean(
    reviewed && live
    && reviewed.permissionVersion === live.permissionVersion
    && reviewed.memberUids.length === live.memberUids.length
    && reviewed.memberUids.every((uid, index) => uid === live.memberUids[index]),
  )
}
