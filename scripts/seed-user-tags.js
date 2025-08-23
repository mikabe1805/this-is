import admin from 'firebase-admin'
import fs from 'fs'
import path from 'path'
import url from 'url'
import chalk from 'chalk'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

// Load service account json in scripts folder (user has placed admin key here)
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

const defaultUserTags = [
  'cozy','trendy','local','adventurous','bookworm','coffee-lover','foodie','night-owl','early-bird','photography','art-lover','music','outdoorsy','family','budget','luxury','romantic','social','quiet','wellness'
]

async function seedUserTags() {
  const tags = process.env.USER_TAGS ? process.env.USER_TAGS.split(',').map(t => t.trim()).filter(Boolean) : defaultUserTags
  console.log(chalk.cyan(`Seeding ${tags.length} user tags...`))
  const batch = db.batch()
  const now = admin.firestore.Timestamp.now()
  for (const t of tags) {
    const id = t.toLowerCase().trim()
    const ref = db.collection('userTags').doc(id)
    batch.set(ref, { name: id, displayName: t, usageCount: admin.firestore.FieldValue.increment(1), createdAt: now, lastUsed: now }, { merge: true })
  }
  await batch.commit()
  console.log(chalk.green('User tags seeded.'))
}

seedUserTags().then(()=>process.exit(0)).catch((e)=>{console.error(e); process.exit(1)})
