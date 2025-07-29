#!/usr/bin/env node

import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc, collection, Timestamp } from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
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
const storage = getStorage(app)

// Helper function to create placeholder images for Node.js
function createPlaceholderImage(text, width = 400, height = 300, backgroundColor = '#E17373', textColor = '#FFFFFF') {
  // Create a simple SVG as placeholder
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${backgroundColor}"/>
    <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${Math.min(width, height) / 10}" 
          fill="${textColor}" text-anchor="middle" dominant-baseline="middle">
      ${text}
    </text>
  </svg>`
  
  // Return buffer for Node.js
  return Buffer.from(svg, 'utf8')
}

// Upload image buffer to Firebase Storage
async function uploadImage(buffer, path, contentType = 'image/svg+xml') {
  try {
    const storageRef = ref(storage, path)
    const metadata = {
      contentType: contentType,
      customMetadata: {
        uploaded: 'seed-script'
      }
    }
    const snapshot = await uploadBytes(storageRef, buffer, metadata)
    const downloadURL = await getDownloadURL(snapshot.ref)
    console.log(`✓ Uploaded: ${path}`)
    return downloadURL
  } catch (error) {
    console.error(`✗ Failed to upload ${path}:`, error)
    return null
  }
}

// Sample users data with profile pictures
const sampleUsers = [
  {
    id: 'user_1',
    name: 'Emma Chen',
    username: 'emmaexplores',
    bio: 'Coffee enthusiast and weekend adventurer. Always searching for the next great brunch spot!',
    location: 'San Francisco, CA',
    tags: ['Foodie', 'Coffee Lover', 'Local Explorer', 'Photography'],
    ageRange: '26-35',
    influences: 142
  },
  {
    id: 'user_2', 
    name: 'Marcus Rivera',
    username: 'marcusadventures',
    bio: 'Outdoor enthusiast and travel blogger. Living for those hidden gem discoveries!',
    location: 'Austin, TX',
    tags: ['Adventurer', 'Nature Enthusiast', 'Travel Blogger', 'Hidden Gem Hunter'],
    ageRange: '26-35',
    influences: 203
  },
  {
    id: 'user_3',
    name: 'Sophia Park',
    username: 'sophiastyle',
    bio: 'Art curator and culture lover. Finding beauty in galleries, markets, and cozy bookshops.',
    location: 'New York, NY',
    tags: ['Art Aficionado', 'Culture Lover', 'Bookworm', 'Trendsetter'],
    ageRange: '36-45',
    influences: 89
  },
  {
    id: 'user_4',
    name: 'David Thompson',
    username: 'davidfinds',
    bio: 'Local historian and food critic. Passionate about preserving neighborhood character.',
    location: 'Chicago, IL',
    tags: ['Local Expert', 'Foodie', 'History Buff', 'Community Builder'],
    ageRange: '46-55',
    influences: 167
  },
  {
    id: 'user_5',
    name: 'Maya Patel',
    username: 'mayawanders',
    bio: 'Tech professional by day, sunset chaser by evening. Love rooftop bars and scenic drives.',
    location: 'Seattle, WA',
    tags: ['Photography', 'Night Owl', 'Tech Professional', 'Scenic Explorer'],
    ageRange: '26-35',
    influences: 94
  }
]

// Sample places data with images
const samplePlaces = [
  {
    id: 'place_1',
    name: 'Blue Bottle Coffee',
    address: '66 Mint St, San Francisco, CA 94103',
    category: 'Coffee Shops',
    tags: ['artisan coffee', 'minimal design', 'specialty roasts'],
    description: 'Third-wave coffee pioneer with exceptional single-origin beans and minimalist aesthetic.',
    savedCount: 234
  },
  {
    id: 'place_2',
    name: 'Golden Gate Park',
    address: 'Golden Gate Park, San Francisco, CA',
    category: 'Parks & Nature',
    tags: ['outdoor activities', 'gardens', 'museums', 'family-friendly'],
    description: 'Expansive urban park with gardens, museums, and endless exploration opportunities.',
    savedCount: 892
  },
  {
    id: 'place_3',
    name: 'The High Line',
    address: 'New York, NY 10011',
    category: 'Parks & Nature',
    tags: ['elevated park', 'art installations', 'city views', 'photography'],
    description: 'Elevated linear park built on former railway tracks with stunning city views.',
    savedCount: 1247
  },
  {
    id: 'place_4',
    name: 'Pike Place Market',
    address: '85 Pike St, Seattle, WA 98101',
    category: 'Markets',
    tags: ['fresh seafood', 'local vendors', 'tourist attraction', 'historic'],
    description: 'Historic market with fresh seafood, local produce, and artisan crafts.',
    savedCount: 678
  },
  {
    id: 'place_5',
    name: 'Art Institute of Chicago',
    address: '111 S Michigan Ave, Chicago, IL 60603',
    category: 'Museums',
    tags: ['fine art', 'impressionist collection', 'cultural institution'],
    description: 'World-renowned art museum with extensive collections spanning centuries.',
    savedCount: 445
  }
]

// Sample lists data with cover images
const sampleLists = [
  {
    id: 'list_1',
    name: 'SF Coffee Crawl',
    description: 'The ultimate guide to San Francisco\'s best coffee shops and roasters.',
    userId: 'user_1',
    tags: ['coffee', 'san francisco', 'cafes'],
    privacy: 'public',
    isPublic: true,
    likes: 67,
    places: ['place_1']
  },
  {
    id: 'list_2',
    name: 'Urban Oases',
    description: 'Peaceful green spaces in the heart of busy cities.',
    userId: 'user_2',
    tags: ['parks', 'nature', 'urban planning'],
    privacy: 'public',
    isPublic: true,
    likes: 143,
    places: ['place_2', 'place_3']
  },
  {
    id: 'list_3',
    name: 'Art & Culture Tour',
    description: 'Must-visit cultural institutions and artistic experiences.',
    userId: 'user_3',
    tags: ['art', 'museums', 'culture'],
    privacy: 'public',
    isPublic: true,
    likes: 89,
    places: ['place_5']
  },
  {
    id: 'list_4',
    name: 'Local Markets & Food',
    description: 'Authentic local markets and food experiences across the country.',
    userId: 'user_4',
    tags: ['markets', 'food', 'local culture'],
    privacy: 'public',
    isPublic: true,
    likes: 156,
    places: ['place_4']
  }
]

// Main seeding function
async function seedWithImages() {
  try {
    console.log('🌱 Starting seed data creation with images...')
    
    // 1. Create and upload profile pictures
    console.log('\n📸 Creating profile pictures...')
    for (const user of sampleUsers) {
      const profileImage = createPlaceholderImage(
        user.name.split(' ').map(n => n[0]).join(''),
        200, 200, '#E17373', '#FFFFFF'
      )
      
      const profileUrl = await uploadImage(
        profileImage, 
        `seed-data/profiles/${user.username}_profile.svg`
      )
      
      if (profileUrl) {
        user.avatar = profileUrl
      }
    }
    
    // 2. Create and upload place images
    console.log('\n🏞️ Creating place images...')
    for (const place of samplePlaces) {
      const placeImage = createPlaceholderImage(
        place.name,
        600, 400, '#8B5A3C', '#FFFFFF'
      )
      
      const placeUrl = await uploadImage(
        placeImage,
        `seed-data/places/${place.id}_main.svg`
      )
      
      if (placeUrl) {
        place.hubImage = placeUrl
      }
    }
    
    // 3. Create and upload list cover images
    console.log('\n📋 Creating list cover images...')
    for (const list of sampleLists) {
      const listImage = createPlaceholderImage(
        list.name,
        800, 300, '#A16B5C', '#FFFFFF'
      )
      
      const listUrl = await uploadImage(
        listImage,
        `seed-data/lists/${list.id}_cover.svg`
      )
      
      if (listUrl) {
        list.coverImage = listUrl
      }
    }
    
    // 4. Upload users to Firestore
    console.log('\n👥 Uploading users to Firestore...')
    for (const user of sampleUsers) {
      try {
        const userData = {
          id: user.id,
          name: user.name,
          username: user.username,
          bio: user.bio,
          location: user.location,
          tags: user.tags,
          ageRange: user.ageRange,
          influences: user.influences,
          avatar: user.avatar || '',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          email: `${user.username}@example.com`
        }
        
        await setDoc(doc(db, 'users', user.id), userData)
        console.log(`✓ Created user: ${user.name}`)
      } catch (error) {
        console.error(`❌ Failed to create user ${user.name}:`, error.message)
        throw error
      }
    }
    
    // 5. Upload places to Firestore  
    console.log('\n🏢 Uploading places to Firestore...')
    for (const place of samplePlaces) {
      const placeData = {
        ...place,
        createdAt: Timestamp.now(),
        coordinates: {
          lat: 37.7749 + (Math.random() - 0.5) * 0.1, // Random coords near SF
          lng: -122.4194 + (Math.random() - 0.5) * 0.1
        },
        posts: []
      }
      
      await setDoc(doc(db, 'places', place.id), placeData)
      console.log(`✓ Created place: ${place.name}`)
    }
    
    // 6. Upload lists to Firestore
    console.log('\n📝 Uploading lists to Firestore...')
    for (const list of sampleLists) {
      const listData = {
        ...list,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        isShared: false,
        isLiked: false,
        hubs: list.places.map(placeId => {
          const place = samplePlaces.find(p => p.id === placeId)
          return {
            id: placeId,
            place: place
          }
        })
      }
      
      await setDoc(doc(db, 'lists', list.id), listData)
      console.log(`✓ Created list: ${list.name}`)
    }
    
    // 7. Create sample user preferences
    console.log('\n⚙️ Creating user preferences...')
    for (const user of sampleUsers) {
      const preferences = {
        favoriteCategories: user.tags.slice(0, 3).map(tag => tag.toLowerCase()),
        preferredPriceRange: ['$', '$$'],
        socialPreferences: {
          exploreNew: 0.7,
          followFriends: 0.6,
          trendingContent: 0.4
        },
        locationPreferences: {
          nearbyRadius: 10,
          preferredAreas: [user.location]
        },
        interactionHistory: {
          savedPlaces: [],
          likedPosts: [],
          visitedLists: [],
          searchHistory: []
        },
        updatedAt: Timestamp.now()
      }
      
      await setDoc(doc(db, 'userPreferences', user.id), preferences)
      console.log(`✓ Created preferences for: ${user.name}`)
    }
    
    console.log('\n🎉 Seed data with images created successfully!')
    console.log('\n📊 Summary:')
    console.log(`   • ${sampleUsers.length} users with profile pictures`)
    console.log(`   • ${samplePlaces.length} places with images`)
    console.log(`   • ${sampleLists.length} lists with cover images`)
    console.log(`   • User preferences for all users`)
    console.log('\n✨ Your app now has rich sample data with real images!')
    
  } catch (error) {
    console.error('❌ Error seeding data:', error)
    process.exit(1)
  }
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith('seed-with-images.js')) {
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
  } else {
    console.log('⚠️  No .env.local file found. Make sure Firebase config is set in environment.')
  }
  
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
    console.error('Please make sure your .env.local file contains all Firebase configuration.')
    process.exit(1)
  }
  
  console.log('✓ All required environment variables found')
  
  seedWithImages()
    .then(() => {
      console.log('\n🚀 Ready to test your enhanced app!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Failed to seed data:', error)
      console.error('Error details:', error.message)
      process.exit(1)
    })
}

export { seedWithImages } 