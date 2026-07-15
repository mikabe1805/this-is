#!/usr/bin/env node
import { existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { buildLegacyErasurePlan } from './v1-erasure-core.mjs'

const args = process.argv.slice(2)
const value = flag => {
  const index = args.indexOf(flag)
  return index >= 0 ? args[index + 1] : undefined
}
const uid = value('--uid')
const out = value('--out')
if (args.includes('--help')) {
  console.log('Usage: npm run erasure:plan -- --uid FIREBASE_UID [--out private-plan.json]')
  process.exit(0)
}
if (!uid) throw new Error('Usage: npm run erasure:plan -- --uid FIREBASE_UID [--out private-plan.json]')

initializeApp({ credential: applicationDefault() })
const db = getFirestore()
const records = new Map()
const keep = snap => {
  for (const doc of snap.docs ?? []) records.set(doc.ref.path, { path: doc.ref.path, data: doc.data() })
  if (snap.exists) records.set(snap.ref.path, { path: snap.ref.path, data: snap.data() })
}
const safe = async (label, work) => {
  try { keep(await work()) } catch (error) { throw new Error(`${label} query failed: ${error.message}`) }
}

await Promise.all([
  safe('owner profile', () => db.collection('users').doc(uid).get()),
  ...['userPreferences', 'userTaste', 'userRankings'].map(root =>
    safe(root, () => db.collection(root).doc(uid).get())),
  safe('authored posts', () => db.collection('posts').where('userId', '==', uid).get()),
  safe('authored lists', () => db.collection('lists').where('userId', '==', uid).get()),
  safe('threads', () => db.collection('threads').where('participants', 'array-contains', uid).get()),
  safe('flat saves', () => db.collection('saves').where('uid', '==', uid).get()),
  safe('analytics', () => db.collection('analytics').doc('userInteractions').collection('events').where('userId', '==', uid).get()),
  safe('authored comments', () => db.collectionGroup('comments').where('userId', '==', uid).get()),
  safe('comment likes', () => db.collectionGroup('comments').where('likedBy', 'array-contains', uid).get()),
  safe('list place authorship', () => db.collectionGroup('places').where('addedBy', '==', uid).get()),
  safe('list post authorship', () => db.collectionGroup('posts').where('userId', '==', uid).get()),
  ...['friends', 'following', 'followers'].flatMap(group => [
    safe(`${group} by field`, () => db.collectionGroup(group).where('userId', '==', uid).get()),
    safe(`${group} id scan`, () => db.collectionGroup(group).select('userId').get()),
  ]),
  safe('post likes', () => db.collection('posts').where('likedBy', 'array-contains', uid).get()),
  safe('list likes', () => db.collection('lists').where('likedBy', 'array-contains', uid).get()),
  safe('user following arrays', () => db.collection('users').where('following', 'array-contains', uid).get()),
  safe('user follower arrays', () => db.collection('users').where('followers', 'array-contains', uid).get()),
  safe('owner hubs by userId', () => db.collection('hubs').where('userId', '==', uid).get()),
  safe('owner hubs by createdBy', () => db.collection('hubs').where('createdBy', '==', uid).get()),
  // These collections contain denormalized or schema-less snapshots that
  // cannot be found safely by one query. Selecting only relevant fields keeps
  // the review scan bounded in payload while remaining explicit about reads.
  safe('place embedded references', () => db.collection('places').select('posts').get()),
  safe('share snapshots', () => db.collection('shares').get()),
])

// Recursively enumerate the owner subtree so the plan proves all descendants,
// including subcollections that the old client forgot existed.
const ownerRef = db.collection('users').doc(uid)
async function descend(ref) {
  for (const sub of await ref.listCollections()) {
    const snap = await sub.get()
    keep(snap)
    for (const doc of snap.docs) await descend(doc.ref)
  }
}
await descend(ownerRef)

// Direct per-place save markers have no queryable owner field.
const placePaths = [...records.keys()].filter(path => /^places\/[^/]+$/.test(path))
await Promise.all(placePaths.map(path => safe(
  'place save marker',
  () => db.doc(path).collection('saves').doc(uid).get()
)))

const plan = buildLegacyErasurePlan(uid, [...records.values()])
console.log(JSON.stringify({
  uid: plan.uid,
  mode: plan.mode,
  scannedRecords: records.size,
  counts: plan.counts,
  storageCandidates: plan.storageCandidates.length,
}, null, 2))

if (out) {
  const target = resolve(out)
  if (existsSync(target)) throw new Error(`Refusing to overwrite ${target}`)
  writeFileSync(target, `${JSON.stringify(plan, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
  console.error(`Private review plan written to ${target}`)
}
