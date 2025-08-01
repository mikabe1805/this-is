import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, orderBy, limit, startAfter, endBefore, onSnapshot, Timestamp, QueryConstraint } from 'firebase/firestore'
import { db } from '../firebase/config'
import type { User, Place, List, Post, Comment, Activity } from '../types'
import { auth } from '../firebase/config'


export interface SearchContext {
  currentUser: User
  friends: User[]
  following: User[]
  recentSearches: string[]
  userPreferences: UserPreferences
}

export interface UserPreferences {
  favoriteCategories: string[]
  preferredPriceRange: string[]
  socialPreferences: {
    exploreNew: number
    followFriends: number
    trendingContent: number
  }
  locationPreferences: {
    nearbyRadius: number
    preferredAreas: string[]
  }
  interactionHistory: {
    savedPlaces: string[]
    likedPosts: string[]
    visitedLists: string[]
    searchHistory: string[]
  }
}

export interface FirebaseSearchData {
  places: Place[]
  lists: List[]
  users: User[]
  posts: Post[]
  totalResults: {
    places: number
    lists: number
    users: number
    posts: number
  }
}

class FirebaseDataService {
  private userPreferencesCache = new Map<string, UserPreferences>()
  private searchCache = new Map<string, { data: FirebaseSearchData; timestamp: number }>()
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  // ====================
  // USER MANAGEMENT
  // ====================

  async getCurrentUser(userId: string): Promise<User | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId))
      if (userDoc.exists()) {
        return { id: userDoc.id, ...userDoc.data() } as User
      }
      return null
    } catch (error) {
      console.error('Error fetching current user:', error)
      return null
    }
  }

  async getUserFriends(userId: string): Promise<User[]> {
    try {
      const friendsQuery = query(
        collection(db, 'users', userId, 'friends'),
        orderBy('addedAt', 'desc')
      )
      const friendsSnapshot = await getDocs(friendsQuery)
      
      // Get full user details for each friend
      const friendPromises = friendsSnapshot.docs.map(async (friendDoc) => {
        const friendId = friendDoc.data().friendId
        return this.getCurrentUser(friendId)
      })
      
      const friends = await Promise.all(friendPromises)
      return friends.filter(friend => friend !== null) as User[]
    } catch (error) {
      console.error('Error fetching user friends:', error)
      return []
    }
  }

  async getUserFollowing(userId: string): Promise<User[]> {
    try {
      const followingQuery = query(
        collection(db, 'users', userId, 'following'),
        orderBy('followedAt', 'desc')
      )
      const followingSnapshot = await getDocs(followingQuery)
      
      const followingPromises = followingSnapshot.docs.map(async (followDoc) => {
        const followedId = followDoc.data().userId
        return this.getCurrentUser(followedId)
      })
      
      const following = await Promise.all(followingPromises)
      return following.filter(user => user !== null) as User[]
    } catch (error) {
      console.error('Error fetching user following:', error)
      return []
    }
  }

  // ====================
  // USER PREFERENCES
  // ====================

  async getUserPreferences(userId: string): Promise<UserPreferences> {
    // Check cache first
    if (this.userPreferencesCache.has(userId)) {
      return this.userPreferencesCache.get(userId)!
    }

    try {
      const prefsDoc = await getDoc(doc(db, 'userPreferences', userId))
      let preferences: UserPreferences

      if (prefsDoc.exists()) {
        preferences = prefsDoc.data() as UserPreferences
      } else {
        // Create default preferences based on user activity
        preferences = await this.generateInitialPreferences(userId)
        await this.saveUserPreferences(userId, preferences)
      }

      this.userPreferencesCache.set(userId, preferences)
      return preferences
    } catch (error) {
      console.error('Error fetching user preferences:', error)
      return this.getDefaultPreferences()
    }
  }

  async saveUserPreferences(userId: string, preferences: UserPreferences): Promise<void> {
    try {
      await setDoc(doc(db, 'userPreferences', userId), {
        ...preferences,
        updatedAt: Timestamp.now()
      })
      this.userPreferencesCache.set(userId, preferences)
    } catch (error) {
      console.error('Error saving user preferences:', error)
    }
  }

  private async generateInitialPreferences(userId: string): Promise<UserPreferences> {
    try {
      // Analyze user's saved places to determine favorite categories
      const savedPlacesQuery = query(
        collection(db, 'users', userId, 'savedPlaces'),
        orderBy('savedAt', 'desc'),
        limit(50)
      )
      const savedPlacesSnapshot = await getDocs(savedPlacesQuery)
      
      const categoryCount: Record<string, number> = {}
      const savedPlaceIds: string[] = []
      
      for (const doc of savedPlacesSnapshot.docs) {
        const placeId = doc.data().placeId
        savedPlaceIds.push(placeId)
        
        const place = await this.getPlace(placeId)
        if (place && place.category) {
          categoryCount[place.category] = (categoryCount[place.category] || 0) + 1
        }
      }

      const favoriteCategories = Object.entries(categoryCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([category]) => category)

      // Analyze liked posts for additional insights
      const likedPostsQuery = query(
        collection(db, 'users', userId, 'likedPosts'),
        orderBy('likedAt', 'desc'),
        limit(30)
      )
      const likedPostsSnapshot = await getDocs(likedPostsQuery)
      const likedPostIds = likedPostsSnapshot.docs.map(doc => doc.data().postId)

      return {
        favoriteCategories,
        preferredPriceRange: ['$', '$$'], // Default to moderate pricing
        socialPreferences: {
          exploreNew: 0.6,
          followFriends: 0.8,
          trendingContent: 0.4
        },
        locationPreferences: {
          nearbyRadius: 10, // 10km default
          preferredAreas: []
        },
        interactionHistory: {
          savedPlaces: savedPlaceIds,
          likedPosts: likedPostIds,
          visitedLists: [],
          searchHistory: []
        }
      }
    } catch (error) {
      console.error('Error generating initial preferences:', error)
      return this.getDefaultPreferences()
    }
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      favoriteCategories: [],
      preferredPriceRange: ['$', '$$'],
      socialPreferences: {
        exploreNew: 0.5,
        followFriends: 0.7,
        trendingContent: 0.3
      },
      locationPreferences: {
        nearbyRadius: 5,
        preferredAreas: []
      },
      interactionHistory: {
        savedPlaces: [],
        likedPosts: [],
        visitedLists: [],
        searchHistory: []
      }
    }
  }

  // ====================
  // AI ANALYSIS UTILITIES
  // ====================

  private async analyzeUserBio(bio: string): Promise<{
    interests: string[]
    preferences: string[]
    suggestedCategories: string[]
    suggestedTags: string[]
  }> {
    if (!bio || bio.trim().length < 10) {
      return {
        interests: [],
        preferences: [],
        suggestedCategories: [],
        suggestedTags: []
      }
    }

    try {
      // Simple keyword-based analysis for now
      // In a real implementation, this would use an AI service like OpenAI GPT
      const bioLower = bio.toLowerCase()
      
      // Define keyword mappings for interests and categories
      const keywordMappings = {
        food: {
          keywords: ['food', 'cooking', 'eating', 'chef', 'restaurant', 'culinary', 'dining', 'taste', 'flavor', 'recipe'],
          categories: ['Restaurants', 'Food Trucks', 'Markets'],
          tags: ['foodie', 'culinary', 'dining']
        },
        coffee: {
          keywords: ['coffee', 'espresso', 'latte', 'cappuccino', 'cafe', 'caffeine', 'brew'],
          categories: ['Coffee Shops'],
          tags: ['coffee enthusiast', 'caffeine', 'cozy']
        },
        nature: {
          keywords: ['nature', 'hiking', 'outdoors', 'park', 'trail', 'mountain', 'forest', 'trees', 'wildlife'],
          categories: ['Parks & Nature', 'Hiking Trails', 'Outdoor Activities'],
          tags: ['nature enthusiast', 'hiking', 'outdoors']
        },
        art: {
          keywords: ['art', 'painting', 'drawing', 'creative', 'design', 'artist', 'gallery', 'museum'],
          categories: ['Art Galleries', 'Museums', 'Creative Spaces'],
          tags: ['art aficionado', 'creative', 'visual artist']
        },
        fitness: {
          keywords: ['fitness', 'gym', 'workout', 'exercise', 'yoga', 'running', 'sports', 'health'],
          categories: ['Sports & Fitness', 'Yoga Studios'],
          tags: ['fitness enthusiast', 'health conscious', 'active']
        },
        music: {
          keywords: ['music', 'concert', 'band', 'singing', 'musician', 'guitar', 'piano', 'jazz', 'rock'],
          categories: ['Live Music', 'Entertainment'],
          tags: ['music lover', 'musician', 'live music']
        },
        travel: {
          keywords: ['travel', 'explore', 'adventure', 'journey', 'discover', 'wanderlust', 'trip'],
          categories: ['Tourist Attractions', 'Adventure Sports'],
          tags: ['adventurer', 'travel blogger', 'explorer']
        },
        work: {
          keywords: ['work', 'business', 'professional', 'meeting', 'coworking', 'laptop', 'remote'],
          categories: ['Co-working Spaces'],
          tags: ['remote worker', 'professional', 'digital nomad']
        },
        social: {
          keywords: ['social', 'friends', 'community', 'networking', 'people', 'party', 'gathering'],
          categories: ['Community Centers', 'Bars & Nightlife'],
          tags: ['social butterfly', 'community builder', 'networker']
        }
      }

      const detectedInterests: string[] = []
      const detectedCategories: string[] = []
      const detectedTags: string[] = []
      const detectedPreferences: string[] = []

      // Analyze bio for keywords
      Object.entries(keywordMappings).forEach(([interest, mapping]) => {
        const hasKeyword = mapping.keywords.some(keyword => bioLower.includes(keyword))
        if (hasKeyword) {
          detectedInterests.push(interest)
          detectedCategories.push(...mapping.categories)
          detectedTags.push(...mapping.tags)
        }
      })

      // Extract preferences based on descriptive words
      const preferenceKeywords = {
        'cozy': ['cozy', 'comfortable', 'warm', 'intimate', 'relaxed'],
        'trendy': ['trendy', 'modern', 'hip', 'stylish', 'contemporary'],
        'quiet': ['quiet', 'peaceful', 'calm', 'serene', 'tranquil'],
        'authentic': ['authentic', 'genuine', 'traditional', 'local', 'real'],
        'luxury': ['luxury', 'upscale', 'premium', 'high-end', 'exclusive'],
        'budget-friendly': ['cheap', 'affordable', 'budget', 'inexpensive', 'economical']
      }

      Object.entries(preferenceKeywords).forEach(([preference, keywords]) => {
        const hasKeyword = keywords.some(keyword => bioLower.includes(keyword))
        if (hasKeyword) {
          detectedPreferences.push(preference)
        }
      })

      return {
        interests: [...new Set(detectedInterests)],
        preferences: [...new Set(detectedPreferences)],
        suggestedCategories: [...new Set(detectedCategories)],
        suggestedTags: [...new Set(detectedTags)]
      }
    } catch (error) {
      console.error('Error analyzing user bio:', error)
      return {
        interests: [],
        preferences: [],
        suggestedCategories: [],
        suggestedTags: []
      }
    }
  }

  // ====================
  // USER CREATION & SETUP
  // ====================

  private async createUserProfile(userId: string, userData: {
    displayName: string
    email: string
    username?: string
    location: string
    bio?: string
    ageRange: string
    userTags?: string[]
    profilePictureUrl?: string
  }): Promise<void> {
    try {
      // Verify user is authenticated
      const currentUser = auth.currentUser
      if (!currentUser || currentUser.uid !== userId) {
        throw new Error('User not properly authenticated')
      }

      const userProfile = {
        id: userId,
        name: userData.displayName,
        username: userData.username || userData.displayName.toLowerCase().replace(/\s+/g, ''),
        location: userData.location,
        bio: userData.bio || '',
        influences: 0,
        tags: userData.userTags || [],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        email: userData.email,
        ageRange: userData.ageRange,
        avatar: userData.profilePictureUrl || ''
      }

      console.log('💾 Saving user profile with avatar:', userData.profilePictureUrl)
      await setDoc(doc(db, 'users', userId), userProfile)
      console.log('✅ User profile created successfully')
    } catch (error) {
      console.error('❌ Error creating user profile:', error)
      throw error
    }
  }

  async initializeUserPreferences(userId: string, signupData: {
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
  }): Promise<void> {
    try {
      // Convert signup data to UserPreferences format
      const preferences: UserPreferences = {
        favoriteCategories: signupData.favoriteCategories,
        preferredPriceRange: signupData.budgetPreferences,
        socialPreferences: {
          exploreNew: signupData.socialPreferences.exploreNew / 100, // Convert percentage to decimal
          followFriends: signupData.socialPreferences.followFriends / 100,
          trendingContent: signupData.socialPreferences.trendingContent / 100
        },
        locationPreferences: {
          nearbyRadius: signupData.discoveryRadius,
          preferredAreas: [signupData.location]
        },
        interactionHistory: {
          savedPlaces: [],
          likedPosts: [],
          visitedLists: [],
          searchHistory: []
        }
      }

      await this.saveUserPreferences(userId, preferences)

      console.log('User preferences initialized successfully')
    } catch (error) {
      console.error('Error initializing user preferences:', error)
      throw error
    }
  }

  async setupNewUser(userId: string, userData: {
    displayName: string
    email: string
    location: string
    bio?: string
    ageRange?: string
    favoriteCategories: string[]
    activityPreferences: string[]
    budgetPreferences: string[]
    socialPreferences: {
      exploreNew: number
      followFriends: number
      trendingContent: number
    }
    discoveryRadius: number
    username?: string
    userTags?: string[]
    profilePictureUrl?: string
  }): Promise<void> {
    try {
      // Analyze user bio with AI to enhance recommendations
      let enhancedCategories = [...userData.favoriteCategories]
      let enhancedTags = [...(userData.userTags || [])]
      let enhancedPreferences = [...userData.activityPreferences]

      if (userData.bio) {
        console.log('🤖 Analyzing user bio for personalized recommendations...')
        const bioAnalysis = await this.analyzeUserBio(userData.bio)
        
        // Merge AI suggestions with user selections (avoid duplicates)
        bioAnalysis.suggestedCategories.forEach(category => {
          if (!enhancedCategories.includes(category)) {
            enhancedCategories.push(category)
          }
        })
        
        bioAnalysis.suggestedTags.forEach(tag => {
          if (!enhancedTags.includes(tag)) {
            enhancedTags.push(tag)
          }
        })
        
        bioAnalysis.preferences.forEach(pref => {
          const prefLabel = pref.charAt(0).toUpperCase() + pref.slice(1).replace('-', ' ')
          if (!enhancedPreferences.includes(prefLabel)) {
            enhancedPreferences.push(prefLabel)
          }
        })

        console.log('✨ Bio analysis complete:', {
          originalCategories: userData.favoriteCategories.length,
          enhancedCategories: enhancedCategories.length,
          originalTags: userData.userTags?.length || 0,
          enhancedTags: enhancedTags.length,
          detectedInterests: bioAnalysis.interests
        })
      }

      // Create user profile with enhanced data
      await this.createUserProfile(userId, {
        displayName: userData.displayName,
        email: userData.email,
        location: userData.location,
        bio: userData.bio,
        ageRange: userData.ageRange || '18-25', // Default to 18-25 if not provided
        username: userData.username,
        userTags: enhancedTags,
        profilePictureUrl: userData.profilePictureUrl
      })

      // Initialize user preferences with enhanced data
      await this.initializeUserPreferences(userId, {
        favoriteCategories: enhancedCategories,
        activityPreferences: enhancedPreferences,
        budgetPreferences: userData.budgetPreferences,
        socialPreferences: userData.socialPreferences,
        discoveryRadius: userData.discoveryRadius,
        location: userData.location
      })

      // Generate and save baseline recommendations with enhanced data
      await this.generateBaselineRecommendations(userId, {
        favoriteCategories: enhancedCategories,
        activityPreferences: enhancedPreferences,
        budgetPreferences: userData.budgetPreferences,
        socialPreferences: userData.socialPreferences,
        discoveryRadius: userData.discoveryRadius,
        location: userData.location
      })

      console.log('✅ New user setup completed successfully with AI-enhanced preferences')
    } catch (error) {
      console.error('Error setting up new user:', error)
      throw error
    }
  }

  private async generateBaselineRecommendations(userId: string, signupPrefs: {
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
  }): Promise<void> {
    try {
      // Verify user is authenticated
      const currentUser = auth.currentUser
      if (!currentUser || currentUser.uid !== userId) {
        console.warn('User not properly authenticated for baseline recommendations, skipping...')
        return
      }

      // Use intelligent search service to generate baseline recommendations
      const recommendations = await createBaselineRecommendations(userId, signupPrefs)
      
      const batch: Promise<any>[] = []
      
      recommendations.forEach(rec => {
        const recData = {
          type: rec.type,
          itemId: rec.item.id,
          score: rec.score,
          reasons: rec.reasons,
          createdAt: Timestamp.now(),
          isBaseline: true
        }
        
        batch.push(
          setDoc(
            doc(db, 'users', userId, 'recommendations', `${rec.type}_${rec.item.id}`),
            recData
          )
        )
      })
      
      // Execute all recommendations saves
      await Promise.all(batch)
      
      console.log(`Generated ${recommendations.length} baseline recommendations for new user`)
    } catch (error) {
      console.error('Error generating baseline recommendations:', error)
      // Don't throw - recommendations are nice to have but not essential for signup
    }
  }

  // ====================
  // SEARCH DATA FETCHING
  // ====================

  async performSearch(
    searchQuery: string,
    filters: {
      category?: string
      priceRange?: string[]
      location?: string
      radius?: number
      tags?: string[]
    } = {},
    limit: number = 50
  ): Promise<FirebaseSearchData> {
    const cacheKey = `${searchQuery}_${JSON.stringify(filters)}_${limit}`
    
    // Check cache
    const cached = this.searchCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data
    }

    try {
      const searchResults = await Promise.all([
        this.searchPlaces(searchQuery, filters, limit),
        this.searchLists(searchQuery, filters, limit),
        this.searchUsers(searchQuery, filters, limit),
        this.searchPosts(searchQuery, filters, limit)
      ])

      const [places, lists, users, posts] = searchResults

      const data: FirebaseSearchData = {
        places,
        lists,
        users,
        posts,
        totalResults: {
          places: places.length,
          lists: lists.length,
          users: users.length,
          posts: posts.length
        }
      }

      // Cache the results
      this.searchCache.set(cacheKey, { data, timestamp: Date.now() })
      
      return data
    } catch (error) {
      console.error('Error performing search:', error)
      return {
        places: [],
        lists: [],
        users: [],
        posts: [],
        totalResults: { places: 0, lists: 0, users: 0, posts: 0 }
      }
    }
  }

  private async searchPlaces(searchQuery: string, filters: any, limitCount: number): Promise<Place[]> {
    console.log(`🏢 Searching places for: "${searchQuery}"`)
    
    const constraints: QueryConstraint[] = []

    // If we have a search query, we need to get more results first, then filter and rank
    if (searchQuery && searchQuery.trim()) {
      // For text search, get a larger set first, then filter client-side
      constraints.push(limit(limitCount * 5)) // Get 5x more results for better search coverage
    } else {
      // For browsing without search, order by popularity
      constraints.push(orderBy('savedCount', 'desc'))
      constraints.push(limit(limitCount))
    }

    if (filters.category) {
      constraints.push(where('category', '==', filters.category))
    }

    if (filters.tags && filters.tags.length > 0) {
      constraints.push(where('tags', 'array-contains-any', filters.tags))
    }

    const placesQuery = query(collection(db, 'places'), ...constraints)
    const placesSnapshot = await getDocs(placesQuery)
    
    let places = placesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Place[]

    // Debug: Log what we got from Firebase
    console.log(`🏢 Found ${places.length} places from Firebase:`)
    places.forEach(place => {
      const name = place.name || place.placeName || 'NO_NAME'
      const tags = place.tags || place.placeTags || []
      console.log(`  - ${name} (tags: ${Array.isArray(tags) ? tags.join(', ') : 'none'})`)
    })

    // AI search will handle relevance filtering, so we can remove the client-side filtering here.

    console.log(`🏢 Final places result: ${places.length} places`)
    return places
  }

  private async searchLists(searchQuery: string, filters: any, limitCount: number): Promise<List[]> {
    const constraints: QueryConstraint[] = [
      where('isPublic', '==', true)
    ]

    console.log(`🔍 Searching lists for: "${searchQuery}"`)

    // If we have a search query, we need to get more results first, then filter and rank
    if (searchQuery && searchQuery.trim()) {
      // For text search, get a larger set first, then filter client-side
      constraints.push(limit(limitCount * 5)) // Get 5x more results for better search coverage
    } else {
      // For browsing without search, order by popularity
      constraints.push(orderBy('likes', 'desc'))
      constraints.push(limit(limitCount))
    }

    if (filters.tags && filters.tags.length > 0) {
      constraints.push(where('tags', 'array-contains-any', filters.tags))
    }

    const listsQuery = query(collection(db, 'lists'), ...constraints)
    const listsSnapshot = await getDocs(listsQuery)
    
    let lists = listsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as List[]

    // Debug: Log what we got from Firebase
    console.log(`📋 Found ${lists.length} lists from Firebase:`)
    lists.forEach(list => {
      console.log(`  - ${list.name || list.listName || 'NO_NAME'} (tags: ${(list.tags || list.listTags || []).join(', ')})`)
    })

    // AI search will handle relevance filtering, so we can remove the client-side filtering here.

    return lists
  }

  private async searchUsers(searchQuery: string, filters: any, limitCount: number): Promise<User[]> {
    const usersQuery = query(
      collection(db, 'users'),
      orderBy('influences', 'desc'),
      limit(limitCount)
    )
    const usersSnapshot = await getDocs(usersQuery)
    
    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as User[]

    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase()
      return users.filter(user => 
        user.name.toLowerCase().includes(searchLower) ||
        user.username.toLowerCase().includes(searchLower) ||
        (user.bio && user.bio.toLowerCase().includes(searchLower)) ||
        (user.tags && user.tags.some(tag => tag.toLowerCase().includes(searchLower)))
      )
    }

    return users
  }

  private async searchPosts(searchQuery: string, filters: any, limitCount: number): Promise<Post[]> {
    const postsQuery = query(
      collection(db, 'posts'),
      where('privacy', '==', 'public'),
      orderBy('likes', 'desc'),
      limit(limitCount)
    )
    const postsSnapshot = await getDocs(postsQuery)
    
    const posts = postsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Post[]

    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase()
      return posts.filter(post => 
        post.description.toLowerCase().includes(searchLower)
      )
    }

    return posts
  }

  // ====================
  // INDIVIDUAL DATA FETCHERS
  // ====================

  async getPlace(placeId: string): Promise<Place | null> {
    try {
      const placeDoc = await getDoc(doc(db, 'places', placeId))
      if (placeDoc.exists()) {
        return { id: placeDoc.id, ...placeDoc.data() } as Place
      }
      return null
    } catch (error) {
      console.error('Error fetching place:', error)
      return null
    }
  }

  async getList(listId: string): Promise<List | null> {
    try {
      const listDoc = await getDoc(doc(db, 'lists', listId))
      if (listDoc.exists()) {
        return { id: listDoc.id, ...listDoc.data() } as List
      }
      return null
    } catch (error) {
      console.error('Error fetching list:', error)
      return null
    }
  }

  async getUserActivity(userId: string, limit: number = 50): Promise<Activity[]> {
    try {
      const activityQuery = query(
        collection(db, 'users', userId, 'activity'),
        orderBy('createdAt', 'desc'),
        limit(limit)
      )
      const activitySnapshot = await getDocs(activityQuery)
      
      return activitySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Activity[]
    } catch (error) {
      console.error('Error fetching user activity:', error)
      return []
    }
  }

  // ====================
  // REAL-TIME UPDATES
  // ====================

  async trackUserInteraction(
    userId: string, 
    action: 'search' | 'save' | 'like' | 'visit' | 'share',
    data: {
      query?: string
      placeId?: string
      listId?: string
      postId?: string
      duration?: number
    }
  ): Promise<void> {
    try {
      // Update user preferences based on action
      const preferences = await this.getUserPreferences(userId)
      
      if (action === 'search' && data.query) {
        preferences.interactionHistory.searchHistory.unshift(data.query)
        preferences.interactionHistory.searchHistory = preferences.interactionHistory.searchHistory.slice(0, 50)
      }
      
      if (action === 'save' && data.placeId) {
        preferences.interactionHistory.savedPlaces.unshift(data.placeId)
      }
      
      if (action === 'like' && data.postId) {
        preferences.interactionHistory.likedPosts.unshift(data.postId)
      }
      
      if (action === 'visit' && data.listId) {
        preferences.interactionHistory.visitedLists.unshift(data.listId)
      }

      await this.saveUserPreferences(userId, preferences)

      // Log activity for analytics
      await setDoc(doc(collection(db, 'analytics', 'userInteractions', 'events')), {
        userId,
        action,
        data,
        timestamp: Timestamp.now()
      })

    } catch (error) {
      console.error('Error tracking user interaction:', error)
    }
  }

  async updateUserTags(userId: string, tags: string[]): Promise<void> {
    try {
      await updateDoc(doc(db, 'users', userId), {
        tags: tags,
        updatedAt: Timestamp.now()
      })
      console.log('User tags updated successfully')
    } catch (error) {
      console.error('Error updating user tags:', error)
      throw error
    }
  }

  // ====================
  // SEARCH CONTEXT BUILDER
  // ====================

  async buildSearchContext(userId: string): Promise<SearchContext> {
    try {
      const [currentUser, friends, following, preferences] = await Promise.all([
        this.getCurrentUser(userId),
        this.getUserFriends(userId),
        this.getUserFollowing(userId),
        this.getUserPreferences(userId)
      ])

      if (!currentUser) {
        // If user doesn't exist (database not seeded yet), create a fallback context
        console.log('User not found in database, using fallback context for:', userId)
        
        const fallbackUser: User = {
          id: userId,
          username: `user_${userId}`,
          displayName: `Demo User`,
          email: `${userId}@demo.com`,
          bio: 'Demo user for testing',
          profilePicture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
          influences: 10,
          privacy: 'public',
          location: { lat: 37.7749, lng: -122.4194 },
          joinedAt: new Date(),
          followersCount: 5,
          followingCount: 8,
          isVerified: false
        }

        const fallbackPreferences: UserPreferences = {
          favoriteCategories: ['coffee', 'food'],
          preferredPriceRange: ['$', '$$'],
          socialPreferences: {
            exploreNew: 0.6,
            followFriends: 0.8,
            trendingContent: 0.4
          },
          locationPreferences: {
            nearbyRadius: 10,
            preferredAreas: ['Mission District', 'SOMA']
          },
          interactionHistory: {
            savedPlaces: [],
            likedPosts: [],
            visitedLists: [],
            searchHistory: ['coffee', 'tacos', 'cozy spots', 'work friendly']
          }
        }

        return {
          currentUser: fallbackUser,
          friends: [],
          following: [],
          recentSearches: fallbackPreferences.interactionHistory.searchHistory,
          userPreferences: fallbackPreferences
        }
      }

      return {
        currentUser,
        friends,
        following,
        recentSearches: preferences.interactionHistory.searchHistory.slice(0, 10),
        userPreferences: preferences
      }
    } catch (error) {
      console.error('Error building search context:', error)
      throw error
    }
  }

  // ====================
  // CACHE MANAGEMENT
  // ====================

  clearCache(): void {
    this.userPreferencesCache.clear()
    this.searchCache.clear()
  }

  clearUserCache(userId: string): void {
    this.userPreferencesCache.delete(userId)
    // Clear search cache entries for this user (simplified)
    this.searchCache.clear()
  }
}

// Export singleton instance
export const firebaseDataService = new FirebaseDataService()
export default firebaseDataService 