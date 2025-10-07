/**
 * Clean Google Photos URLs from Firebase
 * Replaces all Google Places photo URLs with placeholder
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
const PLACEHOLDER = '/assets/leaf.png';

async function cleanCollection(collectionName) {
  console.log(`\n🔍 Cleaning ${collectionName}...`);
  const snapshot = await db.collection(collectionName).get();
  
  let cleaned = 0;
  const batch = db.batch();
  
  snapshot.forEach(doc => {
    const data = doc.data();
    let needsUpdate = false;
    const updates = {};
    
    // Clean mainImage
    if (data.mainImage?.includes('googleapis.com')) {
      updates.mainImage = PLACEHOLDER;
      needsUpdate = true;
    }
    
    // Clean coverImage
    if (data.coverImage?.includes('googleapis.com')) {
      updates.coverImage = PLACEHOLDER;
      needsUpdate = true;
    }
    
    // Clean images array
    if (data.images?.some(img => img?.includes?.('googleapis.com'))) {
      updates.images = data.images.map(img => 
        img?.includes?.('googleapis.com') ? PLACEHOLDER : img
      );
      needsUpdate = true;
    }
    
    // Clean photos array
    if (data.photos?.some(photo => photo?.url?.includes?.('googleapis.com'))) {
      updates.photos = data.photos.map(photo => ({
        ...photo,
        url: photo.url?.includes('googleapis.com') ? PLACEHOLDER : photo.url
      }));
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      batch.update(doc.ref, updates);
      cleaned++;
    }
  });
  
  if (cleaned > 0) {
    await batch.commit();
    console.log(`✅ Cleaned ${cleaned} documents in ${collectionName}`);
  } else {
    console.log(`✓ No Google photo URLs found in ${collectionName}`);
  }
  
  return cleaned;
}

async function main() {
  console.log('🧹 Starting Firebase photo cleanup...\n');
  
  const collections = [
    'places',
    'hubs', 
    'lists',
    'posts',
    'users'
  ];
  
  let totalCleaned = 0;
  
  for (const collection of collections) {
    try {
      const count = await cleanCollection(collection);
      totalCleaned += count;
    } catch (error) {
      console.error(`❌ Error cleaning ${collection}:`, error.message);
    }
  }
  
  console.log(`\n✅ Total cleaned: ${totalCleaned} documents`);
  console.log('✅ All Google Photos URLs replaced with placeholder\n');
  
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

