/**
 * Seed the city candidate pools — the composer, run by hand.
 *
 * This is what makes the app non-empty: a one-shot (re-runnable, ≤30-day
 * refresh posture) sweep of Google Places Text Search around the given
 * anchors, written to cities/{cellKey}/candidates/{g:pid} via the Firestore
 * REST API. The client's discovery rail and search read these pools.
 *
 * Photo names are NEVER stored (ToS) — the client fetches photo refs live,
 * free-tier, per render.
 *
 * Usage:
 *   node scripts/seed-candidates.mjs                  # default: Piscataway area
 *   node scripts/seed-candidates.mjs --lat 40.7 --lng -74.0 --label "downtown"
 *
 * Cost: ~36 Text Search Pro calls per run — within the 5K/mo free allowance.
 * Re-running refreshes names/coords (the ≤30-day cache posture).
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const env = readFileSync(resolve(here, '../../.env.local'), 'utf8')
const grab = k => env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim()
const PLACES_KEY = grab('VITE_PLACES_NEW_KEY')
const FB_KEY = grab('VITE_FIREBASE_API_KEY')
const PROJECT = grab('VITE_FIREBASE_PROJECT_ID')
if (!PLACES_KEY || !FB_KEY || !PROJECT) {
  console.error('Missing VITE_PLACES_NEW_KEY / VITE_FIREBASE_API_KEY / VITE_FIREBASE_PROJECT_ID in .env.local')
  process.exit(1)
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}

// Default anchors: Piscataway + the walkable neighbors (New Brunswick,
// Highland Park). Override with --lat/--lng for any city on earth.
const ANCHORS = arg('lat')
  ? [{ label: arg('label', 'custom'), lat: Number(arg('lat')), lng: Number(arg('lng')) }]
  : [
      { label: 'Piscataway', lat: 40.5549, lng: -74.4649 },
      { label: 'New Brunswick', lat: 40.4899, lng: -74.4485 },
      { label: 'Highland Park', lat: 40.4995, lng: -74.4243 },
    ]

// One query per vibe family per anchor — mirrors src/data/vibes.ts.
const SWEEPS = [
  { q: 'coffee shops', type: 'coffee_shop', tags: ['coffee', 'cozy', 'work-friendly'], hex: '#4C3A34' },
  { q: 'restaurants for dinner', type: 'restaurant', tags: ['dinner', 'date-night'], hex: '#4A3038' },
  { q: 'bars and cocktail bars', type: 'bar', tags: ['drinks', 'late-night'], hex: '#37333F' },
  { q: 'bakeries and dessert shops', type: 'bakery', tags: ['sweet', 'morning'], hex: '#4E4136' },
  { q: 'casual quick lunch spots', type: 'restaurant', tags: ['quick-bite', 'casual'], hex: '#4C3530' },
  { q: 'bookstores and cool shops', type: 'book_store', tags: ['browse', 'quiet', 'cozy'], hex: '#423830' },
  { q: 'parks and gardens', type: 'park', tags: ['outdoors', 'slow-afternoon'], hex: '#364232' },
  { q: 'museums and galleries', type: 'museum', tags: ['culture', 'slow-afternoon'], hex: '#363C44' },
  { q: 'ice cream and cafes for dessert', type: 'ice_cream_shop', tags: ['sweet', 'quick-bite'], hex: '#453946' },
  { q: 'brunch spots', type: 'brunch_restaurant', tags: ['brunch', 'morning'], hex: '#4C4338' },
  { q: 'pizza places', type: 'pizza_restaurant', tags: ['quick-bite', 'casual'], hex: '#4C3530' },
  { q: 'live music and theaters', type: 'performing_arts_theater', tags: ['culture', 'a-show'], hex: '#42303D' },
]

const cellKey = (lat, lng) =>
  `${(Math.round(lat * 10) / 10).toFixed(1)}_${(Math.round(lng * 10) / 10).toFixed(1)}`

function neighborhoodFrom(address) {
  if (!address) return undefined
  const parts = address.split(',').map(s => s.trim()).filter(Boolean)
  return parts.length >= 3 ? parts[1] : undefined
}

async function searchText(query, lat, lng) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': PLACES_KEY,
      // The client key may be referrer-restricted; present as the app.
      Referer: 'http://localhost:5173/',
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.location,places.primaryType',
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: 12,
      languageCode: 'en',
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 4000 } },
    }),
  })
  if (!res.ok) {
    console.warn(`  ! searchText ${res.status}: ${(await res.text()).slice(0, 140)}`)
    return []
  }
  return (await res.json()).places ?? []
}

// Firestore REST typed-value encoding
const S = s => ({ stringValue: s })
const N = n => ({ doubleValue: n })
const I = n => ({ integerValue: String(n) })
const ARR = a => ({ arrayValue: { values: a.map(S) } })

// batchWrite requires OAuth; the per-document PATCH endpoint goes through
// security rules with just the web API key (as an unauthenticated client).
async function writeDoc(path, fields) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${path}?key=${FB_KEY}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) throw new Error(`write ${res.status}: ${(await res.text()).slice(0, 300)}`)
}

const now = Date.now()
const seen = new Map() // g:pid -> candidate

for (const anchor of ANCHORS) {
  console.log(`\n■ ${anchor.label}`)
  for (const sweep of SWEEPS) {
    const places = await searchText(`${sweep.q} near ${anchor.label}`, anchor.lat, anchor.lng)
    let fresh = 0
    for (const p of places) {
      const id = `g:${p.id}`
      if (seen.has(id) || !p.location) continue
      seen.set(id, {
        id,
        name: p.displayName?.text ?? '(unnamed)',
        primaryType: p.primaryType ?? sweep.type,
        vibeTags: sweep.tags,
        neighborhood: neighborhoodFrom(p.formattedAddress),
        lat: p.location.latitude,
        lng: p.location.longitude,
        hex: sweep.hex,
      })
      fresh++
    }
    console.log(`  ${sweep.q}: +${fresh}`)
  }
}

console.log(`\nWriting ${seen.size} candidates…`)
const all = [...seen.values()]
let done = 0
for (let i = 0; i < all.length; i += 8) {
  const chunk = all.slice(i, i + 8)
  await Promise.all(
    chunk.map(c =>
      writeDoc(`cities/${cellKey(c.lat, c.lng)}/candidates/${c.id}`, {
        name: S(c.name),
        primaryType: S(c.primaryType),
        vibeTags: ARR(c.vibeTags),
        ...(c.neighborhood ? { neighborhood: S(c.neighborhood) } : {}),
        lat: N(c.lat),
        lng: N(c.lng),
        coordsFetchedAt: I(now),
        photoHex: S(c.hex),
        savedCount: I(0),
        cityKey: S(cellKey(c.lat, c.lng)),
      })
    )
  )
  done += chunk.length
  process.stdout.write(`  ${done}/${all.length}\r`)
}
console.log(`\n✓ Seeded ${all.length} places into the candidate pools.`)
const cells = new Set(all.map(c => cellKey(c.lat, c.lng)))
console.log(`  cells: ${[...cells].join(', ')}`)