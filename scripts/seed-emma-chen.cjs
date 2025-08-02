const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin for LIVE DATABASE
const serviceAccountPath = path.resolve(__dirname, '..', 'this-is-76332-firebase-adminsdk-fbsvc-fa1125ffae.json');
let serviceAccount;

try {
  serviceAccount = require(serviceAccountPath);
} catch (error) {
  // Fallback for environment variable if the file isn't there
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  } else {
    console.error(`❌ Could not find service account key file or FIREBASE_SERVICE_ACCOUNT_KEY env var.`);
    process.exit(1);
  }
}

if (!admin.apps.length) {
    console.log(`🔥 Connecting to LIVE Firebase project: ${serviceAccount.project_id}...`);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
    });
}

const db = admin.firestore();

async function cleanupEmmaData(batch, emmaId) {
    console.log(`🧹 Cleaning up previous data for user: ${emmaId}...`);
    const userRef = db.collection('users').doc(emmaId);
    
    // Delete all documents in the activity subcollection
    const activitySnapshot = await userRef.collection('activity').get();
    if (!activitySnapshot.empty) {
        console.log(`   - Deleting ${activitySnapshot.size} activity documents...`);
        activitySnapshot.docs.forEach(doc => batch.delete(doc.ref));
    }

    // Delete the main documents
    const postRef = db.collection('posts').doc('post-emma-1');
    const listRef = db.collection('lists').doc('list-emma-1');
    const placeRef = db.collection('places').doc('place-1');

    console.log('   - Deleting main user, post, list, and place documents...');
    batch.delete(userRef);
    batch.delete(postRef);
    batch.delete(listRef);
    batch.delete(placeRef);
}


async function seedEmmaChenData() {
  console.log('🌱 Starting to seed data for Emma Chen into the LIVE database...');

  try {
    const emmaId = 'user-1';
    
    // Create a single batch for all operations
    const batch = db.batch();
    
    // 1. Clean up any previous data for this user
    await cleanupEmmaData(batch, emmaId);

    // 2. Define all the new data
    const emmaData = {
      id: emmaId,
      name: 'Emma Chen',
      username: 'emmachexplores',
      email: 'emmaexplores@example.com',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      bio: 'Coffee enthusiast and weekend adventurer. Finding the coziest spots in SF.',
      location: 'San Francisco, CA',
      influences: 142,
      tags: ['Foodie', 'Coffee Lover', 'Local Explorer'],
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      isVerified: false,
      followerCount: 0,
      followingCount: 0
    };

    const listId = 'list-emma-1';
    const listData = {
      id: listId,
      name: 'SF Coffee Crawl',
      description: 'My favorite go-to coffee shops in San Francisco for work and play.',
      userId: emmaId,
      privacy: 'public',
      tags: ['coffee', 'cozy', 'work-friendly'],
      coverImage: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&h=400&fit=crop',
      likes: 42,
      saves: 18,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      isShared: true,
      collaborators: []
    };

    const postId = 'post-emma-1';
    const postData = {
        id: postId,
        hubId: 'place-1',
        userId: emmaId,
        username: 'Emma Chen',
        userAvatar: emmaData.avatar,
        images: ['https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=800&h=600&fit=crop'],
        description: 'Absolutely loved the vibes at Blue Bottle. The coffee was amazing and the space is perfect for getting some work done.',
        postType: 'loved',
        privacy: 'public',
        likes: 28,
        likedBy: [],
        comments: [],
        location: { lat: 37.7749, lng: -122.4194 },
        createdAt: admin.firestore.Timestamp.now(),
        tags: ['coffee', 'minimalist', 'work-friendly']
    };
    
    const placeId = 'place-1';
    const placeData = {
        id: placeId,
        name: 'Blue Bottle Coffee',
        // Correctly structured location object for HubModal
        location: {
            address: '66 Mint St, San Francisco, CA 94103',
            lat: 37.7749,
            lng: -122.4194
        },
        // Redundant fields for compatibility with the Place type if needed elsewhere
        address: '66 Mint St, San Francisco, CA 94103',
        coordinates: { lat: 37.7749, lng: -122.4194 },
        category: 'Coffee Shop',
        tags: ['minimalist', 'third-wave', 'quality'],
        hubImage: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&h=600&fit=crop',
        description: 'A stylish coffee shop known for its high-quality, single-origin beans and minimalist aesthetic.',
        priceRange: '$$',
        savedCount: 123,
        averageRating: 4.6,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        createdBy: emmaId,
        isVerified: true
    };

    // 3. Add the create operations to the batch
    console.log('🧬 Staging new data for creation...');
    const userRef = db.collection('users').doc(emmaId);
    const placeRef = db.collection('places').doc(placeId);
    const listRef = db.collection('lists').doc(listId);
    const postRef = db.collection('posts').doc(postId);

    batch.set(userRef, emmaData);
    batch.set(placeRef, placeData);
    batch.set(listRef, listData);
    batch.set(postRef, postData);

    const listActivityRef = userRef.collection('activity').doc('activity-list-1');
    batch.set(listActivityRef, { type: 'create_list', listId: listId, createdAt: listData.createdAt });

    const postActivityRef = userRef.collection('activity').doc('activity-post-1');
    batch.set(postActivityRef, { type: 'post', postId: postId, hubId: postData.hubId, createdAt: postData.createdAt });
    
    // 4. Commit all cleanup and creation operations at once
    console.log('🚀 Committing all changes to the database...');
    await batch.commit();

    console.log('\n🎉 Emma Chen data seeding completed successfully!');
    console.log('✅ All previous data was cleaned up and fresh data was created.');

  } catch (error) {
    console.error('❌ Error seeding data for Emma Chen:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  seedEmmaChenData()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}
