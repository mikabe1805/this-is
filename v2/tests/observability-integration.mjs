import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { assertFails, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, collectionGroup, doc, getDoc, getDocs, setDoc, Timestamp } from 'firebase/firestore'
import { summarizeGroupOutcomes, summarizePairOutcomes, summarizePilotEvents } from '../../scripts/pilot-summary-core.mjs'

const projectId = 'demo-this-is-v2'
const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8')
const testEnv = await initializeTestEnvironment({
  projectId,
  firestore: { host: '127.0.0.1', port: 8180, rules },
})
const now = new Date()
const expiry = Timestamp.fromMillis(now.getTime() + 30 * 24 * 60 * 60 * 1000)
const run = promisify(execFile)

try {
  await testEnv.withSecurityRulesDisabled(async context => {
    const admin = context.firestore()
    await setDoc(doc(admin, 'users', 'alice'), { displayName: 'Alice' })
    await setDoc(doc(admin, 'users', 'bob'), { displayName: 'Bob' })
    await setDoc(doc(admin, 'connections', 'alice__bob'), {
      memberUids: ['alice', 'bob'], status: 'active', createdAt: Timestamp.fromDate(now),
    })
    await setDoc(doc(admin, 'picks', 'cohort-pick'), {
      memberUids: ['alice', 'bob'], status: 'visited',
      createdAt: now.getTime(), updatedAt: now.getTime() + 60_000,
    })
    await setDoc(doc(admin, 'groups', 'circle-proof'), {
      memberUids: ['alice', 'bob', 'carol'], status: 'active', createdAt: Timestamp.fromDate(now),
    })
    await setDoc(doc(admin, 'picks', 'group-cohort-pick'), {
      kind: 'group', groupId: 'circle-proof', memberUids: ['alice', 'bob', 'carol'], status: 'visited',
      createdAt: now.getTime(), updatedAt: now.getTime() + 60_000,
    })
  })
  const alice = testEnv.authenticatedContext('alice').firestore()
  await setDoc(doc(alice, 'users', 'alice', 'events', 'delivered'), {
    name: 'plan_viewed',
    properties: { context: 'Food', candidateCount: 2 },
    schemaVersion: 1,
    ts: Timestamp.fromDate(now),
    expiresAt: expiry,
  })
  await assertFails(getDoc(doc(alice, 'users', 'alice', 'events', 'delivered')))

  let rows = []
  let connections = []
  let picks = []
  let groups = []
  await testEnv.withSecurityRulesDisabled(async context => {
    const admin = context.firestore()
    await setDoc(doc(admin, 'users', 'alice', 'events', 'expired'), {
      name: 'signal_saved', properties: { tag: 'loved' }, schemaVersion: 1,
      ts: Timestamp.fromMillis(now.getTime() - 40 * 24 * 60 * 60 * 1000),
      expiresAt: Timestamp.fromMillis(now.getTime() - 10 * 24 * 60 * 60 * 1000),
    })
    const snapshot = await getDocs(collectionGroup(admin, 'events'))
    rows = snapshot.docs.map(item => item.data())
    connections = (await getDocs(collection(admin, 'connections'))).docs.map(item => item.data())
    picks = (await getDocs(collection(admin, 'picks'))).docs.map(item => item.data())
    groups = (await getDocs(collection(admin, 'groups'))).docs.map(item => ({ id: item.id, ...item.data() }))
  })
  const since = new Date(now.getTime() - 60_000)
  const summary = {
    ...summarizePilotEvents(rows, since, now),
    pairOutcomes: summarizePairOutcomes(connections, picks, since),
    groupOutcomes: summarizeGroupOutcomes(groups, picks, since),
  }
  assert.equal(summary.eventCount, 1)
  assert.equal(summary.events.plan_viewed, 1)
  assert.equal(summary.planContexts.Food, 1)
  assert.equal(summary.candidateCount.average, 2)
  assert.equal(summary.pairOutcomes.connectedPairs, 1)
  assert.equal(summary.pairOutcomes.pairsWithPick, 1)
  assert.equal(summary.pairOutcomes.closureWithin14DaysRatePercent, 100)
  assert.equal(summary.groupOutcomes.activeCircles, 1)
  assert.equal(summary.groupOutcomes.closureWithin21DaysRatePercent, 100)
  const serialized = JSON.stringify(summary)
  assert(!serialized.includes('alice'))
  assert(!serialized.includes('uid'))
  assert(!serialized.includes('place'))

  const cli = await run(process.execPath, [
    new URL('../../scripts/summarize-v2-pilot.mjs', import.meta.url).pathname.replace(/^\/(.:)/, '$1'),
    '--since', now.toISOString().slice(0, 10),
  ], { env: process.env })
  const cliSummary = JSON.parse(cli.stdout)
  assert.equal(cliSummary.pairOutcomes.connectedPairs, 1)
  assert.equal(cliSummary.pairOutcomes.closureWithin14DaysRatePercent, 100)
  assert.equal(cliSummary.groupOutcomes.activeCircles, 1)
  assert.equal(cliSummary.groupOutcomes.closureWithin21DaysRatePercent, 100)
  assert(!cli.stdout.includes('alice'))
  assert(!cli.stdout.includes('bob'))
  assert(!cli.stdout.includes('uid'))
  console.log('PASS authenticated event delivery is write-only and retention-bounded')
  console.log('PASS the operator CLI emits pair and group conversion/closure with no identity or place history')
} finally {
  await testEnv.cleanup()
}
