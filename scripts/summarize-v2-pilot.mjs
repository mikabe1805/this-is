import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { summarizeGroupOutcomes, summarizePairOutcomes, summarizePilotEvents } from './pilot-summary-core.mjs'

if (process.argv.includes('--help')) {
  console.log('Usage: npm run pilot:summary -- --since YYYY-MM-DD')
  console.log('Requires Firebase Admin application-default credentials; reads events, connections, groups, and Picks, then prints aggregate counts only.')
  process.exit(0)
}

const sinceArg = process.argv.indexOf('--since')
const sinceText = sinceArg >= 0 ? process.argv[sinceArg + 1] : undefined
const since = sinceText ? new Date(`${sinceText}T00:00:00Z`) : new Date(0)
if (Number.isNaN(since.getTime())) {
  console.error('Use --since YYYY-MM-DD')
  process.exit(1)
}

if (!getApps().length) initializeApp({ credential: applicationDefault() })
const db = getFirestore()
const [eventSnapshot, connectionSnapshot, groupSnapshot, pickSnapshot] = await Promise.all([
  db.collectionGroup('events').get(),
  db.collection('connections').get(),
  db.collection('groups').get(),
  db.collection('picks').get(),
])
const generatedAt = new Date()
const summary = {
  ...summarizePilotEvents(eventSnapshot.docs.map(document => document.data()), since, generatedAt),
  pairOutcomes: summarizePairOutcomes(
    connectionSnapshot.docs.map(document => document.data()),
    pickSnapshot.docs.map(document => document.data()),
    since,
  ),
  groupOutcomes: summarizeGroupOutcomes(
    groupSnapshot.docs.map(document => ({ id: document.id, ...document.data() })),
    pickSnapshot.docs.map(document => document.data()),
    since,
  ),
}

console.log(JSON.stringify(summary, null, 2))
