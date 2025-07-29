#!/usr/bin/env node

import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore'
import { getStorage, ref, listAll, deleteObject } from 'firebase/storage'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { seedWithImages } from './seed-fixed.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.local')

if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8')
  const envVars = envConfig.split('\n').filter(line => line.includes('=') && !line.startsWith('#'))
  
  envVars.forEach(line => {
    const [key, ...valueParts] = line.split('=')
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim()
      process.env[key.trim()] = value
    }
  })
}

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const storage = getStorage(app)

async function cleanupCollection(collectionName) {
  try {
    console.log(`🧹 Cleaning up ${collectionName} collection...`)
    const snapshot = await getDocs(collection(db, collectionName))
    
    const deletePromises = snapshot.docs.map(document => {
      return deleteDoc(doc(db, collectionName, document.id))
    })
    
    await Promise.all(deletePromises)
    console.log(`✓ Deleted ${snapshot.docs.length} documents from ${collectionName}`)
  } catch (error) {
    console.error(`❌ Error cleaning ${collectionName}:`, error.message)
  }
}

async function cleanupStorage() {
  try {
    console.log(`🧹 Cleaning up seed data from Storage...`)
    
    const seedDataRef = ref(storage, 'seed-data')
    const listResult = await listAll(seedDataRef)
    
    // Delete all files in seed-data folder and subfolders
    const deletePromises = []
    
    // Delete files in root seed-data folder
    listResult.items.forEach(item => {
      deletePromises.push(deleteObject(item))
    })
    
    // Delete files in subfolders
    for (const folderRef of listResult.prefixes) {
      const folderResult = await listAll(folderRef)
      folderResult.items.forEach(item => {
        deletePromises.push(deleteObject(item))
      })
    }
    
    await Promise.all(deletePromises)
    console.log(`✓ Deleted ${deletePromises.length} files from Storage`)
  } catch (error) {
    console.error(`❌ Error cleaning Storage:`, error.message)
  }
}

async function cleanupAndSeed() {
  try {
    console.log('🚀 Starting cleanup and fresh seed...\n')
    
    // Clean up existing data
    await cleanupCollection('users')
    await cleanupCollection('places') 
    await cleanupCollection('lists')
    await cleanupCollection('posts')
    await cleanupCollection('test-collection')
    
    // Clean up storage
    await cleanupStorage()
    
    console.log('\n✅ Cleanup completed!')
    console.log('\n🌱 Starting fresh seed...')
    
    // Run the seed script
    await seedWithImages()
    
    console.log('\n🎉 Fresh data seeded successfully!')
    console.log('\n📊 Your app now has:')
    console.log('   • Clean, consistent data structure')
    console.log('   • Proper tags arrays for all items') 
    console.log('   • Fresh images in Storage')
    console.log('   • Ready for discovery algorithm testing')
    
  } catch (error) {
    console.error('❌ Cleanup and seed failed:', error)
    process.exit(1)
  }
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith('cleanup-and-seed.js')) {
  cleanupAndSeed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Failed:', error.message)
      process.exit(1)
    })
}

export { cleanupAndSeed } 