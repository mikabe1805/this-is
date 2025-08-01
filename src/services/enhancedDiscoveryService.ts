import type { User, Place, List } from '../types/index.js'
import { aiDiscoveryService, type SmartRecommendation } from './aiDiscoveryService.js'
import { firebaseDataService } from './firebaseDataService.js'

// ========================================
// ENHANCED DISCOVERY SERVICE WITH AI INTEGRATION
// ========================================

export interface DiscoveryConfig {
  maxRecommendations: number
  includePersonalized: boolean
  includeTrending: boolean
  includeHiddenGems: boolean
  diversityFactor: number
}

export interface EnhancedDiscoveryResult {
  personalizedRecommendations: SmartRecommendation[]
  trendingItems: (Place | List)[]
  hiddenGems: (Place | List)[]
  aiInsights: {
    personalityProfile?: string
    discoveryStyle: string
    recommendations: string[]
  }
  metadata: {
    totalProcessed: number
    aiEnhanced: boolean
    processingTime: number
  }
}

class EnhancedDiscoveryService {
  /**
   * Generate comprehensive personalized discovery recommendations
   */
  async generateDiscoveryFeed(
    user: User,
    config: Partial<DiscoveryConfig> = {}
  ): Promise<EnhancedDiscoveryResult> {
    const startTime = Date.now()
    
    const defaultConfig: DiscoveryConfig = {
      maxRecommendations: 15,
      includePersonalized: true,
      includeTrending: true,
      includeHiddenGems: true,
      diversityFactor: 0.3,
      ...config
    }

    try {
      // Get user activity data
      const [userPosts, savedPlaces, likedLists, allData] = await Promise.all([
        this.getUserPosts(user.id),
        this.getUserSavedPlaces(user.id),
        this.getUserLikedLists(user.id),
        this.getAllContent()
      ])

      let personalizedRecommendations: SmartRecommendation[] = []
      let aiInsights = {
        personalityProfile: 'Standard user profile',
        discoveryStyle: 'Balanced exploration',
        recommendations: ['Explore trending locations', 'Try new cuisines', 'Discover local favorites']
      }

      // Generate AI-powered recommendations if available
      if (aiDiscoveryService.isEnabled() && defaultConfig.includePersonalized) {
        try {
          console.log('🧠 Generating AI-powered personalized recommendations...')
          
          // Analyze user personality
          const personalityInsights = await aiDiscoveryService.analyzeUserPersonality(
            user, userPosts, savedPlaces, likedLists
          )

          if (personalityInsights) {
            // Generate personalized recommendations
            personalizedRecommendations = await aiDiscoveryService.generatePersonalizedRecommendations(
              user,
              personalityInsights,
              allData.places,
              allData.lists,
              { savedPlaces, likedLists, visitedPlaces: [] }
            )

            // Extract behavior patterns
            const behaviorPattern = aiDiscoveryService.extractBehaviorPatterns(
              user, userPosts, savedPlaces, likedLists
            )

            // Create AI insights
            aiInsights = {
              personalityProfile: `${personalityInsights.personality.slice(0, 2).join(', ')} personality with interests in ${personalityInsights.interests.slice(0, 2).join(' and ')}`,
              discoveryStyle: this.interpretDiscoveryStyle(personalityInsights, behaviorPattern),
              recommendations: this.generateAIRecommendations(personalityInsights, behaviorPattern)
            }

            console.log(`✨ Generated ${personalizedRecommendations.length} AI-powered recommendations`)
          }
        } catch (error) {
          console.error('AI discovery failed, falling back to standard recommendations:', error)
        }
      }

      // Generate trending items
      const trendingItems = defaultConfig.includeTrending 
        ? await this.getTrendingItems(allData, defaultConfig.maxRecommendations / 3)
        : []

      // Find hidden gems
      const hiddenGems = defaultConfig.includeHiddenGems
        ? await this.getHiddenGems(allData, defaultConfig.maxRecommendations / 3)
        : []

      const result: EnhancedDiscoveryResult = {
        personalizedRecommendations: personalizedRecommendations.slice(0, defaultConfig.maxRecommendations),
        trendingItems,
        hiddenGems,
        aiInsights,
        metadata: {
          totalProcessed: allData.places.length + allData.lists.length,
          aiEnhanced: aiDiscoveryService.isEnabled(),
          processingTime: Date.now() - startTime
        }
      }

      console.log(`🎯 Discovery feed generated in ${result.metadata.processingTime}ms:`)
      console.log(`  - ${result.personalizedRecommendations.length} personalized recommendations`)
      console.log(`  - ${result.trendingItems.length} trending items`)
      console.log(`  - ${result.hiddenGems.length} hidden gems`)

      return result

    } catch (error) {
      console.error('Error generating discovery feed:', error)
      
      // Return fallback result
      return {
        personalizedRecommendations: [],
        trendingItems: [],
        hiddenGems: [],
        aiInsights,
        metadata: {
          totalProcessed: 0,
          aiEnhanced: false,
          processingTime: Date.now() - startTime
        }
      }
    }
  }

  /**
   * Get user's posts (mock implementation - replace with actual Firebase query)
   */
  private async getUserPosts(userId: string) {
    // TODO: Implement actual Firebase query for user posts
    return []
  }

  /**
   * Get user's saved places (mock implementation)
   */
  private async getUserSavedPlaces(userId: string): Promise<Place[]> {
    // TODO: Implement actual Firebase query for saved places
    return []
  }

  /**
   * Get user's liked lists (mock implementation)
   */
  private async getUserLikedLists(userId: string): Promise<List[]> {
    // TODO: Implement actual Firebase query for liked lists
    return []
  }

  /**
   * Get all places and lists for recommendation processing
   */
  private async getAllContent() {
    const searchData = await firebaseDataService.performSearch('', {}, 100)
    return {
      places: searchData.places,
      lists: searchData.lists
    }
  }

  /**
   * Get trending items based on recent activity
   */
  private async getTrendingItems(
    allData: { places: Place[]; lists: List[] },
    maxItems: number
  ): Promise<(Place | List)[]> {
    const trending: (Place | List)[] = []

    // Sort places by popularity
    const trendingPlaces = allData.places
      .filter(place => place.savedCount && place.savedCount > 20)
      .sort((a, b) => (b.savedCount || 0) - (a.savedCount || 0))
      .slice(0, maxItems / 2)

    // Sort lists by likes
    const trendingLists = allData.lists
      .filter(list => list.likes && list.likes > 10)
      .sort((a, b) => (b.likes || 0) - (a.likes || 0))
      .slice(0, maxItems / 2)

    return [...trendingPlaces, ...trendingLists].slice(0, maxItems)
  }

  /**
   * Find hidden gems (low interaction but high quality)
   */
  private async getHiddenGems(
    allData: { places: Place[]; lists: List[] },
    maxItems: number
  ): Promise<(Place | List)[]> {
    const hiddenGems: (Place | List)[] = []

    // Find places with low saves but good potential
    const hiddenPlaces = allData.places
      .filter(place => (place.savedCount || 0) < 10 && (place.savedCount || 0) > 0)
      .sort((a, b) => (b.savedCount || 0) - (a.savedCount || 0))
      .slice(0, maxItems / 2)

    // Find lists with low likes but good content
    const hiddenLists = allData.lists
      .filter(list => (list.likes || 0) < 5 && (list.likes || 0) > 0)
      .sort((a, b) => (b.likes || 0) - (a.likes || 0))
      .slice(0, maxItems / 2)

    return [...hiddenPlaces, ...hiddenLists].slice(0, maxItems)
  }

  /**
   * Interpret discovery style from AI insights
   */
  private interpretDiscoveryStyle(personalityInsights: any, behaviorPattern: any): string {
    const traits = personalityInsights.personality || []
    const interests = personalityInsights.interests || []

    if (traits.includes('adventurous') || interests.includes('exploration')) {
      return 'Adventurous explorer - seeks unique and off-the-beaten-path experiences'
    } else if (traits.includes('social') || behaviorPattern.socialPreferences === 'group') {
      return 'Social discoverer - prefers popular spots and group-friendly places'
    } else if (traits.includes('methodical') || traits.includes('careful')) {
      return 'Thoughtful curator - carefully selects quality experiences'
    } else {
      return 'Balanced explorer - enjoys mix of popular and unique discoveries'
    }
  }

  /**
   * Generate AI-powered discovery recommendations
   */
  private generateAIRecommendations(personalityInsights: any, behaviorPattern: any): string[] {
    const recommendations = []
    
    if (personalityInsights.interests?.includes('food')) {
      recommendations.push('Explore local food scenes and hidden culinary gems')
    }
    
    if (personalityInsights.personality?.includes('social')) {
      recommendations.push('Try group-friendly venues and social hotspots')
    }
    
    if (behaviorPattern.preferredCategories?.includes('cafe')) {
      recommendations.push('Discover new coffee culture and cozy work spaces')
    }
    
    recommendations.push('Branch out to new neighborhoods and experiences')
    
    return recommendations.slice(0, 4)
  }

  /**
   * Clear caches for testing
   */
  clearCaches() {
    if (aiDiscoveryService.isEnabled()) {
      aiDiscoveryService.clearCaches()
    }
  }
}

// Export singleton instance
export const enhancedDiscoveryService = new EnhancedDiscoveryService()
export default enhancedDiscoveryService