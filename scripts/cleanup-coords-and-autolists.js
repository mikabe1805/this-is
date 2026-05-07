#!/usr/bin/env node

/**
 * Database cleanup pass for the post-tester-feedback refactor:
 *
 *   1. Strip (0, 0) "Null Island" coordinates from every place doc.
 *      The pre-fix createHub defaulted missing lat/lng to 0 || 0, which
 *      Firestore happily indexed and which then made every saved place
 *      show up ~5,409 mi from a US viewer (great-circle (0,0) → NJ).
 *      We now reject (0, 0) at the write site, but legacy docs still
 *      carry the bad coords. This script removes the location.lat/lng
 *      and coordinates.lat/lng fields when both are 0, leaving address
 *      intact so the place isn't bricked.
 *
 *   2. Delete legacy auto-generated lists (All Loved / All Tried / All
 *      Want). These were a pre-refactor pattern that doubled every save
 *      into 6 collection writes and cluttered the favorites tile. The
 *      refactor stopped writing to them but the legacy rows persist.
 *      Matched by either tag (`auto-generated` or `#auto-generated`)
 *      OR exact name (`All Loved`, `All Tried`, `All Want`).
 *
 * Usage:
 *   node scripts/cleanup-coords-and-autolists.js                # dry run
 *   node scripts/cleanup-coords-and-autolists.js --apply        # commit
 *
 * Requires the same admin SDK key file the other scripts use.
 */

import admin from 'firebase-admin'
import fs from 'fs'
import path from 'path'
import url from 'url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const keyPath = path.join(__dirname, 'this-is-76332-firebase-adminsdk-17v4h-a9e338add7.json')
if (!fs.existsSync(keyPath)) {
  console.error('Admin key not found at:', keyPath)
  process.exit(1)
}
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(fs.readFileSync(keyPath, 'utf8')))
  })
}

const db = admin.firestore()
const APPLY = process.argv.includes('--apply')

const isZero = (n) => n === 0 || n === '0' || n === null || n === undefined
const isNullIsland = (lat, lng) => isZero(lat) && isZero(lng)

async function cleanupCoords() {
  console.log(`\n=== STEP 1: Strip (0, 0) coordinates from places ===`)
  const snap = await db.collection('places').get()
  let touched = 0
  const writes = []

  snap.forEach(doc => {
    const data = doc.data() || {}
    const coords = data.coordinates
    const loc = data.location
    const coordsBad = coords && isNullIsland(coords.lat, coords.lng)
    const locBad = loc && (loc.lat !== undefined || loc.lng !== undefined) && isNullIsland(loc.lat, loc.lng)
    if (!coordsBad && !locBad) return

    const update = {}
    if (coordsBad) {
      // Remove the bad coords entirely. Firestore deletes via FieldValue.delete().
      update.coordinates = admin.firestore.FieldValue.delete()
    }
    if (locBad) {
      // Keep address, drop lat/lng.
      update.location = { address: loc?.address || data.address || '' }
    }
    touched += 1
    if (APPLY) {
      writes.push(doc.ref.update(update))
    } else {
      console.log(`  would clean: ${doc.id} (${data.name || 'unnamed'})  coords=${coordsBad} loc=${locBad}`)
    }
  })

  if (APPLY && writes.length > 0) {
    // Process in batches of 50 to stay well under Firestore concurrency limits.
    for (let i = 0; i < writes.length; i += 50) {
      await Promise.all(writes.slice(i, i + 50))
    }
    console.log(`  cleaned ${touched} place doc(s)`)
  } else {
    console.log(`  ${touched} place doc(s) carry (0, 0) coords (dry run)`)
  }
  return touched
}

async function deleteAutoLists() {
  console.log(`\n=== STEP 2: Delete legacy auto-lists ===`)
  const snap = await db.collection('lists').get()
  let touched = 0
  const writes = []

  for (const doc of snap.docs) {
    const data = doc.data() || {}
    const tags = Array.isArray(data.tags) ? data.tags : []
    const hasAutoTag = tags.includes('auto-generated') || tags.includes('#auto-generated')
    const nameLower = String(data.name || '').trim().toLowerCase()
    const isAutoByName = nameLower === 'all loved' || nameLower === 'all tried' || nameLower === 'all want'
    if (!hasAutoTag && !isAutoByName) continue

    touched += 1
    if (APPLY) {
      // Recursive delete: list doc + its `places` and `posts` subcollections.
      // Use admin.firestore().recursiveDelete which handles subcollections.
      writes.push(db.recursiveDelete(doc.ref))
    } else {
      console.log(`  would delete: ${doc.id} "${data.name}" (owner ${data.userId})`)
    }
  }

  if (APPLY && writes.length > 0) {
    for (let i = 0; i < writes.length; i += 25) {
      await Promise.all(writes.slice(i, i + 25))
    }
    console.log(`  deleted ${touched} list doc(s) and their subcollections`)
  } else {
    console.log(`  ${touched} legacy auto-list(s) found (dry run)`)
  }
  return touched
}

async function main() {
  const mode = APPLY ? 'APPLY (will write)' : 'DRY RUN (no writes)'
  console.log(`Mode: ${mode}\n`)
  const a = await cleanupCoords()
  const b = await deleteAutoLists()
  console.log(`\nDone. Coords cleaned: ${a}, auto-lists deleted: ${b}`)
  if (!APPLY && (a + b) > 0) {
    console.log(`\nRe-run with --apply to commit:`)
    console.log(`  node scripts/cleanup-coords-and-autolists.js --apply`)
  }
  process.exit(0)
}

main().catch(err => {
  console.error('Cleanup failed:', err)
  process.exit(1)
})
