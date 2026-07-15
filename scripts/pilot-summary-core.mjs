export const PILOT_EVENT_NAMES = new Set([
  'onboarding_completed',
  'signal_saved',
  'invite_created',
  'connection_accepted',
  'pair_opened',
  'plan_viewed',
  'pick_created',
  'pick_closed',
])

function asDate(value) {
  if (value instanceof Date) return value
  if (value && typeof value.toDate === 'function') return value.toDate()
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}

function pairKey(memberUids) {
  if (!Array.isArray(memberUids) || memberUids.length !== 2) return null
  if (!memberUids.every(uid => typeof uid === 'string' && uid.length > 0)) return null
  if (memberUids[0] === memberUids[1]) return null
  return [...memberUids].sort().join('\u0000')
}

function groupKey(group) {
  if (!group || typeof group !== 'object' || typeof group.id !== 'string' || !group.id) return null
  if (!Array.isArray(group.memberUids) || group.memberUids.length < 2 || group.memberUids.length > 6) return null
  if (!group.memberUids.every(uid => typeof uid === 'string' && uid.length > 0)) return null
  return new Set(group.memberUids).size === group.memberUids.length ? group.id : null
}

export function summarizeGroupOutcomes(groups, picks, since) {
  const sinceDate = asDate(since)
  if (!sinceDate) throw new Error('A valid group pilot start date is required.')
  const cohortGroups = new Set()
  for (const group of groups) {
    const key = groupKey(group)
    const createdAt = asDate(group.createdAt)
    if (key && createdAt && createdAt >= sinceDate && group.status === 'active') cohortGroups.add(key)
  }
  const groupsWithPick = new Set()
  let totalPicks = 0
  let selectedOpen = 0
  let visited = 0
  let dismissed = 0
  let closedWithin21Days = 0
  for (const pick of picks) {
    const createdAt = asDate(pick.createdAt)
    if (pick.kind !== 'group' || typeof pick.groupId !== 'string' || !cohortGroups.has(pick.groupId)
      || !createdAt || createdAt < sinceDate || !['selected', 'visited', 'dismissed'].includes(pick.status)) continue
    totalPicks++
    groupsWithPick.add(pick.groupId)
    if (pick.status === 'selected') {
      selectedOpen++
      continue
    }
    if (pick.status === 'visited') visited++
    if (pick.status === 'dismissed') dismissed++
    const updatedAt = asDate(pick.updatedAt)
    if (updatedAt && updatedAt >= createdAt
      && updatedAt.getTime() - createdAt.getTime() <= 21 * 24 * 60 * 60 * 1000) closedWithin21Days++
  }
  const closedPicks = visited + dismissed
  const percent = (numerator, denominator) => denominator
    ? Number(((numerator / denominator) * 100).toFixed(2))
    : 0
  return {
    activeCircles: cohortGroups.size,
    circlesWithPick: groupsWithPick.size,
    circlePickRatePercent: percent(groupsWithPick.size, cohortGroups.size),
    totalPicks,
    selectedOpen,
    closedPicks,
    visited,
    dismissed,
    closedWithin21Days,
    closureWithin21DaysRatePercent: percent(closedWithin21Days, totalPicks),
  }
}

export function summarizePairOutcomes(connections, picks, since) {
  const sinceDate = asDate(since)
  if (!sinceDate) throw new Error('A valid pilot start date is required.')
  const cohortPairs = new Set()
  for (const connection of connections) {
    const key = pairKey(connection.memberUids)
    const createdAt = asDate(connection.createdAt)
    if (key && createdAt && createdAt >= sinceDate && connection.status === 'active') cohortPairs.add(key)
  }

  const pairsWithPick = new Set()
  const pairsWithClosedPick = new Set()
  let totalPicks = 0
  let visited = 0
  let dismissed = 0
  let selectedOpen = 0
  let closedWithin14Days = 0
  for (const pick of picks) {
    const key = pairKey(pick.memberUids)
    const createdAt = asDate(pick.createdAt)
    if (!key || !cohortPairs.has(key) || !createdAt || createdAt < sinceDate) continue
    if (!['selected', 'visited', 'dismissed'].includes(pick.status)) continue
    totalPicks++
    pairsWithPick.add(key)
    if (pick.status === 'selected') {
      selectedOpen++
      continue
    }
    pairsWithClosedPick.add(key)
    if (pick.status === 'visited') visited++
    if (pick.status === 'dismissed') dismissed++
    const updatedAt = asDate(pick.updatedAt)
    if (updatedAt && updatedAt >= createdAt
      && updatedAt.getTime() - createdAt.getTime() <= 14 * 24 * 60 * 60 * 1000) {
      closedWithin14Days++
    }
  }
  const closedPicks = visited + dismissed
  const percent = (numerator, denominator) => denominator
    ? Number(((numerator / denominator) * 100).toFixed(2))
    : 0
  return {
    connectedPairs: cohortPairs.size,
    pairsWithPick: pairsWithPick.size,
    pairPickRatePercent: percent(pairsWithPick.size, cohortPairs.size),
    totalPicks,
    selectedOpen,
    closedPicks,
    visited,
    dismissed,
    pairsWithClosedPick: pairsWithClosedPick.size,
    closureRatePercent: percent(closedPicks, totalPicks),
    closedWithin14Days,
    closureWithin14DaysRatePercent: percent(closedWithin14Days, totalPicks),
  }
}

export function summarizePilotEvents(events, since, now = new Date()) {
  const sinceDate = asDate(since)
  const nowDate = asDate(now)
  if (!sinceDate || !nowDate) throw new Error('Valid since and now dates are required.')
  const summary = {
    since: sinceDate.toISOString(),
    generatedAt: nowDate.toISOString(),
    retentionDays: 30,
    eventCount: 0,
    events: {},
    planContexts: {},
    pickOutcomes: {},
    savedTags: {},
    candidateCount: { observations: 0, total: 0, average: 0 },
  }

  for (const event of events) {
    const timestamp = asDate(event.ts)
    const expiresAt = asDate(event.expiresAt)
    if (!timestamp || !expiresAt || timestamp < sinceDate || expiresAt <= nowDate) continue
    if (event.schemaVersion !== 1 || !PILOT_EVENT_NAMES.has(event.name)) continue
    summary.eventCount++
    summary.events[event.name] = (summary.events[event.name] ?? 0) + 1
    const properties = event.properties ?? {}
    if (event.name === 'plan_viewed' && ['Anything', 'Food', 'Drinks', 'Coffee'].includes(properties.context)) {
      summary.planContexts[properties.context] = (summary.planContexts[properties.context] ?? 0) + 1
    }
    if (event.name === 'pick_closed' && ['visited', 'dismissed'].includes(properties.status)) {
      summary.pickOutcomes[properties.status] = (summary.pickOutcomes[properties.status] ?? 0) + 1
    }
    if (event.name === 'signal_saved' && ['want', 'tried', 'loved'].includes(properties.tag)) {
      summary.savedTags[properties.tag] = (summary.savedTags[properties.tag] ?? 0) + 1
    }
    if (event.name === 'plan_viewed'
      && Number.isInteger(properties.candidateCount)
      && properties.candidateCount >= 0 && properties.candidateCount <= 3) {
      summary.candidateCount.observations++
      summary.candidateCount.total += properties.candidateCount
    }
  }
  if (summary.candidateCount.observations) {
    summary.candidateCount.average = Number(
      (summary.candidateCount.total / summary.candidateCount.observations).toFixed(2)
    )
  }
  return summary
}
