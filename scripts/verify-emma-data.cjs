const admin = require('firebase-admin');

// Initialize Firebase Admin
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
admin.initializeApp({
  projectId: 'this-is-demo'
});

const db = admin.firestore();

async function verifyEmmaData() {
  console.log('🔍 Verifying Emma Chen\'s data...');

  try {
    // Check user document
    const userDoc = await db.collection('users').doc('user-1').get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log('✅ Emma Chen user document exists');
      console.log('📧 Email:', userData.email);
      console.log('👤 Name:', userData.name);
      console.log('📝 Bio:', userData.bio);
      console.log('🏷️ Tags:', userData.tags);
      console.log('📮 Posts count:', userData.posts ? userData.posts.length : 0);
      
      if (userData.posts && userData.posts.length > 0) {
        console.log('\n📋 Posts details:');
        userData.posts.forEach((post, index) => {
          console.log(`  ${index + 1}. ${post.id}: "${post.description}"`);
        });
      }
    } else {
      console.log('❌ Emma Chen user document not found');
    }

    // Check posts collection
    const postsSnapshot = await db.collection('posts').where('userId', '==', 'user-1').get();
    console.log(`\n📚 Posts in main collection: ${postsSnapshot.size}`);
    postsSnapshot.forEach(doc => {
      const post = doc.data();
      console.log(`  - ${doc.id}: "${post.description}"`);
    });

  } catch (error) {
    console.error('❌ Error verifying data:', error);
  }
}

verifyEmmaData()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });