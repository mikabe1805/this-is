#!/usr/bin/env node

/**
 * Database Seeding Script for "this-is" App
 * 
 * This script populates Firebase with realistic mock data to showcase
 * the intelligent search and discovery algorithms.
 * 
 * Usage:
 *   node scripts/seed-database.js
 * 
 * Requirements:
 *   - Firebase Admin SDK configured
 *   - Environment variables set
 */

const admin = require('firebase-admin')
const fs = require('fs')
const path = require('path')

// Initialize Firebase Admin
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY 
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : null

if (!serviceAccount && !admin.apps.length) {
  console.log('🔐 Using Firebase emulator or default credentials')
  admin.initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'this-is-demo'
  })
} else if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  })
}

const db = admin.firestore()

// ===========================================
// MOCK DATA GENERATORS
// ===========================================

const categories = [
  'coffee', 'restaurant', 'bar', 'cafe', 'bakery', 'museum', 'park', 
  'shopping', 'gym', 'spa', 'bookstore', 'art_gallery', 'theater', 
  'library', 'market', 'boutique', 'brewery', 'wine_bar', 'rooftop'
]

const tags = [
  'cozy', 'modern', 'vintage', 'minimalist', 'rustic', 'elegant', 'casual',
  'trendy', 'authentic', 'local', 'artisanal', 'organic', 'vegan', 'gluten-free',
  'family-friendly', 'date-night', 'work-friendly', 'instagram-worthy', 'hidden-gem',
  'outdoor-seating', 'live-music', 'pet-friendly', 'wheelchair-accessible', 'late-night'
]

const priceRanges = ['$', '$$', '$$$', '$$$$']

const locations = [
  { name: 'Mission District', lat: 37.7599, lng: -122.4148 },
  { name: 'SoMa', lat: 37.7749, lng: -122.4194 },
  { name: 'Castro', lat: 37.7609, lng: -122.4350 },
  { name: 'Haight-Ashbury', lat: 37.7692, lng: -122.4481 },
  { name: 'North Beach', lat: 37.8067, lng: -122.4103 },
  { name: 'Chinatown', lat: 37.7941, lng: -122.4078 },
  { name: 'Financial District', lat: 37.7946, lng: -122.3999 },
  { name: 'Tenderloin', lat: 37.7835, lng: -122.4147 },
  { name: 'Pacific Heights', lat: 37.7930, lng: -122.4347 },
  { name: 'Richmond', lat: 37.7806, lng: -122.4644 }
]

const sampleNames = {
  first: ['Alex', 'Sarah', 'Mike', 'Emma', 'David', 'Lisa', 'Chris', 'Anna', 'James', 'Maria', 
          'Ryan', 'Sophia', 'Ben', 'Olivia', 'Sam', 'Rachel', 'Jordan', 'Taylor', 'Casey', 'Morgan'],
  last: ['Chen', 'Rodriguez', 'Johnson', 'Kim', 'Williams', 'Brown', 'Davis', 'Garcia', 'Miller', 
         'Wilson', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'White', 'Harris']
}

const placeNames = {
  coffee: ['Blue Bottle', 'Ritual Coffee', 'Philz Coffee', 'Sightglass', 'Four Barrel', 'Stumptown'],
  restaurant: ['Flour + Water', 'State Bird Provisions', 'Tartine', 'Zuni Cafe', 'Swan Oyster Depot'],
  bar: ['Smugglers Cove', 'The Alembic', 'Trick Dog', 'Tommy\'s Mexican', 'Blackbird'],
  cafe: ['Jane on Fillmore', 'Cafe Zoetrope', 'Reveille Coffee', 'The Mill', 'Cafe Réveille'],
  bakery: ['Tartine Bakery', 'Arizmendi', 'Acme Bread', 'La Boulangerie', 'Noe Valley Bakery']
}

// Helper functions
const randomItem = (array) => array[Math.floor(Math.random() * array.length)]
const randomItems = (array, count) => {
  const shuffled = [...array].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, Math.min(count, array.length))
}
const randomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const randomId = () => Math.random().toString(36).substr(2, 9)

// ===========================================
// DATA GENERATION FUNCTIONS
// ===========================================

function generateUsers(count = 20) {
  const users = []
  const userIds = []

  for (let i = 0; i < count; i++) {
    const firstName = randomItem(sampleNames.first)
    const lastName = randomItem(sampleNames.last)
    const username = `${firstName.toLowerCase()}_${lastName.toLowerCase()}${i}`
    const userId = `user_${randomId()}`
    
    userIds.push(userId)
    
    users.push({
      id: userId,
      name: `${firstName} ${lastName}`,
      username,
      email: `${username}@example.com`,
      avatar: `https://images.unsplash.com/photo-${randomNumber(1500000000000, 1600000000000)}?w=150&h=150&fit=crop&crop=face`,
      bio: generateUserBio(),
      location: randomItem(locations).name,
      influences: randomNumber(0, 500),
      tags: randomItems(tags, randomNumber(3, 8)),
      createdAt: admin.firestore.Timestamp.fromDate(
        new Date(Date.now() - randomNumber(0, 365 * 24 * 60 * 60 * 1000))
      ),
      updatedAt: admin.firestore.Timestamp.now(),
      settings: {
        privacy: randomItem(['public', 'friends', 'private']),
        notifications: Math.random() > 0.3,
        locationSharing: Math.random() > 0.5
      }
    })
  }
  
  return { users, userIds }
}

function generateUserBio() {
  const interests = randomItems(tags, 3)
  const templates = [
    `Love exploring ${interests[0]} spots and ${interests[1]} vibes`,
    `${interests[0]} enthusiast | Always looking for ${interests[1]} places`,
    `Searching for the best ${interests[0]} and ${interests[1]} experiences`,
    `Local guide for ${interests[0]} spots | ${interests[1]} lover`,
    `Coffee addict & ${interests[0]} explorer`
  ]
  return randomItem(templates)
}

function generatePlaces(count = 100) {
  const places = []
  const placeIds = []

  for (let i = 0; i < count; i++) {
    const category = randomItem(categories)
    const location = randomItem(locations)
    const placeId = `place_${randomId()}`
    
    placeIds.push(placeId)
    
    const nameOptions = placeNames[category] || [`The ${category.charAt(0).toUpperCase() + category.slice(1)}`]
    const baseName = randomItem(nameOptions)
    const name = Math.random() > 0.7 ? `${baseName} ${randomItem(['Co.', 'House', 'Collective', 'Studio', '& Co'])}` : baseName
    
    places.push({
      id: placeId,
      name,
      address: generateAddress(location),
      coordinates: {
        lat: location.lat + (Math.random() - 0.5) * 0.02,
        lng: location.lng + (Math.random() - 0.5) * 0.02
      },
      category,
      tags: randomItems(tags, randomNumber(3, 7)),
      hubImage: `https://images.unsplash.com/photo-${randomNumber(1500000000000, 1600000000000)}?w=800&h=600&fit=crop`,
      description: generatePlaceDescription(category),
      priceRange: randomItem(priceRanges),
      savedCount: randomNumber(5, 200),
      averageRating: Math.round((Math.random() * 2 + 3) * 10) / 10, // 3.0 - 5.0
      createdAt: admin.firestore.Timestamp.fromDate(
        new Date(Date.now() - randomNumber(0, 730 * 24 * 60 * 60 * 1000))
      ),
      updatedAt: admin.firestore.Timestamp.now(),
      createdBy: `user_${randomId()}`, // Will be updated with actual user IDs
      isVerified: Math.random() > 0.7
    })
  }
  
  return { places, placeIds }
}

function generateAddress(location) {
  const streetNumbers = randomNumber(100, 3999)
  const streets = ['Street', 'Avenue', 'Boulevard', 'Drive', 'Way', 'Lane']
  const streetNames = ['Mission', 'Valencia', 'Market', 'Castro', 'Haight', 'Fillmore', 'Union', 'Lombard']
  
  return `${streetNumbers} ${randomItem(streetNames)} ${randomItem(streets)}, San Francisco, CA`
}

function generatePlaceDescription(category) {
  const descriptions = {
    coffee: [
      'Artisanal coffee with locally roasted beans and cozy atmosphere',
      'Third-wave coffee shop with expert baristas and minimal decor',
      'Local favorite for morning coffee and afternoon work sessions'
    ],
    restaurant: [
      'Farm-to-table dining with seasonal ingredients and creative menu',
      'Contemporary cuisine with a focus on local and sustainable ingredients',
      'Innovative dishes that blend traditional flavors with modern techniques'
    ],
    bar: [
      'Craft cocktails in an intimate setting with knowledgeable bartenders',
      'Local hangout with excellent drinks and relaxed atmosphere',
      'Creative mixology and carefully curated spirit selection'
    ]
  }
  
  const defaultDesc = `Great ${category} with excellent service and welcoming atmosphere`
  const options = descriptions[category] || [defaultDesc]
  return randomItem(options)
}

function generateLists(userIds, placeIds, count = 50) {
  const lists = []
  const listIds = []

  for (let i = 0; i < count; i++) {
    const listId = `list_${randomId()}`
    listIds.push(listId)
    
    const themes = [
      'Coffee Spots', 'Date Night', 'Work Friendly', 'Weekend Brunch', 'Hidden Gems',
      'Late Night Eats', 'Rooftop Bars', 'Local Favorites', 'Cozy Cafes', 'Foodie Finds',
      'Happy Hour', 'Sunday Vibes', 'First Date Ideas', 'Group Hangouts', 'Solo Adventures'
    ]
    
    const name = `${randomItem(themes)} in ${randomItem(locations).name}`
    
    lists.push({
      id: listId,
      name,
      description: generateListDescription(name),
      userId: randomItem(userIds),
      privacy: randomItem(['public', 'friends', 'private']),
      tags: randomItems(tags, randomNumber(2, 5)),
      coverImage: `https://images.unsplash.com/photo-${randomNumber(1500000000000, 1600000000000)}?w=800&h=400&fit=crop`,
      likes: randomNumber(0, 100),
      saves: randomNumber(0, 50),
      createdAt: admin.firestore.Timestamp.fromDate(
        new Date(Date.now() - randomNumber(0, 365 * 24 * 60 * 60 * 1000))
      ),
      updatedAt: admin.firestore.Timestamp.now(),
      isShared: Math.random() > 0.7,
      collaborators: Math.random() > 0.8 ? randomItems(userIds, randomNumber(1, 3)) : []
    })
  }
  
  return { lists, listIds }
}

function generateListDescription(name) {
  const templates = [
    `My curated collection of the best spots for ${name.toLowerCase()}`,
    `Hand-picked places that never disappoint`,
    `These places have become my go-to recommendations`,
    `A carefully crafted list of my favorite discoveries`,
    `Places that always deliver on quality and vibes`
  ]
  return randomItem(templates)
}

function generatePosts(userIds, placeIds, count = 200) {
  const posts = []

  for (let i = 0; i < count; i++) {
    const userId = randomItem(userIds)
    const placeId = randomItem(placeIds)
    const postId = `post_${randomId()}`
    
    posts.push({
      id: postId,
      hubId: placeId,
      userId,
      username: `user_${randomId()}`, // Will be updated with actual usernames
      userAvatar: `https://images.unsplash.com/photo-${randomNumber(1500000000000, 1600000000000)}?w=150&h=150&fit=crop&crop=face`,
      images: generatePostImages(),
      description: generatePostDescription(),
      postType: randomItem(['loved', 'tried', 'want']),
      triedRating: Math.random() > 0.5 ? randomItem(['liked', 'neutral', 'disliked']) : undefined,
      privacy: randomItem(['public', 'friends', 'private']),
      listId: Math.random() > 0.7 ? `list_${randomId()}` : undefined,
      likes: randomNumber(0, 150),
      likedBy: randomItems(userIds, randomNumber(0, 10)),
      comments: [],
      location: {
        lat: randomItem(locations).lat + (Math.random() - 0.5) * 0.01,
        lng: randomItem(locations).lng + (Math.random() - 0.5) * 0.01
      },
      createdAt: admin.firestore.Timestamp.fromDate(
        new Date(Date.now() - randomNumber(0, 180 * 24 * 60 * 60 * 1000))
      ),
      tags: randomItems(tags, randomNumber(1, 4))
    })
  }
  
  return posts
}

function generatePostImages() {
  const count = randomNumber(1, 4)
  const images = []
  
  for (let i = 0; i < count; i++) {
    images.push(`https://images.unsplash.com/photo-${randomNumber(1500000000000, 1600000000000)}?w=800&h=800&fit=crop`)
  }
  
  return images
}

function generatePostDescription() {
  const descriptions = [
    'Amazing vibes and even better coffee! Definitely coming back 💕',
    'Found my new favorite spot. The atmosphere is perfect for work',
    'Hidden gem alert! This place exceeded all expectations',
    'Perfect date night spot. Cozy and intimate with incredible food',
    'Love the aesthetic here. Great for photos and even better for hanging out',
    'Local favorite for a reason. Everything about this place is spot on',
    'Can\'t believe I just discovered this place. Where has it been all my life?',
    'Weekend vibes ✨ This place never disappoints',
    'Bringing everyone here from now on. Quality is consistently amazing'
  ]
  return randomItem(descriptions)
}

// ===========================================
// DATABASE SEEDING FUNCTIONS
// ===========================================

async function clearDatabase() {
  console.log('🗑️  Clearing existing data...')
  
  const collections = ['users', 'places', 'lists', 'posts', 'userPreferences', 'analytics']
  
  for (const collectionName of collections) {
    const snapshot = await db.collection(collectionName).get()
    const batch = db.batch()
    
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref)
    })
    
    if (snapshot.docs.length > 0) {
      await batch.commit()
      console.log(`   Cleared ${snapshot.docs.length} documents from ${collectionName}`)
    }
  }
}

async function seedUsers(users) {
  console.log('👥 Seeding users...')
  
  const batch = db.batch()
  let count = 0
  
  for (const user of users) {
    const userRef = db.collection('users').doc(user.id)
    batch.set(userRef, user)
    
    count++
    if (count % 500 === 0) {
      await batch.commit()
      console.log(`   Seeded ${count} users`)
    }
  }
  
  if (count % 500 !== 0) {
    await batch.commit()
  }
  
  console.log(`✅ Seeded ${users.length} users`)
}

async function seedUserRelationships(userIds) {
  console.log('🤝 Creating user relationships...')
  
  const batch = db.batch()
  let operations = 0
  
  for (const userId of userIds) {
    // Create friends (mutual relationships)
    const friendCount = randomNumber(2, 8)
    const friends = randomItems(userIds.filter(id => id !== userId), friendCount)
    
    for (const friendId of friends) {
      // Add friend relationship
      const friendRef = db.collection('users').doc(userId).collection('friends').doc(friendId)
      batch.set(friendRef, {
        friendId,
        addedAt: admin.firestore.Timestamp.fromDate(
          new Date(Date.now() - randomNumber(0, 365 * 24 * 60 * 60 * 1000))
        )
      })
      
      operations++
    }
    
    // Create following relationships
    const followingCount = randomNumber(3, 12)
    const following = randomItems(userIds.filter(id => id !== userId && !friends.includes(id)), followingCount)
    
    for (const followedId of following) {
      const followingRef = db.collection('users').doc(userId).collection('following').doc(followedId)
      batch.set(followingRef, {
        userId: followedId,
        followedAt: admin.firestore.Timestamp.fromDate(
          new Date(Date.now() - randomNumber(0, 365 * 24 * 60 * 60 * 1000))
        )
      })
      
      operations++
    }
    
    if (operations >= 400) {
      await batch.commit()
      operations = 0
    }
  }
  
  if (operations > 0) {
    await batch.commit()
  }
  
  console.log('✅ Created user relationships')
}

async function seedPlaces(places) {
  console.log('🏢 Seeding places...')
  
  const batch = db.batch()
  let count = 0
  
  for (const place of places) {
    const placeRef = db.collection('places').doc(place.id)
    batch.set(placeRef, place)
    
    count++
    if (count % 500 === 0) {
      await batch.commit()
      console.log(`   Seeded ${count} places`)
    }
  }
  
  if (count % 500 !== 0) {
    await batch.commit()
  }
  
  console.log(`✅ Seeded ${places.length} places`)
}

async function seedLists(lists, placeIds) {
  console.log('📝 Seeding lists...')
  
  const batch = db.batch()
  let count = 0
  
  for (const list of lists) {
    const listRef = db.collection('lists').doc(list.id)
    batch.set(listRef, list)
    
    // Add places to list
    const placesToAdd = randomItems(placeIds, randomNumber(3, 12))
    for (const placeId of placesToAdd) {
      const listPlaceRef = listRef.collection('places').doc(placeId)
      batch.set(listPlaceRef, {
        placeId,
        note: Math.random() > 0.6 ? generateListPlaceNote() : null,
        addedBy: list.userId,
        addedAt: admin.firestore.Timestamp.fromDate(
          new Date(Date.now() - randomNumber(0, 180 * 24 * 60 * 60 * 1000))
        )
      })
    }
    
    count++
    if (count % 100 === 0) {
      await batch.commit()
      console.log(`   Seeded ${count} lists`)
    }
  }
  
  if (count % 100 !== 0) {
    await batch.commit()
  }
  
  console.log(`✅ Seeded ${lists.length} lists`)
}

function generateListPlaceNote() {
  const notes = [
    'Must try the specialty coffee!',
    'Perfect for weekend brunch',
    'Great atmosphere for dates',
    'Amazing happy hour deals',
    'Hidden gem - don\'t miss it',
    'Best spot for remote work',
    'Incredible rooftop views',
    'Local favorite for good reason'
  ]
  return randomItem(notes)
}

async function seedPosts(posts) {
  console.log('📸 Seeding posts...')
  
  const batch = db.batch()
  let count = 0
  
  for (const post of posts) {
    const postRef = db.collection('posts').doc(post.id)
    batch.set(postRef, post)
    
    count++
    if (count % 500 === 0) {
      await batch.commit()
      console.log(`   Seeded ${count} posts`)
    }
  }
  
  if (count % 500 !== 0) {
    await batch.commit()
  }
  
  console.log(`✅ Seeded ${posts.length} posts`)
}

async function seedUserPreferences(userIds, placeIds) {
  console.log('⚙️  Generating user preferences...')
  
  const batch = db.batch()
  let count = 0
  
  for (const userId of userIds) {
    const preferencesRef = db.collection('userPreferences').doc(userId)
    
    const preferences = {
      favoriteCategories: randomItems(categories, randomNumber(2, 5)),
      preferredPriceRange: randomItems(priceRanges, randomNumber(1, 3)),
      socialPreferences: {
        exploreNew: Math.round((Math.random() * 0.8 + 0.2) * 100) / 100, // 0.2 - 1.0
        followFriends: Math.round((Math.random() * 0.8 + 0.2) * 100) / 100,
        trendingContent: Math.round((Math.random() * 0.6 + 0.1) * 100) / 100
      },
      locationPreferences: {
        nearbyRadius: randomNumber(5, 25),
        preferredAreas: randomItems(locations, randomNumber(1, 4)).map(l => l.name)
      },
      interactionHistory: {
        savedPlaces: randomItems(placeIds, randomNumber(5, 20)),
        likedPosts: [],
        visitedLists: [],
        searchHistory: generateSearchHistory()
      },
      updatedAt: admin.firestore.Timestamp.now()
    }
    
    batch.set(preferencesRef, preferences)
    
    count++
    if (count % 500 === 0) {
      await batch.commit()
      console.log(`   Generated ${count} user preferences`)
    }
  }
  
  if (count % 500 !== 0) {
    await batch.commit()
  }
  
  console.log(`✅ Generated user preferences for ${userIds.length} users`)
}

function generateSearchHistory() {
  const searchTerms = [
    'coffee', 'brunch', 'date night', 'happy hour', 'rooftop', 'cozy cafe',
    'work friendly', 'late night', 'hidden gems', 'local favorites',
    'vegan food', 'craft cocktails', 'outdoor seating', 'live music'
  ]
  return randomItems(searchTerms, randomNumber(3, 10))
}

async function seedUserInteractions(userIds, placeIds) {
  console.log('📊 Creating user interactions...')
  
  const batch = db.batch()
  let count = 0
  
  for (const userId of userIds) {
    // Create saved places
    const savedPlaces = randomItems(placeIds, randomNumber(3, 15))
    for (const placeId of savedPlaces) {
      const savedRef = db.collection('users').doc(userId).collection('savedPlaces').doc(placeId)
      batch.set(savedRef, {
        placeId,
        savedAt: admin.firestore.Timestamp.fromDate(
          new Date(Date.now() - randomNumber(0, 365 * 24 * 60 * 60 * 1000))
        ),
        status: randomItem(['loved', 'tried', 'want']),
        note: Math.random() > 0.7 ? generateListPlaceNote() : null
      })
      count++
    }
    
    // Create activity log
    const activityCount = randomNumber(10, 30)
    for (let i = 0; i < activityCount; i++) {
      const activityRef = db.collection('users').doc(userId).collection('activity').doc()
      batch.set(activityRef, {
        type: randomItem(['save', 'like', 'post', 'create_list']),
        placeId: Math.random() > 0.5 ? randomItem(placeIds) : null,
        createdAt: admin.firestore.Timestamp.fromDate(
          new Date(Date.now() - randomNumber(0, 90 * 24 * 60 * 60 * 1000))
        )
      })
      count++
    }
    
    if (count >= 400) {
      await batch.commit()
      count = 0
    }
  }
  
  if (count > 0) {
    await batch.commit()
  }
  
  console.log('✅ Created user interactions')
}

// ===========================================
// MAIN SEEDING FUNCTION
// ===========================================

async function seedDatabase() {
  console.log('🌱 Starting database seeding...\n')
  
  try {
    // Step 1: Clear existing data
    await clearDatabase()
    
    // Step 2: Generate mock data
    console.log('\n📊 Generating mock data...')
    const { users, userIds } = generateUsers(25)
    const { places, placeIds } = generatePlaces(150)
    const { lists, listIds } = generateLists(userIds, placeIds, 75)
    const posts = generatePosts(userIds, placeIds, 300)
    
    // Step 3: Seed core data
    await seedUsers(users)
    await seedPlaces(places)
    await seedLists(lists, placeIds)
    await seedPosts(posts)
    
    // Step 4: Create relationships and interactions
    await seedUserRelationships(userIds)
    await seedUserPreferences(userIds, placeIds)
    await seedUserInteractions(userIds, placeIds)
    
    console.log('\n🎉 Database seeding completed successfully!')
    console.log('\n📈 Summary:')
    console.log(`   👥 Users: ${users.length}`)
    console.log(`   🏢 Places: ${places.length}`)
    console.log(`   📝 Lists: ${lists.length}`)
    console.log(`   📸 Posts: ${posts.length}`)
    console.log(`   🤝 Relationships: Created`)
    console.log(`   ⚙️  Preferences: Generated`)
    console.log(`   📊 Interactions: Created`)
    
    console.log('\n✨ Your intelligent search system is now ready to test!')
    
  } catch (error) {
    console.error('❌ Error seeding database:', error)
    process.exit(1)
  }
}

// ===========================================
// SCRIPT EXECUTION
// ===========================================

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Fatal error:', error)
      process.exit(1)
    })
}

module.exports = {
  seedDatabase,
  clearDatabase,
  generateUsers,
  generatePlaces,
  generateLists,
  generatePosts
} 