import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs } from 'firebase/firestore'
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

console.log('🔍 Checking lists for coffee-related content...')
const listsRef = collection(db, 'lists')
const snapshot = await getDocs(listsRef)

console.log('Total lists found:', snapshot.size)
let coffeeRelated = 0
snapshot.forEach(doc => {
  const data = doc.data()
  const name = data.name || ''
  const desc = data.description || ''
  const tags = data.tags || []
  
  const isCoffeeRelated = name.toLowerCase().includes('coffee') || 
                         desc.toLowerCase().includes('coffee') || 
                         tags.some(tag => tag && tag.toLowerCase().includes('coffee'))
  
  if (isCoffeeRelated || name.toLowerCase().includes('sf')) {
    coffeeRelated++
    console.log('☕ LIST:', name)
    console.log('   Description:', desc.substring(0, 100))
    console.log('   Tags:', tags)
    console.log('   IsPublic:', data.isPublic)
    console.log('   ID:', doc.id)
    console.log('')
  }
})

console.log('Coffee/SF-related lists found:', coffeeRelated)

// Also check places
console.log('\n🏢 Checking places for coffee-related content...')
const placesRef = collection(db, 'places')
const placesSnapshot = await getDocs(placesRef)

console.log('Total places found:', placesSnapshot.size)
let coffeePlaces = 0
placesSnapshot.forEach(doc => {
  const data = doc.data()
  const name = data.name || ''
  const tags = data.tags || []
  
  const isCoffeeRelated = name.toLowerCase().includes('coffee') || 
                         tags.some(tag => tag && tag.toLowerCase().includes('coffee'))
  
  if (isCoffeeRelated) {
    coffeePlaces++
    console.log('☕ PLACE:', name)
    console.log('   Tags:', tags)
    console.log('   Address:', data.address)
    console.log('')
  }
})

console.log('Coffee-related places found:', coffeePlaces) 