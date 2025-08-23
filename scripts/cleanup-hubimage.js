#!/usr/bin/env node
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

async function cleanup() {
  console.log('🧹 Removing legacy hubImage fields…')
  const snap = await db.collection('places').get()
  let updates = 0
  let batch = db.batch()
  for (const doc of snap.docs) {
    const data = doc.data() || {}
    if (data.hubImage !== undefined) {
      batch.update(doc.ref, { hubImage: admin.firestore.FieldValue.delete() })
      updates++
      if (updates % 400 === 0) {
        await batch.commit()
        batch = db.batch()
      }
    }
  }
  if (updates % 400 !== 0) {
    await batch.commit()
  }
  console.log(`✅ Removed hubImage from ${updates} documents`)
}

cleanup().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})


