#!/usr/bin/env node

/**
 * Database cleanup pass for the post-tester-feedback refactor.
 *
 *   1. Strip (0, 0) "Null Island" coordinates from every place doc.
 *      The pre-fix createHub defaulted missing lat/lng to 0 || 0, which
 *      Firestore happily indexed and which then made every saved place
 *      show up ~5,409 mi from a US viewer (great-circle (0,0) → NJ).
 *      We now reject (0, 0) at the write site, but legacy docs still
 *      carry the bad coords. This pass deletes the `coordinates` field
 *      and rewrites `location` to drop lat/lng (keeping the address).
 *
 *   2. Delete legacy auto-generated lists (All Loved / All Tried / All
 *      Want), including their `places` and `posts` subcollections.
 *      Matched by tag (`auto-generated` or `#auto-generated`) OR by
 *      exact name (case-insensitive: 'all loved', 'all tried', 'all want').
 *
 * Auth: uses `gcloud auth print-access-token` for the REST API and
 * `firebase firestore:delete --recursive` for the recursive deletes —
 * both already in your shell from this session, so no service-account
 * key file is needed.
 *
 * Usage:
 *   node scripts/cleanup-coords-and-autolists.js                # dry run
 *   node scripts/cleanup-coords-and-autolists.js --apply        # commit
 */

import { execSync, spawnSync } from 'child_process'

const PROJECT = process.env.GCLOUD_PROJECT || 'this-is-76332'
const APPLY = process.argv.includes('--apply')
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`

function token() {
  try {
    return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim()
  } catch (e) {
    console.error('Could not read gcloud token. Run `gcloud auth login` first.')
    process.exit(1)
  }
}

async function rest(method, pathOrUrl, body) {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${BASE}${pathOrUrl}`
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${token()}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${method} ${url} → ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

async function listAll(collectionPath) {
  const out = []
  let pageToken = ''
  do {
    const url = `${BASE}/${collectionPath}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`
    const data = await rest('GET', url)
    if (Array.isArray(data.documents)) out.push(...data.documents)
    pageToken = data.nextPageToken || ''
  } while (pageToken)
  return out
}

function readField(doc, name) {
  const f = doc?.fields?.[name]
  if (!f) return undefined
  // Firestore REST returns typed values; unwrap the obvious primitives.
  if ('stringValue' in f) return f.stringValue
  if ('integerValue' in f) return Number(f.integerValue)
  if ('doubleValue' in f) return f.doubleValue
  if ('booleanValue' in f) return f.booleanValue
  if ('arrayValue' in f) return (f.arrayValue.values || []).map(v => v.stringValue ?? v.integerValue ?? v.doubleValue ?? v)
  if ('mapValue' in f) {
    const m = f.mapValue.fields || {}
    const out = {}
    for (const k of Object.keys(m)) {
      const v = m[k]
      if ('stringValue' in v) out[k] = v.stringValue
      else if ('integerValue' in v) out[k] = Number(v.integerValue)
      else if ('doubleValue' in v) out[k] = v.doubleValue
      else if ('booleanValue' in v) out[k] = v.booleanValue
      else if ('nullValue' in v) out[k] = null
      else out[k] = v
    }
    return out
  }
  return undefined
}

function isZero(n) { return n === 0 || n === '0' || n === null || n === undefined }
function isNullIsland(lat, lng) { return isZero(lat) && isZero(lng) }

async function patchPlace(docName, locationAddress) {
  // updateMask drops `coordinates` entirely (no value sent for it, but
  // listed in the mask) and rewrites `location` to address-only.
  const url = `https://firestore.googleapis.com/v1/${docName}?updateMask.fieldPaths=coordinates&updateMask.fieldPaths=location`
  const body = {
    fields: {
      location: { mapValue: { fields: { address: { stringValue: locationAddress || '' } } } },
      // coordinates intentionally absent — listing it in updateMask without
      // a value clears the field.
    },
  }
  await rest('PATCH', url, body)
}

async function cleanupCoords() {
  console.log(`\n=== STEP 1: Strip (0, 0) coordinates from places ===`)
  const docs = await listAll('places')
  let touched = 0
  for (const d of docs) {
    const coords = readField(d, 'coordinates')
    const loc = readField(d, 'location')
    const coordsBad = coords && isNullIsland(coords.lat, coords.lng)
    const locBad = loc && (loc.lat !== undefined || loc.lng !== undefined) && isNullIsland(loc.lat, loc.lng)
    if (!coordsBad && !locBad) continue
    touched += 1
    const name = readField(d, 'name') || '(unnamed)'
    const addr = (loc && loc.address) || readField(d, 'address') || ''
    if (APPLY) {
      try {
        await patchPlace(d.name, addr)
        console.log(`  cleaned: ${name} (${d.name.split('/').pop()})`)
      } catch (e) {
        console.warn(`  failed: ${name} — ${e.message}`)
      }
    } else {
      console.log(`  would clean: ${name} (${d.name.split('/').pop()})  coords=${coordsBad} loc=${locBad}`)
    }
  }
  console.log(`  ${APPLY ? 'cleaned' : 'would clean'} ${touched} place doc(s)`)
  return touched
}

async function deleteAutoLists() {
  console.log(`\n=== STEP 2: Delete legacy auto-lists ===`)
  const docs = await listAll('lists')
  let matched = 0
  const targets = []
  for (const d of docs) {
    const tags = readField(d, 'tags') || []
    const tagsLower = tags.map(t => String(t).toLowerCase())
    const hasAutoTag = tagsLower.includes('auto-generated') || tagsLower.includes('#auto-generated')
    const name = String(readField(d, 'name') || '').trim().toLowerCase()
    const isAutoByName = name === 'all loved' || name === 'all tried' || name === 'all want'
    if (!hasAutoTag && !isAutoByName) continue
    matched += 1
    const id = d.name.split('/').pop()
    targets.push({ id, name: readField(d, 'name') })
  }

  if (targets.length === 0) {
    console.log(`  no legacy auto-lists found.`)
    return 0
  }

  for (const t of targets) {
    if (APPLY) {
      console.log(`  deleting: ${t.name} (${t.id})`)
      const result = spawnSync('npx', ['--yes', 'firebase', 'firestore:delete', `lists/${t.id}`, '--recursive', '--force', '--project', PROJECT], {
        stdio: 'inherit',
        shell: process.platform === 'win32',
      })
      if (result.status !== 0) {
        console.warn(`  ⚠️  firestore:delete returned ${result.status} for lists/${t.id}`)
      }
    } else {
      console.log(`  would delete: ${t.name} (${t.id})`)
    }
  }
  console.log(`  ${APPLY ? 'deleted' : 'would delete'} ${matched} list(s)`)
  return matched
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (will write)' : 'DRY RUN (no writes)'}`)
  console.log(`Project: ${PROJECT}`)
  const a = await cleanupCoords()
  const b = await deleteAutoLists()
  console.log(`\nDone. Coords cleaned: ${a}, auto-lists deleted: ${b}`)
  if (!APPLY && (a + b) > 0) {
    console.log(`\nRe-run with --apply to commit:`)
    console.log(`  node scripts/cleanup-coords-and-autolists.js --apply`)
  }
}

main().catch(err => {
  console.error('Cleanup failed:', err.message || err)
  process.exit(1)
})
