import { initializeApp } from 'firebase/app'
import { getFirestore, collection, doc, setDoc } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
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
const storage = getStorage(app)

const GOOGLE_MAPS_API_KEY = envVars.VITE_GOOGLE_MAPS_API_KEY

// Real location data from Google Maps API
const SEARCH_QUERIES = [
  // San Francisco
  'popular coffee shops San Francisco',
  'best restaurants San Francisco',
  'tourist attractions San Francisco',
  'parks San Francisco',
  'museums San Francisco',
  'bars nightlife San Francisco',
  'shopping centers San Francisco',
  
  // Oakland
  'coffee shops Oakland CA',
  'restaurants Oakland CA',
  'parks Oakland CA',
  
  // Berkeley
  'cafes Berkeley CA',
  'restaurants Berkeley CA',
  
  // Palo Alto
  'restaurants Palo Alto CA',
  'coffee shops Palo Alto CA',
  
  // San Jose
  'popular restaurants San Jose CA',
  'attractions San Jose CA'
]

async function searchPlaces(query, location = 'San Francisco, CA') {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}&radius=50000&key=${GOOGLE_MAPS_API_KEY}`
    )
    
    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Places API status: ${data.status}`)
    }
    
    return data.results || []
  } catch (error) {
    console.error(`Error searching for "${query}":`, error.message)
    return []
  }
}

async function getPlacePhoto(photoReference, maxWidth = 400) {
  if (!photoReference) return null
  
  try {
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${GOOGLE_MAPS_API_KEY}`
    
    // For this demo, we'll return the URL directly since we can't easily upload external images to Firebase Storage
    // In a production app, you'd want to download and re-upload to your own storage
    return photoUrl
  } catch (error) {
    console.error('Error getting place photo:', error)
    return null
  }
}

function categorizePlace(types) {
  const typeMap = {
    'restaurant': 'Restaurant',
    'cafe': 'Coffee Shop', 
    'coffee_shop': 'Coffee Shop',
    'bar': 'Bar',
    'night_club': 'Nightlife',
    'tourist_attraction': 'Attraction',
    'museum': 'Museum',
    'park': 'Park',
    'shopping_mall': 'Shopping',
    'store': 'Shopping',
    'gym': 'Fitness',
    'spa': 'Wellness',
    'hospital': 'Healthcare',
    'school': 'Education',
    'university': 'Education'
  }
  
  for (const type of types) {
    if (typeMap[type]) {
      return typeMap[type]
    }
  }
  
  return 'Place'
}

function extractTags(place) {
  const tags = []
  
  // Add category-based tags
  if (place.types.includes('restaurant')) tags.push('food', 'dining')
  if (place.types.includes('cafe') || place.types.includes('coffee_shop')) tags.push('coffee', 'cozy')
  if (place.types.includes('bar')) tags.push('drinks', 'social')
  if (place.types.includes('tourist_attraction')) tags.push('popular', 'must-visit')
  if (place.types.includes('park')) tags.push('nature', 'outdoor')
  if (place.types.includes('museum')) tags.push('culture', 'educational')
  if (place.types.includes('shopping_mall') || place.types.includes('store')) tags.push('shopping', 'retail')
  
  // Add rating-based tags
  if (place.rating >= 4.5) tags.push('highly-rated', 'excellent')
  else if (place.rating >= 4.0) tags.push('well-rated', 'quality')
  
  // Add price-based tags
  if (place.price_level === 1) tags.push('budget-friendly', 'affordable')
  else if (place.price_level === 4) tags.push('upscale', 'luxury')
  
  return tags
}

async function populateRealHubs() {
  console.log('🌟 Starting to populate database with real hub data from Google Maps...')
  
  let totalPlaces = 0
  const processedPlaceIds = new Set()
  
  for (const query of SEARCH_QUERIES) {
    console.log(`🔍 Searching for: ${query}`)
    
    const places = await searchPlaces(query)
    console.log(`  Found ${places.length} places`)
    
    for (const place of places.slice(0, 10)) { // Limit to 10 per query to avoid API limits
      // Skip if we've already processed this place
      if (processedPlaceIds.has(place.place_id)) {
        continue
      }
      processedPlaceIds.add(place.place_id)
      
      try {
        // Get place photo if available
        let hubImage = null
        if (place.photos && place.photos.length > 0) {
          hubImage = await getPlacePhoto(place.photos[0].photo_reference)
        }
        
        // Create place object
        const placeData = {
          id: place.place_id,
          name: place.name,
          address: place.formatted_address || `${place.vicinity}`,
          coordinates: {
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng
          },
          category: categorizePlace(place.types),
          tags: extractTags(place),
          hubImage: hubImage,
          posts: [],
          savedCount: Math.floor(Math.random() * 100) + 10, // Random saved count
          createdAt: new Date().toISOString(),
          description: `${place.name} is a popular ${categorizePlace(place.types).toLowerCase()} located in ${place.vicinity || 'the area'}. ${place.rating ? `Rated ${place.rating}/5 by visitors.` : ''}`,
          rating: place.rating || null,
          priceLevel: place.price_level || null,
          googlePlaceId: place.place_id,
          isFromGoogleMaps: true
        }
        
        // Save to Firestore
        await setDoc(doc(db, 'places', place.place_id), placeData)
        console.log(`  ✅ Added: ${place.name}`)
        totalPlaces++
        
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.error(`  ❌ Error processing ${place.name}:`, error.message)
      }
    }
    
    // Delay between search queries
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  console.log(`🎉 Successfully populated ${totalPlaces} real places from Google Maps!`)
}

// Run the population script
populateRealHubs().catch(console.error) 