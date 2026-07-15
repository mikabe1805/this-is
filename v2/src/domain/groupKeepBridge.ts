import type { UserPlaceCategory } from './placeMemory.js'
import { matchesExplicitPlanArea, normalizeExplicitPlanArea } from './planArea.js'

export interface GroupKeepBridgeMemory {
  placeId: string
  label: string
  category: UserPlaceCategory
  area?: string
}

export interface GroupKeepBridgeSave {
  placeId: string
  tag: 'want' | 'tried' | 'loved'
  visibility: 'private' | 'circle'
  ts: number
  memory?: GroupKeepBridgeMemory
}

export interface GroupKeepBridgePlan {
  category?: UserPlaceCategory | null
  area?: string
}

export interface GroupKeepShareHandoff {
  checkGroupShare: string
  returnToGroup: string
}

const GROUP_ID_MAX_LENGTH = 160

function boundedGroupId(value: unknown): string | null {
  if (typeof value !== 'string' || value !== value.trim()
    || value.length < 1 || value.length > GROUP_ID_MAX_LENGTH
    || value === '.' || value === '..' || value.includes('/') || /^__.*__$/.test(value)) {
    return null
  }
  return [...value].some(character => {
    const code = character.charCodeAt(0)
    return code <= 31 || code === 127
  }) ? null : value
}

/**
 * Choose at most three already-known private memories for one group handoff.
 * Loved leads Want, recency orders within each state, and equal rows retain
 * their input order. An explicit plan category or area is a hard known-fact
 * filter: a missing memory or area stays unknown and therefore cannot fit.
 */
export function groupKeepBridgeCandidates<T extends GroupKeepBridgeSave>(
  saves: readonly T[],
  plan: GroupKeepBridgePlan = {},
): T[] {
  const normalizedArea = normalizeExplicitPlanArea(plan.area ?? '')
  if (normalizedArea === null) return []
  const category = plan.category ?? null

  return saves
    .map((save, inputIndex) => ({ save, inputIndex }))
    .filter(({ save }) => {
      if (save.visibility !== 'private'
        || (save.tag !== 'loved' && save.tag !== 'want') || !save.memory) return false
      if (category && save.memory.category !== category) return false
      if (normalizedArea && !matchesExplicitPlanArea(save.memory.area, normalizedArea)) return false
      return true
    })
    .sort((left, right) => {
      const tagOrder = Number(right.save.tag === 'loved') - Number(left.save.tag === 'loved')
      if (tagOrder !== 0) return tagOrder
      const recency = right.save.ts - left.save.ts
      return recency || left.inputIndex - right.inputIndex
    })
    .slice(0, 3)
    .map(({ save }) => save)
}

/** Build the only route state that may return an explicit Keep share to a
 * group. Both fields intentionally name the same bounded audience. */
export function createGroupKeepShareHandoff(groupId: unknown): GroupKeepShareHandoff | null {
  const bounded = boundedGroupId(groupId)
  return bounded ? { checkGroupShare: bounded, returnToGroup: bounded } : null
}

/** Treat browser history state as untrusted. A mismatched or malformed return
 * target can still review sharing, but it can never redirect the person. */
export function readGroupKeepShareHandoff(value: unknown): GroupKeepShareHandoff | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const data = value as Record<string, unknown>
  const checkGroupShare = boundedGroupId(data.checkGroupShare)
  const returnToGroup = boundedGroupId(data.returnToGroup)
  return checkGroupShare && returnToGroup && checkGroupShare === returnToGroup
    ? { checkGroupShare, returnToGroup }
    : null
}
