import type { User, Place, List, Post, Hub } from '../types/index.js'
import { 
  parseSearchQuery, 
  rankSearchResults, 
  type ParsedQuery, 
  type SearchContext, 
  type SearchResult 
} from './searchAlgorithm.js'
import { 
  analyzeUserPreferences, 
  generateDiscoveryRecommendations,
  type UserPreferences,
  type DiscoveryContext,
  type DiscoveryRecommendation 
} from './discoveryAlgorithm.js'
import { firebaseDataService, type FirebaseSearchData } from '../services/firebaseDataService.js'

// ========================================
// NEW USER BASELINE RECOMMENDATIONS
// ========================================

export interface SignupPreferences {
  favoriteCategories: string[]
  activityPreferences: string[]
  budgetPreferences: string[]
  socialPreferences: {
    exploreNew: number
    followFriends: number
    trendingContent: number
  }
  discoveryRadius: number
  location: string
}

/**
 * Creates baseline recommendations for a new user based on their signup preferences
 * This generates initial content before the user has any interaction history
 */
export async function createBaselineRecommendations(
  userId: string, 
  signupPrefs: SignupPreferences
): Promise<DiscoveryRecommendation[]> {
  try {
    // Convert signup preferences to discovery algorithm format
    const userPreferences: UserPreferences = {
      places: {
        categories: {},
        tags: {},
        priceRange: mapBudgetToRange(signupPrefs.budgetPreferences),
        atmospherePrefs: mapActivityToAtmosphere(signupPrefs.activityPreferences)
      },
      social: {
        followsSimilarUsers: [],
        influencedBy: [],
        interactionPattern: mapSocialToPattern(signupPrefs.socialPreferences)
      },
      temporal: {
        activeHours: [], // Will be learned over time
        weekdayVsWeekend: 'both',
        seasonalPrefs: {}
      },
      behavioral: {
        explorationVsReliability: signupPrefs.socialPreferences.exploreNew / 100,
        groupVsIndividual: mapActivityToGroupPref(signupPrefs.activityPreferences),
        plannerVsSpontaneous: 0.5 // Default to balanced
      }
    }

    // Weight categories based on selections
    signupPrefs.favoriteCategories.forEach(category => {
      userPreferences.places.categories[category.toLowerCase()] = 1.0
    })

    // Weight tags based on activity preferences
    signupPrefs.activityPreferences.forEach(activity => {
      userPreferences.places.tags[activity.toLowerCase().replace(/\s+/g, '_')] = 0.8
    })

    // Get places and lists for recommendations
    const searchData = await firebaseDataService.performSearch('', {
      location: signupPrefs.location,
      radius: signupPrefs.discoveryRadius
    }, 100)

    // Create mock discovery context for new user
    const mockUser: User = {
      id: userId,
      name: 'New User',
      username: 'newuser',
      influences: 0,
      location: signupPrefs.location
    }

    const discoveryContext: DiscoveryContext = {
      currentUser: mockUser,
      userPreferences,
      allUsers: [], // Empty for new user
      allPlaces: searchData.places,
      allLists: searchData.lists,
      allPosts: [],
      userInteractions: {
        userId,
        savedPlaces: [],
        likedLists: [],
        visitedPlaces: [],
        createdLists: [],
        friendsList: [],
        following: []
      },
      currentLocation: undefined, // Could be enhanced with geolocation
      timeContext: {
        currentTime: new Date(),
        season: getCurrentSeason(),
        isWeekend: isWeekend()
      }
    }

    // Generate content-based recommendations
    const contentBasedRecs = generateContentBasedRecommendations(discoveryContext)
    
    // Generate category-based recommendations
    const categoryBasedRecs = generateCategoryBasedRecommendations(discoveryContext, signupPrefs)
    
    // Generate trending recommendations (weighted by user preference)
    const trendingRecs = generateTrendingRecommendations(discoveryContext, signupPrefs.socialPreferences.trendingContent / 100)

    // Combine and rank all recommendations
    const allRecs = [...contentBasedRecs, ...categoryBasedRecs, ...trendingRecs]
    
    // Sort by score and return top recommendations
    return allRecs
      .sort((a, b) => b.score - a.score)
      .slice(0, 20) // Return top 20 recommendations

  } catch (error) {
    console.error('Error creating baseline recommendations:', error)
    return []
  }
}

/**
 * Generate content-based recommendations using category and activity preferences
 */
function generateContentBasedRecommendations(context: DiscoveryContext): DiscoveryRecommendation[] {
  const recommendations: DiscoveryRecommendation[] = []
  
  // Recommend places based on favorite categories
  context.allPlaces.forEach(place => {
    let score = 0
    const reasons: string[] = []
    
    if (place.category && context.userPreferences.places.categories[place.category.toLowerCase()]) {
      score += context.userPreferences.places.categories[place.category.toLowerCase()] * 0.8
      reasons.push(`Matches your interest in ${place.category}`)
    }
    
    // Check tag alignment
    place.tags?.forEach(tag => {
      if (context.userPreferences.places.tags[tag.toLowerCase()]) {
        score += context.userPreferences.places.tags[tag.toLowerCase()] * 0.6
        reasons.push(`Matches your preference for ${tag} experiences`)
      }
    })
    
    if (score > 0.3) {
      recommendations.push({
        item: place,
        type: 'place',
        score,
        confidence: Math.min(score, 0.8), // Lower confidence for new users
        reasons,
        algorithm: 'content_based',
        metadata: {
          expectedPreference: 3 + (score * 2), // Scale to 1-5 rating
          contextualFactors: ['new_user_preference_match']
        }
      })
    }
  })
  
  // Recommend lists based on categories
  context.allLists.forEach(list => {
    let score = 0
    const reasons: string[] = []
    
    list.tags?.forEach(tag => {
      if (context.userPreferences.places.categories[tag.toLowerCase()]) {
        score += context.userPreferences.places.categories[tag.toLowerCase()] * 0.7
        reasons.push(`List contains ${tag} places you're interested in`)
      }
    })
    
    if (score > 0.4) {
      recommendations.push({
        item: list,
        type: 'list',
        score,
        confidence: Math.min(score, 0.7),
        reasons,
        algorithm: 'content_based',
        metadata: {
          expectedPreference: 3 + (score * 1.5),
          contextualFactors: ['category_match']
        }
      })
    }
  })
  
  return recommendations
}

/**
 * Generate category-based recommendations specifically for signup preferences
 */
function generateCategoryBasedRecommendations(context: DiscoveryContext, signupPrefs: SignupPreferences): DiscoveryRecommendation[] {
  const recommendations: DiscoveryRecommendation[] = []
  
  // For each favorite category, find the best places
  signupPrefs.favoriteCategories.forEach(category => {
    const categoryPlaces = context.allPlaces
      .filter(place => place.category?.toLowerCase() === category.toLowerCase())
      .sort((a, b) => (b.savedCount || 0) - (a.savedCount || 0)) // Sort by popularity
      .slice(0, 3) // Top 3 per category
    
    categoryPlaces.forEach(place => {
      recommendations.push({
        item: place,
        type: 'place',
        score: 0.9, // High score for direct category match
        confidence: 0.9,
        reasons: [`Top-rated ${category} place`, 'Popular with other users'],
        algorithm: 'content_based',
        metadata: {
          expectedPreference: 4.2,
          contextualFactors: ['direct_category_match', 'popular_choice']
        }
      })
    })
  })
  
  return recommendations
}

/**
 * Generate trending recommendations weighted by user's preference for trending content
 */
function generateTrendingRecommendations(context: DiscoveryContext, trendingWeight: number): DiscoveryRecommendation[] {
  if (trendingWeight < 0.3) return [] // User doesn't want trending content
  
  const recommendations: DiscoveryRecommendation[] = []
  
  // Get most saved places (trending places)
  const trendingPlaces = context.allPlaces
    .sort((a, b) => (b.savedCount || 0) - (a.savedCount || 0))
    .slice(0, 5)
  
  trendingPlaces.forEach(place => {
    recommendations.push({
      item: place,
      type: 'place',
      score: 0.7 * trendingWeight,
      confidence: 0.6,
      reasons: ['Currently trending', 'Popular with the community'],
      algorithm: 'trending',
      metadata: {
        expectedPreference: 3.8,
        contextualFactors: ['trending', 'community_favorite']
      }
    })
  })
  
  // Get most liked lists (trending lists)
  const trendingLists = context.allLists
    .sort((a, b) => (b.likes || 0) - (a.likes || 0))
    .slice(0, 3)
  
  trendingLists.forEach(list => {
    recommendations.push({
      item: list,
      type: 'list',
      score: 0.6 * trendingWeight,
      confidence: 0.5,
      reasons: ['Trending list', 'Highly liked by community'],
      algorithm: 'trending',
      metadata: {
        expectedPreference: 3.5,
        contextualFactors: ['trending_list']
      }
    })
  })
  
  return recommendations
}

// Helper functions
function mapBudgetToRange(budgetPrefs: string[]): 'budget' | 'mid' | 'luxury' | 'mixed' {
  if (budgetPrefs.includes('$') && !budgetPrefs.includes('$$') && !budgetPrefs.includes('$$$')) return 'budget'
  if (budgetPrefs.includes('$$$') || budgetPrefs.includes('$$$$')) return 'luxury'
  if (budgetPrefs.includes('$$') && budgetPrefs.length === 1) return 'mid'
  return 'mixed'
}

function mapActivityToAtmosphere(activities: string[]): { [key: string]: number } {
  const atmosphere: { [key: string]: number } = {}
  
  activities.forEach(activity => {
    switch (activity.toLowerCase()) {
      case 'relaxed & chill':
        atmosphere['cozy'] = 1.0
        atmosphere['quiet'] = 0.8
        break
      case 'trendy & hip':
        atmosphere['trendy'] = 1.0
        atmosphere['modern'] = 0.8
        break
      case 'romantic':
        atmosphere['intimate'] = 1.0
        atmosphere['elegant'] = 0.8
        break
      case 'active & energetic':
        atmosphere['lively'] = 1.0
        atmosphere['energetic'] = 0.9
        break
      case 'cultural & educational':
        atmosphere['sophisticated'] = 0.9
        atmosphere['inspiring'] = 0.8
        break
    }
  })
  
  return atmosphere
}

function mapSocialToPattern(socialPrefs: SignupPreferences['socialPreferences']): 'discoverer' | 'follower' | 'curator' | 'mixed' {
  if (socialPrefs.exploreNew > 70) return 'discoverer'
  if (socialPrefs.followFriends > 70) return 'follower'
  return 'mixed'
}

function mapActivityToGroupPref(activities: string[]): number {
  let groupScore = 0.5 // Default neutral
  
  activities.forEach(activity => {
    switch (activity.toLowerCase()) {
      case 'social experiences':
        groupScore += 0.3
        break
      case 'solo-friendly':
        groupScore -= 0.3
        break
      case 'family-friendly':
        groupScore += 0.2
        break
    }
  })
  
  return Math.max(0, Math.min(1, groupScore))
}

function getCurrentSeason(): 'spring' | 'summer' | 'fall' | 'winter' {
  const month = new Date().getMonth()
  if (month >= 2 && month <= 4) return 'spring'
  if (month >= 5 && month <= 7) return 'summer'
  if (month >= 8 && month <= 10) return 'fall'
  return 'winter'
}

function isWeekend(): boolean {
  const day = new Date().getDay()
  return day === 0 || day === 6
}

// ========================================
// UNIFIED SEARCH INTERFACE
// ========================================

export interface SearchConfig {
  maxResults: number
  includeDiscovery: boolean
  discoveryWeight: number // 0-1: how much to weight discovery vs direct search
  algorithms: {
    enableNLP: boolean
    enableCollaborative: boolean
    enableContentBased: boolean
    enableSocial: boolean
    enableLocation: boolean
    enableTrending: boolean
  }
}

export interface SearchFilters {
  types: ('places' | 'lists' | 'users' | 'posts')[]
  tags: string[]
  categories: string[]
  location?: {
    lat: number
    lng: number
    radius: number // km
  }
  dateRange?: {
    from: Date
    to: Date
  }
  socialFilters?: {
    friendsOnly: boolean
    followingOnly: boolean
    publicOnly: boolean
  }
}

export interface IntelligentSearchResult {
  // Direct search results
  places: SearchResult<Place>[]
  lists: SearchResult<List>[]
  users: SearchResult<User>[]
  posts: SearchResult<Post>[]
  
  // Discovery recommendations (when query is empty or very broad)
  discoveries: DiscoveryRecommendation[]
  
  // Meta information
  query: {
    original: string
    parsed: ParsedQuery
    intent: string
    confidence: number
  }
  
  // Smart suggestions
  suggestions: {
    queryCorrections: string[]
    relatedSearches: string[]
    expandedQueries: string[]
  }
  
  // Analytics for continuous improvement
  analytics: {
    totalResults: number
    searchLatency: number
    algorithmsUsed: string[]
    userBehaviorHints: string[]
  }
}

// ========================================
// MAIN SEARCH SERVICE
// ========================================

export class IntelligentSearchService {
  private userPreferences: Map<string, UserPreferences> = new Map()
  private searchHistory: Map<string, string[]> = new Map()
  
  constructor() {
    // Initialize with any cached preferences
    this.loadCachedPreferences()
  }

  /**
   * Main search method that handles both direct search and discovery
   */
  async performSearch(
    query: string,
    context: SearchContext,
    filters: Partial<SearchFilters> = {},
    config: Partial<SearchConfig> = {}
  ): Promise<IntelligentSearchResult> {
    const startTime = Date.now()
    
    // Merge with default config
    const fullConfig: SearchConfig = {
      maxResults: 50,
      includeDiscovery: true,
      discoveryWeight: 0.3,
      algorithms: {
        enableNLP: true,
        enableCollaborative: true,
        enableContentBased: true,
        enableSocial: true,
        enableLocation: true,
        enableTrending: true
      },
      ...config
    }

    // Parse the search query
    const parsedQuery = fullConfig.algorithms.enableNLP ? 
      parseSearchQuery(query, context) : 
      this.createBasicParsedQuery(query)

    // Prepare data sources
    const dataSources = await this.prepareDataSources(query, context, filters)

    // Perform direct search
    const searchResults = await this.performDirectSearch(
      parsedQuery, 
      context, 
      dataSources, 
      fullConfig
    )

    // Generate discovery recommendations (if enabled and appropriate)
    const discoveries = await this.generateDiscoveries(
      query,
      parsedQuery,
      context,
      dataSources,
      fullConfig
    )

    // Generate smart suggestions
    const suggestions = await this.generateSuggestions(
      query,
      parsedQuery,
      context,
      searchResults
    )

    // Update search history
    this.updateSearchHistory(context.currentUser.id, query)

    const endTime = Date.now()

    return {
      places: searchResults.places,
      lists: searchResults.lists,
      users: searchResults.users,
      posts: searchResults.posts,
      discoveries,
      query: {
        original: query,
        parsed: parsedQuery,
        intent: this.interpretIntent(parsedQuery),
        confidence: this.calculateQueryConfidence(parsedQuery)
      },
      suggestions,
      analytics: {
        totalResults: searchResults.places.length + searchResults.lists.length + 
                     searchResults.users.length + searchResults.posts.length,
        searchLatency: endTime - startTime,
        algorithmsUsed: this.getUsedAlgorithms(fullConfig),
        userBehaviorHints: this.generateBehaviorHints(parsedQuery, context)
      }
    }
  }

  /**
   * Get personalized discovery recommendations without search query
   */
  async getDiscoveryRecommendations(
    context: SearchContext,
    maxRecommendations: number = 20
  ): Promise<DiscoveryRecommendation[]> {
    const userPrefs = await this.getUserPreferences(context.currentUser.id, context)
    
    const discoveryContext: DiscoveryContext = {
      currentUser: context.currentUser,
      userPreferences: userPrefs,
      allUsers: context.friends.concat(context.following),
      allPlaces: [], // Would be loaded from data source
      allLists: [], // Would be loaded from data source
      allPosts: [], // Would be loaded from data source
      userInteractions: {
        userId: context.currentUser.id,
        savedPlaces: context.userPreferences.interactionHistory.savedPlaces,
        likedLists: context.userPreferences.interactionHistory.likedPosts,
        visitedPlaces: context.userPreferences.interactionHistory.visitedLists,
        createdLists: [],
        friendsList: context.friends.map(f => f.id),
        following: context.following.map(f => f.id)
      },
      currentLocation: context.currentUser.location || { lat: 37.7749, lng: -122.4194 },
      timeContext: {
        currentTime: new Date(),
        season: this.getCurrentSeason(),
        isWeekend: this.isWeekend()
      }
    }

    return generateDiscoveryRecommendations(discoveryContext, maxRecommendations)
  }

  /**
   * Update user preferences based on their interactions
   */
  async updateUserPreferences(
    userId: string,
    interaction: {
      type: 'save' | 'like' | 'visit' | 'search' | 'view'
      itemType: 'place' | 'list' | 'user' | 'post'
      itemId: string
      metadata?: any
    }
  ): Promise<void> {
    // This would update the user's preference model in real-time
    // For now, we'll just invalidate cached preferences
    this.userPreferences.delete(userId)
  }

  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================

  private async performDirectSearch(
    parsedQuery: ParsedQuery,
    context: SearchContext,
    dataSources: any,
    config: SearchConfig
  ): Promise<{
    places: SearchResult<Place>[]
    lists: SearchResult<List>[]
    users: SearchResult<User>[]
    posts: SearchResult<Post>[]
  }> {
    const results = {
      places: [] as SearchResult<Place>[],
      lists: [] as SearchResult<List>[],
      users: [] as SearchResult<User>[],
      posts: [] as SearchResult<Post>[]
    }

    // Search places
    if (parsedQuery.intent === 'find_places' || parsedQuery.intent === 'mixed') {
      results.places = rankSearchResults(
        dataSources.places,
        parsedQuery,
        context,
        (place: Place) => ({
          name: place.name,
          description: `Place in ${place.address}`,
          tags: place.tags,
          userId: undefined,
          createdAt: place.createdAt,
          likes: undefined,
          savedCount: place.savedCount
        })
      ).slice(0, Math.floor(config.maxResults * 0.4))
    }

    // Search lists
    if (parsedQuery.intent === 'find_lists' || parsedQuery.intent === 'mixed') {
      results.lists = rankSearchResults(
        dataSources.lists,
        parsedQuery,
        context,
        (list: List) => ({
          name: list.name,
          description: list.description,
          tags: list.tags,
          userId: list.userId,
          createdAt: list.createdAt,
          likes: list.likes,
          savedCount: undefined
        })
      ).slice(0, Math.floor(config.maxResults * 0.3))
    }

    // Search users
    if (parsedQuery.intent === 'find_users' || parsedQuery.intent === 'mixed') {
      results.users = rankSearchResults(
        dataSources.users,
        parsedQuery,
        context,
        (user: User) => ({
          name: user.name,
          description: user.bio || '',
          tags: user.tags || [],
          userId: user.id,
          createdAt: undefined,
          likes: user.influences,
          savedCount: undefined
        })
      ).slice(0, Math.floor(config.maxResults * 0.2))
    }

    // Search posts
    if (parsedQuery.intent === 'find_posts' || parsedQuery.intent === 'mixed') {
      results.posts = rankSearchResults(
        dataSources.posts,
        parsedQuery,
        context,
        (post: Post) => ({
          name: `Post by ${post.username}`,
          description: post.description,
          tags: [], // Posts don't have tags directly
          userId: post.userId,
          createdAt: post.createdAt,
          likes: post.likes,
          savedCount: undefined
        })
      ).slice(0, Math.floor(config.maxResults * 0.1))
    }

    return results
  }

  private async generateDiscoveries(
    query: string,
    parsedQuery: ParsedQuery,
    context: SearchContext,
    dataSources: any,
    config: SearchConfig
  ): Promise<DiscoveryRecommendation[]> {
    // Only generate discoveries for empty/broad queries or when specifically enabled
    if (!config.includeDiscovery || (query.trim().length > 5 && parsedQuery.queryType !== 'general')) {
      return []
    }

    try {
      const userPrefs = await this.getUserPreferences(context.currentUser.id, context)
      
      const discoveryContext: DiscoveryContext = {
        currentUser: context.currentUser,
        userPreferences: userPrefs,
        allUsers: dataSources.users,
        allPlaces: dataSources.places,
        allLists: dataSources.lists,
        allPosts: dataSources.posts,
        userInteractions: {
          userId: context.currentUser.id,
          savedPlaces: context.userPreferences.interactionHistory.savedPlaces,
          likedLists: context.userPreferences.interactionHistory.likedPosts,
          visitedPlaces: context.userPreferences.interactionHistory.visitedLists,
          createdLists: [],
          friendsList: context.friends.map(f => f.id),
          following: context.following.map(f => f.id)
        },
        currentLocation: context.currentUser.location || { lat: 37.7749, lng: -122.4194 },
        timeContext: {
          currentTime: new Date(),
          season: this.getCurrentSeason(),
          isWeekend: this.isWeekend()
        }
      }

      const maxDiscoveries = Math.floor(config.maxResults * config.discoveryWeight)
      return generateDiscoveryRecommendations(discoveryContext, maxDiscoveries)
    } catch (error) {
      console.warn('Failed to generate discovery recommendations:', error)
      return []
    }
  }

  private async generateSuggestions(
    query: string,
    parsedQuery: ParsedQuery,
    context: SearchContext,
    searchResults: any
  ): Promise<IntelligentSearchResult['suggestions']> {
    const suggestions = {
      queryCorrections: [] as string[],
      relatedSearches: [] as string[],
      expandedQueries: [] as string[]
    }

    // Generate query corrections for typos
    if (query.length > 3) {
      suggestions.queryCorrections = this.generateSpellCorrections(query, context)
    }

    // Generate related searches based on user's search history
    const userHistory = this.searchHistory.get(context.currentUser.id) || []
    suggestions.relatedSearches = this.generateRelatedSearches(query, userHistory, context)

    // Generate expanded queries for better results
    suggestions.expandedQueries = this.generateExpandedQueries(parsedQuery, context)

    return suggestions
  }

  private async getUserPreferences(userId: string, context: SearchContext): Promise<UserPreferences> {
    if (this.userPreferences.has(userId)) {
      return this.userPreferences.get(userId)!
    }

    try {
      // Use Firebase service to get user preferences
      const firebasePreferences = await firebaseDataService.getUserPreferences(userId)
      
      // Convert Firebase preferences to our UserPreferences format
      const preferences: UserPreferences = {
        favoriteCategories: firebasePreferences.favoriteCategories,
        preferredPriceRange: firebasePreferences.preferredPriceRange,
        socialPatterns: {
          exploreNew: firebasePreferences.socialPreferences.exploreNew,
          followFriends: firebasePreferences.socialPreferences.followFriends,
          trendingContent: firebasePreferences.socialPreferences.trendingContent
        },
        locationPatterns: {
          nearbyRadius: firebasePreferences.locationPreferences.nearbyRadius,
          preferredAreas: firebasePreferences.locationPreferences.preferredAreas
        }
      }

      this.userPreferences.set(userId, preferences)
      return preferences
    } catch (error) {
      console.error('Error fetching user preferences:', error)
      
      // Fallback to analyzing user behavior from context
      const mockInteractions = {
        userId,
        savedPlaces: [], // Will be populated from Firebase preferences
        likedLists: [], 
        visitedPlaces: [],
        createdLists: [],
        friendsList: context.friends.map(f => f.id),
        following: context.following.map(f => f.id)
      }

      const fallbackPreferences = analyzeUserPreferences(
        context.currentUser,
        mockInteractions,
        [], // Empty arrays as fallback
        [],
        []
      )

      this.userPreferences.set(userId, fallbackPreferences)
      return fallbackPreferences
    }
  }

  private async prepareDataSources(query: string, context: SearchContext, filters: Partial<SearchFilters>) {
    try {
      // Use Firebase data service to fetch real data
      const searchFilters = {
        category: filters.category,
        priceRange: filters.priceRange,
        location: filters.location,
        radius: filters.radius,
        tags: filters.tags
      }

      // Perform search in Firebase to get initial data set
      // Use the actual search query to get relevant results from Firebase first
      const firebaseData = await firebaseDataService.performSearch(
        query, // Use actual search query for better initial filtering
        searchFilters,
        100 // Get more results for better algorithmic processing
      )

      // Combine Firebase data with social connections
      const allUsers = [...context.friends, ...context.following, ...firebaseData.users]
      
      // Remove duplicates from users
      const uniqueUsers = allUsers.filter((user, index, self) => 
        index === self.findIndex(u => u.id === user.id)
      )

      return {
        places: firebaseData.places,
        lists: firebaseData.lists,
        users: uniqueUsers,
        posts: firebaseData.posts
      }
    } catch (error) {
      console.error('Error preparing data sources:', error)
      // Fallback to basic user data if Firebase fails
      return {
        places: [] as Place[],
        lists: [] as List[],
        users: context.friends.concat(context.following),
        posts: [] as Post[]
      }
    }
  }

  private createBasicParsedQuery(query: string): ParsedQuery {
    return {
      originalQuery: query,
      searchTerms: query.toLowerCase().split(/\s+/).filter(term => term.length > 2),
      userMentions: [],
      possessiveContext: {},
      tags: [],
      queryType: 'general',
      intent: 'mixed'
    }
  }

  private interpretIntent(parsedQuery: ParsedQuery): string {
    const intentMap = {
      'find_places': 'Looking for places to visit',
      'find_lists': 'Searching for curated lists',
      'find_users': 'Finding people',
      'find_posts': 'Looking for posts and experiences',
      'mixed': 'General search across all content'
    }
    return intentMap[parsedQuery.intent] || 'Unknown intent'
  }

  private calculateQueryConfidence(parsedQuery: ParsedQuery): number {
    let confidence = 0.5
    
    if (parsedQuery.searchTerms.length > 0) confidence += 0.2
    if (parsedQuery.possessiveContext.username) confidence += 0.2
    if (parsedQuery.tags.length > 0) confidence += 0.1
    if (parsedQuery.queryType !== 'general') confidence += 0.1
    
    return Math.min(confidence, 1.0)
  }

  private getUsedAlgorithms(config: SearchConfig): string[] {
    const algorithms: string[] = []
    if (config.algorithms.enableNLP) algorithms.push('NLP')
    if (config.algorithms.enableCollaborative) algorithms.push('Collaborative')
    if (config.algorithms.enableContentBased) algorithms.push('Content-Based')
    if (config.algorithms.enableSocial) algorithms.push('Social')
    if (config.algorithms.enableLocation) algorithms.push('Location')
    if (config.algorithms.enableTrending) algorithms.push('Trending')
    return algorithms
  }

  private generateBehaviorHints(parsedQuery: ParsedQuery, context: SearchContext): string[] {
    const hints: string[] = []
    
    if (parsedQuery.possessiveContext.username) {
      hints.push('social_search')
    }
    if (parsedQuery.locationContext) {
      hints.push('location_aware')
    }
    if (parsedQuery.queryType === 'general' && parsedQuery.searchTerms.length === 0) {
      hints.push('discovery_mode')
    }
    
    return hints
  }

  private generateSpellCorrections(query: string, context: SearchContext): string[] {
    // Simple spell correction - in a real app you'd use a proper spelling library
    const corrections: string[] = []
    
    // Check against common place/food terms
    const commonTerms = ['coffee', 'restaurant', 'pizza', 'sushi', 'tacos', 'burger']
    for (const term of commonTerms) {
      if (this.isTypo(query, term)) {
        corrections.push(query.replace(/\w+/, term))
      }
    }
    
    return corrections.slice(0, 3)
  }

  private isTypo(query: string, correctWord: string): boolean {
    // Very simple typo detection - can be enhanced
    const distance = this.levenshteinDistance(query.toLowerCase(), correctWord.toLowerCase())
    return distance <= 2 && distance > 0
  }

  private levenshteinDistance(str1: string, str2: string): number {
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

  private generateRelatedSearches(query: string, userHistory: string[], context: SearchContext): string[] {
    const related: string[] = []
    
    // Find searches that are similar to current query
    for (const historicalQuery of userHistory.slice(-20)) {
      if (historicalQuery !== query && this.isSimilarQuery(query, historicalQuery)) {
        related.push(historicalQuery)
      }
    }
    
    return related.slice(0, 5)
  }

  private isSimilarQuery(query1: string, query2: string): boolean {
    const words1 = query1.toLowerCase().split(/\s+/)
    const words2 = query2.toLowerCase().split(/\s+/)
    
    let commonWords = 0
    for (const word of words1) {
      if (words2.includes(word)) commonWords++
    }
    
    return commonWords > 0 && commonWords / Math.max(words1.length, words2.length) > 0.3
  }

  private generateExpandedQueries(parsedQuery: ParsedQuery, context: SearchContext): string[] {
    const expanded: string[] = []
    
    // Add synonyms and related terms
    for (const term of parsedQuery.searchTerms) {
      const synonyms = this.getSynonyms(term)
      for (const synonym of synonyms) {
        const expandedQuery = parsedQuery.originalQuery.replace(term, synonym)
        if (expandedQuery !== parsedQuery.originalQuery) {
          expanded.push(expandedQuery)
        }
      }
    }
    
    return expanded.slice(0, 3)
  }

  private getSynonyms(word: string): string[] {
    const synonymMap: { [key: string]: string[] } = {
      'coffee': ['cafe', 'espresso', 'latte'],
      'food': ['restaurant', 'dining', 'eat'],
      'cozy': ['comfortable', 'warm', 'intimate'],
      'quick': ['fast', 'rapid', 'speedy']
    }
    
    return synonymMap[word.toLowerCase()] || []
  }

  private updateSearchHistory(userId: string, query: string): void {
    if (!this.searchHistory.has(userId)) {
      this.searchHistory.set(userId, [])
    }
    
    const history = this.searchHistory.get(userId)!
    history.unshift(query)
    
    // Keep only last 50 searches
    if (history.length > 50) {
      history.length = 50
    }
  }

  private getCurrentSeason(): 'spring' | 'summer' | 'fall' | 'winter' {
    const month = new Date().getMonth()
    if (month >= 2 && month <= 4) return 'spring'
    if (month >= 5 && month <= 7) return 'summer'
    if (month >= 8 && month <= 10) return 'fall'
    return 'winter'
  }

  private isWeekend(): boolean {
    const day = new Date().getDay()
    return day === 0 || day === 6
  }

  private loadCachedPreferences(): void {
    // In a real app, this would load from localStorage or server
    // For now, just initialize empty
  }
}

// ========================================
// SINGLETON INSTANCE
// ========================================

export const intelligentSearch = new IntelligentSearchService()

// ========================================
// CONVENIENCE FUNCTIONS
// ========================================

export async function searchIntelligently(
  query: string,
  context: SearchContext,
  filters?: Partial<SearchFilters>,
  config?: Partial<SearchConfig>
): Promise<IntelligentSearchResult> {
  return intelligentSearch.performSearch(query, context, filters, config)
}

export async function getPersonalizedRecommendations(
  context: SearchContext,
  maxRecommendations?: number
): Promise<DiscoveryRecommendation[]> {
  return intelligentSearch.getDiscoveryRecommendations(context, maxRecommendations)
} 