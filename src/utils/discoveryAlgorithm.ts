import type { User, Place, List, Post, Hub } from '../types/index.js'
import type { UserPreferences } from '../services/firebaseDataService'

// ========================================
// USER PREFERENCE ANALYSIS
// ========================================

export interface DiscoveryContext {
  currentUser: User
  userPreferences: UserPreferences
  allUsers: User[]
  allPlaces: Place[]
  allLists: List[]
  allPosts: Post[]
  userInteractions: {
    userId: string
    savedPlaces: string[]
    likedLists: string[]
    visitedPlaces: string[]
    createdLists: string[]
    friendsList: string[]
    following: string[]
  }
  currentLocation?: {
    lat: number
    lng: number
  }
  timeContext: {
    currentTime: Date
    season: 'spring' | 'summer' | 'fall' | 'winter'
    isWeekend: boolean
  }
}

export interface DiscoveryRecommendation {
  item: Place | List
  type: 'place' | 'list'
  score: number
  confidence: number // 0-1: how confident we are in this recommendation
  reasons: string[]
  algorithm: 'collaborative' | 'content_based' | 'hybrid' | 'trending' | 'social' | 'location'
  metadata: {
    expectedPreference: number // predicted user rating 1-5
    similarUsers?: User[]
    relatedItems?: (Place | List)[]
    contextualFactors?: string[]
  }
}

// ========================================
// USER PREFERENCE EXTRACTION
// ========================================

export function analyzeUserPreferences(
  user: User,
  interactions: DiscoveryContext['userInteractions'],
  allPlaces: Place[],
  allLists: List[],
  allPosts: Post[]
): UserPreferences {
  
  const preferences: UserPreferences = {
    favoriteCategories: [],
    preferredPriceRange: [],
    socialPreferences: {
      exploreNew: 0.5,
      followFriends: 0.5,
      trendingContent: 0.5
    },
    locationPreferences: {
      nearbyRadius: 50,
      preferredAreas: []
    },
    interactionHistory: {
      savedPlaces: interactions.savedPlaces || [],
      likedPosts: interactions.likedPosts || [],
      visitedLists: interactions.visitedLists || [],
      searchHistory: []
    }
  }

  // Analyze saved and visited places
  const userPlaces = allPlaces.filter(place => 
    interactions.savedPlaces.includes(place.id) || 
    interactions.visitedPlaces.includes(place.id)
  )

  // Extract place preferences
  const categoryCount: { [key: string]: number } = {}
  
  for (const place of userPlaces) {
    // Category preferences
    if (place.category) {
      categoryCount[place.category] = (categoryCount[place.category] || 0) + 1
    }

    // Tag preferences (add to categories since they're similar)
    const placeTags = Array.isArray(place.tags) ? place.tags : []
    for (const tag of placeTags) {
      if (tag) {
        categoryCount[tag] = (categoryCount[tag] || 0) + 1
      }
    }
  }
  
  // Convert top categories to favoriteCategories array
  preferences.favoriteCategories = Object.entries(categoryCount)
    .sort(([,a], [,b]) => b - a)  // Sort by count desc
    .slice(0, 10)  // Take top 10
    .map(([category]) => category)

  // Analyze user's posts for sentiment and preferences
  const userPosts = allPosts.filter(post => post.userId === user.id)
  for (const post of userPosts) {
    const sentiment = analyzeSentiment(post.description)
    if (sentiment.score > 0.6) { // Positive post
      const place = allPlaces.find(p => p.id === post.hubId)
      if (place) {
        // Add place category and tags to favorites with higher weight
        if (place.category && !preferences.favoriteCategories.includes(place.category)) {
          preferences.favoriteCategories.unshift(place.category)  // Add to front
        }
        
        const placeTags = Array.isArray(place.tags) ? place.tags : []
        for (const tag of placeTags) {
          if (tag && !preferences.favoriteCategories.includes(tag)) {
            preferences.favoriteCategories.push(tag)
          }
        }
      }
    }
  }

  // Trim favoriteCategories to reasonable size
  preferences.favoriteCategories = preferences.favoriteCategories.slice(0, 15)
  
  // Analyze social behavior
  preferences.socialPreferences.exploreNew = calculateExplorationScore(userPlaces, interactions)
  preferences.socialPreferences.followFriends = Math.min(interactions.visitedLists.length / 10, 1.0)
  preferences.socialPreferences.trendingContent = 0.5  // Default value

  // Set location preferences
  if (user.location) {
    preferences.locationPreferences.preferredAreas = [user.location]
  }

  return preferences
}

function analyzeSentiment(text: string): { score: number; words: string[] } {
  const positiveWords = ['love', 'amazing', 'great', 'excellent', 'perfect', 'beautiful', 'fantastic', 'wonderful']
  const negativeWords = ['hate', 'terrible', 'awful', 'bad', 'disappointing', 'worst']
  
  const words = text.toLowerCase().split(/\s+/)
  let score = 0.5 // neutral baseline
  const matchedWords: string[] = []

  for (const word of words) {
    if (positiveWords.includes(word)) {
      score += 0.15
      matchedWords.push(word)
    } else if (negativeWords.includes(word)) {
      score -= 0.15
      matchedWords.push(word)
    }
  }

  return { score: Math.max(0, Math.min(1, score)), words: matchedWords }
}

function determineSocialPattern(
  interactions: DiscoveryContext['userInteractions'],
  allLists: List[]
): UserPreferences['social']['interactionPattern'] {
  const userLists = allLists.filter(list => list.userId === interactions.userId)
  const savedCount = interactions.savedPlaces.length
  const createdCount = interactions.createdLists.length
  const followingCount = interactions.following.length

  if (createdCount > savedCount && userLists.length > 3) return 'curator'
  if (followingCount > 20 && savedCount > createdCount * 3) return 'follower'
  if (savedCount < 5 && createdCount < 2) return 'discoverer'
  return 'mixed'
}

function findSimilarUsers(
  user: User,
  interactions: DiscoveryContext['userInteractions'],
  allPlaces: Place[]
): string[] {
  // This would implement collaborative filtering to find users with similar preferences
  // For now, return empty array - would be implemented with proper user similarity analysis
  return []
}

function calculateExplorationScore(userPlaces: Place[], interactions: DiscoveryContext['userInteractions']): number {
  const uniqueCategories = new Set(userPlaces.map(p => p.category).filter(Boolean))
  const totalPlaces = userPlaces.length
  
  if (totalPlaces === 0) return 0.5
  
  // Higher score = more exploratory (tries different types of places)
  return Math.min(1, uniqueCategories.size / (totalPlaces * 0.3))
}

function calculatePlanningScore(userPosts: Post[], listsCreated: number): number {
  // Analyze post content for planning indicators
  const planningWords = ['planned', 'scheduled', 'organized', 'itinerary', 'agenda']
  const spontaneousWords = ['spontaneous', 'unexpected', 'random', 'impulse', 'just found']
  
  let planningScore = 0.5
  
  for (const post of userPosts) {
    const text = post.description ? post.description.toLowerCase() : ''
    if (planningWords.some(word => text.includes(word))) {
      planningScore += 0.1
    }
    if (spontaneousWords.some(word => text.includes(word))) {
      planningScore -= 0.1
    }
  }

  // Users who create many lists tend to be planners
  if (listsCreated > 5) planningScore += 0.2

  return Math.max(0, Math.min(1, planningScore))
}

// Note: Normalization is now handled by sorting and slicing favoriteCategories array

// ========================================
// RECOMMENDATION ALGORITHMS
// ========================================

export function generateDiscoveryRecommendations(
  context: DiscoveryContext,
  maxRecommendations: number = 20
): DiscoveryRecommendation[] {
  const recommendations: DiscoveryRecommendation[] = []

  // Collaborative Filtering Recommendations
  const collaborativeRecs = generateCollaborativeRecommendations(context)
  recommendations.push(...collaborativeRecs.slice(0, Math.floor(maxRecommendations * 0.3)))

  // Content-Based Recommendations
  const contentRecs = generateContentBasedRecommendations(context)
  recommendations.push(...contentRecs.slice(0, Math.floor(maxRecommendations * 0.3)))

  // Social Recommendations (friends' activities)
  const socialRecs = generateSocialRecommendations(context)
  recommendations.push(...socialRecs.slice(0, Math.floor(maxRecommendations * 0.2)))

  // Location-Based Recommendations
  const locationRecs = generateLocationBasedRecommendations(context)
  recommendations.push(...locationRecs.slice(0, Math.floor(maxRecommendations * 0.1)))

  // Trending Recommendations
  const trendingRecs = generateTrendingRecommendations(context)
  recommendations.push(...trendingRecs.slice(0, Math.floor(maxRecommendations * 0.1)))

  // Sort by score and remove duplicates
  const uniqueRecs = removeDuplicateRecommendations(recommendations)
  return uniqueRecs.sort((a, b) => b.score - a.score).slice(0, maxRecommendations)
}

function generateCollaborativeRecommendations(context: DiscoveryContext): DiscoveryRecommendation[] {
  const recommendations: DiscoveryRecommendation[] = []
  
  // Find users with similar preferences
  const similarUsers = findUsersWithSimilarPreferences(context)
  
  for (const similarUser of similarUsers.slice(0, 10)) {
    // Find places this similar user liked but current user hasn't tried
    const similarUserInteractions = {
      ...context.userInteractions,
      userId: similarUser.user.id
    }
    
    // Get places the similar user saved/visited
    const similarUserPlaces = context.allPlaces.filter(place =>
      similarUserInteractions.savedPlaces?.includes(place.id) ||
      similarUserInteractions.visitedPlaces?.includes(place.id)
    )
    
    for (const place of similarUserPlaces) {
      // Skip if current user already knows this place
      if (context.userInteractions.savedPlaces.includes(place.id) ||
          context.userInteractions.visitedPlaces.includes(place.id)) {
        continue
      }
      
      const score = calculateCollaborativeScore(place, similarUser, context)
      
      recommendations.push({
        item: place,
        type: 'place',
        score,
        confidence: similarUser.similarity * 0.8,
        reasons: [`People with similar taste love this place`, `${similarUser.user.name} saved this`],
        algorithm: 'collaborative',
        metadata: {
          expectedPreference: score / 20, // Convert to 1-5 scale
          similarUsers: [similarUser.user],
          contextualFactors: ['user_similarity']
        }
      })
    }
  }
  
  return recommendations
}

function generateContentBasedRecommendations(context: DiscoveryContext): DiscoveryRecommendation[] {
  const recommendations: DiscoveryRecommendation[] = []
  const { userPreferences } = context
  
  for (const place of context.allPlaces) {
    // Skip places user already knows
    if (context.userInteractions.savedPlaces.includes(place.id) ||
        context.userInteractions.visitedPlaces.includes(place.id)) {
      continue
    }
    
    const score = calculateContentBasedScore(place, userPreferences)
    if (score > 30) { // Only recommend if score is decent
      
      const reasons = generateContentBasedReasons(place, userPreferences)
      
      recommendations.push({
        item: place,
        type: 'place',
        score,
        confidence: Math.min(score / 100, 0.9),
        reasons,
        algorithm: 'content_based',
        metadata: {
          expectedPreference: Math.min(score / 25, 5),
          contextualFactors: ['preference_match']
        }
      })
    }
  }
  
  return recommendations
}

function generateSocialRecommendations(context: DiscoveryContext): DiscoveryRecommendation[] {
  const recommendations: DiscoveryRecommendation[] = []
  
  // Get recent activity from friends
  const friendIds = context.userInteractions.friendsList
  const recentPosts = context.allPosts
    .filter(post => friendIds.includes(post.userId))
    .filter(post => {
      const postDate = new Date(post.createdAt)
      const daysSince = (context.timeContext.currentTime.getTime() - postDate.getTime()) / (1000 * 60 * 60 * 24)
      return daysSince <= 7 // Posts from last week
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  
  for (const post of recentPosts.slice(0, 10)) {
    const place = context.allPlaces.find(p => p.id === post.hubId)
    if (!place) continue
    
    // Skip if user already knows this place
    if (context.userInteractions.savedPlaces.includes(place.id) ||
        context.userInteractions.visitedPlaces.includes(place.id)) {
      continue
    }
    
    const friend = context.allUsers.find(u => u.id === post.userId)
    if (!friend) continue
    
    const sentiment = analyzeSentiment(post.description)
    const score = 40 + (sentiment.score * 30) + (post.likes * 2)
    
    recommendations.push({
      item: place,
      type: 'place',
      score,
      confidence: 0.7,
      reasons: [`${friend.name} recently visited and ${sentiment.score > 0.6 ? 'loved' : 'visited'} this place`],
      algorithm: 'social',
      metadata: {
        expectedPreference: sentiment.score * 5,
        contextualFactors: ['friend_activity', 'recent']
      }
    })
  }
  
  return recommendations
}

function generateLocationBasedRecommendations(context: DiscoveryContext): DiscoveryRecommendation[] {
  const recommendations: DiscoveryRecommendation[] = []
  
  if (!context.currentLocation) return recommendations
  
  // Find places near user's location
  const nearbyPlaces = context.allPlaces.filter(place => {
    if (!place.coordinates) return false
    
    const distance = calculateDistance(
      context.currentLocation!.lat,
      context.currentLocation!.lng,
      place.coordinates.lat,
      place.coordinates.lng
    )
    
    return distance <= 5 // Within 5km
  })
  
  for (const place of nearbyPlaces) {
    // Skip if user already knows this place
    if (context.userInteractions.savedPlaces.includes(place.id) ||
        context.userInteractions.visitedPlaces.includes(place.id)) {
      continue
    }
    
    const distance = calculateDistance(
      context.currentLocation!.lat,
      context.currentLocation!.lng,
      place.coordinates!.lat,
      place.coordinates!.lng
    )
    
    const proximityScore = Math.max(0, 50 - (distance * 10)) // Closer = higher score
    const popularityScore = (place.savedCount || 0) * 0.5
    const score = proximityScore + popularityScore
    
    recommendations.push({
      item: place,
      type: 'place',
      score,
      confidence: 0.6,
      reasons: [`Only ${distance.toFixed(1)}km away`, 'Popular in your area'],
      algorithm: 'location',
      metadata: {
        expectedPreference: 3.5,
        contextualFactors: ['proximity', 'local_popularity']
      }
    })
  }
  
  return recommendations
}

function generateTrendingRecommendations(context: DiscoveryContext): DiscoveryRecommendation[] {
  const recommendations: DiscoveryRecommendation[] = []
  
  // Calculate trending score for places based on recent activity
  const placeTrendingScores = new Map<string, number>()
  
  const recentPosts = context.allPosts.filter(post => {
    const postDate = new Date(post.createdAt)
    const daysSince = (context.timeContext.currentTime.getTime() - postDate.getTime()) / (1000 * 60 * 60 * 24)
    return daysSince <= 14 // Last 2 weeks
  })
  
  for (const post of recentPosts) {
    const currentScore = placeTrendingScores.get(post.hubId) || 0
    const postAge = (context.timeContext.currentTime.getTime() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    const ageMultiplier = Math.max(0.1, 1 - (postAge / 14)) // More recent = higher multiplier
    
    placeTrendingScores.set(post.hubId, currentScore + (post.likes * ageMultiplier))
  }
  
  // Convert to recommendations
  for (const [placeId, trendingScore] of placeTrendingScores.entries()) {
    if (trendingScore < 5) continue // Minimum threshold
    
    const place = context.allPlaces.find(p => p.id === placeId)
    if (!place) continue
    
    // Skip if user already knows this place
    if (context.userInteractions.savedPlaces.includes(place.id) ||
        context.userInteractions.visitedPlaces.includes(place.id)) {
      continue
    }
    
    recommendations.push({
      item: place,
      type: 'place',
      score: 35 + trendingScore,
      confidence: 0.65,
      reasons: ['Trending right now', 'Getting lots of attention'],
      algorithm: 'trending',
      metadata: {
        expectedPreference: 3.8,
        contextualFactors: ['trending', 'recent_activity']
      }
    })
  }
  
  return recommendations
}

// ========================================
// HELPER FUNCTIONS
// ========================================

interface SimilarUser {
  user: User
  similarity: number
}

function findUsersWithSimilarPreferences(context: DiscoveryContext): SimilarUser[] {
  const similarUsers: SimilarUser[] = []
  const currentUserPrefs = context.userPreferences
  
  for (const user of context.allUsers) {
    if (user.id === context.currentUser.id) continue
    
    // Calculate user similarity (simplified version)
    let similarity = 0
    
    // Tag similarity
    if (user.tags && context.currentUser.tags) {
      const commonTags = user.tags.filter(tag => context.currentUser.tags!.includes(tag))
      similarity += commonTags.length * 0.1
    }
    
    // You would expand this with more sophisticated similarity calculations
    
    if (similarity > 0.3) {
      similarUsers.push({ user, similarity })
    }
  }
  
  return similarUsers.sort((a, b) => b.similarity - a.similarity)
}

function calculateCollaborativeScore(
  place: Place,
  similarUser: SimilarUser,
  context: DiscoveryContext
): number {
  let score = 40 * similarUser.similarity
  
  // Bonus for highly rated places
  score += (place.savedCount || 0) * 0.3
  
  // Bonus for tags matching user preferences
  const placeTags = Array.isArray(place.tags) ? place.tags : []
  const favoriteCategories = context.userPreferences.favoriteCategories || []
  
  for (const tag of placeTags) {
    if (tag && favoriteCategories.includes(tag)) {
      score += 10 // Boost for matching user's favorite categories/tags
    }
  }
  
  return score
}

function calculateContentBasedScore(place: Place, userPreferences: UserPreferences): number {
  let score = 0
  
  // Tag matching - use favoriteCategories as a proxy for preferred tags
  const placeTags = Array.isArray(place.tags) ? place.tags : []
  const favoriteCategories = userPreferences.favoriteCategories || []
  
  for (const tag of placeTags) {
    if (tag && favoriteCategories.includes(tag)) {
      score += 25 // Boost for matching user's favorite categories/tags
    }
  }
  
  // Category matching
  if (place.category && favoriteCategories.includes(place.category)) {
    score += 20 // Boost for matching user's favorite categories
  }
  
  return score
}

function generateContentBasedReasons(place: Place, userPreferences: UserPreferences): string[] {
  const reasons: string[] = []
  
  // Find matching tags
  const placeTags = Array.isArray(place.tags) ? place.tags : []
  const favoriteCategories = userPreferences.favoriteCategories || []
  const matchingTags = placeTags.filter(tag => tag && favoriteCategories.includes(tag))
  
  if (matchingTags.length > 0) {
    reasons.push(`Matches your interests: ${matchingTags.slice(0, 2).join(', ')}`)
  }
  
  // Category match
  if (place.category && favoriteCategories.includes(place.category)) {
    reasons.push(`You love ${place.category} places`)
  }
  
  return reasons
}

function removeDuplicateRecommendations(recommendations: DiscoveryRecommendation[]): DiscoveryRecommendation[] {
  const seen = new Set<string>()
  return recommendations.filter(rec => {
    const key = `${rec.type}-${rec.item.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

// ========================================
// EXPORTS
// ======================================== 