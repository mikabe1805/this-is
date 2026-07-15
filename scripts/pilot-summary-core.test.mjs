import assert from 'node:assert/strict'
import { summarizeGroupOutcomes, summarizePairOutcomes, summarizePilotEvents } from './pilot-summary-core.mjs'

const now = new Date('2026-07-11T12:00:00Z')
const future = '2026-08-10T12:00:00Z'
const rows = [
  {
    name: 'plan_viewed', properties: { context: 'Food', candidateCount: 2 }, schemaVersion: 1,
    ts: '2026-07-11T11:00:00Z', expiresAt: future,
  },
  {
    name: 'pick_created', properties: { context: 'Food', candidateCount: 3 }, schemaVersion: 1,
    ts: '2026-07-11T11:15:00Z', expiresAt: future,
  },
  {
    name: 'pick_closed', properties: { status: 'visited', candidateCount: 99 }, schemaVersion: 1,
    ts: '2026-07-11T11:30:00Z', expiresAt: future,
  },
  {
    name: 'signal_saved', properties: { tag: 'loved' }, schemaVersion: 1,
    ts: '2026-06-01T00:00:00Z', expiresAt: '2026-07-01T00:00:00Z',
  },
  {
    name: 'signal_saved', properties: { tag: 'want' }, schemaVersion: 1,
    ts: '2026-07-11T11:00:00Z',
  },
  {
    name: 'made_up_event', properties: {}, schemaVersion: 1,
    ts: '2026-07-11T11:00:00Z', expiresAt: future,
  },
]

const summary = summarizePilotEvents(rows, '2026-07-11T00:00:00Z', now)
assert.equal(summary.eventCount, 3)
assert.equal(summary.events.plan_viewed, 1)
assert.equal(summary.events.pick_created, 1)
assert.equal(summary.events.pick_closed, 1)
assert.equal(summary.planContexts.Food, 1)
assert.equal(summary.pickOutcomes.visited, 1)
assert.deepEqual(summary.savedTags, {})
assert.deepEqual(summary.candidateCount, { observations: 1, total: 2, average: 2 })
assert.equal(summary.retentionDays, 30)
console.log('✓ pilot summary excludes expired, missing-expiry, unknown, and out-of-schema evidence')
console.log('✓ pilot summary aggregates only bounded cohort metrics')

const day = 24 * 60 * 60 * 1000
const start = Date.parse('2026-07-01T00:00:00Z')
const pairOutcomes = summarizePairOutcomes([
  { memberUids: ['alice', 'bob'], status: 'active', createdAt: start + day },
  { memberUids: ['alice', 'carol'], status: 'active', createdAt: start - day },
  { memberUids: ['alice', 'alice'], status: 'active', createdAt: start + day },
], [
  { memberUids: ['bob', 'alice'], status: 'selected', createdAt: start + 2 * day, updatedAt: start + 2 * day },
  { memberUids: ['alice', 'bob'], status: 'visited', createdAt: start + 3 * day, updatedAt: start + 4 * day },
  { memberUids: ['alice', 'bob'], status: 'dismissed', createdAt: start + 4 * day, updatedAt: start + 24 * day },
  { memberUids: ['alice', 'carol'], status: 'visited', createdAt: start + 2 * day, updatedAt: start + 3 * day },
], new Date(start))
assert.deepEqual(pairOutcomes, {
  connectedPairs: 1,
  pairsWithPick: 1,
  pairPickRatePercent: 100,
  totalPicks: 3,
  selectedOpen: 1,
  closedPicks: 2,
  visited: 1,
  dismissed: 1,
  pairsWithClosedPick: 1,
  closureRatePercent: 66.67,
  closedWithin14Days: 1,
  closureWithin14DaysRatePercent: 33.33,
})
assert(!JSON.stringify(pairOutcomes).includes('alice'))
console.log('✓ pair outcomes measure cohort conversion and 14-day closure without emitting member identities')

const groupOutcomes = summarizeGroupOutcomes([
  { id: 'group-a', memberUids: ['a', 'b', 'c'], status: 'active', createdAt: start + day },
  { id: 'group-old', memberUids: ['d', 'e'], status: 'active', createdAt: start - day },
  { id: 'group-bad', memberUids: ['x', 'x'], status: 'active', createdAt: start + day },
], [
  { kind: 'group', groupId: 'group-a', status: 'visited', createdAt: start + 2 * day, updatedAt: start + 3 * day },
  { kind: 'group', groupId: 'group-a', status: 'dismissed', createdAt: start + 3 * day, updatedAt: start + 30 * day },
  { kind: 'group', groupId: 'group-a', status: 'selected', createdAt: start + 4 * day, updatedAt: start + 4 * day },
  { kind: 'group', groupId: 'group-old', status: 'visited', createdAt: start + 2 * day, updatedAt: start + 3 * day },
], new Date(start))
assert.deepEqual(groupOutcomes, {
  activeCircles: 1,
  circlesWithPick: 1,
  circlePickRatePercent: 100,
  totalPicks: 3,
  selectedOpen: 1,
  closedPicks: 2,
  visited: 1,
  dismissed: 1,
  closedWithin21Days: 1,
  closureWithin21DaysRatePercent: 33.33,
})
assert(!JSON.stringify(groupOutcomes).includes('group-a'))
console.log('✓ group outcomes measure circle conversion and 21-day closure without emitting IDs')
