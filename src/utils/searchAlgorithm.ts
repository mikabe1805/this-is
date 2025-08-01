import type { User, Place, List, Post, Hub } from '../types/index.js'

// ========================================
// NATURAL LANGUAGE PROCESSING UTILITIES
// ========================================

export interface ParsedQuery {
  originalQuery: string
  searchTerms: string[]
  userMentions: string[]
  possessiveContext: {
    username?: string
    relationship?: 'friend' | 'following' | 'unknown'
    possessiveType?: 'favorite' | 'list' | 'saved' | 'loved' | 'tried'
  }
  locationContext?: string
  tags: string[]
  queryType: 'general' | 'user_specific' | 'possessive' | 'location_based'
  intent: 'find_places' | 'find_lists' | 'find_users' | 'find_posts' | 'mixed'
}

export interface SearchContext {
  currentUser: User
  friends: User[]
  following: User[]
  userHistory: {
    searches: string[]
    savedPlaces: string[]
    likedLists: string[]
    visitedPlaces: string[]
  }
  location?: {
    lat: number
    lng: number
  }
}

// Possessive patterns and keywords
const POSSESSIVE_PATTERNS = [
  // Direct possessive: "sara's favorite cafe"
  /(\w+)'s\s+(favorite|best|top|preferred|go-to|recommended)\s+(\w+)/gi,
  // Indirect possessive: "favorite cafes from sara"
  /(favorite|best|top|preferred|go-to|recommended)\s+(\w+)\s+(from|by|of)\s+(\w+)/gi,
  // List patterns: "sara's coffee list"
  /(\w+)'s\s+(\w+)\s+(list|collection|spots|places)/gi,
]

const SENTIMENT_KEYWORDS = {
  positive: ['favorite', 'best', 'amazing', 'great', 'excellent', 'perfect', 'love', 'awesome'],
  negative: ['worst', 'terrible', 'awful', 'bad', 'hate', 'dislike'],
  neutral: ['okay', 'fine', 'decent', 'average']
}

const PLACE_TYPE_KEYWORDS = {
  food: ['restaurant', 'cafe', 'coffee', 'taco', 'pizza', 'burger', 'sushi', 'food', 'dining', 'eat'],
  entertainment: ['bar', 'club', 'movie', 'theater', 'museum', 'gallery', 'park', 'beach'],
  work: ['coworking', 'library', 'study', 'work', 'office', 'quiet'],
  shopping: ['store', 'mall', 'boutique', 'shop', 'market']
}

// ========================================
// QUERY PARSING ENGINE
// ========================================

export function parseSearchQuery(query: string, context: SearchContext): ParsedQuery {
  const lowercaseQuery = query.toLowerCase()
  const words = lowercaseQuery.split(/\s+/)
  
  // Initialize parsed query
  const parsed: ParsedQuery = {
    originalQuery: query,
    searchTerms: [],
    userMentions: [],
    possessiveContext: {},
    tags: [],
    queryType: 'general',
    intent: 'mixed'
  }

  // Extract hashtags
  parsed.tags = extractHashtags(query)
  
  // Check for possessive patterns
  const possessiveMatch = analyzePossessiveContext(query, context)
  if (possessiveMatch) {
    parsed.possessiveContext = possessiveMatch
    parsed.queryType = 'possessive'
  }

  // Extract user mentions (@username or just names)
  parsed.userMentions = extractUserMentions(query, context)
  if (parsed.userMentions.length > 0 && !possessiveMatch) {
    parsed.queryType = 'user_specific'
  }

  // Extract location context
  parsed.locationContext = extractLocationContext(query)
  if (parsed.locationContext) {
    parsed.queryType = 'location_based'
  }

  // Clean search terms (remove possessive parts, user mentions, etc.)
  parsed.searchTerms = extractCleanSearchTerms(query, parsed)

  // Determine intent
  parsed.intent = determineSearchIntent(parsed, lowercaseQuery)

  return parsed
}

function extractHashtags(query: string): string[] {
  const hashtags = query.match(/#[\w]+/g) || []
  return hashtags.map(tag => tag.substring(1))
}

function analyzePossessiveContext(query: string, context: SearchContext): ParsedQuery['possessiveContext'] | null {
  for (const pattern of POSSESSIVE_PATTERNS) {
    const match = pattern.exec(query)
    if (match) {
      const username = match[1] || match[4]
      const possessiveType = match[2] || match[1]
      
      // Find user in friends/following
      const user = findUserByNameOrUsername(username, context)
      
      return {
        username,
        relationship: user ? (context.friends.some(f => f.id === user.id) ? 'friend' : 'following') : 'unknown',
        possessiveType: possessiveType as any
      }
    }
  }
  return null
}

function extractUserMentions(query: string, context: SearchContext): string[] {
  const mentions: string[] = []
  
  // Extract @mentions
  const atMentions = query.match(/@(\w+)/g) || []
  mentions.push(...atMentions.map(m => m.substring(1)))
  
  // Try to find names that match friends/following
  const words = query.toLowerCase().split(/\s+/)
  for (const word of words) {
    const user = findUserByNameOrUsername(word, context)
    if (user && !mentions.includes(user.username)) {
      mentions.push(user.username)
    }
  }
  
  return mentions
}

function extractLocationContext(query: string): string | undefined {
  // Simple location extraction - can be enhanced with NLP libraries
  const locationKeywords = ['near', 'in', 'at', 'around', 'close to']
  const words = query.split(/\s+/)
  
  for (let i = 0; i < words.length - 1; i++) {
    if (locationKeywords.includes(words[i].toLowerCase())) {
      return words.slice(i + 1).join(' ')
    }
  }
  
  return undefined
}

function extractCleanSearchTerms(query: string, parsed: ParsedQuery): string[] {
  let cleanQuery = query
  
  // Remove hashtags
  cleanQuery = cleanQuery.replace(/#[\w]+/g, '')
  
  // Remove user mentions
  cleanQuery = cleanQuery.replace(/@\w+/g, '')
  
  // Remove possessive patterns
  if (parsed.possessiveContext.username) {
    cleanQuery = cleanQuery.replace(new RegExp(`${parsed.possessiveContext.username}'s`, 'gi'), '')
    cleanQuery = cleanQuery.replace(new RegExp(`\\b${parsed.possessiveContext.possessiveType}\\b`, 'gi'), '')
  }
  
  // Remove location context
  if (parsed.locationContext) {
    cleanQuery = cleanQuery.replace(parsed.locationContext, '')
    cleanQuery = cleanQuery.replace(/\b(near|in|at|around|close to)\b/gi, '')
  }
  
  // Split into meaningful terms
  return cleanQuery
    .split(/\s+/)
    .filter(term => term.length > 2)
    .filter(term => !['the', 'and', 'or', 'but', 'for', 'with'].includes(term.toLowerCase()))
}

function determineSearchIntent(parsed: ParsedQuery, query: string): ParsedQuery['intent'] {
  const placeKeywords = Object.values(PLACE_TYPE_KEYWORDS).flat()
  const hasPlaceKeywords = placeKeywords.some(keyword => query.includes(keyword))
  
  if (parsed.possessiveContext.username) {
    return hasPlaceKeywords ? 'find_places' : 'find_lists'
  }
  
  if (parsed.userMentions.length > 0) {
    return 'find_users'
  }
  
  if (hasPlaceKeywords) {
    return 'find_places'
  }
  
  if (query.includes('list') || query.includes('collection')) {
    return 'find_lists'
  }
  
  return 'mixed'
}

function findUserByNameOrUsername(name: string, context: SearchContext): User | null {
  const allUsers = [...context.friends, ...context.following]
  return allUsers.find(user => 
    (user.name && user.name.toLowerCase().includes(name.toLowerCase())) ||
    (user.username && user.username.toLowerCase().includes(name.toLowerCase()))
  ) || null
}

// ========================================
// INTELLIGENT RANKING SYSTEM
// ========================================

export interface SearchResult<T> {
  item: T
  score: number
  reasons: string[]
  category: 'exact_match' | 'semantic_match' | 'user_connection' | 'trending' | 'personalized'
}

export function rankSearchResults<T>(
  items: T[],
  parsed: ParsedQuery,
  context: SearchContext,
  getItemMetadata: (item: T) => {
    name: string
    description?: string
    tags?: string[]
    userId?: string
    createdAt?: string
    likes?: number
    savedCount?: number
  }
): SearchResult<T>[] {
  const results: SearchResult<T>[] = []
  
  for (const item of items) {
    const metadata = getItemMetadata(item)
    const score = calculateItemScore(item, metadata, parsed, context)
    const reasons = generateScoreReasons(metadata, parsed, context)
    
    if (score.total > 0) {
      results.push({
        item,
        score: score.total,
        reasons,
        category: score.primaryCategory
      })
    }
  }
  
  return results.sort((a, b) => b.score - a.score)
}

function calculateItemScore<T>(
  item: T,
  metadata: ReturnType<Parameters<typeof rankSearchResults>[3]>,
  parsed: ParsedQuery,
  context: SearchContext
) {
  // Calculate component scores with proper normalization
  const exactMatchScore = exactMatch(metadata.name, parsed.searchTerms) ? 100 : 0
  const semanticScore = calculateSemanticScore(metadata, parsed.searchTerms) // Already capped at 100
  const userConnectionScore = (metadata.userId && isUserConnected(metadata.userId, context)) ? 25 : 0
  const possessiveScore = parsed.possessiveContext.username ? 
    Math.min(calculatePossessiveScore(metadata, parsed, context), 30) : 0
  const popularityScore = Math.min(calculatePopularityScore(metadata), 20)
  const personalizationScore = Math.min(calculatePersonalizationScore(metadata, context), 15)
  const recencyScore = metadata.createdAt ? Math.min(calculateRecencyScore(metadata.createdAt), 10) : 0
  
  // Sum all scores
  const totalScore = exactMatchScore + semanticScore + userConnectionScore + 
                    possessiveScore + popularityScore + personalizationScore + recencyScore
  
  // Normalize to 0-100 scale using logarithmic scaling for high scores
  let finalScore: number
  if (totalScore <= 100) {
    finalScore = totalScore
  } else {
    // Use logarithmic scaling to compress scores above 100 into 80-100 range
    const excess = totalScore - 100
    const compressedExcess = Math.log(excess + 1) * 8
    finalScore = Math.min(80 + compressedExcess, 100)
  }
  
  // Determine primary category based on highest contributing factor
  let primaryCategory: SearchResult<T>['category'] = 'semantic_match'
  if (exactMatchScore > 0) primaryCategory = 'exact_match'
  else if (userConnectionScore > 15 || possessiveScore > 20) primaryCategory = 'user_connection'
  else if (popularityScore > 15) primaryCategory = 'trending'
  else if (personalizationScore > 10) primaryCategory = 'personalized'
  
  return { total: Math.round(finalScore), primaryCategory }
}

function exactMatch(text: string | undefined | null, searchTerms: string[]): boolean {
  if (!text || typeof text !== 'string') {
    return false
  }
  const lowerText = text.toLowerCase()
  return searchTerms.some(term => lowerText.includes(term.toLowerCase()))
}

function calculateSemanticScore(
  metadata: ReturnType<Parameters<typeof rankSearchResults>[3]>,
  searchTerms: string[]
): number {
  let score = 0
  
  for (const term of searchTerms) {
    const termLower = term.toLowerCase()
    
    // Exact match in name gets highest score (40 points per term)
    if (metadata.name && metadata.name.toLowerCase().includes(termLower)) {
      score += 40
    }
    // Match in tags gets good score (30 points per term)  
    else if (metadata.tags && Array.isArray(metadata.tags) && metadata.tags.some(tag => 
      tag && tag.toLowerCase().includes(termLower))) {
      score += 30
    }
    // Match in description gets medium score (20 points per term)
    else if (metadata.description && metadata.description.toLowerCase().includes(termLower)) {
      score += 20
    }
    // Fuzzy matching for slight variations (10 points per term)
    else {
      const searchText = `${metadata.name || ''} ${metadata.description || ''} ${(metadata.tags || []).join(' ')}`.toLowerCase()
      if (fuzzyMatch(searchText, termLower)) {
        score += 10
      }
    }
  }
  
  // Cap semantic score at 80 (allows room for other factors)
  return Math.min(score, 80)
}

function isUserConnected(userId: string, context: SearchContext): boolean {
  return context.friends.some(f => f.id === userId) || 
         context.following.some(f => f.id === userId)
}

function calculatePossessiveScore(
  metadata: ReturnType<Parameters<typeof rankSearchResults>[3]>,
  parsed: ParsedQuery,
  context: SearchContext
): number {
  if (!parsed.possessiveContext.username) return 0
  
  const user = findUserByNameOrUsername(parsed.possessiveContext.username, context)
  if (!user) return 0
  
  // Strong bonus if item belongs to the mentioned user
  if (metadata.userId === user.id) {
    return 75
  }
  
  // Moderate bonus if user has interacted with this item
  // (This would require additional data about user interactions)
  return 0
}

function calculatePopularityScore(metadata: ReturnType<Parameters<typeof rankSearchResults>[3]>): number {
  const likes = metadata.likes || 0
  const saves = metadata.savedCount || 0
  
  // Logarithmic scaling to prevent extremely popular items from dominating
  return Math.min(Math.log(likes + saves + 1) * 5, 25)
}

function calculatePersonalizationScore(
  metadata: ReturnType<Parameters<typeof rankSearchResults>[3]>,
  context: SearchContext
): number {
  let score = 0
  
  // Bonus for tags matching user's interest
  if (metadata.tags && context.currentUser.tags) {
    const commonTags = metadata.tags.filter(tag => 
      context.currentUser.tags!.includes(tag)
    )
    score += commonTags.length * 5
  }
  
  // Bonus for places user has searched before
  if (metadata.name && context.userPreferences.interactionHistory.searchHistory.some(search => 
    search && typeof search === 'string' && search.toLowerCase().includes(metadata.name.toLowerCase())
  )) {
    score += 10
  }
  
  return Math.min(score, 20)
}

function calculateRecencyScore(createdAt: string): number {
  const now = new Date()
  const created = new Date(createdAt)
  const daysDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
  
  // Bonus for recent content, diminishing over time
  if (daysDiff < 7) return 10
  if (daysDiff < 30) return 5
  return 0
}

function fuzzyMatch(text: string, term: string): boolean {
  // Simple fuzzy matching - can be enhanced with more sophisticated algorithms
  const threshold = 0.8
  const longer = text.length > term.length ? text : term
  const shorter = text.length > term.length ? term : text
  
  if (longer.length === 0) return true
  
  const similarity = (longer.length - levenshteinDistance(longer, shorter)) / longer.length
  return similarity >= threshold
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = []
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  
  return matrix[str2.length][str1.length]
}

function generateScoreReasons(
  metadata: ReturnType<Parameters<typeof rankSearchResults>[3]>,
  parsed: ParsedQuery,
  context: SearchContext
): string[] {
  const reasons: string[] = []
  
  if (exactMatch(metadata.name, parsed.searchTerms)) {
    reasons.push('Exact name match')
  }
  
  if (metadata.userId && isUserConnected(metadata.userId, context)) {
    const user = [...context.friends, ...context.following].find(u => u.id === metadata.userId)
    if (user) {
      reasons.push(`Created by ${user.name}`)
    }
  }
  
  if (parsed.possessiveContext.username && metadata.userId) {
    const user = findUserByNameOrUsername(parsed.possessiveContext.username, context)
    if (user && metadata.userId === user.id) {
      reasons.push(`${user.name}'s ${parsed.possessiveContext.possessiveType}`)
    }
  }
  
  if ((metadata.likes || 0) > 20) {
    reasons.push('Popular item')
  }
  
  if (metadata.tags && context.currentUser.tags) {
    const commonTags = metadata.tags.filter(tag => 
      context.currentUser.tags!.includes(tag)
    )
    if (commonTags.length > 0) {
      reasons.push(`Matches your interests: ${commonTags.join(', ')}`)
    }
  }
  
  return reasons
}

// ========================================
// EXPORTS
// ========================================

export {
  PLACE_TYPE_KEYWORDS,
  SENTIMENT_KEYWORDS
} 