#!/usr/bin/env node

import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

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

async function testUsersCollection() {
  try {
    console.log('🧪 Testing users collection specifically...\n')
    
    // Test simple user creation
    const testUser = {
      name: 'Test User',
      username: 'testuser',
      bio: 'Just a test user',
      location: 'Test City',
      tags: ['test', 'user'],
      influences: 0,
      avatar: 'https://example.com/avatar.jpg',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    }
    
    console.log('📝 Creating test user document...')
    console.log('User data:', JSON.stringify(testUser, null, 2))
    
    await setDoc(doc(db, 'users', 'test-user-123'), testUser)
    console.log('✅ Test user created successfully!')
    
    // Try creating with different field combinations
    const minimalUser = {
      name: 'Minimal User',
      username: 'minimal',
      createdAt: Timestamp.now()
    }
    
    console.log('\n📝 Creating minimal user document...')
    await setDoc(doc(db, 'users', 'minimal-user-123'), minimalUser)
    console.log('✅ Minimal user created successfully!')
    
    console.log('\n🎉 Users collection is working properly!')
    
  } catch (error) {
    console.error('❌ Error testing users collection:', error.message)
    console.error('Error code:', error.code)
    console.error('Full error:', error)
    process.exit(1)
  }
}

testUsersCollection()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }) 