export const RECENT_AUTH_SECONDS = 5 * 60

export function hasRecentAuthentication(
  authTimeSeconds: number | undefined,
  nowSeconds = Math.floor(Date.now() / 1000)
): boolean {
  return typeof authTimeSeconds === 'number'
    && authTimeSeconds <= nowSeconds
    && nowSeconds - authTimeSeconds <= RECENT_AUTH_SECONDS
}

/** Convert Firestore values to portable JSON without leaking SDK internals. */
export function portable(value: unknown): unknown {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value
  if (Array.isArray(value)) return value.map(portable)
  if (typeof value === 'object') {
    const candidate = value as { toDate?: () => Date }
    if (typeof candidate.toDate === 'function') return candidate.toDate().toISOString()
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key, portable(item)]))
  }
  return String(value)
}

export const CANONICAL_EXPORT_SECTIONS = [
  'profile', 'saves', 'connections', 'groups', 'groupSignals', 'groupPreferences', 'groupInvites', 'picks', 'pickReceipts', 'invites', 'events',
] as const
