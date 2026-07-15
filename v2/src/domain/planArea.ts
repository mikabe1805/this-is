export const EXPLICIT_PLAN_AREA_MAX_LENGTH = 80

/** Normalize only words the person explicitly typed for this draft. There is
 * no geocoding, coordinate lookup, saved default, or inferred geography. */
export function normalizeExplicitPlanArea(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized) return ''
  return normalized.length <= EXPLICIT_PLAN_AREA_MAX_LENGTH ? normalized : null
}

function areaWords(value: string): string[] {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) ?? []
}

/** Every typed word must exist in the place's user-confirmed area. Missing
 * place geography is unknown and therefore cannot satisfy an active filter. */
export function matchesExplicitPlanArea(placeArea: unknown, planArea: unknown): boolean {
  const normalizedPlan = normalizeExplicitPlanArea(planArea)
  if (normalizedPlan === '') return true
  if (normalizedPlan === null || typeof placeArea !== 'string') return false
  const planWords = areaWords(normalizedPlan)
  const placeWords = new Set(areaWords(placeArea))
  return planWords.length > 0 && planWords.every(word => placeWords.has(word))
}
