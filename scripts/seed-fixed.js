#!/usr/bin/env node

import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.local')

if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8')
  const envVars = envConfig.split('\n').filter(line => line.includes('=') && !line.startsWith('#'))
  
  envVars.forEach(line => {
    const [key, ...valueParts] = line.split('=')
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim()
      process.env[key.trim()] = value
    }
  })
}

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const storage = getStorage(app)

// Helper function to validate and clean data
function validateData(data, type) {
  const cleaned = {}
  
  // Clean each field based on expected types
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) {
      continue // Skip undefined/null values
    }
    
    try {
      if (typeof value === 'string') {
        cleaned[key] = value.trim()
      } else if (typeof value === 'number') {
        cleaned[key] = Number(value)
      } else if (typeof value === 'boolean') {
        cleaned[key] = Boolean(value)
      } else if (Array.isArray(value)) {
        // Ensure all array elements are strings
        cleaned[key] = value.map(item => String(item).trim()).filter(item => item.length > 0)
      } else if (value instanceof Date || value?.toDate) {
        // Handle timestamps
        cleaned[key] = value
      } else if (typeof value === 'object') {
        // For objects, validate recursively
        cleaned[key] = validateData(value, 'object')
      } else {
        // Convert other types to string
        cleaned[key] = String(value)
      }
    } catch (error) {
      console.warn(`Warning: Skipping invalid field ${key}:`, error.message)
    }
  }
  
  return cleaned
}

// Create placeholder SVG image
function createPlaceholderSVG(text, width = 400, height = 300, backgroundColor = '#E17373', textColor = '#FFFFFF') {
  const cleanText = String(text).replace(/[<>&"']/g, '') // Sanitize text
  
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${backgroundColor}"/>
    <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${Math.min(width, height) / 8}" 
          fill="${textColor}" text-anchor="middle" dominant-baseline="middle">
      ${cleanText}
    </text>
  </svg>`
}

// Upload image to Storage
async function uploadImage(svgContent, imagePath) {
  try {
    const buffer = Buffer.from(svgContent, 'utf8')
    const storageRef = ref(storage, imagePath)
    
    const metadata = {
      contentType: 'image/svg+xml',
      customMetadata: {
        source: 'seed-script',
        created: new Date().toISOString()
      }
    }
    
    const snapshot = await uploadBytes(storageRef, buffer, metadata)
    const downloadURL = await getDownloadURL(snapshot.ref)
    
    console.log(`  ✓ Uploaded: ${imagePath}`)
    return downloadURL
    
  } catch (error) {
    console.error(`  ❌ Failed to upload ${imagePath}:`, error.message)
    return null
  }
}

// Sample data with proper validation
const sampleUsers = [
  {
    id: 'user-1',
    displayName: 'Emma Chen',
    username: 'emmaexplores',
    bio: 'Coffee enthusiast and weekend adventurer.',
    location: 'San Francisco, CA',
    userTags: ['Foodie', 'Coffee Lover', 'Local Explorer'],
    ageRange: '26-35',
    influences: 142,
    email: 'emmaexplores@example.com'
  },
  {
    id: 'user-2',
    displayName: 'Marcus Rivera', 
    username: 'marcusadventures',
    bio: 'Outdoor enthusiast and travel blogger.',
    location: 'Austin, TX',
    userTags: ['Adventurer', 'Nature Enthusiast', 'Travel Blogger'],
    ageRange: '26-35',
    influences: 203,
    email: 'marcusadventures@example.com'
  },
  {
    id: 'user-3',
    displayName: 'Sophia Kim',
    username: 'sophiastyle',
    bio: 'Fashion blogger and lifestyle enthusiast.',
    location: 'New York, NY',
    userTags: ['Fashion', 'Lifestyle', 'Photography'],
    ageRange: '22-25',
    influences: 89,
    email: 'sophiastyle@example.com'
  }
]

const samplePlaces = [
  {
    id: 'place-1',
    placeName: 'Blue Bottle Coffee',
    address: '66 Mint St, San Francisco, CA 94103',
    category: 'Coffee Shops',
    placeTags: ['artisan coffee', 'minimal design'],
    savedCount: 234
  },
  {
    id: 'place-2',
    placeName: 'Golden Gate Park',
    address: 'Golden Gate Park, San Francisco, CA',
    category: 'Parks & Nature', 
    placeTags: ['outdoor activities', 'gardens'],
    savedCount: 892
  },
  {
    id: 'place-3',
    placeName: 'The High Line',
    address: 'New York, NY 10011',
    category: 'Attractions',
    placeTags: ['urban park', 'walking trail'],
    savedCount: 567
  }
]

const sampleLists = [
  {
    id: 'list-1',
    name: 'SF Coffee Crawl',
    listName: 'SF Coffee Crawl', // Keep for compatibility
    description: 'The ultimate guide to San Francisco\'s best coffee shops.',
    userId: 'user-1',
    tags: ['coffee', 'san francisco'],
    listTags: ['coffee', 'san francisco'], // Keep for compatibility
    privacy: 'public',
    isPublic: true,
    likes: 67,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isLiked: false,
    isShared: false,
    hubs: []
  },
  {
    id: 'list-2', 
    name: 'Austin Adventures',
    listName: 'Austin Adventures', // Keep for compatibility
    description: 'Outdoor activities and hidden gems in Austin.',
    userId: 'user-2',
    tags: ['outdoor', 'austin', 'adventure'],
    listTags: ['outdoor', 'austin', 'adventure'], // Keep for compatibility
    privacy: 'public',
    isPublic: true,
    likes: 43,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isLiked: false,
    isShared: false,
    hubs: []
  }
]

async function seedWithImages() {
  try {
    console.log('🌱 Starting enhanced seed data creation...\n')
    
    // Step 1: Create and upload profile images
    console.log('📸 Creating profile pictures...')
    for (const user of sampleUsers) {
      const initials = user.displayName.split(' ').map(n => n[0]).join('')
      const svgContent = createPlaceholderSVG(initials, 200, 200, '#E17373', '#FFFFFF')
      
      const profileUrl = await uploadImage(
        svgContent,
        `seed-data/profiles/${user.username}_profile.svg`
      )
      
      if (profileUrl) {
        user.profilePicture = profileUrl
      }
    }
    
    // Step 2: Create and upload place images  
    console.log('\n🏞️ Creating place images...')
    for (const place of samplePlaces) {
      const svgContent = createPlaceholderSVG(place.placeName, 600, 400, '#8B5A3C', '#FFFFFF')
      
      const placeUrl = await uploadImage(
        svgContent,
        `seed-data/places/${place.id}_main.svg`
      )
      
      if (placeUrl) {
        place.hubImage = placeUrl
      }
    }
    
    // Step 3: Create and upload list cover images
    console.log('\n📋 Creating list cover images...')
    for (const list of sampleLists) {
      const svgContent = createPlaceholderSVG(list.listName, 800, 300, '#A16B5C', '#FFFFFF')
      
      const listUrl = await uploadImage(
        svgContent,
        `seed-data/lists/${list.id}_cover.svg`
      )
      
      if (listUrl) {
        list.coverImage = listUrl
      }
    }
    
    // Step 4: Upload users to Firestore
    console.log('\n👥 Uploading users to Firestore...')
    for (const user of sampleUsers) {
      try {
        const now = Timestamp.now()
        
        const userData = validateData({
          name: user.displayName,
          username: user.username,
          bio: user.bio,
          location: user.location,
          tags: user.userTags,
          ageRange: user.ageRange,
          influences: user.influences,
          email: user.email,
          avatar: user.profilePicture || '',
          isVerified: false,
          followerCount: 0,
          followingCount: 0,
          createdAt: now,
          updatedAt: now
        }, 'user')
        
        await setDoc(doc(db, 'users', user.id), userData)
        console.log(`  ✓ Created user: ${user.displayName}`)
        
      } catch (error) {
        console.error(`  ❌ Failed to create user ${user.displayName}:`, error.message)
        throw error
      }
    }
    
    // Step 5: Upload places to Firestore
    console.log('\n🏢 Uploading places to Firestore...')
    for (const place of samplePlaces) {
      try {
        const placeData = validateData({
          name: place.placeName,
          address: place.address,
          category: place.category,
          tags: place.placeTags,
          savedCount: place.savedCount,
          hubImage: place.hubImage || '',
          posts: [],
          coordinates: {
            lat: 37.7749,
            lng: -122.4194
          },
          createdAt: Timestamp.now()
        }, 'place')
        
        await setDoc(doc(db, 'places', place.id), placeData)
        console.log(`  ✓ Created place: ${place.placeName}`)
        
      } catch (error) {
        console.error(`  ❌ Failed to create place ${place.placeName}:`, error.message)
        throw error
      }
    }
    
    // Step 6: Upload lists to Firestore  
    console.log('\n📝 Uploading lists to Firestore...')
    for (const list of sampleLists) {
      try {
        const listData = validateData({
          name: list.listName,
          description: list.description,
          userId: list.userId,
          tags: list.listTags,
          privacy: list.privacy,
          isPublic: list.isPublic,
          likes: list.likes,
          coverImage: list.coverImage || '',
          isShared: false,
          isLiked: false,
          hubs: [],
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        }, 'list')
        
        await setDoc(doc(db, 'lists', list.id), listData)
        console.log(`  ✓ Created list: ${list.listName}`)
        
      } catch (error) {
        console.error(`  ❌ Failed to create list ${list.listName}:`, error.message)
        throw error
      }
    }
    
    console.log('\n🎉 Enhanced seed data created successfully!')
    console.log('\n📊 Summary:')
    console.log(`   • ${sampleUsers.length} users with profile pictures`)
    console.log(`   • ${samplePlaces.length} places with hub images`)
    console.log(`   • ${sampleLists.length} lists with cover images`)
    console.log('\n🚀 Ready to test your visual app!')
    
  } catch (error) {
    console.error('❌ Error seeding data:', error)
    process.exit(1)
  }
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith('seed-fixed.js')) {
  // Validate required environment variables
  const requiredVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET'
  ]
  
  const missingVars = requiredVars.filter(varName => !process.env[varName])
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars.join(', '))
    console.error('Please create .env.local with your Firebase configuration.')
    process.exit(1)
  }
  
  seedWithImages()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Failed to seed data:', error.message)
      process.exit(1)
    })
}

export { seedWithImages } 