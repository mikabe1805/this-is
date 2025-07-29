#!/usr/bin/env node

import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc, getDoc, Timestamp } from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
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

console.log('🔧 Testing Firebase Configuration...\n')

// Check required environment variables
const requiredVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN', 
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET'
]

console.log('📋 Environment Variables:')
const missingVars = []
requiredVars.forEach(varName => {
  const value = process.env[varName]
  if (value) {
    console.log(`  ✓ ${varName}: ${value.substring(0, 20)}...`)
  } else {
    console.log(`  ❌ ${varName}: MISSING`)
    missingVars.push(varName)
  }
})

if (missingVars.length > 0) {
  console.log('\n❌ Missing required environment variables. Please create .env.local')
  process.exit(1)
}

// Initialize Firebase
console.log('\n🚀 Initializing Firebase...')
const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const storage = getStorage(app)

async function testFirestore() {
  console.log('\n📝 Testing Firestore...')
  
  try {
    // Test simple document creation
    const testData = {
      id: 'test-doc',
      name: 'Test Document',
      description: 'Simple test document',
      tags: ['test', 'firebase'],
      count: 42,
      isActive: true,
      createdAt: Timestamp.now()
    }
    
    console.log('  • Creating test document...')
    await setDoc(doc(db, 'test-collection', 'test-doc'), testData)
    console.log('  ✓ Document created successfully')
    
    // Test reading the document
    console.log('  • Reading test document...')
    const docSnap = await getDoc(doc(db, 'test-collection', 'test-doc'))
    
    if (docSnap.exists()) {
      console.log('  ✓ Document read successfully')
      console.log('  ✓ Firestore is working properly')
      return true
    } else {
      console.log('  ❌ Document not found after creation')
      return false
    }
    
  } catch (error) {
    console.log('  ❌ Firestore error:', error.message)
    console.log('  🔍 Error code:', error.code)
    return false
  }
}

async function testStorage() {
  console.log('\n📁 Testing Firebase Storage...')
  
  try {
    // Create a simple test file
    const testContent = 'This is a test file for Firebase Storage'
    const testBuffer = Buffer.from(testContent, 'utf8')
    
    console.log('  • Uploading test file...')
    const storageRef = ref(storage, 'test/test-file.txt')
    const snapshot = await uploadBytes(storageRef, testBuffer, {
      contentType: 'text/plain',
      customMetadata: {
        test: 'true'
      }
    })
    
    console.log('  ✓ File uploaded successfully')
    
    // Get download URL
    console.log('  • Getting download URL...')
    const downloadURL = await getDownloadURL(snapshot.ref)
    console.log(`  ✓ Download URL: ${downloadURL.substring(0, 50)}...`)
    
    console.log('  ✓ Firebase Storage is working properly')
    return true
    
  } catch (error) {
    console.log('  ❌ Storage error:', error.message)
    console.log('  🔍 Error code:', error.code)
    
    if (error.code === 'storage/no-default-bucket') {
      console.log('  💡 Solution: Enable Firebase Storage in your console')
    }
    
    return false
  }
}

async function runDiagnostics() {
  try {
    console.log('🔬 Running Firebase Diagnostics...')
    
    const firestoreOk = await testFirestore()
    const storageOk = await testStorage()
    
    console.log('\n📊 Results:')
    console.log(`  Firestore: ${firestoreOk ? '✅ Working' : '❌ Issues'}`)
    console.log(`  Storage: ${storageOk ? '✅ Working' : '❌ Issues'}`)
    
    if (firestoreOk && storageOk) {
      console.log('\n🎉 All Firebase services are working!')
      console.log('🚀 Ready to run seed data with images!')
    } else {
      console.log('\n⚠️  Some services have issues. Check the errors above.')
    }
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error.message)
  }
}

// Run diagnostics
runDiagnostics()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }) 