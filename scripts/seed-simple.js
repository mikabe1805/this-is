#!/usr/bin/env node

import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

// Simple sample data (no images for now)
const sampleUsers = [
  {
    id: 'user_1',
    name: 'Emma Chen',
    username: 'emmaexplores',
    bio: 'Coffee enthusiast and weekend adventurer.',
    location: 'San Francisco, CA',
    tags: ['Foodie', 'Coffee Lover', 'Local Explorer'],
    ageRange: '26-35',
    influences: 142,
    avatar: 'https://via.placeholder.com/150/E17373/FFFFFF?text=EC'
  },
  {
    id: 'user_2', 
    name: 'Marcus Rivera',
    username: 'marcusadventures',
    bio: 'Outdoor enthusiast and travel blogger.',
    location: 'Austin, TX',
    tags: ['Adventurer', 'Nature Enthusiast', 'Travel Blogger'],
    ageRange: '26-35',
    influences: 203,
    avatar: 'https://via.placeholder.com/150/E17373/FFFFFF?text=MR'
  }
]

const samplePlaces = [
  {
    id: 'place_1',
    name: 'Blue Bottle Coffee',
    address: '66 Mint St, San Francisco, CA 94103',
    category: 'Coffee Shops',
    tags: ['artisan coffee', 'minimal design'],
    savedCount: 234,
    hubImage: 'https://via.placeholder.com/600x400/8B5A3C/FFFFFF?text=Blue+Bottle'
  },
  {
    id: 'place_2',
    name: 'Golden Gate Park',
    address: 'Golden Gate Park, San Francisco, CA',
    category: 'Parks & Nature',
    tags: ['outdoor activities', 'gardens'],
    savedCount: 892,
    hubImage: 'https://via.placeholder.com/600x400/8B5A3C/FFFFFF?text=Golden+Gate'
  }
]

const sampleLists = [
  {
    id: 'list_1',
    name: 'SF Coffee Crawl',
    description: 'The ultimate guide to San Francisco\'s best coffee shops.',
    userId: 'user_1',
    tags: ['coffee', 'san francisco'],
    privacy: 'public',
    isPublic: true,
    likes: 67,
    coverImage: 'https://via.placeholder.com/800x300/A16B5C/FFFFFF?text=SF+Coffee'
  }
]

async function seedSimple() {
  try {
    console.log('🌱 Starting simple seed data creation...')
    
    // Upload users
    console.log('\n👥 Uploading users to Firestore...')
    for (const user of sampleUsers) {
      try {
        // Create clean user data with explicit field types
        const userData = {
          id: String(user.id),
          name: String(user.name),
          username: String(user.username),
          bio: String(user.bio),
          location: String(user.location),
          tags: user.tags.map(tag => String(tag)),
          ageRange: String(user.ageRange),
          influences: Number(user.influences),
          avatar: String(user.avatar),
          email: String(`${user.username}@example.com`),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        }
        
        console.log(`Uploading user ${user.name} with data:`, {
          id: userData.id,
          name: userData.name,
          username: userData.username,
          fieldCount: Object.keys(userData).length
        })
        
        await setDoc(doc(db, 'users', userData.id), userData)
        console.log(`✓ Created user: ${user.name}`)
        
      } catch (error) {
        console.error(`❌ Failed to create user ${user.name}:`, {
          message: error.message,
          code: error.code,
          userData: user
        })
        throw error
      }
    }
    
    // Upload places
    console.log('\n🏢 Uploading places to Firestore...')
    for (const place of samplePlaces) {
      try {
        const placeData = {
          id: String(place.id),
          name: String(place.name),
          address: String(place.address),
          category: String(place.category),
          tags: place.tags.map(tag => String(tag)),
          savedCount: Number(place.savedCount),
          hubImage: String(place.hubImage),
          posts: [],
          coordinates: {
            lat: Number(37.7749),
            lng: Number(-122.4194)
          },
          createdAt: Timestamp.now()
        }
        
        await setDoc(doc(db, 'places', placeData.id), placeData)
        console.log(`✓ Created place: ${place.name}`)
        
      } catch (error) {
        console.error(`❌ Failed to create place ${place.name}:`, error.message)
        throw error
      }
    }
    
    // Upload lists
    console.log('\n📝 Uploading lists to Firestore...')
    for (const list of sampleLists) {
      try {
        const listData = {
          id: String(list.id),
          name: String(list.name),
          description: String(list.description),
          userId: String(list.userId),
          tags: list.tags.map(tag => String(tag)),
          privacy: String(list.privacy),
          isPublic: Boolean(list.isPublic),
          likes: Number(list.likes),
          coverImage: String(list.coverImage),
          isShared: Boolean(false),
          isLiked: Boolean(false),
          hubs: [],
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        }
        
        await setDoc(doc(db, 'lists', listData.id), listData)
        console.log(`✓ Created list: ${list.name}`)
        
      } catch (error) {
        console.error(`❌ Failed to create list ${list.name}:`, error.message)
        throw error
      }
    }
    
    console.log('\n🎉 Simple seed data created successfully!')
    console.log('\n📊 Summary:')
    console.log(`   • ${sampleUsers.length} users`)
    console.log(`   • ${samplePlaces.length} places`)  
    console.log(`   • ${sampleLists.length} lists`)
    
  } catch (error) {
    console.error('❌ Error seeding data:', error)
    process.exit(1)
  }
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith('seed-simple.js')) {
  // Load environment variables
  const envPath = path.join(__dirname, '..', '.env.local')
  
  console.log('🔧 Loading environment variables...')
  
  if (fs.existsSync(envPath)) {
    try {
      const envConfig = fs.readFileSync(envPath, 'utf8')
      const envVars = envConfig.split('\n').filter(line => line.includes('=') && !line.startsWith('#'))
      
      envVars.forEach(line => {
        const [key, ...valueParts] = line.split('=')
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim()
          process.env[key.trim()] = value
        }
      })
      
      console.log('✓ Environment variables loaded')
    } catch (error) {
      console.error('❌ Error loading environment variables:', error)
      process.exit(1)
    }
  }
  
  // Validate required environment variables
  const requiredVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN', 
    'VITE_FIREBASE_PROJECT_ID'
  ]
  
  const missingVars = requiredVars.filter(varName => !process.env[varName])
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars.join(', '))
    process.exit(1)
  }
  
  console.log('✓ Required environment variables found')
  
  seedSimple()
    .then(() => {
      console.log('\n🚀 Ready to test basic functionality!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Failed to seed data:', error)
      console.error('Error details:', error.message)
      process.exit(1)
    })
}

export { seedSimple } 