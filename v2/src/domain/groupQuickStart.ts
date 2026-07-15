export const GROUP_QUICK_START_CATEGORIES = ['food', 'coffee', 'activity'] as const
export type GroupQuickStartCategory = (typeof GROUP_QUICK_START_CATEGORIES)[number]

export const GROUP_QUICK_START_CONSTRAINTS = [
  'quiet', 'casual', 'outdoors', 'family_friendly', 'special_occasion',
] as const
export type GroupQuickStartConstraint = (typeof GROUP_QUICK_START_CONSTRAINTS)[number]

export interface GroupQuickStartPreference {
  uid: string
  categoryHints: GroupQuickStartCategory[]
  constraintHints: GroupQuickStartConstraint[]
  permissionVersion: number
  updatedAt?: unknown
}

function uniqueAllowed<T extends string>(value: unknown, allowed: readonly T[], max: number): T[] | null {
  if (!Array.isArray(value) || value.length > max) return null
  const result = value.filter((item): item is T => typeof item === 'string' && allowed.includes(item as T))
  return result.length === value.length && new Set(result).size === result.length ? result : null
}

export function normalizeGroupQuickStartPreference(value: unknown): GroupQuickStartPreference | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  const categoryHints = uniqueAllowed(data.categoryHints, GROUP_QUICK_START_CATEGORIES, 3)
  const constraintHints = uniqueAllowed(data.constraintHints, GROUP_QUICK_START_CONSTRAINTS, 5)
  const permissionVersion = Number(data.permissionVersion)
  if (
    typeof data.uid !== 'string' || !data.uid
    || !categoryHints || !constraintHints
    || categoryHints.length + constraintHints.length === 0
    || !Number.isSafeInteger(permissionVersion) || permissionVersion < 1
  ) return null
  return { uid: data.uid, categoryHints, constraintHints, permissionVersion, updatedAt: data.updatedAt }
}
