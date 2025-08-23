import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, orderBy, limit as fsLimit, startAfter, endBefore, onSnapshot, Timestamp, QueryConstraint, addDoc, deleteDoc, increment } from 'firebase/firestore'
import { db } from '../firebase/config'
import type { User, Place, List, Post, PostComment, Activity, Hub } from '../types'
import { auth } from '../firebase/config'
import { firebaseStorageService } from './firebaseStorageService'



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
  private userCache = new Map<string, { user: User; timestamp: number }>()
  private userActivityCache = new Map<string, { activities: Activity[]; timestamp: number }>()
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  // ====================
  // USER MANAGEMENT
  // ====================

  async getCurrentUser(userId: string): Promise<User | null> {
    const cached = this.userCache.get(userId)
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.user
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', userId))
      if (userDoc.exists()) {
        const user = { id: userDoc.id, ...userDoc.data() } as User
        this.userCache.set(userId, { user, timestamp: Date.now() })
        return user
      }
      return null
    } catch (error) {
      console.error('Error fetching current user:', error)
      return null
    }
  }

  async createUser(user: User): Promise<void> {
    try {
      await setDoc(doc(db, 'users', user.id), user);
    } catch (error) {
      console.error('Error creating user:', error);
    }
  }

  async getFollowers(userId: string): Promise<User[]> {
    try {
      const followersQuery = query(
        collection(db, 'users', userId, 'followers'),
        orderBy('followedAt', 'desc')
      );
      const followersSnapshot = await getDocs(followersQuery);
      
      const followerPromises = followersSnapshot.docs.map(async (followerDoc) => {
        const followerId = followerDoc.data().userId;
        return this.getCurrentUser(followerId);
      });
      
      const followers = await Promise.all(followerPromises);
      return followers.filter(user => user !== null) as User[];
    } catch (error) {
      console.error('Error fetching user followers:', error);
      return [];
    }
  }

  async getUserFriends(userId: string): Promise<User[]> {
    try {
      // For simplicity, we'll consider "friends" to be users who both follow each other.
      // A more optimized approach might involve storing a "friends" subcollection.
      const following = await this.getUserFollowing(userId);
      const followers = await this.getFollowers(userId);

      const followingIds = new Set(following.map(u => u.id));
      const friends = followers.filter(follower => followingIds.has(follower.id));
      
      return friends;
    } catch (error) {
      console.error('Error fetching user friends:', error);
      return [];
    }
  }

  async getUserFollowing(userId: string): Promise<User[]> {
    try {
      console.log(`Fetching following for user: ${userId}`);
      const followingQuery = query(
        collection(db, 'users', userId, 'following'),
        orderBy('followedAt', 'desc')
      )
      const followingSnapshot = await getDocs(followingQuery)
      console.log(`Found ${followingSnapshot.docs.length} following documents`);
      
      const followingPromises = followingSnapshot.docs.map(async (followDoc) => {
        const followedId = followDoc.data().userId
        console.log(`Fetching user data for: ${followedId}`);
        return this.getCurrentUser(followedId)
      })
      
      const following = await Promise.all(followingPromises)
      const filteredFollowing = following.filter(user => user !== null) as User[]
      console.log(`Returning ${filteredFollowing.length} following users`);
      return filteredFollowing
    } catch (error) {
      console.error('Error fetching user following:', error)
      return []
    }
  }

  async updateUserProfile(userId: string, profileData: Partial<User>): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        ...profileData,
        updatedAt: Timestamp.now()
      });
      this.clearUserCache(userId); // Invalidate cache
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  async followUser(currentUserId: string, targetUserId: string): Promise<void> {
    // Prevent self-following
    if (currentUserId === targetUserId) {
      console.log('Cannot follow yourself');
      return;
    }

    console.log(`Attempting to follow: ${currentUserId} -> ${targetUserId}`);

    const currentUserFollowingRef = doc(db, 'users', currentUserId, 'following', targetUserId);
    const targetUserFollowersRef = doc(db, 'users', targetUserId, 'followers', currentUserId);

    try {
      console.log('Setting follow document for current user...');
      console.log('Document path:', currentUserFollowingRef.path);
      await setDoc(currentUserFollowingRef, {
        userId: targetUserId,
        followedAt: Timestamp.now()
      });
      console.log('Follow document set for current user');

      console.log('Setting follower document for target user...');
      console.log('Document path:', targetUserFollowersRef.path);
      await setDoc(targetUserFollowersRef, {
        userId: currentUserId,
        followedAt: Timestamp.now()
      });
      console.log('Follower document set for target user');

      // For testing: automatically add as friend
      console.log('Adding as friend...');
      await this.addUserAsFriend(currentUserId, targetUserId);

      console.log(`User ${currentUserId} successfully followed ${targetUserId}`);
    } catch (error) {
      console.error('Error following user:', error);
      console.error('Error details:', {
        currentUserId,
        targetUserId,
        errorMessage: error.message,
        errorCode: error.code
      });
      throw error;
    }
  }

  async addUserAsFriend(currentUserId: string, targetUserId: string): Promise<void> {
    const currentUserFriendsRef = doc(db, 'users', currentUserId, 'friends', targetUserId);
    const targetUserFriendsRef = doc(db, 'users', targetUserId, 'friends', currentUserId);

    try {
      await setDoc(currentUserFriendsRef, {
        userId: targetUserId,
        addedAt: Timestamp.now()
      });
      await setDoc(targetUserFriendsRef, {
        userId: currentUserId,
        addedAt: Timestamp.now()
      });

      console.log(`User ${currentUserId} and ${targetUserId} are now friends`);
    } catch (error) {
      console.error('Error adding user as friend:', error);
      throw error;
    }
  }

  async unfollowUser(currentUserId: string, targetUserId: string): Promise<void> {
    const currentUserFollowingRef = doc(db, 'users', currentUserId, 'following', targetUserId);
    const targetUserFollowersRef = doc(db, 'users', targetUserId, 'followers', currentUserId);

    try {
      await deleteDoc(currentUserFollowingRef);
      await deleteDoc(targetUserFollowersRef);
    } catch (error) {
      console.error('Error unfollowing user:', error);
      throw error;
    }
  }

  async deleteUser(userId: string): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await deleteDoc(userRef);
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }
  
  async getSavedPosts(userId: string): Promise<Post[]> {
    // This assumes you have a 'savedPosts' subcollection for each user.
    // You might need to adjust this based on your actual data model.
    try {
      const savedPostsQuery = query(
        collection(db, 'users', userId, 'savedPosts'),
        orderBy('savedAt', 'desc')
      );
      const savedPostsSnapshot = await getDocs(savedPostsQuery);
      const postPromises = savedPostsSnapshot.docs.map(doc => this.getPost(doc.data().postId));
      const posts = await Promise.all(postPromises);
      return posts.filter(p => p !== null) as Post[];
    } catch (error) {
      console.error('Error fetching saved posts:', error);
      return [];
    }
  }

  async getUserPosts(userId: string): Promise<Post[]> {
    try {
      const postsQuery = query(
        collection(db, 'posts'),
        where('userId', '==', userId)
        // Temporarily removed orderBy to avoid index requirement
        // orderBy('createdAt', 'desc')
      );
      const postsSnapshot = await getDocs(postsQuery);
      const posts = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];
      
      // Sort posts client-side instead
      return posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('Error fetching user posts:', error);
      return [];
    }
  }


  async getPostsFromUsers(userIds: string[]): Promise<Post[]> {
    if (userIds.length === 0) {
      return [];
    }
    try {
      const postsQuery = query(
        collection(db, 'posts'),
        where('userId', 'in', userIds)
      );
      const postsSnapshot = await getDocs(postsQuery);
      return postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];
    } catch (error) {
      console.error('Error fetching posts from users:', error);
      return [];
    }
  }

  async getSavedLists(userId: string): Promise<List[]> {
    try {
      const savedListsQuery = query(
        collection(db, 'users', userId, 'savedLists'),
        orderBy('savedAt', 'desc')
      );
      const savedListsSnapshot = await getDocs(savedListsQuery);
      const listPromises = savedListsSnapshot.docs.map(doc => this.getList(doc.data().listId));
      const lists = await Promise.all(listPromises);
      return lists.filter(l => l !== null) as List[];
    } catch (error) {
      console.error('Error fetching saved lists:', error);
      return [];
    }
  }

  async getSavedPlaces(userId: string): Promise<Place[]> {
    try {
      const savedPlacesQuery = query(
        collection(db, 'users', userId, 'savedPlaces'),
        orderBy('savedAt', 'desc')
      );
      const savedPlacesSnapshot = await getDocs(savedPlacesQuery);
      const placePromises = savedPlacesSnapshot.docs.map(doc => this.getPlace(doc.data().placeId));
      return Promise.all(placePromises.filter(p => p !== null)) as Promise<Place[]>;
    } catch (error) {
      console.error('Error fetching saved places:', error);
      return [];
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
        fsLimit(50)
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
        fsLimit(30)
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
      /* await this.generateBaselineRecommendations(userId, {
        favoriteCategories: enhancedCategories,
        activityPreferences: enhancedPreferences,
        budgetPreferences: userData.budgetPreferences,
        socialPreferences: userData.socialPreferences,
        discoveryRadius: userData.discoveryRadius,
        location: userData.location
      }); */

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

  async checkUsernameAvailability(username: string): Promise<boolean> {
    try {
      const q = query(collection(db, 'users'), where('username', '==', username));
      const querySnapshot = await getDocs(q);
      return querySnapshot.empty; // True if username is available
    } catch (error) {
      console.error('Error checking username availability:', error);
      return false; // Fail safe
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
      constraints.push(fsLimit(limitCount * 5)) // Get 5x more results for better search coverage
    } else {
      // For browsing without search, order by popularity
      constraints.push(orderBy('savedCount', 'desc'))
      constraints.push(fsLimit(limitCount))
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

    // Client-side filtering when a text query is provided
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      places = places.filter(p => {
        const name = (p.name || (p as any).placeName || '').toLowerCase()
        const address = (p.address || '').toLowerCase()
        const tags = ((p.tags || (p as any).placeTags || []) as string[]).map(t => t.toLowerCase())
        return (
          name.includes(q) ||
          address.includes(q) ||
          tags.some(t => t.includes(q))
        )
      })
      // Basic relevance ranking: name > tags > address
      places.sort((a, b) => {
        const rank = (p: Place) => {
          const name = (p.name || (p as any).placeName || '').toLowerCase()
          const address = (p.address || '').toLowerCase()
          const tags = ((p.tags || (p as any).placeTags || []) as string[]).map(t => t.toLowerCase())
          if (name.includes(q)) return 0
          if (tags.some(t => t.includes(q))) return 1
          if (address.includes(q)) return 2
          return 3
        }
        return rank(a) - rank(b)
      })
      places = places.slice(0, limitCount)
    }

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
      constraints.push(fsLimit(limitCount * 5)) // Get 5x more results for better search coverage
    } else {
      // For browsing without search, order by popularity
      constraints.push(orderBy('likes', 'desc'))
      constraints.push(fsLimit(limitCount))
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
 
    // Client-side text filtering for list name/description/tags to ensure relevant results like 'cat'
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      lists = lists.filter(list => {
        const name = (list.name || list.listName || '').toLowerCase()
        const description = (list.description || '').toLowerCase()
        const tags = (list.tags || list.listTags || []).map(t => t.toLowerCase())
        return (
          name.includes(q) ||
          description.includes(q) ||
          tags.some((t: string) => t.includes(q))
        )
      })
      // Basic relevance: prioritize name matches, then tag, then description
      lists.sort((a, b) => {
        const rank = (l: List) => {
          const name = (l.name || l.listName || '').toLowerCase()
          const description = (l.description || '').toLowerCase()
          const tags = (l.tags || l.listTags || []).map(t => t.toLowerCase())
          if (name.includes(q)) return 0
          if (tags.some((t: string) => t.includes(q))) return 1
          if (description.includes(q)) return 2
          return 3
        }
        return rank(a) - rank(b)
      })
      // Trim to requested limit after filtering
      lists = lists.slice(0, limitCount)
    }
 
    return lists
  }

  private async searchUsers(searchQuery: string, filters: any, limitCount: number): Promise<User[]> {
    const usersQuery = query(
      collection(db, 'users'),
      orderBy('influences', 'desc'),
      fsLimit(limitCount)
    )
    const usersSnapshot = await getDocs(usersQuery)
    
    let users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as User[]

    // Optional user-tag filtering (via filters.tags)
    if (filters && Array.isArray(filters.tags) && filters.tags.length > 0) {
      const tagSet = new Set((filters.tags as string[]).map(t => t.toLowerCase()))
      users = users.filter(user => Array.isArray((user as any).tags) && (user as any).tags.some((tag: string) => tagSet.has(String(tag).toLowerCase())))
    }

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

  async searchPosts(searchQuery: string, filters: any, limitCount: number): Promise<Post[]> {
    const postsQuery = query(
      collection(db, 'posts'),
      where('privacy', '==', 'public'),
      orderBy('likes', 'desc'),
      fsLimit(limitCount)
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

  async getPlaceKeysLite(limitCount: number = 500): Promise<Array<{ id: string; name: string; address?: string; lat?: number; lng?: number }>> {
    try {
      const placesQuery = query(collection(db, 'places'), fsLimit(limitCount))
      const snap = await getDocs(placesQuery)
      return snap.docs.map(d => {
        const data: any = d.data()
        const lat = (data.coordinates && data.coordinates.lat) || data.location?.lat
        const lng = (data.coordinates && data.coordinates.lng) || data.location?.lng
        return { id: d.id, name: data.name || data.placeName || '', address: data.address || data.location?.address, lat, lng }
      })
    } catch (e) {
      console.warn('getPlaceKeysLite failed', e)
      return []
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

  async getPostsForHub(hubId: string): Promise<Post[]> {
    try {
      const postsQuery = query(
        collection(db, 'posts'),
        where('hubId', '==', hubId),
        orderBy('createdAt', 'desc')
      );
      const postsSnapshot = await getDocs(postsQuery);
      const posts = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];
      
      // Enrich posts with user information
      const enrichedPosts = await Promise.all(
        posts.map(async (post) => {
          if (post.userId && !post.username) {
            try {
              const username = await this.getUserDisplayName(post.userId);
              const user = await this.getCurrentUser(post.userId);
              return { 
                ...post, 
                username,
                userAvatar: user?.avatar || ''
              };
            } catch (error) {
              console.error('Error fetching username for post:', error);
              return { ...post, username: 'Unknown User', userAvatar: '' };
            }
          }
          return post;
        })
      );
      
      return enrichedPosts;
    } catch (error) {
      console.error('Error fetching posts for hub:', error);
      return [];
    }
  }

  async getPost(postId: string): Promise<Post | null> {
    try {
      const postDoc = await getDoc(doc(db, 'posts', postId))
      if (postDoc.exists()) {
        return { id: postDoc.id, ...postDoc.data() } as Post
      }
      return null
    } catch (error) {
      console.error('Error fetching post:', error)
      return null
    }
  }

  async getCommentsForPost(postId: string): Promise<PostComment[]> {
    try {
      console.log('firebaseDataService: Fetching comments for post:', postId);
      
      const commentsQuery = query(
        collection(db, 'posts', postId, 'comments'),
        orderBy('createdAt', 'desc')
      );
      const commentsSnapshot = await getDocs(commentsQuery);
      
      console.log('firebaseDataService: Found', commentsSnapshot.docs.length, 'comments');
      
      const comments = await Promise.all(commentsSnapshot.docs.map(async doc => {
        const commentData = doc.data() as PostComment;
        const user = await this.getCurrentUser(commentData.userId);
        return {
          id: doc.id,
          ...commentData,
          username: user?.username || 'Unknown User',
          userAvatar: user?.avatar || ''
        };
      }));
      
      console.log('firebaseDataService: Processed comments:', comments.length);
      return comments;
    } catch (error) {
      console.error('firebaseDataService: Error fetching comments for post:', error);
      return [];
    }
  }

  async postComment(postId: string, userId: string, text: string): Promise<PostComment | null> {
    try {
      console.log('firebaseDataService: Posting comment:', { postId, userId, text });
      
      const currentUser = await this.getCurrentUser(userId);
      if (!currentUser) {
        console.error('firebaseDataService: User not found for comment posting');
        throw new Error('User not found');
      }

      const newCommentRef = doc(collection(db, 'posts', postId, 'comments'));
      const newComment: PostComment = {
        id: newCommentRef.id,
        userId,
        username: currentUser.username,
        userAvatar: currentUser.avatar || '',
        text,
        createdAt: Timestamp.now().toDate().toISOString(), // Use proper timestamp
        likes: 0,
        likedBy: [],
      };

      console.log('firebaseDataService: Saving comment to Firestore:', newComment);
      await setDoc(newCommentRef, newComment);
      
      console.log('firebaseDataService: Comment saved successfully');
      return newComment;
    } catch (error) {
      console.error('firebaseDataService: Error posting comment:', error);
      return null;
    }
  }

  async likeComment(postId: string, commentId: string, userId: string): Promise<void> {
    try {
      const commentRef = doc(db, 'posts', postId, 'comments', commentId)
      const snap = await getDoc(commentRef)
      if (!snap.exists()) return
      const data = snap.data() as PostComment
      const likedBy = data.likedBy || []
      let likes = data.likes || 0
      if (likedBy.includes(userId)) {
        likes = Math.max(0, likes - 1)
        await updateDoc(commentRef, { likes, likedBy: likedBy.filter(id => id !== userId) })
      } else {
        likes += 1
        await updateDoc(commentRef, { likes, likedBy: [...likedBy, userId] })
      }
    } catch (error) {
      console.error('firebaseDataService: Error liking comment:', error)
    }
  }

  async addReplyToComment(postId: string, commentId: string, userId: string, text: string): Promise<{ id: string; userId: string; username: string; userAvatar: string; text: string; createdAt: string } | null> {
    try {
      const currentUser = await this.getCurrentUser(userId)
      if (!currentUser) throw new Error('User not found')

      const commentRef = doc(db, 'posts', postId, 'comments', commentId)
      const snap = await getDoc(commentRef)
      if (!snap.exists()) return null
      const data = snap.data() as PostComment & { replies?: any[] }

      const replyId = doc(collection(db, 'posts', postId, 'comments', commentId, 'replies')).id
      const reply = {
        id: replyId,
        userId,
        username: currentUser.username,
        userAvatar: currentUser.avatar || '',
        text,
        createdAt: new Date().toISOString()
      }

      const existingReplies = Array.isArray((data as any).replies) ? (data as any).replies : []
      await updateDoc(commentRef, { replies: [...existingReplies, reply] })
      return reply
    } catch (error) {
      console.error('firebaseDataService: Error adding reply to comment:', error)
      return null
    }
  }

  async postProfileComment(profileUserId: string, authorUserId: string, text: string): Promise<PostComment | null> {
    try {
      const author = await this.getCurrentUser(authorUserId);
      if (!author) {
        throw new Error('Author not found');
      }

      const newCommentRef = doc(collection(db, 'users', profileUserId, 'comments'));
      const newComment: PostComment = {
        id: newCommentRef.id,
        userId: authorUserId,
        username: author.username,
        userAvatar: author.avatar || '',
        text,
        createdAt: new Date().toISOString(),
        likes: 0,
        likedBy: [],
      };

      await setDoc(newCommentRef, newComment);
      return newComment;
    } catch (error) {
      console.error('Error posting profile comment:', error);
      return null;
    }
  }

  async likePost(postId: string, userId: string): Promise<void> {
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);

    if (postSnap.exists()) {
      const post = postSnap.data() as Post;
      const likedBy = post.likedBy || [];
      let newLikes = post.likes || 0;

      if (likedBy.includes(userId)) {
        // User has already liked, so unlike
        newLikes -= 1;
        const index = likedBy.indexOf(userId);
        likedBy.splice(index, 1);
      } else {
        // User has not liked, so like
        newLikes += 1;
        likedBy.push(userId);
      }

      await updateDoc(postRef, {
        likes: newLikes,
        likedBy: likedBy,
      });

      // Update hub banner image if this post might now be the most popular
      // Temporarily disabled to prevent banner flickering
      /*
      if (post.hubId) {
        // Use setTimeout to avoid blocking the UI
        setTimeout(() => {
          this.updateHubBannerImage(post.hubId);
        }, 100);
      }
      */
    }
  }

  async createPost(postData: Omit<Post, 'id' | 'createdAt' | 'images'> & { images: File[] }): Promise<string | null> {
    try {
      const newPostRef = doc(collection(db, 'posts'));
      const postId = newPostRef.id;

      const imageUrls = await firebaseStorageService.uploadPostImages(postId, postData.images);

      const finalPostData: Post = {
        ...postData,
        id: postId,
        images: imageUrls,
        createdAt: new Date().toISOString(),
        likes: 0,
        likedBy: [],
        commentCount: 0,
      };

      await setDoc(newPostRef, finalPostData);

      // Log activity for user feed
      try {
        await this.logActivity(postData.userId, {
          type: 'post',
          userId: postData.userId,
          postId: postId,
          createdAt: new Date().toISOString()
        })
      } catch (e) {
        console.warn('Failed to log post activity:', e)
      }

      // If the post is associated with lists, update those lists
      if (postData.listIds && postData.listIds.length > 0) {
        for (const listId of postData.listIds) {
          await this.savePostToList(postId, listId);
        }
      }

      // Update hub banner image if this might be the first post or most popular
      // Temporarily disabled to prevent banner flickering
      /*
      if (postData.hubId) {
        // Use setTimeout to avoid blocking the UI
        setTimeout(() => {
          this.updateHubBannerImage(postData.hubId);
        }, 100);
      }
      */
      
      return postId;
    } catch (error) {
      console.error('Error creating post:', error);
      return null;
    }
  }


  async likeList(listId: string, userId: string): Promise<void> {
    const listRef = doc(db, 'lists', listId);
    const listSnap = await getDoc(listRef);

    if (listSnap.exists()) {
      const list = listSnap.data() as List;
      const likedBy = list.likedBy || [];
      let newLikes = list.likes || 0;

      if (likedBy.includes(userId)) {
        newLikes -= 1;
        const index = likedBy.indexOf(userId);
        likedBy.splice(index, 1);
      } else {
        newLikes += 1;
        likedBy.push(userId);
      }

      await updateDoc(listRef, {
        likes: newLikes,
        likedBy: likedBy,
      });
    }
  }

  async saveList(listId: string, userId: string): Promise<void> {
    const userSavedListsRef = doc(db, 'users', userId, 'savedLists', listId);
    const userSavedListSnap = await getDoc(userSavedListsRef);

    if (userSavedListSnap.exists()) {
      // Remove from saved lists
      await deleteDoc(userSavedListsRef);
      // Decrement like count
      await this.updateListLikeCount(listId, -1);
    } else {
      // Add to saved lists
      await setDoc(userSavedListsRef, { listId, savedAt: Timestamp.now() });
      // Increment like count
      await this.updateListLikeCount(listId, 1);
      // Log activity
      try {
        await this.logActivity(userId, { type: 'save', userId, listId })
      } catch (e) {
        console.warn('Failed to log save list activity:', e)
      }
    }
  }

  private async updateListLikeCount(listId: string, incrementAmount: number): Promise<void> {
    try {
      const listRef = doc(db, 'lists', listId);
      await updateDoc(listRef, {
        likes: increment(incrementAmount)
      });
    } catch (error) {
      console.error('Error updating list like count:', error);
    }
  }

  async getListLikeCount(listId: string): Promise<number> {
    try {
      const listRef = doc(db, 'lists', listId);
      const listSnap = await getDoc(listRef);
      if (listSnap.exists()) {
        return listSnap.data().likes || 0;
      }
      return 0;
    } catch (error) {
      console.error('Error getting list like count:', error);
      return 0;
    }
  }

  async isListSavedByUser(listId: string, userId: string): Promise<boolean> {
    try {
      const userSavedListsRef = doc(db, 'users', userId, 'savedLists', listId);
      const userSavedListSnap = await getDoc(userSavedListsRef);
      return userSavedListSnap.exists();
    } catch (error) {
      console.error('Error checking if list is saved:', error);
      return false;
    }
  }


  async savePostToList(postId: string, listId: string): Promise<void> {
    const listRef = doc(db, 'lists', listId);
    const postRef = doc(db, 'posts', postId);

    try {
      const listDoc = await getDoc(listRef);
      if (!listDoc.exists()) {
        throw new Error(`List with id ${listId} does not exist.`);
      }

      // Add post to the list's posts subcollection or update a posts array
      // This example assumes a 'posts' subcollection on a list
      const listPostsRef = collection(listRef, 'posts');
      await setDoc(doc(listPostsRef, postId), { 
        postId: postId,
        addedAt: Timestamp.now()
      });

      // Also update the post document to link back to the list
      await updateDoc(postRef, {
        listId: listId
      });

      console.log(`Post ${postId} successfully saved to list ${listId}`);
    } catch (error) {
      console.error('Error saving post to list:', error);
    }
  }

  async savePlaceToList(placeId: string, listId: string, userId: string, note?: string, savedFromListId?: string, status?: 'loved' | 'tried' | 'want', triedRating?: 'liked' | 'neutral' | 'disliked'): Promise<void> {
    console.log('savePlaceToList called with:', { placeId, listId, userId, note, savedFromListId, status, triedRating });
    const listRef = doc(db, 'lists', listId);

    try {
      const listDoc = await getDoc(listRef);
      if (!listDoc.exists()) {
        throw new Error(`List with id ${listId} does not exist.`);
      }

      const listData = listDoc.data() as List;
      console.log('List data:', listData);
      
      // Add to subcollection with status and rating information
      const listPlacesRef = collection(listRef, 'places');
      await setDoc(doc(listPlacesRef, placeId), { 
        placeId: placeId,
        addedBy: userId,
        status: status || 'loved', // Default to loved if no status provided
        triedRating: status === 'tried' ? (triedRating || 'liked') : null, // Only include rating for tried status
        note: note || '',
        addedAt: Timestamp.now()
      });
      console.log('Added to subcollection successfully with status:', status);

      // Update the main list document's hubs array
      const updatedHubs = listData.hubs || [];
      console.log('Current hubs:', updatedHubs);
      if (!updatedHubs.includes(placeId)) {
        await updateDoc(listRef, {
          hubs: [...updatedHubs, placeId],
          updatedAt: Timestamp.now()
        });
        console.log('Updated hubs array successfully');
      } else {
        console.log('Place already in hubs array');
      }

      if (savedFromListId) {
        const fromListRef = doc(db, 'lists', savedFromListId);
        const fromListDoc = await getDoc(fromListRef);
        if (fromListDoc.exists()) {
          const fromList = fromListDoc.data() as List;
          await updateDoc(fromListRef, {
            savesFrom: (fromList.savesFrom || 0) + 1
          });
        }
      }

      // Log activity for user feed
      try {
        await this.logActivity(userId, { type: 'save', userId, placeId, listId })
      } catch (e) {
        console.warn('Failed to log save place activity:', e)
      }

      // Increment savedCount on the place to support discovery ranking
      try {
        const placeRef = doc(db, 'places', placeId)
        await updateDoc(placeRef, { savedCount: increment(1) })
      } catch (e) {
        console.warn('Failed to increment place savedCount', e)
      }

      console.log(`Place ${placeId} successfully saved to list ${listId}`);
    } catch (error) {
      console.error('Error saving place to list:', error);
    }
  }

  private cleanUndefined<T extends Record<string, any>>(obj: T): T {
    const out: Record<string, any> = {}
    Object.keys(obj).forEach((k) => {
      const v = (obj as any)[k]
      if (v !== undefined) out[k] = v
    })
    return out as T
  }

  async ensureAutoList(userId: string, status: 'loved' | 'tried' | 'want'): Promise<List> {
    const autoName = status === 'loved' ? 'All Loved' : status === 'tried' ? 'All Tried' : 'All Want'
    // Try to find existing
    const lists = await this.getUserLists(userId)
    const found = lists.find(l => (l.name || '').trim().toLowerCase() === autoName.toLowerCase() || ((l as any).tags||[]).includes('#auto-generated') && ((l as any).tags||[]).includes(`#${status}`))
    if (found) return found
    // Create if missing (private by default)
    const newId = await this.createList({
      name: autoName,
      description: '',
      privacy: 'private',
      tags: ['#auto-generated', `#${status}`],
      userId
    })
    if (!newId) throw new Error('Failed to create auto-generated list')
    const created = await this.getList(newId)
    if (!created) throw new Error('Auto-generated list not found after creation')
    return created
  }

  async saveToAutoList(placeId: string, userId: string, status: 'loved' | 'tried' | 'want', note?: string, rating?: 'liked' | 'neutral' | 'disliked'): Promise<void> {
    const autoList = await this.ensureAutoList(userId, status)
    const exists = await this.isPlaceInList(autoList.id, placeId)
    if (!exists) {
      await this.savePlaceToList(placeId, autoList.id, userId, note, undefined, status, rating)
    }
  }

  async createList(listData: { name: string; description: string; privacy: 'public' | 'private' | 'friends'; tags: string[], userId: string }): Promise<string | null> {
    try {
      const newListRef = doc(collection(db, 'lists'));
      const cleaned = this.cleanUndefined(listData)
      const list = this.cleanUndefined({
        id: newListRef.id,
        ...cleaned,
        isPublic: listData.privacy === 'public',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        hubs: [],
        likes: 0,
        isLiked: false,
      });
      await setDoc(newListRef, list);

      // Log activity for user feed
      try {
        await this.logActivity(listData.userId, {
          type: 'create_list',
          userId: listData.userId,
          listId: newListRef.id,
          createdAt: new Date().toISOString()
        })
      } catch (e) {
        console.warn('Failed to log create_list activity:', e)
      }
      return newListRef.id;
    } catch (error) {
      console.error('Error creating list:', error);
      return null;
    }
  }

  async getUserLists(userId: string): Promise<List[]> {
    if (!userId) {
      console.warn('getUserLists called with undefined userId');
      return [];
    }
    try {
      const listsQuery = query(
        collection(db, 'lists'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const listsSnapshot = await getDocs(listsQuery);
      return listsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as List[];
    } catch (error) {
      console.error('Error fetching user lists:', error);
      return [];
    }
  }

  async getListsContainingHub(hubId: string): Promise<List[]> {
    try {
      // Get all lists and check their places subcollections
      const listsQuery = query(collection(db, 'lists'));
      const listsSnapshot = await getDocs(listsQuery);
      
      const listsWithHub: List[] = [];
      
      for (const listDoc of listsSnapshot.docs) {
        const listData = listDoc.data() as List;
        
        // Check if this hub is in the list's places subcollection
        const placeRef = doc(db, 'lists', listDoc.id, 'places', hubId);
        const placeSnap = await getDoc(placeRef);
        
        if (placeSnap.exists()) {
          listsWithHub.push({ id: listDoc.id, ...listData });
        }
      }
      
      return listsWithHub;
    } catch (error) {
      console.error('Error fetching lists containing hub:', error);
      return [];
    }
  }

  async getFriendsListsContainingHub(hubId: string, currentUserId: string): Promise<List[]> {
    try {
      // Get current user's friends (mutual follows)
      const friends = await this.getUserFriends(currentUserId);
      const friendIds = friends.map(friend => friend.id);
      
      if (friendIds.length === 0) {
        return [];
      }

      // Get lists from friends and check their places subcollections
      const listsQuery = query(
        collection(db, 'lists'),
        where('userId', 'in', friendIds)
      );
      const listsSnapshot = await getDocs(listsQuery);
      
      const friendsListsWithHub: List[] = [];
      
      for (const listDoc of listsSnapshot.docs) {
        const listData = listDoc.data() as List;
        
        // Check if this hub is in the list's places subcollection
        const placeRef = doc(db, 'lists', listDoc.id, 'places', hubId);
        const placeSnap = await getDoc(placeRef);
        
        if (placeSnap.exists()) {
          friendsListsWithHub.push({ id: listDoc.id, ...listData });
        }
      }
      
      return friendsListsWithHub;
    } catch (error) {
      console.error('Error fetching friends lists containing hub:', error);
      return [];
    }
  }

  async getPostsForList(listId: string): Promise<Post[]> {
    try {
      const postsQuery = query(
        collection(db, 'posts'),
        where('listId', '==', listId),
        orderBy('createdAt', 'desc')
      );
      const postsSnapshot = await getDocs(postsQuery);
      const posts = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];
      
      // Enrich posts with user information
      const enrichedPosts = await Promise.all(
        posts.map(async (post) => {
          if (post.userId && !post.username) {
            try {
              const username = await this.getUserDisplayName(post.userId);
              return { ...post, username };
            } catch (error) {
              console.error('Error fetching username for post:', error);
              return { ...post, username: 'Unknown User' };
            }
          }
          return post;
        })
      );
      
      return enrichedPosts;
    } catch (error) {
      console.error('Error fetching posts for list:', error);
      return [];
    }
  }

  async getProfileComments(userId: string): Promise<PostComment[]> {
    try {
      console.log('firebaseDataService: Fetching profile comments for user:', userId);
      const commentsQuery = query(
        collection(db, 'users', userId, 'comments'),
        orderBy('createdAt', 'desc')
      );
      const commentsSnapshot = await getDocs(commentsQuery);
      console.log('firebaseDataService: Found', commentsSnapshot.docs.length, 'profile comments');
      
      const comments = await Promise.all(commentsSnapshot.docs.map(async doc => {
        const commentData = doc.data() as PostComment;
        const user = await this.getCurrentUser(commentData.userId);
        return {
          id: doc.id,
          ...commentData,
          username: user?.username || 'Unknown User',
          userAvatar: user?.avatar || ''
        };
      }));
      
      console.log('firebaseDataService: Processed profile comments:', comments.length);
      return comments;
    } catch (error) {
      console.error('firebaseDataService: Error fetching profile comments:', error);
      return [];
    }
  }

  async getBatchPostAndListData(
    activities: Activity[]
  ): Promise<{ posts: Post[]; lists: List[] }> {
    const postIds = activities
      .filter((a) => a.type === 'post' && a.postId)
      .map((a) => a.postId)
    const listIds = activities
      .filter((a) => (a.type === 'list' || a.type === 'create_list') && a.listId)
      .map((a) => a.listId)

    const posts: Post[] = []
    const lists: List[] = []

    try {
      // Firestore 'in' queries are limited to 30 items. Batch if necessary.
      const postPromises = []
      for (let i = 0; i < postIds.length; i += 10) {
        const batchIds = postIds.slice(i, i + 10)
        if (batchIds.length > 0) {
          const q = query(collection(db, 'posts'), where('__name__', 'in', batchIds))
          postPromises.push(getDocs(q))
        }
      }

      const listPromises = []
      for (let i = 0; i < listIds.length; i += 10) {
        const batchIds = listIds.slice(i, i + 10)
        if (batchIds.length > 0) {
          const q = query(collection(db, 'lists'), where('__name__', 'in', batchIds))
          listPromises.push(getDocs(q))
        }
      }

      const postSnapshots = await Promise.all(postPromises)
      postSnapshots.forEach((snapshot) => {
        snapshot.forEach((doc) => {
          posts.push({ id: doc.id, ...doc.data() } as Post)
        })
      })

      const listSnapshots = await Promise.all(listPromises)
      listSnapshots.forEach((snapshot) => {
        snapshot.forEach((doc) => {
          lists.push({ id: doc.id, ...doc.data() } as List)
        })
      })

      return { posts, lists }
    } catch (error) {
      console.error('Error fetching batch post and list data:', error)
      return { posts: [], lists: [] }
    }
  }


  async getUserActivity(userId: string, limitCount: number = 50): Promise<Activity[]> {
    const cached = this.userActivityCache.get(userId)
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.activities
    }

    try {
      const activityQuery = query(
        collection(db, 'users', userId, 'activity'),
        orderBy('createdAt', 'desc'),
        fsLimit(limitCount)
      )
      const activitySnapshot = await getDocs(activityQuery)
      
      let activities = activitySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Activity[]

      // Enrich activities with referenced data for UI convenience
      const enriched: Activity[] = []
      for (const a of activities) {
        const activity: any = { ...a }
        try {
          if (a.listId && !a.list) {
            const list = await this.getList(a.listId)
            if (list) activity.list = list
          }
          if (a.placeId && !a.place) {
            const place = await this.getPlace(a.placeId)
            if (place) activity.place = place
          }
        } catch {}
        enriched.push(activity as Activity)
      }

      activities = enriched

      this.userActivityCache.set(userId, { activities, timestamp: Date.now() })
      return activities
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
      userId?: string
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

  // Write a normalized activity entry for a user feed
  async logActivity(userId: string, activity: { type: 'save' | 'like' | 'post' | 'create_list'; userId: string; placeId?: string; listId?: string; postId?: string; createdAt?: string }): Promise<void> {
    try {
      const activityRef = doc(collection(db, 'users', userId, 'activity'))
      await setDoc(activityRef, {
        ...activity,
        createdAt: activity.createdAt || new Date().toISOString()
      })
      // Bust cache for that user's activity
      this.userActivityCache.delete(userId)
    } catch (error) {
      console.error('Error logging activity:', error)
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
  // GLOBAL TAG MANAGEMENT
  // ====================

  async getAllTags(): Promise<string[]> {
    try {
      const tagsSnapshot = await getDocs(collection(db, 'tags'))
      const tags: string[] = []
      tagsSnapshot.forEach(doc => {
        tags.push(doc.id)
      })
      return tags.sort()
    } catch (error) {
      console.error('Error fetching all tags:', error)
      return []
    }
  }

  async addTag(tagName: string): Promise<void> {
    try {
      const normalizedTag = tagName.toLowerCase().trim()
      if (!normalizedTag) return

      // Check if tag already exists
      const tagDoc = await getDoc(doc(db, 'tags', normalizedTag))
      if (tagDoc.exists()) {
        // Tag exists, increment usage count
        await updateDoc(doc(db, 'tags', normalizedTag), {
          usageCount: increment(1),
          lastUsed: Timestamp.now()
        })
      } else {
        // Create new tag
        await setDoc(doc(db, 'tags', normalizedTag), {
          name: normalizedTag,
          displayName: tagName.trim(),
          usageCount: 1,
          createdAt: Timestamp.now(),
          lastUsed: Timestamp.now()
        })
      }
      console.log(`Tag "${normalizedTag}" added/updated successfully`)
    } catch (error) {
      console.error('Error adding tag:', error)
      throw error
    }
  }

  async addTags(tagNames: string[]): Promise<void> {
    try {
      const uniqueTags = [...new Set(tagNames.map(tag => tag.toLowerCase().trim()).filter(tag => tag))]
      await Promise.all(uniqueTags.map(tag => this.addTag(tag)))
    } catch (error) {
      console.error('Error adding tags:', error)
      throw error
    }
  }

  async getPopularTags(limitCount: number = 20): Promise<string[]> {
    try {
      // Prefer ordering by usageCount when available
      try {
        const tagsQuery = query(
          collection(db, 'tags'),
          orderBy('usageCount', 'desc'),
          fsLimit(limitCount)
        )
        const tagsSnapshot = await getDocs(tagsQuery)
        const tags: string[] = []
        if (!tagsSnapshot.empty) {
          tagsSnapshot.forEach(docSnap => tags.push(docSnap.id))
          return tags
        }
      } catch {}

      // Fallback: no usageCount or query failed — return all tags sorted alphabetically
      const all = await getDocs(collection(db, 'tags'))
      const names = all.docs.map(d => d.id).sort()
      return names.slice(0, limitCount)
    } catch (error) {
      console.error('Error fetching popular tags:', error)
      return []
    }
  }

  // Suggest places for cold-start users based on interests and optional location
  async getSuggestedPlaces(options: { tags?: string[]; location?: { lat: number; lng: number }; limit?: number } = {}): Promise<Place[]> {
    const { tags = [], location, limit = 12 } = options
    try {
      // Try to fetch top places by savedCount/popularity first
      const q = query(
        collection(db, 'places'),
        orderBy('savedCount', 'desc'),
        fsLimit(Math.max(limit * 10, 100))
      )
      const snap = await getDocs(q)
      let places: any[] = []
      snap.forEach(d => places.push({ id: d.id, ...d.data() }))

      // If we have tag preferences, filter and rank by tag overlap
      if (tags.length > 0) {
        const tagSet = new Set(tags.map(t => t.toLowerCase()))
        const scored = places.map(p => {
          const ptags = (p.tags || []).map((t: string) => String(t).toLowerCase())
          const overlap = ptags.filter((t: string) => tagSet.has(t)).length
          let score = overlap * 5 + (p.savedCount || 0)
          // Light distance boost if user location available
          if (location && p.coordinates && typeof p.coordinates.lat === 'number' && typeof p.coordinates.lng === 'number') {
            const dlat = (p.coordinates.lat - location.lat)
            const dlng = (p.coordinates.lng - location.lng)
            const approxKm = Math.sqrt(dlat * dlat + dlng * dlng) * 111
            const distBoost = Math.max(0, 30 - Math.min(30, approxKm)) // up to +30 near
            score += distBoost
          }
          return { p, score }
        })
        places = scored.sort((a, b) => b.score - a.score).map(s => s.p)
      } else if (location) {
        // No tags: lightly sort by proximity if location given
        places = places.sort((a, b) => {
          const da = a.coordinates ? Math.hypot(a.coordinates.lat - location.lat, a.coordinates.lng - location.lng) : 1e9
          const db = b.coordinates ? Math.hypot(b.coordinates.lat - location.lat, b.coordinates.lng - location.lng) : 1e9
          return da - db
        })
      }

      return places.slice(0, limit)
    } catch (e) {
      console.warn('getSuggestedPlaces fallback', e)
      return []
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
    this.userCache.delete(userId)
    this.userActivityCache.delete(userId)
    // Clear search cache entries for this user (simplified)
    this.searchCache.clear()
  }

  async getExternalSuggestedPlaces(
    lat: number,
    lng: number,
    tags: string[] = [],
    limit = 12,
    options: { interests?: string[]; radiusKm?: number; openNow?: boolean } = {}
  ): Promise<Place[]> {
    try {
      const clientKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY
      const payload = { lat, lng, tags, limit, interests: options.interests || [], radiusKm: options.radiusKm ?? undefined, openNow: options.openNow ?? undefined, clientKey }
      // Use deployed Cloud Function only
      const cfUrl = 'https://us-central1-this-is-76332.cloudfunctions.net/suggestPlaces'
      const resp = await fetch(cfUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      } as any)
      if (!resp || !resp.ok) throw new Error('Request failed')
      const data = await resp.json()
      return data.places || []
    } catch (e) {
      console.warn('getExternalSuggestedPlaces failed', e)
      return []
    }
  }

  async geocodeLocation(query: string): Promise<{ lat: number; lng: number; address: string } | null> {
    try {
      // Try local rewrites first (emulator/hosting)
      const clientKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY
      let resp: any = await fetch(`/geocodeLocation?q=${encodeURIComponent(query)}&clientKey=${encodeURIComponent(clientKey || '')}` as any)
      if (!resp || !resp.ok) {
        // Fallback to deployed Cloud Function URL
        const cfUrl = 'https://us-central1-this-is-76332.cloudfunctions.net/geocodeLocation'
        resp = await fetch(`${cfUrl}?q=${encodeURIComponent(query)}&clientKey=${encodeURIComponent(clientKey || '')}` as any)
      }
      if (!resp || !resp.ok) return null
      const data = await (resp as any).json()
      console.log('[geocodeLocation] query ->', query, 'result ->', data)
      return data.location || null
    } catch {
      return null
    }
  }

  async createHub(hubData: { name: string, address: string, description: string, coordinates?: { lat: number, lng: number } }): Promise<string> {
    // Prevent duplicates: look for matching name and similar address first
    try {
      const nameLower = (hubData.name || '').toLowerCase().trim()
      if (nameLower) {
        const qname = query(collection(db, 'places'), where('name_lowercase', '==', nameLower), fsLimit(10))
        const snap = await getDocs(qname)
        const normalize = (v: string) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
        const addrNorm = normalize(hubData.address)
        for (const d of snap.docs) {
          const data: any = d.data()
          const existingAddr = data.address || data.location?.address || ''
          if (normalize(existingAddr) === addrNorm) {
            return d.id // Return existing hub id instead of creating a duplicate
          }
        }
      }
    } catch {}

    const hubRef = await addDoc(collection(db, 'places'), {
      name: hubData.name,
      description: hubData.description,
      location: {
        address: hubData.address,
        lat: hubData.coordinates?.lat || 0,
        lng: hubData.coordinates?.lng || 0
      },
      // Store coordinates in a dedicated field as well; other parts of the app read from this
      coordinates: {
        lat: hubData.coordinates?.lat || 0,
        lng: hubData.coordinates?.lng || 0
      },
      tags: [],
      savedCount: 0,
      name_lowercase: hubData.name.toLowerCase(),
      createdAt: Timestamp.now(),
      mainImage: '/assets/leaf.png' // Default banner image
    });
    return hubRef.id;
  }
  
  async searchHubs(queryText: string, count: number = 10): Promise<Hub[]> {
    try {
      const text = queryText.toLowerCase();
      const hubsRef = collection(db, 'places');
      
      // Get all hubs and filter client-side for more lenient matching
      const hubQuery = query(hubsRef, fsLimit(50)); // Get more results to filter from
      const hubSnap = await getDocs(hubQuery);
      const allHubs = hubSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Hub));
      
      // More lenient search algorithm
      const searchTerms = text.split(' ').filter(term => term.length > 0);
      const scoredHubs = allHubs.map(hub => {
        const hubName = hub.name.toLowerCase();
        const hubAddress = (hub.location?.address || '').toLowerCase();
        const hubDescription = (hub.description || '').toLowerCase();
        
        let score = 0;
        
        // Exact match gets highest score
        if (hubName === text) score += 100;
        if (hubName.includes(text)) score += 50;
        
        // Partial word matches
        searchTerms.forEach(term => {
          if (hubName.includes(term)) score += 20;
          if (hubAddress.includes(term)) score += 10;
          if (hubDescription.includes(term)) score += 5;
        });
        
        // Fuzzy matching for similar words
        searchTerms.forEach(term => {
          if (term.length > 2) {
            // Check if any word in hub name contains most of the search term
            const hubWords = hubName.split(' ');
            hubWords.forEach(word => {
              if (word.length > 2 && (word.includes(term) || term.includes(word))) {
                score += 15;
              }
            });
          }
        });
        
        return { hub, score };
      });
      
      // Sort by score and return top results
      return scoredHubs
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, count)
        .map(item => {
          const hub = item.hub;
          // Ensure the hub has the proper structure
          return {
            ...hub,
            location: hub.location || {
              address: hub.address || 'No address available',
              lat: hub.lat || 0,
              lng: hub.lng || 0
            }
          } as Hub;
        });
    } catch (error) {
      console.error('Error searching hubs:', error);
      return [];
    }
  }

  async findHubsNear(lat: number, lng: number, radiusInMeters: number): Promise<Hub[]> {
    try {
      //-Geopoint search
      const r = 6371; //-Earth radius in kilometers
      const radiusInKm = radiusInMeters / 1000;

      const latT = lat + (180 / Math.PI) * (radiusInKm / r);
      const latB = lat - (180 / Math.PI) * (radiusInKm / r);
      const lonL = lng - (180 / Math.PI) * (radiusInKm / r) / Math.cos(lat * Math.PI / 180);
      const lonR = lng + (180 / Math.PI) * (radiusInKm / r) / Math.cos(lat * Math.PI / 180);

      const hubsRef = collection(db, 'places');
      const hubQuery = query(
        hubsRef,
        where('location.lat', '>=', latB),
        where('location.lat', '<=', latT),
        where('location.lng', '>=', lonL),
        where('location.lng', '<=', lonR)
      );
      
      const hubSnap = await getDocs(hubQuery);
      const hubs = hubSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Hub));
      
      //-Filter by longitude client-side
      return hubs;
    } catch (error) {
      console.error('Error finding hubs near location:', error);
      return [];
    }
  }

  async getUserDisplayName(userId: string): Promise<string> {
    try {
      const user = await this.getCurrentUser(userId);
      return user?.name || user?.displayName || 'Unknown User';
    } catch (error) {
      console.error('Error fetching user display name:', error);
      return 'Unknown User';
    }
  }

  // ====================
  // HUB BANNER IMAGE MANAGEMENT
  // ====================

  async updateHubBannerImage(hubId: string): Promise<void> {
    try {
      // Get all posts for this hub
      const posts = await this.getPostsForHub(hubId);
      
      if (posts.length === 0) {
        // No posts, but keep a default banner image instead of removing it
        // This prevents the banner from disappearing
        await updateDoc(doc(db, 'places', hubId), {
          mainImage: '/assets/leaf.png' // Default fallback image
        });
        return;
      }

      // Find the post with the most likes
      const mostPopularPost = posts.reduce((prev, current) => 
        (current.likes || 0) > (prev.likes || 0) ? current : prev
      );

      // Get the first image from the most popular post
      const bannerImage = mostPopularPost.images && mostPopularPost.images.length > 0 
        ? mostPopularPost.images[0] 
        : '/assets/leaf.png'; // Fallback to default image

      // Only update if the image is actually different to avoid unnecessary updates
      const currentPlace = await this.getPlace(hubId);
      if (currentPlace?.mainImage === bannerImage) {
        console.log(`Hub ${hubId} banner image unchanged: ${bannerImage}`);
        return;
      }

      // Update the hub's main image
      await updateDoc(doc(db, 'places', hubId), {
        mainImage: bannerImage
      });

      console.log(`Updated hub ${hubId} banner image to: ${bannerImage}`);
    } catch (error) {
      console.error('Error updating hub banner image:', error);
      // Set a fallback image on error
      try {
        await updateDoc(doc(db, 'places', hubId), {
          mainImage: '/assets/leaf.png'
        });
      } catch (fallbackError) {
        console.error('Error setting fallback banner image:', fallbackError);
      }
    }
  }

  async updateAllHubBannerImages(): Promise<void> {
    try {
      // Get all hubs
      const hubsRef = collection(db, 'places');
      const hubsSnapshot = await getDocs(hubsRef);
      
      const updatePromises = hubsSnapshot.docs.map(doc => 
        this.updateHubBannerImage(doc.id)
      );
      
      await Promise.all(updatePromises);
      console.log('Updated banner images for all hubs');
    } catch (error) {
      console.error('Error updating all hub banner images:', error);
    }
  }

  // Helper function to manually trigger banner update (for testing)
  async refreshHubBannerImage(hubId: string): Promise<void> {
    console.log(`Manually refreshing banner image for hub: ${hubId}`);
    await this.updateHubBannerImage(hubId);
  }

  async addUserTag(tagName: string): Promise<void> {
    try {
      const normalizedTag = tagName.toLowerCase().trim()
      if (!normalizedTag) return
      const tagDoc = await getDoc(doc(db, 'userTags', normalizedTag))
      if (tagDoc.exists()) {
        await updateDoc(doc(db, 'userTags', normalizedTag), {
          usageCount: increment(1),
          lastUsed: Timestamp.now()
        })
      } else {
        await setDoc(doc(db, 'userTags', normalizedTag), {
          name: normalizedTag,
          displayName: tagName.trim(),
          usageCount: 1,
          createdAt: Timestamp.now(),
          lastUsed: Timestamp.now()
        })
      }
    } catch (error) {
      console.error('Error adding user tag:', error)
    }
  }

  async getAllUserTags(): Promise<string[]> {
    try {
      const snapshot = await getDocs(collection(db, 'userTags'))
      const tags: string[] = []
      snapshot.forEach(doc => tags.push(doc.id))
      return tags.sort()
    } catch (error) {
      console.error('Error fetching all user tags:', error)
      return []
    }
  }

  async getPopularUserTags(limitCount: number = 20): Promise<string[]> {
    try {
      const q = query(collection(db, 'userTags'), orderBy('usageCount', 'desc'), fsLimit(limitCount))
      const snapshot = await getDocs(q)
      const tags: string[] = []
      snapshot.forEach(doc => tags.push(doc.id))
      return tags
    } catch (error) {
      console.error('Error fetching popular user tags:', error)
      return []
    }
  }

  async isPlaceInList(listId: string, placeId: string): Promise<boolean> {
    try {
      const placeRef = doc(db, 'lists', listId, 'places', placeId)
      const snap = await getDoc(placeRef)
      return snap.exists()
    } catch (error) {
      console.error('Error checking if place is in list:', error)
      return false
    }
  }

  async setHubMainImage(hubId: string, imageUrl: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'places', hubId), { mainImage: imageUrl })
    } catch (error) {
      console.error('Error setting hub main image:', error)
      throw error
    }
  }
}

// Export singleton instance
export const firebaseDataService = new FirebaseDataService()
export default firebaseDataService
