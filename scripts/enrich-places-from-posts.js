#!/usr/bin/env node

// Enrich places (hubs) using their posts:
// - hubImage/mainImage taken from the most liked post (thumbnail or first image)
// - tagsDerived computed from most frequent post tags (top 5)
// - If place.tags is missing/empty, fill with tagsDerived

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

function pickImageFromPost(post) {
  if (!post) return null
  if (post.thumbnail) return post.thumbnail
  if (Array.isArray(post.images) && post.images.length > 0) return post.images[0]
  return null
}

async function enrichPlaces() {
  console.log('✨ Enriching places from posts…')
  const placesSnap = await db.collection('places').get()
  let updates = 0
  let processed = 0
  let batch = db.batch()

  for (const placeDoc of placesSnap.docs) {
    processed++
    const placeId = placeDoc.id
    const postsSnap = await db.collection('posts').where('hubId', '==', placeId).get()
    if (postsSnap.empty) continue

    const posts = postsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    // Most liked (tie-break by recency)
    posts.sort((a, b) => {
      const la = typeof a.likes === 'number' ? a.likes : 0
      const lb = typeof b.likes === 'number' ? b.likes : 0
      if (lb !== la) return lb - la
      const ta = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().getTime() : 0
      const tb = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().getTime() : 0
      return tb - ta
    })
    const topPost = posts[0]
    const chosenImage = pickImageFromPost(topPost)

    // Aggregate tags
    const tagCounts = new Map()
    for (const p of posts) {
      const ptags = Array.isArray(p.tags) ? p.tags : []
      for (const t of ptags) {
        const key = String(t).toLowerCase()
        tagCounts.set(key, (tagCounts.get(key) || 0) + 1)
      }
    }
    const tagsDerived = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t]) => t)

    const current = placeDoc.data() || {}
    const upd = {}
    if (chosenImage && current.mainImage !== chosenImage) {
      upd.mainImage = chosenImage
    }
    upd.tagsDerived = tagsDerived
    const hasTags = Array.isArray(current.tags) && current.tags.length > 0
    if (!hasTags && tagsDerived.length > 0) {
      upd.tags = tagsDerived
    }

    if (Object.keys(upd).length > 0) {
      batch.update(placeDoc.ref, upd)
      updates++
    }

    // Commit periodically to avoid oversized batches
    if (updates > 0 && updates % 400 === 0) {
      await batch.commit()
      batch = db.batch()
    }
  }

  if (updates % 400 !== 0) {
    await batch.commit()
  }
  console.log(`✅ Enriched ${updates} places (processed ${processed})`)
}

enrichPlaces().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})


