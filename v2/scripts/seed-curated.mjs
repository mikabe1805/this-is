/**
 * Seed the CURATED catalog — the low-lit going-out rooms that ARE the product
 * (DIRECTION.md). This is a SCAFFOLD: it uses Google Text Search to pull REAL
 * venues in the launch metro, tags each with a scene + an example curator POV,
 * and writes them to `curated/{g:pid}`. The owner then replaces the POV lines
 * with their real take (including the exclusions) and swaps in owned ambiance
 * photos. The card format is the point; the taste is the founder's to author.
 *
 * Launch metro = New York (the real low-lit scene ~45 min from Piscataway),
 * plus the near-side Jersey City / Hoboken rooms so it's alive from home too.
 *
 * Usage:  node scripts/seed-curated.mjs
 * Cost: ~30 Text Search Pro calls (inside the 5K/mo free tier).
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
  console.error('Missing keys in .env.local'); process.exit(1)
}

const CITY_KEY = 'new-york-metro'

// The scenes — each a Text Search query + the vibe tags + an example POV line
// (owner rewrites these with the real take). Kept low-lit / intimate on purpose.
const SCENES = [
  { q: 'natural wine bar', tags: ['wine', 'drinks', 'cozy', 'date-night'], hex: '#4A2E3C', povs: [
    'Low light, natural pours, a list short enough to read by candle.',
    'Skin-contact and orange bottles, no attitude — the anti-scene wine room.',
    'A marble ledge, two stools, and whatever the bar is excited about tonight.' ] },
  { q: 'listening bar', tags: ['music', 'drinks', 'late-night', 'cozy'], hex: '#3D2F42', povs: [
    'Vinyl on a real system, talk-height volume — sit and stay a while.',
    'A room built around the speakers; the drinks keep pace with the records.',
    'Low hum, warm horns, one seat at the counter facing the turntable.' ] },
  { q: 'intimate cocktail bar dimly lit', tags: ['drinks', 'date-night', 'late-night'], hex: '#38303F', povs: [
    'A dim room and a bartender with opinions — order what you can’t pronounce.',
    'Six seats, no menu, and a drink built for whatever you’re in the mood for.',
    'The kind of dark where a first date actually works.' ] },
  { q: 'cozy speakeasy', tags: ['drinks', 'date-night', 'hidden'], hex: '#33323F', povs: [
    'Unmarked door, low ceilings, no photos of the crowd — just the drink.',
    'You have to know it’s there. That’s most of the point.',
    'Behind the thing that isn’t a door, a room that rewards the effort.' ] },
  { q: 'candlelit cafe open late', tags: ['coffee', 'cozy', 'quiet', 'work-friendly'], hex: '#4C3A34', povs: [
    'Candlelit past dark, slow on purpose — a coffee that becomes an evening.',
    'The rare café that gets better after sunset.',
    'Small tables, warm light, nobody rushing you out.' ] },
  { q: 'mezcal bar', tags: ['drinks', 'late-night', 'adventurous'], hex: '#3F332C', povs: [
    'Smoke and agave in a room that leans low — go slow.',
    'Ask what’s under the counter; the good bottles aren’t on the list.',
    'A single candle, a flight of mezcal, and nowhere you need to be.' ] },
]

// Anchors across the launch metro (NYC core + the near-side NJ rooms).
const ANCHORS = [
  { label: 'Lower East Side', lat: 40.7185, lng: -73.9875 },
  { label: 'East Village', lat: 40.7265, lng: -73.9815 },
  { label: 'West Village', lat: 40.7340, lng: -74.0030 },
  { label: 'Williamsburg', lat: 40.7145, lng: -73.9570 },
  { label: 'Greenpoint', lat: 40.7300, lng: -73.9510 },
  { label: 'Jersey City', lat: 40.7210, lng: -74.0470 },
  { label: 'Hoboken', lat: 40.7440, lng: -74.0300 },
]

const PER_QUERY = 2
const TARGET = 26 // cap the starter set

function neighborhoodFrom(address, fallback) {
  if (!address) return fallback
  const parts = address.split(',').map(s => s.trim()).filter(Boolean)
  return parts.length >= 3 ? parts[1] : fallback
}

async function searchText(query, lat, lng) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': PLACES_KEY,
      Referer: 'http://localhost:5173/',
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.primaryType',
    },
    body: JSON.stringify({
      textQuery: query, maxResultCount: PER_QUERY, languageCode: 'en',
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 2500 } },
    }),
  })
  if (!res.ok) { console.warn(`  ! ${res.status} ${(await res.text()).slice(0,120)}`); return [] }
  return (await res.json()).places ?? []
}

const S = s => ({ stringValue: s })
const N = n => ({ doubleValue: n })
const I = n => ({ integerValue: String(n) })
const B = b => ({ booleanValue: b })
const ARR = a => ({ arrayValue: { values: a.map(S) } })

async function writeDoc(id, fields) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/curated/${id}?key=${FB_KEY}`
  const res = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) })
  if (!res.ok) throw new Error(`write ${res.status}: ${(await res.text()).slice(0,200)}`)
}

/** Wipe the collection first so a re-seed drops stale / mis-matched venues. */
async function clearCurated() {
  const list = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/curated?pageSize=300&key=${FB_KEY}`)
  const docs = (await list.json()).documents ?? []
  for (const d of docs) {
    const id = d.name.split('/').pop()
    await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/curated/${id}?key=${FB_KEY}`, { method: 'DELETE' })
  }
  if (docs.length) console.log(`Cleared ${docs.length} existing curated docs.`)
}

const now = Date.now()
const seen = new Map()

await clearCurated()

for (const anchor of ANCHORS) {
  for (const scene of SCENES) {
    if (seen.size >= TARGET) break
    const places = await searchText(scene.q, anchor.lat, anchor.lng)
    for (const p of places) {
      const id = `g:${p.id}`
      if (seen.has(id) || !p.location || seen.size >= TARGET) continue
      // Drop obvious non-scene matches Text Search drags in.
      const name = p.displayName?.text ?? ''
      if (/wings?|diner|mcdonald|dunkin|starbucks|chipotle|halal|deli/i.test(name)) continue
      if (/fast_food|meal_takeaway|meal_delivery/.test(p.primaryType ?? '')) continue
      // Deterministic POV variant per venue so a scene doesn't read templated.
      let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
      seen.set(id, {
        id,
        name: p.displayName?.text ?? '(unnamed)',
        primaryType: p.primaryType ?? 'bar',
        vibeTags: scene.tags,
        curatorPOV: scene.povs[h % scene.povs.length],
        neighborhood: neighborhoodFrom(p.formattedAddress, anchor.label),
        lat: p.location.latitude, lng: p.location.longitude, hex: scene.hex,
      })
    }
  }
}

console.log(`Writing ${seen.size} curated venues…`)
let n = 0
for (const c of seen.values()) {
  await writeDoc(c.id, {
    name: S(c.name), primaryType: S(c.primaryType), vibeTags: ARR(c.vibeTags),
    curatorPOV: S(c.curatorPOV), neighborhood: S(c.neighborhood),
    lat: N(c.lat), lng: N(c.lng), coordsFetchedAt: I(now),
    photoHex: S(c.hex), savedCount: I(0), cityKey: S(CITY_KEY), curated: B(true),
  })
  process.stdout.write(`  ${++n}/${seen.size}\r`)
}
console.log(`\n✓ Seeded ${n} curated venues into new-york-metro.`)
console.log('  Next: the owner rewrites each curatorPOV with the real take + adds owned photos.')