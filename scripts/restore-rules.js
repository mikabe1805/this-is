#!/usr/bin/env node

/**
 * Restore Secure Firestore Rules
 * 
 * This script restores the original secure Firestore rules after browser-based seeding.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

console.log('🔒 Restoring secure Firestore rules...\n')

try {
  // Check if backup exists
  const backupPath = path.join(__dirname, '..', 'firestore.rules.backup')
  if (!fs.existsSync(backupPath)) {
    console.error('❌ No backup rules found. Cannot restore.')
    console.log('💡 You may need to manually restore your firestore.rules file.')
    process.exit(1)
  }

  // Step 1: Restore original rules
  console.log('📋 Restoring original Firestore rules...')
  const originalRules = fs.readFileSync(backupPath, 'utf8')
  fs.writeFileSync(path.join(__dirname, '..', 'firestore.rules'), originalRules)
  console.log('✅ Original rules restored to firestore.rules')

  // Step 2: Deploy secure rules
  console.log('\n🔒 Deploying secure rules to Firebase...')
  execSync('firebase deploy --only firestore:rules', { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  })
  
  // Step 3: Clean up backup
  console.log('\n🧹 Cleaning up backup files...')
  fs.unlinkSync(backupPath)
  console.log('✅ Backup file removed')
  
  console.log('\n🎉 Security restored! Your database is now protected.')
  console.log('\n📊 Your intelligent search system is ready to use with:')
  console.log('   ✅ Real Firebase data')
  console.log('   ✅ Secure access rules')
  console.log('   ✅ AI-powered search algorithms')
  console.log('   ✅ Social intelligence features')

} catch (error) {
  console.error('❌ Error restoring rules:', error.message)
  console.log('\n💡 Manual restoration steps:')
  console.log('   1. Copy content from firestore.rules.backup to firestore.rules')
  console.log('   2. Run: firebase deploy --only firestore:rules')
  process.exit(1)
} 