#!/usr/bin/env node

/**
 * Browser Seeding Setup Script
 * 
 * This script temporarily deploys open Firestore rules for browser-based seeding,
 * then provides instructions to revert to secure rules after seeding.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

console.log('🔧 Setting up browser-based database seeding...\n')

try {
  // Step 1: Backup current rules
  console.log('📋 Backing up current Firestore rules...')
  const originalRules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8')
  fs.writeFileSync(path.join(__dirname, '..', 'firestore.rules.backup'), originalRules)
  console.log('✅ Rules backed up to firestore.rules.backup')

  // Step 2: Copy temporary rules
  console.log('\n🔓 Deploying temporary open rules for seeding...')
  const tempRules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules.temp'), 'utf8')
  fs.writeFileSync(path.join(__dirname, '..', 'firestore.rules'), tempRules)
  
  // Step 3: Deploy temporary rules
  console.log('📤 Deploying temporary rules to Firebase...')
  execSync('firebase deploy --only firestore:rules', { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  })
  
  console.log('\n🎉 Setup complete! You can now seed your database.')
  console.log('\n📱 Next steps:')
  console.log('   1. Start your app: npm run dev')
  console.log('   2. Visit: http://localhost:5173/seed-database')
  console.log('   3. Click "🚀 Seed Database"')
  console.log('   4. After seeding, run: npm run db:restore-rules')
  
  console.log('\n⚠️  IMPORTANT: Run "npm run db:restore-rules" after seeding to restore security!')

} catch (error) {
  console.error('❌ Error setting up browser seeding:', error.message)
  process.exit(1)
} 