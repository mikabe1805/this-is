const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY 
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : null;

if (!serviceAccount && !admin.apps.length) {
  console.log('🔐 Using Firebase emulator');
  process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
  admin.initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'this-is-demo'
  });
} else if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}

const db = admin.firestore();

// Helper functions
const randomId = () => Math.random().toString(36).substr(2, 9);

async function seedTestData() {
  console.log('🌱 Starting test data seeding...');

  try {
    const users = [
      {
        id: 'test-user-1',
        name: 'Alex Tester',
        username: 'alextester',
        email: 'alex@test.com',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
        bio: 'Just a test user, looking for test data.',
        location: 'Testville, USA',
        influences: 42,
        tags: ['testing', 'seed-data', 'new-user'],
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        settings: {
          privacy: 'public',
          notifications: true,
          locationSharing: true
        }
      },
      {
        id: 'test-user-2',
        name: 'Beth Tester',
        username: 'bethtester',
        email: 'beth@test.com',
        avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop&crop=face',
        bio: 'Another test user, hoping to find some cool new places.',
        location: 'Testville, USA',
        influences: 123,
        tags: ['testing', 'seed-data', 'another-user'],
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        settings: {
          privacy: 'public',
          notifications: true,
          locationSharing: true
        }
      }
    ];

    const lists = [
      {
        id: 'test-list-1',
        name: 'Alexs Test List',
        description: 'A list of test places for Alex.',
        userId: 'test-user-1',
        privacy: 'public',
        tags: ['testing', 'places'],
        coverImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad3411?w=800&h=400&fit=crop',
        likes: 10,
        saves: 5,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      }
    ];

    const places = [
      {
        id: 'test-place-1',
        name: 'The Test Cafe',
        address: '123 Test Street, Testville, USA',
        coordinates: {
          lat: 37.7749,
          lng: -122.4194
        },
        category: 'cafe',
        tags: ['testing', 'coffee', 'cafe'],
        hubImage: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&h=600&fit=crop',
        description: 'The best test cafe in town.',
        priceRange: '$$',
        savedCount: 1,
        averageRating: 4.5,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        createdBy: 'test-user-1',
        isVerified: true
      }
    ];

    console.log('👥 Seeding test users...');
    const userBatch = db.batch();
    users.forEach(user => {
      const ref = db.collection('users').doc(user.id);
      userBatch.set(ref, user);
    });
    await userBatch.commit();
    console.log(`✅ Seeded ${users.length} test users`);

    console.log('📝 Seeding test lists...');
    const listBatch = db.batch();
    lists.forEach(list => {
      const ref = db.collection('lists').doc(list.id);
      listBatch.set(ref, list);
    });
    await listBatch.commit();
    console.log(`✅ Seeded ${lists.length} test lists`);

    console.log('🏢 Seeding test places...');
    const placeBatch = db.batch();
    places.forEach(place => {
      const ref = db.collection('places').doc(place.id);
      placeBatch.set(ref, place);
    });
    await placeBatch.commit();
    console.log(`✅ Seeded ${places.length} test places`);
    
    console.log('\n🎉 Test data seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding test database:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  seedTestData()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}
