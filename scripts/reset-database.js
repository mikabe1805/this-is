/**
 * NUCLEAR OPTION: Complete database reset
 * Deletes all data from all collections
 * USE WITH CAUTION - This cannot be undone!
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync('./firebase-service-account.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function deleteCollection(collectionName) {
  console.log(`🗑️  Deleting ${collectionName}...`);
  
  const snapshot = await db.collection(collectionName).get();
  const batch = db.batch();
  
  snapshot.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  console.log(`✅ Deleted ${snapshot.size} documents from ${collectionName}`);
  
  return snapshot.size;
}

async function main() {
  console.log('\n⚠️  DATABASE RESET - This will delete ALL data!\n');
  
  const collections = [
    'places',
    'hubs',
    'lists',
    'posts',
    'users',
    'comments',
    'notifications',
    'activities',
    'follows'
  ];
  
  let totalDeleted = 0;
  
  for (const collection of collections) {
    try {
      const count = await deleteCollection(collection);
      totalDeleted += count;
    } catch (error) {
      console.error(`❌ Error deleting ${collection}:`, error.message);
    }
  }
  
  console.log(`\n✅ Database reset complete!`);
  console.log(`✅ Total deleted: ${totalDeleted} documents\n`);
  
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

