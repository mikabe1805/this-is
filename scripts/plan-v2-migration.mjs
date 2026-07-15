import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { planLegacyMigration } from '../v2/scripts/migration-core.mjs'

const arg = name => {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

if (process.argv.includes('--help')) {
  console.log('Usage: npm run migration:plan -- --uid UID [--visibility private|circle] [--out sensitive-plan.json]')
  console.log('   or: npm run migration:plan -- --fixture fixture.json [--visibility private|circle] [--out plan.json]')
  console.log('Read-only: this command never writes to Firebase.')
  process.exit(0)
}

const fixture = arg('fixture')
const out = arg('out')
const targetVisibility = arg('visibility') ?? 'private'
if (!['private', 'circle'].includes(targetVisibility)) {
  console.error('--visibility must be private or circle.')
  process.exit(1)
}
let input

if (fixture) {
  input = { ...JSON.parse(readFileSync(resolve(fixture), 'utf8')), targetVisibility }
} else {
  const uid = arg('uid')
  if (!uid) {
    console.error('Provide --uid UID or --fixture FILE. Use --help for details.')
    process.exit(1)
  }
  if (!getApps().length) initializeApp({ credential: applicationDefault() })
  const db = getFirestore()
  const [markersSnapshot, listsSnapshot, existingSavesSnapshot] = await Promise.all([
    db.collection('users').doc(uid).collection('savedPlaces').get(),
    db.collection('lists').where('userId', '==', uid).get(),
    db.collection('saves').where('uid', '==', uid).get(),
  ])
  const savedMarkers = markersSnapshot.docs.map(document => ({ id: document.id, ...document.data() }))
  const lists = listsSnapshot.docs.map(document => ({ id: document.id, ...document.data() }))
  const listEntries = await Promise.all(lists.map(async list => {
    const snapshot = await db.collection('lists').doc(list.id).collection('places').get()
    return [list.id, snapshot.docs.map(document => ({ id: document.id, ...document.data() }))]
  }))
  const listPlacesByList = Object.fromEntries(listEntries)
  const legacyIds = [...new Set([
    ...savedMarkers.map(marker => String(marker.placeId ?? marker.id)),
    ...Object.values(listPlacesByList).flat().map(row => String(row.placeId ?? row.id)),
  ])].filter(Boolean)
  const sourceSnapshots = await Promise.all(legacyIds.map(id => db.collection('places').doc(id).get()))
  const placesById = Object.fromEntries(sourceSnapshots
    .filter(snapshot => snapshot.exists)
    .map(snapshot => [snapshot.id, snapshot.data()]))

  input = {
    uid,
    savedMarkers,
    lists,
    listPlacesByList,
    placesById,
    existingSaveIds: existingSavesSnapshot.docs.map(document => document.id),
    targetVisibility,
  }
}

const plan = planLegacyMigration(input)
console.log(JSON.stringify(plan.summary, null, 2))
if (out) {
  const path = resolve(out)
  writeFileSync(path, `${JSON.stringify(plan, null, 2)}\n`, { flag: 'wx' })
  console.log(`Wrote read-only migration plan: ${path}`)
  console.warn('The plan may contain private notes. Store it securely and delete it after review.')
} else {
  console.log('Summary only. Pass --out FILE to write the sensitive operation and rollback plan.')
}
