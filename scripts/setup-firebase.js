#!/usr/bin/env node

/**
 * Firebase Setup Script for "this-is" App
 * 
 * This script helps configure Firebase for the intelligent search system.
 * It checks configuration, deploys rules and indexes, and provides setup guidance.
 */

const admin = require('firebase-admin')
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
require('dotenv').config()

console.log('🚀 Firebase Setup for "this-is" App\n')

// ===========================================
// CONFIGURATION VALIDATION
// ===========================================

function validateEnvironment() {
  console.log('🔍 Checking environment configuration...')
  
  const requiredVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN', 
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID'
  ]
  
  const missing = requiredVars.filter(varName => !process.env[varName])
  
  if (missing.length > 0) {
    console.log('❌ Missing environment variables:')
    missing.forEach(varName => console.log(`   - ${varName}`))
    console.log('\n📝 Please create a .env file with your Firebase configuration.')
    console.log('   You can find these values in your Firebase project settings.')
    return false
  }
  
  console.log('✅ Environment configuration is complete')
  return true
}

function checkFirebaseProject() {
  console.log('\n🔍 Checking Firebase project connection...')
  
  try {
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID
    console.log(`   Project ID: ${projectId}`)
    
    // Initialize admin if not already initialized
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: projectId
      })
    }
    
    console.log('✅ Firebase project connection established')
    return true
  } catch (error) {
    console.log('❌ Firebase project connection failed:', error.message)
    return false
  }
}

// ===========================================
// FIREBASE DEPLOYMENT
// ===========================================

function deployFirestoreRules() {
  console.log('\n🔐 Deploying Firestore security rules...')
  
  try {
    execSync('firebase deploy --only firestore:rules', { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    })
    console.log('✅ Firestore rules deployed successfully')
    return true
  } catch (error) {
    console.log('❌ Failed to deploy Firestore rules:', error.message)
    return false
  }
}

function deployFirestoreIndexes() {
  console.log('\n📊 Deploying Firestore indexes...')
  
  try {
    execSync('firebase deploy --only firestore:indexes', { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    })
    console.log('✅ Firestore indexes deployed successfully')
    return true
  } catch (error) {
    console.log('❌ Failed to deploy Firestore indexes:', error.message)
    return false
  }
}

// ===========================================
// DATABASE INITIALIZATION
// ===========================================

async function checkDatabaseStatus() {
  console.log('\n📊 Checking database status...')
  
  try {
    const db = admin.firestore()
    
    const collections = ['users', 'places', 'lists', 'posts', 'userPreferences']
    const status = {}
    
    for (const collectionName of collections) {
      const snapshot = await db.collection(collectionName).limit(1).get()
      status[collectionName] = snapshot.docs.length > 0
    }
    
    console.log('   Collection status:')
    Object.entries(status).forEach(([name, hasData]) => {
      console.log(`   - ${name}: ${hasData ? '✅ Has data' : '❌ Empty'}`)
    })
    
    const isEmpty = Object.values(status).every(hasData => !hasData)
    
    if (isEmpty) {
      console.log('\n💡 Database appears to be empty. Run the seeding script to add mock data:')
      console.log('   npm run seed')
    } else {
      console.log('\n✅ Database contains data and is ready for the intelligent search system')
    }
    
    return !isEmpty
  } catch (error) {
    console.log('❌ Failed to check database status:', error.message)
    return false
  }
}

// ===========================================
// SETUP VERIFICATION
// ===========================================

async function verifyIntelligentSearch() {
  console.log('\n🧠 Verifying intelligent search components...')
  
  const components = [
    'src/services/firebaseDataService.ts',
    'src/utils/searchAlgorithm.ts',
    'src/utils/discoveryAlgorithm.ts',
    'src/utils/intelligentSearchService.ts'
  ]
  
  let allExists = true
  
  for (const component of components) {
    const exists = fs.existsSync(path.join(__dirname, '..', component))
    console.log(`   - ${component}: ${exists ? '✅' : '❌'}`)
    if (!exists) allExists = false
  }
  
  if (allExists) {
    console.log('✅ All intelligent search components are in place')
  } else {
    console.log('❌ Some intelligent search components are missing')
  }
  
  return allExists
}

// ===========================================
// MAIN SETUP FUNCTION
// ===========================================

async function setupFirebase() {
  try {
    console.log('Setting up Firebase for intelligent search...\n')
    
    // Step 1: Validate environment
    if (!validateEnvironment()) {
      process.exit(1)
    }
    
    // Step 2: Check Firebase project
    if (!checkFirebaseProject()) {
      console.log('\n💡 Make sure you have:')
      console.log('   1. Created a Firebase project')
      console.log('   2. Enabled Firestore database')
      console.log('   3. Set up Firebase Authentication')
      console.log('   4. Added your environment variables')
      process.exit(1)
    }
    
    // Step 3: Deploy rules and indexes
    console.log('\n🚀 Deploying Firebase configuration...')
    
    const rulesDeployed = deployFirestoreRules()
    const indexesDeployed = deployFirestoreIndexes()
    
    if (!rulesDeployed || !indexesDeployed) {
      console.log('\n💡 Make sure you have:')
      console.log('   1. Installed Firebase CLI: npm install -g firebase-tools')
      console.log('   2. Logged in: firebase login')
      console.log('   3. Initialized project: firebase init')
      process.exit(1)
    }
    
    // Step 4: Check database status
    const hasData = await checkDatabaseStatus()
    
    // Step 5: Verify components
    const componentsReady = await verifyIntelligentSearch()
    
    // Final summary
    console.log('\n🎉 Firebase setup summary:')
    console.log(`   ✅ Environment: Configured`)
    console.log(`   ✅ Project: Connected`)
    console.log(`   ✅ Rules: Deployed`)
    console.log(`   ✅ Indexes: Deployed`)
    console.log(`   ${hasData ? '✅' : '⚠️ '} Database: ${hasData ? 'Ready' : 'Empty (run npm run seed)'}`)
    console.log(`   ${componentsReady ? '✅' : '❌'} Components: ${componentsReady ? 'Ready' : 'Missing'}`)
    
    if (hasData && componentsReady) {
      console.log('\n🚀 Your intelligent search system is ready to use!')
      console.log('\n📱 To test the system:')
      console.log('   1. Start your app: npm run dev')
      console.log('   2. Navigate to the search page')
      console.log('   3. Try searching with natural language queries')
      console.log('   4. Check out the discovery recommendations')
    } else {
      console.log('\n⚠️  Additional steps needed:')
      if (!hasData) {
        console.log('   - Run: npm run seed (to add mock data)')
      }
      if (!componentsReady) {
        console.log('   - Ensure all intelligent search components are properly set up')
      }
    }
    
  } catch (error) {
    console.error('❌ Setup failed:', error)
    process.exit(1)
  }
}

// ===========================================
// SCRIPT EXECUTION
// ===========================================

if (require.main === module) {
  setupFirebase()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Fatal error:', error)
      process.exit(1)
    })
}

module.exports = {
  setupFirebase,
  validateEnvironment,
  checkFirebaseProject,
  deployFirestoreRules,
  deployFirestoreIndexes
} 