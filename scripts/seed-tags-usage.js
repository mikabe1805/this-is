import admin from 'firebase-admin'
import fs from 'fs'
import path from 'path'
import url from 'url'
import chalk from 'chalk'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

// Load service account json in scripts folder
const keyPath = path.join(__dirname, 'this-is-76332-firebase-adminsdk-17v4h-a9e338add7.json')
if (!fs.existsSync(keyPath)) {
  console.error(chalk.red('Admin key not found at:'), keyPath)
  process.exit(1)
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(fs.readFileSync(keyPath, 'utf8')))
  })
}

const db = admin.firestore()

async function backfillTagUsage() {
  console.log(chalk.cyan('Backfilling tags usageCount and lastUsed...'))
  const snapshot = await db.collection('tags').get()
  const now = admin.firestore.Timestamp.now()
  let updated = 0
  const batch = db.batch()

  snapshot.forEach(doc => {
    const data = doc.data() || {}
    const hasCount = typeof data.usageCount === 'number'
    if (!hasCount) {
      batch.set(doc.ref, { usageCount: 1, createdAt: data.createdAt || now, lastUsed: now, name: data.name || doc.id, displayName: data.displayName || doc.id }, { merge: true })
      updated++
    }
  })

  if (updated > 0) {
    await batch.commit()
  }
  console.log(chalk.green(`Backfill complete. Updated ${updated} tags.`))
}

backfillTagUsage().then(()=>process.exit(0)).catch(e=>{console.error(e); process.exit(1)})


