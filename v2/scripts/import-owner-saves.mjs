/**
 * Owner-import: recreate your real Google Maps saves as v2 pins — the only
 * data that matters. No v1 migration code exists or ever will.
 *
 * Input: a text file of Google place_ids (one per line; blank lines and
 * `#` comments ignored). Google Takeout's "Saved Places" export contains
 * place_ids in its URLs — grep them out, or paste IDs from Maps share links.
 *
 * Usage:
 *   set GOOGLE_APPLICATION_CREDENTIALS=path\to\service-account.json
 *   node scripts/import-owner-saves.mjs --uid <your-uid> --file places.txt \
 *        --board "Imported" [--city piscataway-nj-us]
 *
 * --city tags the imported place docs so they can seed the first candidate
 * pool (W3). It is a per-run tag, not an app default — the app is global.
 *
 * Reads VITE_PLACES_NEW_KEY from the repo-root .env.local for the details
 * calls (one per place — run once, it's idempotent thanks to g:{pid} keys).
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const here = dirname(fileURLToPath(import.meta.url))

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}

const uid = arg('uid')
const file = arg('file')
const boardName = arg('board', 'Imported')
const cityKey = arg('city')

if (!uid || !file) {
  console.error('Usage: node import-owner-saves.mjs --uid <uid> --file <place_ids.txt> [--board <name>] [--city <cityKey>]')
  process.exit(1)
}

// Places key from repo-root .env.local (same file Vite reads).
const envText = readFileSync(resolve(here, '../../.env.local'), 'utf8')
const KEY = envText.match(/^VITE_PLACES_NEW_KEY=(.+)$/m)?.[1]?.trim()
if (!KEY) {
  console.error('VITE_PLACES_NEW_KEY not found in repo-root .env.local')
  process.exit(1)
}

const ids = readFileSync(resolve(file), 'utf8')
  .split(/\r?\n/)
  .map(l => l.trim())
  .filter(l => l && !l.startsWith('#'))

initializeApp({ credential: applicationDefault() })
const db = getFirestore()

async function details(pid) {
  const res = await fetch(`https://places.googleapis.com/v1/places/${pid}`, {
    headers: {
      'X-Goog-Api-Key': KEY,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,primaryType',
    },
  })
  if (!res.ok) return null
  return res.json()
}

function neighborhoodFrom(address) {
  if (!address) return undefined
  const parts = address.split(',').map(s => s.trim()).filter(Boolean)
  return parts.length >= 3 ? parts[1] : undefined
}

const now = Date.now()

// Truly idempotent: reuse the named board if it exists; skip places the user
// already has as pins (never overwrite app-edited state, never re-increment).
const boardsCol = db.collection('users').doc(uid).collection('boards')
const existingBoard = await boardsCol.where('name', '==', boardName).limit(1).get()
const boardRef = existingBoard.empty ? boardsCol.doc() : existingBoard.docs[0].ref
if (existingBoard.empty) {
  await boardRef.set({
    name: boardName,
    coverHex: '#3A2B31',
    vibeTags: [],
    pinCount: 0,
    createdAt: now,
    lastUsedAt: now,
  })
  console.log(`Board "${boardName}" created → ${boardRef.id}`)
} else {
  console.log(`Board "${boardName}" reused → ${boardRef.id}`)
}

let ok = 0
let skipped = 0
for (const pid of ids) {
  const id = pid.startsWith('g:') ? pid : `g:${pid}`
  const pinRef = db.collection('users').doc(uid).collection('pins').doc(id)
  const existingPin = await pinRef.get()
  if (existingPin.exists) {
    skipped++
    console.log(`  · already saved, skipping: ${existingPin.data()?.snapshot?.name ?? id}`)
    continue
  }
  const p = await details(id.slice(2))
  if (!p) {
    console.warn(`  skip (details failed): ${pid}`)
    continue
  }
  const name = p.displayName?.text ?? '(unnamed)'
  const neighborhood = neighborhoodFrom(p.formattedAddress)
  const snapshot = {
    name,
    hex: '#3A2B31',
    ...(p.primaryType ? { primaryType: p.primaryType } : {}),
    ...(neighborhood ? { neighborhood } : {}),
    ...(p.location
      ? { lat: p.location.latitude, lng: p.location.longitude, coordsAt: now }
      : {}),
  }
  const batch = db.batch()
  batch.set(pinRef, {
    boardIds: [boardRef.id],
    status: 'want',
    savedAt: now,
    lastTouchedAt: now,
    snapshot,
  })
  batch.set(
    db.collection('places').doc(id),
    {
      name,
      vibeTags: [],
      photoHex: '#3A2B31',
      ...(p.primaryType ? { primaryType: p.primaryType } : {}),
      ...(neighborhood ? { neighborhood } : {}),
      ...(p.location
        ? { lat: p.location.latitude, lng: p.location.longitude, coordsFetchedAt: now }
        : {}),
      savedCount: FieldValue.increment(1),
      ...(cityKey ? { cityKey } : {}),
    },
    { merge: true }
  )
  batch.update(boardRef, { pinCount: FieldValue.increment(1), lastUsedAt: now })
  await batch.commit()
  ok++
  console.log(`  ✓ ${name}`)
}

console.log(`Imported ${ok}/${ids.length} places (${skipped} already saved).`)
