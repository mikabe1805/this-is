/**
 * Seed a demo FRIEND GRAPH so the friend-first vision is visible immediately
 * (v2/FRIENDS.md). Creates three friend personas and their Want/Tried/Loved
 * saves — with notes that read like a 1 AM text, not a Yelp review — on the
 * curated NYC rooms. This is scaffolding to SHOW the model; real friends
 * arrive via invite links.
 *
 * Usage:  node scripts/seed-social.mjs
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const env = readFileSync(resolve(here, '../../.env.local'), 'utf8')
const grab = k => env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim()
const FB_KEY = grab('VITE_FIREBASE_API_KEY')
const PROJECT = grab('VITE_FIREBASE_PROJECT_ID')
if (!FB_KEY || !PROJECT) { console.error('Missing Firebase keys'); process.exit(1) }

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`
const S = s => ({ stringValue: s })
const I = n => ({ integerValue: String(n) })
const N = n => ({ doubleValue: n })
const MAP = fields => ({ mapValue: { fields } })

async function patch(path, fields) {
  const res = await fetch(`${BASE}/${path}?key=${FB_KEY}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }),
  })
  if (!res.ok) throw new Error(`write ${res.status}: ${(await res.text()).slice(0, 200)}`)
}
async function del(path) {
  await fetch(`${BASE}/${path}?key=${FB_KEY}`, { method: 'DELETE' })
}

// Read the curated rooms to hang saves on real place_ids.
const curatedRes = await fetch(`${BASE}/curated?pageSize=100&key=${FB_KEY}`)
const curated = (await curatedRes.json()).documents ?? []
const info = {} // id -> denormalized place snapshot (mapValue fields)
for (const d of curated) {
  const id = d.name.split('/').pop()
  const f = d.fields ?? {}
  const snap = { name: f.name ?? S(id), hex: f.photoHex ?? S('#3A2B31') }
  if (f.primaryType) snap.primaryType = f.primaryType
  if (f.neighborhood) snap.neighborhood = f.neighborhood
  if (f.lat && f.lng) { snap.lat = f.lat; snap.lng = f.lng }
  info[id] = snap
}
const ids = Object.keys(info)
if (!ids.length) { console.error('No curated venues — run seed-curated first.'); process.exit(1) }
const pick = i => ids[i % ids.length]

const FRIENDS = [
  { uid: 'demo-vivian', handle: '@vivian', displayName: 'Vivian', avatarHex: '#8E5A6B' },
  { uid: 'demo-uri', handle: '@uri', displayName: 'Uri', avatarHex: '#5A6B8E' },
  { uid: 'demo-sam', handle: '@sam', displayName: 'Sam', avatarHex: '#6B8E5A' },
]

// (friendIndex, placeIndex, tag, note) — notes as 1 AM texts.
const SAVES = [
  [0, 0, 'loved', 'Get the orange wine. We stayed at the back table for three hours.'],
  [0, 3, 'loved', 'The room is tiny and perfect. Go early or you won’t get a seat.'],
  [0, 6, 'tried', 'Cute but louder than it looks. Fine for a first drink, not the night.'],
  [0, 9, 'want', 'Been meaning to go forever — supposedly the mezcal flight is unreal.'],
  [1, 0, 'tried', 'Solid. The natural stuff by the glass rotates, ask what’s open.'],
  [1, 2, 'loved', 'This is THE spot. Dark, low, they leave you alone. Order the special.'],
  [1, 5, 'want', 'On my list. Uri from work swears by the back room.'],
  [1, 8, 'loved', 'Candlelit and half-empty on a Tuesday, which is exactly right.'],
  [2, 1, 'loved', 'Sat at the counter facing the turntable for two hours. No notes.'],
  [2, 4, 'tried', 'Good drinks, weird crowd that night. Might have been an off evening.'],
  [2, 7, 'want', 'Vivian won’t stop talking about this one.'],
  [2, 10, 'loved', 'The move: get there at open, sit at the far end, order two of whatever.'],
  [2, 0, 'want', 'Everyone keeps sending me this place. Fine, I’ll go.'],
]

// Clear previous demo saves, then reseed.
const existing = await fetch(`${BASE}/saves?pageSize=300&key=${FB_KEY}`)
for (const d of (await existing.json()).documents ?? []) {
  const uid = d.fields?.uid?.stringValue ?? ''
  if (uid.startsWith('demo-')) await del(`saves/${d.name.split('/').pop()}`)
}

for (const f of FRIENDS) {
  await patch(`users/${f.uid}`, {
    handle: S(f.handle), displayName: S(f.displayName), avatarHex: S(f.avatarHex), demo: { booleanValue: true },
  })
}

const now = Date.now()
let n = 0
for (const [fi, pi, tag, note] of SAVES) {
  const f = FRIENDS[fi]
  const id = pick(pi)
  await patch(`saves/${f.uid}__${id}`, {
    uid: S(f.uid), placeId: S(id), tag: S(tag), note: S(note),
    ts: I(now - n * 3_600_000), // stagger for a believable feed order
    place: MAP(info[id]),
  })
  n++
}
void N // (kept for schema symmetry with other seeders)
console.log(`✓ Seeded ${FRIENDS.length} demo friends + ${n} Want/Tried/Loved saves with notes.`)
