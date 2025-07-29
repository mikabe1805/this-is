/**
 * Browser-based data seeding for "this-is" app
 * Uses Firebase client SDK instead of Admin SDK for easier setup
 */

import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc,
  Timestamp 
} from 'firebase/firestore'
import { db } from '../firebase/config'

// Same data generators as the Node.js script, but adapted for browser
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

// Helper functions
const randomItem = <T>(array: T[]): T => array[Math.floor(Math.random() * array.length)]
const randomItems = <T>(array: T[], count: number): T[] => {
  const shuffled = [...array].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, Math.min(count, array.length))
}
const randomNumber = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min
const randomId = (): string => Math.random().toString(36).substr(2, 9)

// Data generators
function generateUsers(count = 15) {
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
      createdAt: Timestamp.fromDate(
        new Date(Date.now() - randomNumber(0, 365 * 24 * 60 * 60 * 1000))
      ),
      updatedAt: Timestamp.now(),
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

function generatePlaces(count = 75) {
  const places = []
  const placeIds = []

  for (let i = 0; i < count; i++) {
    const category = randomItem(categories)
    const location = randomItem(locations)
    const placeId = `place_${randomId()}`
    
    placeIds.push(placeId)
    
    const name = generatePlaceName(category)
    
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
      averageRating: Math.round((Math.random() * 2 + 3) * 10) / 10,
      createdAt: Timestamp.fromDate(
        new Date(Date.now() - randomNumber(0, 730 * 24 * 60 * 60 * 1000))
      ),
      updatedAt: Timestamp.now(),
      createdBy: `user_${randomId()}`,
      isVerified: Math.random() > 0.7
    })
  }
  
  return { places, placeIds }
}

function generatePlaceName(category: string): string {
  const placeNames: Record<string, string[]> = {
    coffee: ['Blue Bottle', 'Ritual Coffee', 'Philz Coffee', 'Sightglass', 'Four Barrel', 'Stumptown'],
    restaurant: ['Flour + Water', 'State Bird Provisions', 'Tartine', 'Zuni Cafe', 'Swan Oyster Depot'],
    bar: ['Smugglers Cove', 'The Alembic', 'Trick Dog', 'Tommy\'s Mexican', 'Blackbird'],
    cafe: ['Jane on Fillmore', 'Cafe Zoetrope', 'Reveille Coffee', 'The Mill', 'Cafe Réveille'],
    bakery: ['Tartine Bakery', 'Arizmendi', 'Acme Bread', 'La Boulangerie', 'Noe Valley Bakery']
  }
  
  const nameOptions = placeNames[category] || [`The ${category.charAt(0).toUpperCase() + category.slice(1)}`]
  const baseName = randomItem(nameOptions)
  return Math.random() > 0.7 ? `${baseName} ${randomItem(['Co.', 'House', 'Collective', 'Studio', '& Co'])}` : baseName
}

function generateAddress(location: any): string {
  const streetNumbers = randomNumber(100, 3999)
  const streets = ['Street', 'Avenue', 'Boulevard', 'Drive', 'Way', 'Lane']
  const streetNames = ['Mission', 'Valencia', 'Market', 'Castro', 'Haight', 'Fillmore', 'Union', 'Lombard']
  
  return `${streetNumbers} ${randomItem(streetNames)} ${randomItem(streets)}, San Francisco, CA`
}

function generatePlaceDescription(category: string): string {
  const descriptions: Record<string, string[]> = {
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

function generateLists(userIds: string[], placeIds: string[], count = 30) {
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
      createdAt: Timestamp.fromDate(
        new Date(Date.now() - randomNumber(0, 365 * 24 * 60 * 60 * 1000))
      ),
      updatedAt: Timestamp.now(),
      isShared: Math.random() > 0.7,
      collaborators: Math.random() > 0.8 ? randomItems(userIds, randomNumber(1, 3)) : []
    })
  }
  
  return { lists, listIds }
}

function generateListDescription(name: string): string {
  const templates = [
    `My curated collection of the best spots for ${name.toLowerCase()}`,
    `Hand-picked places that never disappoint`,
    `These places have become my go-to recommendations`,
    `A carefully crafted list of my favorite discoveries`,
    `Places that always deliver on quality and vibes`
  ]
  return randomItem(templates)
}

function generatePosts(userIds: string[], placeIds: string[], listIds: string[], count = 100) {
  const posts = []

  for (let i = 0; i < count; i++) {
    const userId = randomItem(userIds)
    const placeId = randomItem(placeIds)
    const postId = `post_${randomId()}`
    
    // Create base post object
    const basePost = {
      id: postId,
      hubId: placeId,
      userId,
      username: `user_${randomId()}`,
      userAvatar: `https://images.unsplash.com/photo-${randomNumber(1500000000000, 1600000000000)}?w=150&h=150&fit=crop&crop=face`,
      images: generatePostImages(),
      description: generatePostDescription(),
      postType: randomItem(['loved', 'tried', 'want']),
      privacy: randomItem(['public', 'friends', 'private']),
      likes: randomNumber(0, 150),
      likedBy: randomItems(userIds, randomNumber(0, 10)),
      comments: [],
      location: {
        lat: randomItem(locations).lat + (Math.random() - 0.5) * 0.01,
        lng: randomItem(locations).lng + (Math.random() - 0.5) * 0.01
      },
      createdAt: Timestamp.fromDate(
        new Date(Date.now() - randomNumber(0, 180 * 24 * 60 * 60 * 1000))
      ),
      tags: randomItems(tags, randomNumber(1, 4))
    }

    // Add optional fields only if they have values
    if (Math.random() > 0.5) {
      basePost.triedRating = randomItem(['liked', 'neutral', 'disliked'])
    }
    
    // Only add listId if we want this post to be associated with a list (30% chance)
    if (Math.random() > 0.7) {
      basePost.listId = randomItem(listIds) // Use existing list IDs instead of generating new ones
    }

    posts.push(basePost)
  }
  
  return posts
}

function generatePostImages(): string[] {
  const count = randomNumber(1, 4)
  const images = []
  
  for (let i = 0; i < count; i++) {
    images.push(`https://images.unsplash.com/photo-${randomNumber(1500000000000, 1600000000000)}?w=800&h=800&fit=crop`)
  }
  
  return images
}

function generatePostDescription(): string {
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

// Seeding functions
export async function clearDatabase() {
  console.log('🗑️  Clearing existing data...')
  
  const collections = ['users', 'places', 'lists', 'posts', 'userPreferences']
  
  for (const collectionName of collections) {
    try {
      const snapshot = await getDocs(collection(db, collectionName))
      const deletePromises = snapshot.docs.map(docSnapshot => deleteDoc(docSnapshot.ref))
      await Promise.all(deletePromises)
      console.log(`   Cleared ${snapshot.docs.length} documents from ${collectionName}`)
    } catch (error) {
      console.log(`   Error clearing ${collectionName}:`, error)
    }
  }
}

export async function seedDatabase() {
  console.log('🌱 Starting database seeding...')
  
  try {
    // Generate data
    const { users, userIds } = generateUsers(15)
    const { places, placeIds } = generatePlaces(75)
    const { lists, listIds } = generateLists(userIds, placeIds, 30)
    const posts = generatePosts(userIds, placeIds, listIds, 100)
    
    // Seed users
    console.log('👥 Seeding users...')
    for (const user of users) {
      await setDoc(doc(db, 'users', user.id), user)
    }
    console.log(`✅ Seeded ${users.length} users`)
    
    // Seed places
    console.log('🏢 Seeding places...')
    for (const place of places) {
      await setDoc(doc(db, 'places', place.id), place)
    }
    console.log(`✅ Seeded ${places.length} places`)
    
    // Seed lists
    console.log('📝 Seeding lists...')
    for (const list of lists) {
      await setDoc(doc(db, 'lists', list.id), list)
    }
    console.log(`✅ Seeded ${lists.length} lists`)
    
    // Seed posts
    console.log('📸 Seeding posts...')
    for (const post of posts) {
      await setDoc(doc(db, 'posts', post.id), post)
    }
    console.log(`✅ Seeded ${posts.length} posts`)
    
    // Generate user preferences
    console.log('⚙️  Generating user preferences...')
    for (const userId of userIds) {
      const preferences = {
        favoriteCategories: randomItems(categories, randomNumber(2, 5)),
        preferredPriceRange: randomItems(priceRanges, randomNumber(1, 3)),
        socialPreferences: {
          exploreNew: Math.round((Math.random() * 0.8 + 0.2) * 100) / 100,
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
        updatedAt: Timestamp.now()
      }
      
      await setDoc(doc(db, 'userPreferences', userId), preferences)
    }
    console.log(`✅ Generated user preferences for ${userIds.length} users`)
    
    console.log('\n🎉 Database seeding completed successfully!')
    console.log('\n📈 Summary:')
    console.log(`   👥 Users: ${users.length}`)
    console.log(`   🏢 Places: ${places.length}`)
    console.log(`   📝 Lists: ${lists.length}`)
    console.log(`   📸 Posts: ${posts.length}`)
    console.log(`   ⚙️  Preferences: Generated`)
    
    console.log('\n✨ Your intelligent search system is now ready to test!')
    return true
    
  } catch (error) {
    console.error('❌ Error seeding database:', error)
    return false
  }
}

function generateSearchHistory(): string[] {
  const searchTerms = [
    'coffee', 'brunch', 'date night', 'happy hour', 'rooftop', 'cozy cafe',
    'work friendly', 'late night', 'hidden gems', 'local favorites',
    'vegan food', 'craft cocktails', 'outdoor seating', 'live music'
  ]
  return randomItems(searchTerms, randomNumber(3, 10))
}

// Export for use in components
export const seedingUtils = {
  seedDatabase,
  clearDatabase
} 