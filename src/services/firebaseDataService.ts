import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  Timestamp,
  QuerySnapshot,
  startAfter,
  endBefore,
  QueryConstraint
} from 'firebase/firestore'
import { db } from '../firebase/config'
import type { User, Place, List, Post, Comment, Activity } from '../types'

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

  private async searchPlaces(searchQuery: string, filters: any, limit: number): Promise<Place[]> {
    const constraints: QueryConstraint[] = []
    
    if (filters.category) {
      constraints.push(where('category', '==', filters.category))
    }
    
    if (filters.tags && filters.tags.length > 0) {
      constraints.push(where('tags', 'array-contains-any', filters.tags))
    }

    constraints.push(orderBy('savedCount', 'desc'))
    constraints.push(limit(limit))

    const placesQuery = query(collection(db, 'places'), ...constraints)
    const placesSnapshot = await getDocs(placesQuery)
    
    const places = placesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Place[]

    // Filter by name/address if search query provided
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase()
      return places.filter(place => 
        place.name.toLowerCase().includes(searchLower) ||
        place.address.toLowerCase().includes(searchLower) ||
        place.tags.some(tag => tag.toLowerCase().includes(searchLower))
      )
    }

    return places
  }

  private async searchLists(searchQuery: string, filters: any, limit: number): Promise<List[]> {
    const constraints: QueryConstraint[] = [
      where('isPublic', '==', true),
      orderBy('likes', 'desc'),
      limit(limit)
    ]

    if (filters.tags && filters.tags.length > 0) {
      constraints.push(where('tags', 'array-contains-any', filters.tags))
    }

    const listsQuery = query(collection(db, 'lists'), ...constraints)
    const listsSnapshot = await getDocs(listsQuery)
    
    const lists = listsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as List[]

    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase()
      return lists.filter(list => 
        list.name.toLowerCase().includes(searchLower) ||
        list.description.toLowerCase().includes(searchLower) ||
        list.tags.some(tag => tag.toLowerCase().includes(searchLower))
      )
    }

    return lists
  }

  private async searchUsers(searchQuery: string, filters: any, limit: number): Promise<User[]> {
    const usersQuery = query(
      collection(db, 'users'),
      orderBy('influences', 'desc'),
      limit(limit)
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

  private async searchPosts(searchQuery: string, filters: any, limit: number): Promise<Post[]> {
    const postsQuery = query(
      collection(db, 'posts'),
      where('privacy', '==', 'public'),
      orderBy('likes', 'desc'),
      limit(limit)
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