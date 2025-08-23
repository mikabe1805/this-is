#!/usr/bin/env node

// Normalizes existing place documents to match user-created hub format
// - Ensures fields: name, name_lowercase, address, coordinates{lat,lng}, location{address,lat,lng}
// - Adds savedCount (0 if missing)
// - Ensures tags array exists

import admin from 'firebase-admin'
import fs from 'fs'
import path from 'path'
import url from 'url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
// Use the same key loading approach as seed-user-tags.js
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

async function normalizePlaces() {
  console.log('🔧 Normalizing places…')
  const snap = await db.collection('places').get()
  let updates = 0
  const batch = db.batch()

  snap.forEach(doc => {
    const data = doc.data() || {}
    const update = {}

    // name_lowercase
    if (data.name && data.name.toLowerCase() !== data.name_lowercase) {
      update.name_lowercase = String(data.name).toLowerCase()
    }
    // location block to mirror user-created hubs
    const addr = data.address || data.location?.address || ''
    const lat = data.coordinates?.lat ?? data.location?.lat ?? 0
    const lng = data.coordinates?.lng ?? data.location?.lng ?? 0
    if (!data.location || data.location.address !== addr || data.location.lat !== lat || data.location.lng !== lng) {
      update.location = { address: addr, lat, lng }
    }
    // ensure coordinates object exists
    if (!data.coordinates || data.coordinates.lat !== lat || data.coordinates.lng !== lng) {
      update.coordinates = { lat, lng }
    }
    // savedCount
    if (typeof data.savedCount !== 'number') {
      update.savedCount = 0
    }
    // tags
    if (!Array.isArray(data.tags)) {
      update.tags = []
    }

    if (Object.keys(update).length > 0) {
      batch.update(doc.ref, update)
      updates++
    }
  })

  if (updates > 0) {
    await batch.commit()
    console.log(`✅ Updated ${updates} place documents`)
  } else {
    console.log('👌 No updates needed')
  }
}

normalizePlaces().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})


