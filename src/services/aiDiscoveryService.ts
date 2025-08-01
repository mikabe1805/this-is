import OpenAI from 'openai'
import type { User, Place, List, Post } from '../types/index.js'
import { aiSearchService } from './aiSearchService.js'

// ========================================
// AI-POWERED DISCOVERY & PERSONALIZATION SERVICE
// ========================================

export interface UserBehaviorPattern {
  preferredCategories: string[]
  activityTimes: string[]
  socialPreferences: 'solo' | 'group' | 'mixed'
  explorationStyle: 'adventurous' | 'conservative' | 'balanced'
  locationPreferences: 'urban' | 'nature' | 'mixed'
  pricePreferences: 'budget' | 'mid-range' | 'premium' | 'mixed'
}

export interface AIPersonalityInsights {
  personality: string[]
  interests: string[]
  lifestyle: string[]
  motivations: string[]
  confidence: number
}

export interface SmartRecommendation {
  item: Place | List
  type: 'place' | 'list'
  score: number
  personalityMatch: number
  reasons: string[]
  aiInsights: string[]
  category: 'personality_match' | 'social_discovery' | 'trending_for_you' | 'hidden_gem'
}

class AIDiscoveryService {
  private openai: OpenAI | null = null
  private personalityCache = new Map<string, AIPersonalityInsights>()
  private behaviorPatterns = new Map<string, UserBehaviorPattern>()

  constructor() {
    this.initializeAI()
  }

  private initializeAI() {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY
    const isEnabled = import.meta.env.VITE_ENABLE_AI_SEARCH === 'true'
    
    if (apiKey && isEnabled) {
      this.openai = new OpenAI({
        apiKey,
        dangerouslyAllowBrowser: true
      })
      console.log('🧠 AI Discovery Service initialized')
    }
  }

  /**
   * Analyze user personality and preferences from their behavior
   */
  async analyzeUserPersonality(
    user: User, 
    userPosts: Post[], 
    savedPlaces: Place[], 
    likedLists: List[]
  ): Promise<AIPersonalityInsights | null> {
    if (!this.openai) return null

    // Check cache first
    if (this.personalityCache.has(user.id)) {
      return this.personalityCache.get(user.id)!
    }

    try {
      // Combine user data into analysis text
      const userBio = user.bio || 'No bio provided'
      const userTags = (user.tags || []).join(', ')
      const postDescriptions = userPosts.slice(0, 10).map(p => p.description).join('. ')
      const savedPlaceNames = savedPlaces.slice(0, 10).map(p => `${p.name} (${p.category})`).join(', ')
      const likedListNames = likedLists.slice(0, 5).map(l => l.name).join(', ')

      const analysisText = `
User Profile Analysis:
Bio: ${userBio}
Interests: ${userTags}
Recent Posts: ${postDescriptions}
Saved Places: ${savedPlaceNames}
Liked Lists: ${likedListNames}
      `.trim()

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are an expert personality analyst for a location discovery app. 
            
            Analyze the user's personality, interests, lifestyle, and motivations based on their activity.
            
            Return a JSON object with:
            {
              "personality": ["trait1", "trait2", "trait3"], // 3-5 personality traits
              "interests": ["interest1", "interest2", "interest3"], // 3-5 main interests
              "lifestyle": ["aspect1", "aspect2"], // 2-3 lifestyle aspects
              "motivations": ["motivation1", "motivation2"], // 2-3 core motivations
              "confidence": 0.85 // confidence score 0-1
            }
            
            Be specific and insightful. Focus on traits that would help recommend places and experiences.`
          },
          {
            role: 'user',
            content: analysisText
          }
        ],
        max_tokens: 300,
        temperature: 0.3
      })

      const result = response.choices[0]?.message?.content
      if (!result) return null

      const insights: AIPersonalityInsights = JSON.parse(result)
      
      // Cache the result
      this.personalityCache.set(user.id, insights)
      
      console.log(`🧠 AI analyzed personality for ${user.name}:`, insights)
      return insights

    } catch (error) {
      console.error('Error analyzing user personality:', error)
      return null
    }
  }

  /**
   * Generate AI-powered personalized recommendations
   */
  async generatePersonalizedRecommendations(
    user: User,
    personalityInsights: AIPersonalityInsights,
    allPlaces: Place[],
    allLists: List[],
    userHistory: {
      savedPlaces: Place[]
      likedLists: List[]
      visitedPlaces: Place[]
    }
  ): Promise<SmartRecommendation[]> {
    if (!this.openai) return []

    try {
      const recommendations: SmartRecommendation[] = []

      // Process places and lists for recommendations
      const items = [
        ...allPlaces.map(p => ({ item: p, type: 'place' as const })),
        ...allLists.map(l => ({ item: l, type: 'list' as const }))
      ]

      for (const { item, type } of items.slice(0, 50)) { // Limit for API efficiency
        // Skip items user already interacted with
        const isKnown = type === 'place' 
          ? userHistory.savedPlaces.some(p => p.id === item.id) || userHistory.visitedPlaces.some(p => p.id === item.id)
          : userHistory.likedLists.some(l => l.id === item.id)

        if (isKnown) continue

        // Create item description for AI analysis
        const itemDescription = type === 'place'
          ? `${(item as Place).name} - ${(item as Place).category} at ${(item as Place).address}. Tags: ${(item as Place).tags?.join(', ')}`
          : `${(item as List).name} - ${(item as List).description}. Tags: ${(item as List).tags?.join(', ')}`

        // Analyze personality match
        const personalityMatch = await this.analyzePersonalityMatch(
          personalityInsights,
          itemDescription,
          type
        )

        if (personalityMatch && personalityMatch.score > 0.7) {
          recommendations.push({
            item,
            type,
            score: Math.round(personalityMatch.score * 100),
            personalityMatch: personalityMatch.score,
            reasons: personalityMatch.reasons,
            aiInsights: personalityMatch.insights,
            category: this.determineRecommendationCategory(personalityMatch.score, item, type)
          })
        }

        // Limit API calls
        if (recommendations.length >= 15) break
      }

      // Sort by score and return top recommendations
      return recommendations
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)

    } catch (error) {
      console.error('Error generating personalized recommendations:', error)
      return []
    }
  }

  /**
   * Analyze how well an item matches user personality
   */
  private async analyzePersonalityMatch(
    personalityInsights: AIPersonalityInsights,
    itemDescription: string,
    itemType: 'place' | 'list'
  ): Promise<{ score: number; reasons: string[]; insights: string[] } | null> {
    if (!this.openai) return null

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are an expert at matching places/lists to user personalities.

            Given a user's personality analysis and a ${itemType} description, determine how well they match.

            Return JSON:
            {
              "score": 0.85, // match score 0-1
              "reasons": ["reason1", "reason2"], // 2-3 specific reasons why it matches
              "insights": ["insight1", "insight2"] // 1-2 deeper personality insights
            }

            Consider personality traits, interests, lifestyle, and motivations. Be specific and insightful.`
          },
          {
            role: 'user',
            content: `User Personality:
Traits: ${personalityInsights.personality.join(', ')}
Interests: ${personalityInsights.interests.join(', ')}
Lifestyle: ${personalityInsights.lifestyle.join(', ')}
Motivations: ${personalityInsights.motivations.join(', ')}

${itemType.charAt(0).toUpperCase() + itemType.slice(1)}: ${itemDescription}`
          }
        ],
        max_tokens: 200,
        temperature: 0.3
      })

      const result = response.choices[0]?.message?.content
      if (!result) return null

      return JSON.parse(result)

    } catch (error) {
      console.error('Error analyzing personality match:', error)
      return null
    }
  }

  /**
   * Determine recommendation category based on score and item characteristics
   */
  private determineRecommendationCategory(
    score: number, 
    item: Place | List, 
    type: 'place' | 'list'
  ): SmartRecommendation['category'] {
    if (score >= 0.9) return 'personality_match'
    
    if (type === 'place') {
      const place = item as Place
      if (place.savedCount && place.savedCount < 10) return 'hidden_gem'
      if (place.savedCount && place.savedCount > 50) return 'trending_for_you'
    } else {
      const list = item as List
      if (list.likes && list.likes < 5) return 'hidden_gem'
      if (list.likes && list.likes > 20) return 'trending_for_you'
    }
    
    return 'social_discovery'
  }

  /**
   * Extract user behavior patterns from activity
   */
  extractBehaviorPatterns(
    user: User,
    posts: Post[],
    savedPlaces: Place[],
    likedLists: List[]
  ): UserBehaviorPattern {
    // Analyze categories from saved places
    const categories = savedPlaces.map(p => p.category).filter(Boolean)
    const categoryCount = categories.reduce((acc, cat) => {
      acc[cat!] = (acc[cat!] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const preferredCategories = Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([cat]) => cat)

    // Analyze posting times (simplified)
    const postTimes = posts.map(p => new Date(p.createdAt).getHours())
    const avgPostTime = postTimes.reduce((a, b) => a + b, 0) / postTimes.length || 12
    
    let activityTimes: string[]
    if (avgPostTime < 10) activityTimes = ['morning']
    else if (avgPostTime < 14) activityTimes = ['afternoon'] 
    else if (avgPostTime < 18) activityTimes = ['evening']
    else activityTimes = ['night']

    // Determine social preferences from post types and descriptions
    const socialWords = posts.map(p => p.description.toLowerCase())
      .join(' ')
    
    let socialPreferences: UserBehaviorPattern['socialPreferences'] = 'mixed'
    if (socialWords.includes('alone') || socialWords.includes('solo')) {
      socialPreferences = 'solo'
    } else if (socialWords.includes('friends') || socialWords.includes('group')) {
      socialPreferences = 'group'
    }

    const pattern: UserBehaviorPattern = {
      preferredCategories,
      activityTimes,
      socialPreferences,
      explorationStyle: 'balanced', // Can be enhanced with more analysis
      locationPreferences: 'mixed',
      pricePreferences: 'mixed'
    }

    this.behaviorPatterns.set(user.id, pattern)
    return pattern
  }

  /**
   * Check if AI discovery is enabled
   */
  isEnabled(): boolean {
    return this.openai !== null
  }

  /**
   * Clear caches for testing
   */
  clearCaches() {
    this.personalityCache.clear()
    this.behaviorPatterns.clear()
    console.log('🧹 AI Discovery caches cleared')
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      personalityProfiles: this.personalityCache.size,
      behaviorPatterns: this.behaviorPatterns.size,
      isEnabled: this.isEnabled()
    }
  }
}

// Export singleton instance
export const aiDiscoveryService = new AIDiscoveryService()
export default aiDiscoveryService