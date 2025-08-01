import { initializeApp } from 'firebase/app'
import { getFirestore, collection, doc, setDoc, getDocs, query, where } from 'firebase/firestore'
import fs from 'fs'

// Load environment variables
const envContent = fs.readFileSync('.env.local', 'utf8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=')
  if (key && value) envVars[key.trim()] = value.trim()
})

const firebaseConfig = {
  apiKey: envVars.VITE_FIREBASE_API_KEY,
  authDomain: envVars.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: envVars.VITE_FIREBASE_PROJECT_ID,
  storageBucket: envVars.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envVars.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: envVars.VITE_FIREBASE_APP_ID
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

// Curated list templates
const LIST_TEMPLATES = [
  {
    id: 'sf-coffee-crawl-real',
    name: 'SF Coffee Crawl',
    description: 'The ultimate guide to San Francisco\'s best coffee shops and cafes',
    tags: ['coffee', 'san francisco', 'local favorites'],
    category: 'coffee',
    filterTags: ['coffee']
  },
  {
    id: 'sf-foodie-favorites',
    name: 'SF Foodie Favorites',
    description: 'Must-try restaurants and eateries across San Francisco',
    tags: ['food', 'restaurants', 'san francisco'],
    category: 'food',
    filterTags: ['food', 'dining']
  },
  {
    id: 'sf-tourist-attractions',
    name: 'SF Must-See Attractions',
    description: 'Essential tourist spots and landmarks in San Francisco',
    tags: ['tourist', 'attractions', 'san francisco'],
    category: 'attractions',
    filterTags: ['popular', 'must-visit']
  },
  {
    id: 'bay-area-parks',
    name: 'Bay Area Parks & Nature',
    description: 'Beautiful parks and outdoor spaces around the Bay Area',
    tags: ['nature', 'parks', 'outdoor', 'bay area'],
    category: 'nature',
    filterTags: ['nature', 'outdoor']
  },
  {
    id: 'sf-nightlife-guide',
    name: 'SF Nightlife Guide',
    description: 'Best bars, clubs, and nightlife spots in San Francisco',
    tags: ['nightlife', 'bars', 'san francisco'],
    category: 'nightlife',
    filterTags: ['drinks', 'social']
  },
  {
    id: 'sf-museums-culture',
    name: 'SF Museums & Culture',
    description: 'Cultural attractions and museums in San Francisco',
    tags: ['culture', 'museums', 'san francisco'],
    category: 'culture',
    filterTags: ['culture', 'educational']
  },
  {
    id: 'east-bay-eats',
    name: 'East Bay Eats',
    description: 'Great restaurants and cafes in Oakland and Berkeley',
    tags: ['food', 'east bay', 'oakland', 'berkeley'],
    category: 'food',
    filterTags: ['food', 'dining']
  },
  {
    id: 'budget-friendly-sf',
    name: 'Budget-Friendly SF',
    description: 'Amazing experiences in SF that won\'t break the bank',
    tags: ['budget', 'affordable', 'san francisco'],
    category: 'budget',
    filterTags: ['budget-friendly', 'affordable']
  },
  {
    id: 'luxury-sf-experiences',
    name: 'Luxury SF Experiences',
    description: 'High-end dining, shopping, and experiences in San Francisco',
    tags: ['luxury', 'upscale', 'san francisco'],
    category: 'luxury',
    filterTags: ['upscale', 'luxury']
  },
  {
    id: 'highly-rated-gems',
    name: 'Highly Rated Hidden Gems',
    description: 'Top-rated places that locals love across the Bay Area',
    tags: ['highly-rated', 'hidden gems', 'local favorites'],
    category: 'gems',
    filterTags: ['highly-rated', 'excellent']
  }
]

async function getPlacesByTags(tags, limit = 8) {
  try {
    const placesRef = collection(db, 'places')
    const places = []
    
    for (const tag of tags) {
      const q = query(
        placesRef,
        where('tags', 'array-contains', tag)
      )
      const snapshot = await getDocs(q)
      
      snapshot.docs.forEach(doc => {
        const place = { id: doc.id, ...doc.data() }
        // Avoid duplicates
        if (!places.find(p => p.id === place.id)) {
          places.push(place)
        }
      })
    }
    
    // Sort by rating and return limited results
    return places
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, limit)
  } catch (error) {
    console.error('Error getting places by tags:', error)
    return []
  }
}

function generateListCoverImage(places) {
  // Use the first place's image, or a category-based default
  if (places.length > 0 && places[0].hubImage) {
    return places[0].hubImage
  }
  
  // Fallback to category-specific images
  const categoryImages = {
    coffee: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop',
    food: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop',
    attractions: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
    nature: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=300&fit=crop',
    nightlife: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400&h=300&fit=crop',
    culture: 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=400&h=300&fit=crop'
  }
  
  return categoryImages.food // Default fallback
}

async function populateRealLists() {
  console.log('📋 Starting to populate curated lists with real hub data...')
  
  let totalLists = 0
  
  for (const template of LIST_TEMPLATES) {
    console.log(`📝 Creating list: ${template.name}`)
    
    try {
      // Get places that match the list's criteria
      const places = await getPlacesByTags(template.filterTags, 8)
      
      if (places.length === 0) {
        console.log(`  ⚠️  No places found for ${template.name}, skipping...`)
        continue
      }
      
      // Convert places to list format (simplified)
      const hubs = places.map(place => ({
        id: place.id,
        name: place.name,
        address: place.address,
        tags: place.tags,
        hubImage: place.hubImage,
        category: place.category,
        rating: place.rating,
        description: place.description
      }))
      
      // Create the list object
      const listData = {
        id: template.id,
        name: template.name,
        description: template.description,
        userId: 'system', // System-generated list
        isPublic: true,
        isShared: false,
        privacy: 'public',
        tags: template.tags,
        hubs: hubs,
        coverImage: generateListCoverImage(places),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        likes: Math.floor(Math.random() * 50) + 20, // Random likes between 20-70
        isLiked: false,
        isCurated: true,
        isFromRealData: true,
        category: template.category
      }
      
      // Save to Firestore
      await setDoc(doc(db, 'lists', template.id), listData)
      console.log(`  ✅ Created "${template.name}" with ${hubs.length} places`)
      totalLists++
      
    } catch (error) {
      console.error(`  ❌ Error creating ${template.name}:`, error.message)
    }
  }
  
  console.log(`🎉 Successfully created ${totalLists} curated lists with real data!`)
}

// Run the population script
populateRealLists().catch(console.error) 