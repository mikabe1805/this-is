const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const TEST_USER_EMAIL = 'emma.c@this-is.com';
const TEST_USER_PASSWORD = 'password123';
const TEST_USER_UID = 'user-1'; // Match the UID from your seed data
const TEST_USER_DISPLAY_NAME = 'Emma Chen';
const TEST_USER_AVATAR = 'https://images.unsplash.com/photo-1544005313-94ddf0286de2?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1288&q=80';

// --- INITIALIZATION ---

// Load environment variables from .env if it exists
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

// Find and load the service account key
let serviceAccount;
const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (keyPath) {
    if (fs.existsSync(keyPath)) {
        serviceAccount = require(keyPath);
    } else {
        try {
            // Try parsing it as a JSON string
            serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
        } catch (e) {
            console.error('Could not find or parse the service account key. Please check the FIREBASE_SERVICE_ACCOUNT_KEY path in your .env file.');
            process.exit(1);
        }
    }
} else {
    // Fallback for Vercel/CI environments
try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
} catch (e) {
    console.error('Service account key not found. Please set FIREBASE_SERVICE_ACCOUNT_KEY in .env or FIREBASE_SERVICE_ACCOUNT_JSON as an environment variable.');
    process.exit(1);
}
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
});

const auth = admin.auth();
const db = admin.firestore();

// --- SCRIPT LOGIC ---

async function ensureTestUser() {
  console.log(`Checking for test user: ${TEST_USER_EMAIL}`);

  try {
    // 1. Check if user exists in Firebase Auth
    await auth.getUserByEmail(TEST_USER_EMAIL);
    console.log('✅ Auth user already exists. Updating details to ensure consistency...');

    // If they exist, ensure their UID and other details are correct
    await auth.updateUser(TEST_USER_UID, {
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      displayName: TEST_USER_DISPLAY_NAME,
      photoURL: TEST_USER_AVATAR,
    });

  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.log('User not found. Creating new auth user...');
      // 2. If user does not exist, create them
      await auth.createUser({
        uid: TEST_USER_UID,
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
        displayName: TEST_USER_DISPLAY_NAME,
        photoURL: TEST_USER_AVATAR,
      });
      console.log('✅ New auth user created successfully.');
    } else {
      // Handle other errors
      console.error('Error fetching user:', error);
      process.exit(1);
    }
  }

  // 3. Ensure the corresponding Firestore document exists and is up-to-date
  console.log(`Verifying Firestore document for UID: ${TEST_USER_UID}...`);
  const userRef = db.collection('users').doc(TEST_USER_UID);
  const userDoc = await userRef.get();

  const userData = {
      name: TEST_USER_DISPLAY_NAME,
      username: 'emma.c', // As in seed data
      email: TEST_USER_EMAIL,
      avatar: TEST_USER_AVATAR,
      bio: 'Lover of hidden gems and local coffee shops. Trying to find the best pastries in the world, one city at a time.',
      location: 'San Francisco, CA',
      tags: ['foodie', 'travel', 'coffee', 'art', 'books'],
      influences: 1200, // Example value
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (!userDoc.exists) {
    console.log('Firestore document not found. Creating it...');
    await userRef.set(userData);
    console.log('✅ Firestore user document created.');
  } else {
    console.log('Firestore document exists. Merging data to ensure it is up-to-date...');
    await userRef.set(userData, { merge: true });
    console.log('✅ Firestore user document updated.');
  }

  console.log('\n🎉 Test user setup complete!');
}

ensureTestUser()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ An unexpected error occurred:', error);
    process.exit(1);
  });
