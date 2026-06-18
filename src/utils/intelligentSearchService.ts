import type { User, Place, List, Post } from '../types/index.js'
import {
  parseSearchQuery,
  rankSearchResults,
  type ParsedQuery,
  type SearchContext,
  type SearchResult
} from './searchAlgorithm.js'
import { aiSearchService } from '../services/aiSearchService';
import { firebaseDataService } from '../services/firebaseDataService.js'

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
  
  // Discovery recommendations — always empty here; the live discovery engine is
  // firebaseDataService.getTasteRecommendations, not this search path.
  discoveries: never[]

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
  /**
   * Main search method that handles both direct search and discovery
   */
  private async getRankedResults<T extends { id: string; name?: string }>(
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
      this.getRankedResults(finalResults.places, parsedQuery, context, item => ({ name: item.name, description: item.address, tags: item.tags || [] })),
      this.getRankedResults(finalResults.lists, parsedQuery, context, item => ({ name: item.name, description: item.description, tags: item.tags || [] })),
      this.getRankedResults(finalResults.users, parsedQuery, context, item => ({ name: item.name, description: item.bio || '', tags: item.tags || [] })),
      this.getRankedResults(finalResults.posts, parsedQuery, context, item => ({ name: 'Post', description: item.description, tags: [] })),
    ]);

    finalResults = { places: places as any, lists: lists as any, users: users as any, posts: posts as any };

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
        expandedQueries: [],
      },
      analytics: {
        totalResults: 0,
        searchLatency: Date.now() - startTime,
        algorithmsUsed: [],
        userBehaviorHints: [],
      },
    };
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
  options?: { sortBy?: string, tags?: string[] }
): Promise<IntelligentSearchResult> {
  return intelligentSearch.performSearch(query, context, options)
}
