/**
 * NUCLEAR OPTION: Complete database reset
 * Deletes all data from all collections
 * USE WITH CAUTION - This cannot be undone!
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin (same pattern as existing scripts)
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY 
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : null;

if (!serviceAccount && !admin.apps.length) {
  console.log('🔐 Using Firebase emulator or default credentials');
  admin.initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'this-is-76332'
  });
} else if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

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

