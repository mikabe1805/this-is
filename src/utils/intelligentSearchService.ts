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
import { aiSearchService } from '../services/aiSearchService';
import { firebaseDataService, type FirebaseSearchData } from '../services/firebaseDataService.js'





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
    // Constructor is now empty, can be removed if not needed.
  }

  /**
   * Main search method that handles both direct search and discovery
   */
  private async getRankedResults<T extends { id: string; name: string }>(
    items: T[],
    parsedQuery: ParsedQuery,
    context: SearchContext,
    mapper: (item: T) => { name: string; description: string; tags: string[] }
  ): Promise<SearchResult<T>[]> {
    if (!items || items.length === 0) return [];
    return rankSearchResults(items, parsedQuery, context, mapper);
  }

  public async performSearch(
    query: string,
    context: SearchContext,
    filters: Partial<any> = {},
    config: Partial<{ useAI: boolean }> = {}
  ): Promise<IntelligentSearchResult> {
    const startTime = Date.now();
    const parsedQuery = parseSearchQuery(query, context);

    const firebaseData = await firebaseDataService.performSearch(query, filters, 200);

    let finalResults = {
      places: firebaseData.places,
      lists: firebaseData.lists,
      users: firebaseData.users,
      posts: firebaseData.posts,
    };

    if (config.useAI && aiSearchService.isAISearchEnabled()) {
      try {
        // Expand the query using AI
        const expandedQuery = await aiSearchService.getChatCompletion(
          `Expand the search query "${query}" to include related terms and concepts. Return a short paragraph.`,
          { max_tokens: 60 }
        );
        const expandedSearchTerms = expandedQuery ? expandedQuery.toLowerCase().split(/\s+/) : [];
        parsedQuery.searchTerms = [...new Set([...parsedQuery.searchTerms, ...expandedSearchTerms])];

        // Get embeddings for the expanded query and all items
        const [queryEmbedding] = await aiSearchService.getEmbeddings([parsedQuery.searchTerms.join(' ')]);
        const itemTexts = [
          ...firebaseData.places.map(p => `${p.name} ${p.description} ${p.tags?.join(' ')}`),
          ...firebaseData.lists.map(l => `${l.name} ${l.description} ${l.tags?.join(' ')}`),
        ];
        const itemEmbeddings = await aiSearchService.getEmbeddings(itemTexts);

        // Calculate cosine similarity and add to the results
        let itemIndex = 0;
        const semanticResults = {
          places: firebaseData.places.map(p => ({
            item: p,
            score: aiSearchService.cosineSimilarity(queryEmbedding, itemEmbeddings[itemIndex++]) * 100,
            reasons: ['Semantic match'],
            category: 'semantic_match' as const
          })),
          lists: firebaseData.lists.map(l => ({
            item: l,
            score: aiSearchService.cosineSimilarity(queryEmbedding, itemEmbeddings[itemIndex++]) * 100,
            reasons: ['Semantic match'],
            category: 'semantic_match' as const
          })),
        };

        // Merge semantic results with Firebase results
        finalResults.places = [...finalResults.places, ...semanticResults.places.map(r => r.item)];
        finalResults.lists = [...finalResults.lists, ...semanticResults.lists.map(r => r.item)];

      } catch (error) {
        console.error("AI search enhancement failed:", error);
      }
    }

    const [places, lists, users, posts] = await Promise.all([
      this.getRankedResults(finalResults.places, parsedQuery, context, item => ({ name: item.name, description: item.address, tags: item.tags })),
      this.getRankedResults(finalResults.lists, parsedQuery, context, item => ({ name: item.name, description: item.description, tags: item.tags })),
      this.getRankedResults(finalResults.users, parsedQuery, context, item => ({ name: item.name, description: item.bio, tags: item.tags })),
      this.getRankedResults(finalResults.posts, parsedQuery, context, item => ({ name: 'Post', description: item.description, tags: [] })),
    ]);

    finalResults = { places, lists, users, posts };

    return {
      ...finalResults,
      discoveries: [], 
      query: {
        original: query,
        parsed: parsedQuery,
        intent: 'mixed', 
        confidence: 0.8, 
      },
      suggestions: {
        queryCorrections: [], 
        relatedSearches: [],
      },
      analytics: {
        searchLatency: Date.now() - startTime,
      },
    };
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



  private createBasicParsedQuery(query: string): ParsedQuery {
    const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0)
    
    // Determine intent based on query content
    let intent: ParsedQuery['intent'] = 'mixed'
    const queryLower = query.toLowerCase()
    
    // Look for list-related keywords
    if (queryLower.includes('list') || queryLower.includes('collection') || queryLower.includes('spots')) {
      intent = 'find_lists'
    }
    // Look for place-related keywords  
    else if (queryLower.match(/\b(cafe|coffee|restaurant|bar|shop|place|location)\b/)) {
      intent = 'find_places'
    }
    // For short queries like "coffee", include both places and lists
    else if (searchTerms.length === 1 && searchTerms[0].length > 2) {
      intent = 'mixed'
    }
    
    return {
      originalQuery: query,
      searchTerms,
      userMentions: [],
      possessiveContext: {},
      tags: [],
      queryType: 'general',
      intent
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

  /**
   * Enhance search results with AI-powered semantic search
   */



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