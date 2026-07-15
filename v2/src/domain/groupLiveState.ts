import { groupUpdatedAtMillis, type GroupCircle, type GroupSummary } from './groups.js'

export type LiveGroupSummaryPlan =
  | { action: 'merge'; value: GroupCircle }
  | { action: 'refetch' }

/**
 * A group-document listener carries membership facts, not signal projections.
 * Merge only membership-only updates; any privacy/evidence boundary change must
 * re-read the server-owned subcollections before the UI can use it.
 */
export function planLiveGroupSummary(
  current: GroupCircle,
  next: GroupSummary,
): LiveGroupSummaryPlan {
  if (
    current.id !== next.id
    || current.permissionVersion !== next.permissionVersion
    || current.projectionCount !== next.projectionCount
    || current.membershipLocked !== next.membershipLocked
    || groupUpdatedAtMillis(current.updatedAt) !== groupUpdatedAtMillis(next.updatedAt)
  ) return { action: 'refetch' }

  const currentTaste = new Map(current.tastes.map(taste => [taste.uid, taste]))
  const tastes = next.members.map(member => {
    const existing = currentTaste.get(member.uid)
    return existing
      ? { ...existing, name: member.displayName }
      : { uid: member.uid, name: member.displayName, saves: [] }
  })
  return {
    action: 'merge',
    value: {
      ...current,
      ...next,
      tastes,
      changeLabel: next.status === 'forming'
        ? 'Waiting for someone to join'
        : next.projectionCount === 0
          ? 'No shared place signals yet'
          : current.changeLabel,
    },
  }
}
