import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, orderBy, limit as fsLimit, startAfter, endBefore, onSnapshot, Timestamp, QueryConstraint, addDoc, deleteDoc, increment, writeBatch, arrayUnion, arrayRemove } from 'firebase/firestore'
import { db } from '../firebase/config'
import { serverTimestamp } from 'firebase/firestore'
import type { User, Place, List, Post, PostComment, Activity, Hub } from '../types'
import { auth } from '../firebase/config'
import { firebaseStorageService } from './firebaseStorageService'
import { firebaseListService } from './firebaseListService'
import { stablePlaceKey } from '../utils/stablePlaceKey'
import { mapInterestsToTypes, getComplementaryTypes } from '../utils/placeTypes'
import { searchNearby, getDetails } from '../lib/placesNew'



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

// Mulberry32 — small, deterministic PRNG. Stable shuffle keyed off `seed` so
// successive Refresh taps produce different orders without throwing away signal.
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffleIfSeed<T>(arr: T[], seed: number | string | undefined): T[] {
  if (seed === undefined || arr.length < 2) return arr
  const out = arr.slice()
  const rng = seededRandom(String(seed))
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

class FirebaseDataService {
  private userPreferencesCache = new Map<string, UserPreferences>()
  private searchCache = new Map<string, { data: FirebaseSearchData; timestamp: number }>()
  private userCache = new Map<string, { user: User; timestamp: number }>()
  private userActivityCache = new Map<string, { activities: Activity[]; timestamp: number }>()
  // In-flight dedup for getCurrentUser. ProfileModal + UserProfile + comment
  // hydration etc. fire concurrent fetches for the same user; without this
  // they all race to Firestore and burn quota. With it, the first request
  // wins and everyone else awaits the same promise.
  private getCurrentUserInFlight = new Map<string, Promise<User | null>>()
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  // ====================
  // USER MANAGEMENT
  // ====================

  async getCurrentUser(userId: string): Promise<User | null> {
    const cached = this.userCache.get(userId)
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.user
    }

    const existing = this.getCurrentUserInFlight.get(userId)
    if (existing) return existing

    const work = (async () => {
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
      } finally {
        this.getCurrentUserInFlight.delete(userId)
      }
    })()

    this.getCurrentUserInFlight.set(userId, work)
    return work
  }

  invalidateUserCache(userId: string): void {
    this.userCache.delete(userId)
    this.getCurrentUserInFlight.delete(userId)
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
      // Notify subscribers (Profile page, comments, post avatars, etc.) so
      // they can re-render with the latest name/bio/avatar.
      try {
        window.dispatchEvent(new CustomEvent('this-is:userUpdated', { detail: { userId, fields: Object.keys(profileData) } }))
      } catch (e) {
        // window may not exist in non-DOM contexts (SSR, tests)
        console.warn('[updateUserProfile] dispatch failed', e)
      }
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  async followUser(currentUserId: string, targetUserId: string): Promise<void> {
    if (currentUserId === targetUserId) {
      console.log('Cannot follow yourself');
      return;
    }

    // Atomic bidirectional write: both the "I'm following" doc and the
    // "they have a follower" doc must commit together. Without writeBatch,
    // a failure between the two leaves follower/following counts permanently
    // out of sync.
    const followingRef = doc(db, 'users', currentUserId, 'following', targetUserId);
    const followersRef = doc(db, 'users', targetUserId, 'followers', currentUserId);
    const ts = Timestamp.now();

    try {
      const batch = writeBatch(db);
      batch.set(followingRef, { userId: targetUserId, followedAt: ts });
      batch.set(followersRef, { userId: currentUserId, followedAt: ts });
      await batch.commit();

      // Friend relation kept separate (legacy "auto-friend" behavior); not in
      // the same batch because it's not strictly part of the follow contract.
      try { await this.addUserAsFriend(currentUserId, targetUserId); } catch (e) {
        console.warn('[followUser] auto-friend failed', e);
      }

      try {
        window.dispatchEvent(new CustomEvent('this-is:followed', {
          detail: { followerId: currentUserId, followedId: targetUserId, delta: 1 }
        }))
      } catch (err) {
        console.warn('[followUser] dispatch failed', err)
      }
    } catch (error: any) {
      console.error('Error following user:', error);
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
    // Same atomic-pair concern as followUser — unfollow must clean up both
    // docs together or counts drift. Also tear down the auto-friended
    // mirror docs (followUser → addUserAsFriend writes them both ways);
    // without this, unfollowing leaves a permanent "ghost friendship" and
    // the user keeps appearing in friends-only feeds and recommendations.
    const followingRef = doc(db, 'users', currentUserId, 'following', targetUserId);
    const followersRef = doc(db, 'users', targetUserId, 'followers', currentUserId);
    const myFriendRef = doc(db, 'users', currentUserId, 'friends', targetUserId);
    const theirFriendRef = doc(db, 'users', targetUserId, 'friends', currentUserId);

    try {
      const batch = writeBatch(db);
      batch.delete(followingRef);
      batch.delete(followersRef);
      batch.delete(myFriendRef);
      batch.delete(theirFriendRef);
      await batch.commit();
      try {
        window.dispatchEvent(new CustomEvent('this-is:followed', {
          detail: { followerId: currentUserId, followedId: targetUserId, delta: -1 }
        }))
      } catch (err) {
        console.warn('[unfollowUser] dispatch failed', err)
      }
    } catch (error) {
      console.error('Error unfollowing user:', error);
      throw error;
    }
  }

  async deleteUser(userId: string): Promise<void> {
    // Was a one-line `deleteDoc(users/{userId})` — left every subcollection
    // (savedPosts, savedLists, activity, friends, following, followers,
    // comments, suggestSuppress) AND every authored list and post orphaned
    // in Firestore. Account deletion was effectively a no-op for privacy.
    // This now does a best-effort cascade.
    try {
      const userSubcollections = [
        'savedPosts',
        'savedLists',
        'activity',
        'friends',
        'following',
        'followers',
        'comments',
        'suggestSuppress',
      ];
      for (const sub of userSubcollections) {
        try {
          const snap = await getDocs(collection(db, 'users', userId, sub));
          await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
        } catch (e) {
          console.warn(`[deleteUser] subcollection ${sub} cleanup failed`, e);
        }
      }

      // Delete authored lists (deleteList itself recursively cleans places + posts).
      try {
        const lists = await this.getUserLists(userId, 500);
        await Promise.all(lists.map(l => firebaseListService.deleteList(l.id).catch(err => {
          console.warn(`[deleteUser] failed to delete list ${l.id}`, err);
        })));
      } catch (e) {
        console.warn('[deleteUser] authored-lists cleanup failed', e);
      }

      // Delete authored posts.
      try {
        const posts = await this.getUserPosts(userId, 500);
        await Promise.all(posts.map(p => deleteDoc(doc(db, 'posts', p.id)).catch(err => {
          console.warn(`[deleteUser] failed to delete post ${p.id}`, err);
        })));
      } catch (e) {
        console.warn('[deleteUser] authored-posts cleanup failed', e);
      }

      // Finally the user doc itself.
      await deleteDoc(doc(db, 'users', userId));
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }
  
  async getSavedPosts(userId: string): Promise<Post[]> {
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

  async savePost(userId: string, postId: string): Promise<void> {
    try {
      const ref = doc(db, 'users', userId, 'savedPosts', postId);
      await setDoc(ref, { postId, savedAt: Timestamp.now() });
    } catch (error) {
      console.error('Error saving post:', error);
      throw error;
    }
  }

  async unsavePost(userId: string, postId: string): Promise<void> {
    try {
      const ref = doc(db, 'users', userId, 'savedPosts', postId);
      await deleteDoc(ref);
    } catch (error) {
      console.error('Error unsaving post:', error);
      throw error;
    }
  }

  async getUserPosts(userId: string, max = 50): Promise<Post[]> {
    try {
      // Cap with fsLimit so a power user with thousands of posts doesn't
      // pull the whole collection into memory and choke the renderer. The
      // orderBy is intentionally still client-side because adding a
      // (userId asc, createdAt desc) index requires a Firestore migration.
      const postsQuery = query(
        collection(db, 'posts'),
        where('userId', '==', userId),
        fsLimit(Math.max(max, 1))
      );
      const postsSnapshot = await getDocs(postsQuery);
      const posts = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];
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

      console.log('[firebaseDataService] saving user profile with avatar:', userData.profilePictureUrl)
      await setDoc(doc(db, 'users', userId), userProfile)
      console.log('[firebaseDataService] user profile created successfully')
    } catch (error) {
      console.error('[firebaseDataService] error creating user profile:', error)
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
        console.log('[firebaseDataService] analyzing user bio for personalized recommendations...')
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

        console.log('[firebaseDataService] bio analysis complete:', {
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

      console.log('[firebaseDataService] new user setup completed successfully with AI-enhanced preferences')

      // Notify subscribers (Home For-You feed, profile widgets, etc.) so they
      // re-fetch with the now-populated location/categories instead of waiting
      // for the next route change.
      try {
        this.invalidateUserCache(userId)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('this-is:userUpdated', {
            detail: { userId, fields: ['location', 'tags', 'bio', 'avatar', 'username'] }
          }))
        }
      } catch (e) {
        console.warn('[setupNewUser] post-setup dispatch failed', e)
      }
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
    console.log(`[firebaseDataService] searching places for: "${searchQuery}"`)
    
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
    console.log(`[firebaseDataService] found ${places.length} places from Firebase:`)
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

    console.log(`[firebaseDataService] final places result: ${places.length} places`)
    return places
  }

  private async searchLists(searchQuery: string, filters: any, limitCount: number): Promise<List[]> {
    const constraints: QueryConstraint[] = [
      where('isPublic', '==', true)
    ]
 
    console.log(`[firebaseDataService] searching lists for: "${searchQuery}"`)
 
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
    console.log(`[firebaseDataService] found ${lists.length} lists from Firebase:`)
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
      if (!placeId || typeof placeId !== 'string' || placeId.trim().length === 0) {
        console.warn('[getPlace] invalid placeId', placeId)
        return null
      }
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

  async getPostsForHub(hubId: string, viewerId?: string): Promise<Post[]> {
    try {
      const postsQuery = query(
        collection(db, 'posts'),
        where('hubId', '==', hubId),
        orderBy('createdAt', 'desc')
      );
      const postsSnapshot = await getDocs(postsQuery);
      const allPosts = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];

      // Privacy gate. 'public' is always visible. 'friends' is visible to the
      // author and to mutual-follow friends of the author. 'private' is only
      // ever visible to the author. Without this filter, calling this method
      // with no viewerId leaks private posts on the hub feed.
      let friendsOfViewer = new Set<string>();
      if (viewerId) {
        try {
          const fr = await this.getUserFriends(viewerId)
          friendsOfViewer = new Set(fr.map(u => u.id))
        } catch (e) {
          console.warn('[getPostsForHub] friend lookup failed', e)
        }
      }
      const posts = allPosts.filter(p => {
        const privacy = (p as { privacy?: string }).privacy
        if (!privacy || privacy === 'public') return true
        if (privacy === 'friends') return !!viewerId && (p.userId === viewerId || friendsOfViewer.has(p.userId))
        return p.userId === viewerId
      })

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

  /**
   * Delete a guestbook comment from a profile. Only the comment author or
   * the profile owner is allowed to remove it. Caller is responsible for
   * passing `actingUserId`; the function refuses if it doesn't match.
   */
  async deleteProfileComment(
    profileUserId: string,
    commentId: string,
    actingUserId: string,
  ): Promise<boolean> {
    try {
      const ref = doc(db, 'users', profileUserId, 'comments', commentId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return false;
      const data = snap.data() as PostComment;
      const allowed = data.userId === actingUserId || profileUserId === actingUserId;
      if (!allowed) {
        console.warn('[deleteProfileComment] forbidden — actor is neither author nor profile owner');
        return false;
      }
      await deleteDoc(ref);
      return true;
    } catch (error) {
      console.error('Error deleting profile comment:', error);
      return false;
    }
  }

  async likePost(postId: string, userId: string): Promise<void> {
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);
    if (!postSnap.exists()) return;

    const post = postSnap.data() as Post;
    const alreadyLiked = (post.likedBy || []).includes(userId);

    // Atomic update: arrayUnion/arrayRemove are server-side merges, so two
    // concurrent likes from different users no longer overwrite each other.
    // The likes counter uses increment() for the same reason.
    if (alreadyLiked) {
      await updateDoc(postRef, {
        likedBy: arrayRemove(userId),
        likes: increment(-1),
      });
    } else {
      await updateDoc(postRef, {
        likedBy: arrayUnion(userId),
        likes: increment(1),
      });
      // Log a 'like' activity so it shows up in the friends feed.
      try {
        await this.logActivity(userId, { type: 'like', userId, postId, placeId: post.hubId });
      } catch (e) {
        console.warn('[likePost] activity log failed', e);
      }
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
    if (!listSnap.exists()) return;

    const list = listSnap.data() as List;
    const alreadyLiked = (list.likedBy || []).includes(userId);

    // Atomic update — see likePost for rationale.
    if (alreadyLiked) {
      await updateDoc(listRef, {
        likedBy: arrayRemove(userId),
        likes: increment(-1),
      });
    } else {
      await updateDoc(listRef, {
        likedBy: arrayUnion(userId),
        likes: increment(1),
      });
      try {
        await this.logActivity(userId, { type: 'like', userId, listId });
      } catch (e) {
        console.warn('[likeList] activity log failed', e);
      }
    }
  }

  async saveList(listId: string, userId: string): Promise<void> {
    const userSavedListsRef = doc(db, 'users', userId, 'savedLists', listId);
    const userSavedListSnap = await getDoc(userSavedListsRef);

    if (userSavedListSnap.exists()) {
      await deleteDoc(userSavedListsRef);
      // Decrement the SAVES counter, not likes — these are separate concepts.
      // Was incrementing `list.likes` too, which double-counted: liking +
      // saving the same list bumped `likes` by 2, throwing off the influence
      // calc and any "popular lists" sort.
      await this.updateListSaveCount(listId, -1);
    } else {
      await setDoc(userSavedListsRef, { listId, savedAt: Timestamp.now() });
      await this.updateListSaveCount(listId, 1);
      try {
        await this.logActivity(userId, { type: 'save', userId, listId })
      } catch (e) {
        console.warn('Failed to log save list activity:', e)
      }
    }
  }

  private async updateListSaveCount(listId: string, incrementAmount: number): Promise<void> {
    try {
      const listRef = doc(db, 'lists', listId);
      await updateDoc(listRef, {
        saves: increment(incrementAmount)
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

      // Atomic union — two concurrent saves of different places to the same
      // list no longer race-overwrite each other.
      await updateDoc(listRef, {
        hubs: arrayUnion(placeId),
        updatedAt: Timestamp.now()
      });

      if (savedFromListId) {
        // Atomic increment — was a read-modify-write that could race with a
        // concurrent save sourced from the same list and lose a count.
        const fromListRef = doc(db, 'lists', savedFromListId);
        try {
          await updateDoc(fromListRef, { savesFrom: increment(1) });
        } catch (e) {
          console.warn('[savePlaceToList] failed to bump savesFrom', e);
        }
      }

      // Log activity for user feed
      try {
        await this.logActivity(userId, { type: 'save', userId, placeId, listId })
      } catch (e) {
        console.warn('Failed to log save place activity:', e)
      }

      // savedCount is now incremented idempotently via recordUserSave() at the
      // end of the SaveModal flow — not here. Otherwise picking N lists would
      // bump the count by N, plus the auto-list path would add another +1.
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

  async getUserLists(userId: string, max = 100): Promise<List[]> {
    if (!userId) {
      console.warn('getUserLists called with undefined userId');
      return [];
    }
    try {
      // Cap so a viewer doesn't render unbounded lists at once.
      const listsQuery = query(
        collection(db, 'lists'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        fsLimit(Math.max(max, 1))
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
      // Was: scan every list, then per-list check whether `lists/{id}/places/{hubId}`
      // exists. That's O(N) reads per call (one per list in the database) and
      // grows linearly forever. Replaced with a single `hubs` array-contains
      // query — list docs already maintain a `hubs[]` denormalized array of
      // place IDs that's kept in sync via savePlaceToList / removePlaceFromList.
      const listsQuery = query(
        collection(db, 'lists'),
        where('hubs', 'array-contains', hubId),
        fsLimit(50)
      );
      const listsSnapshot = await getDocs(listsQuery);
      return listsSnapshot.docs.map(d => ({ id: d.id, ...(d.data() as Omit<List, 'id'>) }));
    } catch (error) {
      console.error('Error fetching lists containing hub:', error);
      return [];
    }
  }

  async getFriendsListsContainingHub(hubId: string, currentUserId: string): Promise<List[]> {
    try {
      const friends = await this.getUserFriends(currentUserId);
      const friendIds = new Set(friends.map(friend => friend.id));
      if (friendIds.size === 0) return [];

      // Was: get every list owned by any friend, then per-list getDoc to
      // check the places subcollection. With N friends owning M lists each,
      // that's M*N reads. Now one query against the denormalized `hubs[]`
      // array, then filter by friend ownership client-side. Also avoids
      // Firestore's 30-element `in` cap that the old code would hit for
      // a user with many friends.
      const listsQuery = query(
        collection(db, 'lists'),
        where('hubs', 'array-contains', hubId),
        fsLimit(100)
      );
      const snap = await getDocs(listsQuery);
      const out: List[] = [];
      snap.forEach(d => {
        const data = d.data() as List;
        if (data.userId && friendIds.has(data.userId)) {
          out.push({ id: d.id, ...data });
        }
      });
      return out;
    } catch (error) {
      console.error('Error fetching friends lists containing hub:', error);
      return [];
    }
  }

  async getPostsForList(listId: string, viewerId?: string): Promise<Post[]> {
    try {
      // Read from `lists/{id}/posts` subcollection (canonical) rather than
      // `posts where listId == X`. Posts saved to multiple lists used to
      // appear only in the *last* one because the legacy `listId` field
      // was overwritten on each save. Subcollection IDs are the source of
      // truth — every list the post was attached to has a doc.
      const subSnap = await getDocs(collection(db, 'lists', listId, 'posts'));
      const postIds = subSnap.docs.map(d => d.id);
      if (postIds.length === 0) return [];
      const fetched = await Promise.all(postIds.map(id => this.getPost(id)));
      const allPosts = fetched.filter((p): p is Post => p !== null)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Privacy gate — same logic as getPostsForHub.
      let friendsOfViewer = new Set<string>();
      if (viewerId) {
        try {
          const fr = await this.getUserFriends(viewerId)
          friendsOfViewer = new Set(fr.map(u => u.id))
        } catch (e) {
          console.warn('[getPostsForList] friend lookup failed', e)
        }
      }
      const posts = allPosts.filter(p => {
        const privacy = (p as { privacy?: string }).privacy
        if (!privacy || privacy === 'public') return true
        if (privacy === 'friends') return !!viewerId && (p.userId === viewerId || friendsOfViewer.has(p.userId))
        return p.userId === viewerId
      })

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

      // Collapse "same place saved to multiple lists at once" into a single
      // entry. SaveModal calls savePlaceToList per selected list, each of
      // which logs an activity — so picking 5 lists made 5 friend-feed rows
      // for what's emotionally one save event. Group by (type, placeId)
      // within a 60-second window and keep the most recent. Likes/posts/etc
      // are unaffected because they don't have this fan-out shape.
      const COLLAPSE_WINDOW_MS = 60_000
      const seen = new Map<string, Activity>()
      const deduped: Activity[] = []
      for (const a of activities) {
        if (a.type !== 'save' || !a.placeId) {
          deduped.push(a)
          continue
        }
        const key = `${a.type}|${a.placeId}`
        const prev = seen.get(key)
        if (prev) {
          const dt = Math.abs(new Date(prev.createdAt).getTime() - new Date(a.createdAt).getTime())
          if (dt < COLLAPSE_WINDOW_MS) continue // skip — older sibling already kept
        }
        seen.set(key, a)
        deduped.push(a)
      }
      activities = deduped

      // Enrich activities with referenced data. Was a serial loop — for 50
      // activities with both listId and placeId set, that was up to 100
      // sequential getDoc roundtrips. Now batched: dedupe the ids, fetch
      // each unique list/place once in parallel, hydrate the activities
      // from the resulting maps.
      const listIds = new Set<string>()
      const placeIds = new Set<string>()
      for (const a of activities) {
        if (a.listId && !a.list) listIds.add(a.listId)
        if (a.placeId && !a.place) placeIds.add(a.placeId)
      }
      const [lists, places] = await Promise.all([
        Promise.all(Array.from(listIds).map(id => this.getList(id).catch(() => null))),
        Promise.all(Array.from(placeIds).map(id => this.getPlace(id).catch(() => null))),
      ])
      const listById = new Map(Array.from(listIds).map((id, i) => [id, lists[i]]))
      const placeById = new Map(Array.from(placeIds).map((id, i) => [id, places[i]]))
      activities = activities.map(a => {
        const activity: any = { ...a }
        if (a.listId && !a.list) {
          const l = listById.get(a.listId)
          if (l) activity.list = l
        }
        if (a.placeId && !a.place) {
          const p = placeById.get(a.placeId)
          if (p) activity.place = p
        }
        return activity as Activity
      })

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

  // Soft negative feedback: user is not interested in a place
  async markPlaceNotInterested(userId: string, placeId: string): Promise<void> {
    try {
      const prefs = await this.getUserPreferences(userId)
      const hidden = Array.isArray((prefs as any).hiddenPlaces) ? (prefs as any).hiddenPlaces as string[] : []
      if (!hidden.includes(placeId)) hidden.unshift(placeId)
      ;(prefs as any).hiddenPlaces = hidden.slice(0, 500)
      await this.saveUserPreferences(userId, prefs)
    } catch (e) {
      console.error('Failed to mark not interested', e)
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

      // Fallback: no usageCount or query failed -- return all tags sorted alphabetically
      const all = await getDocs(collection(db, 'tags'))
      const names = all.docs.map(d => d.id).sort()
      return names.slice(0, limitCount)
    } catch (error) {
      console.error('Error fetching popular tags:', error)
      return []
    }
  }

  // Suggest places for cold-start users based on interests and optional location.
  // `seed` (any number/string) shuffles the candidate pool deterministically — pass
  // a fresh value (e.g. Date.now()) to surface different picks on Refresh.
  async getSuggestedPlaces(options: { tags?: string[]; location?: { lat: number; lng: number }; limit?: number; seed?: number | string } = {}): Promise<Place[]> {
    const { tags = [], location, limit = 12, seed } = options
    try {
      // Pull a wide candidate pool so we have room to rotate.
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
          if (location && p.coordinates && typeof p.coordinates.lat === 'number' && typeof p.coordinates.lng === 'number') {
            const dlat = (p.coordinates.lat - location.lat)
            const dlng = (p.coordinates.lng - location.lng)
            const approxKm = Math.sqrt(dlat * dlat + dlng * dlng) * 111
            const distBoost = Math.max(0, 30 - Math.min(30, approxKm))
            score += distBoost
          }
          return { p, score }
        })
        places = scored.sort((a, b) => b.score - a.score).map(s => s.p)
      } else if (location) {
        places = places.sort((a, b) => {
          const da = a.coordinates ? Math.hypot(a.coordinates.lat - location.lat, a.coordinates.lng - location.lng) : 1e9
          const db = b.coordinates ? Math.hypot(b.coordinates.lat - location.lat, b.coordinates.lng - location.lng) : 1e9
          return da - db
        })
      }
      // No tags AND no location: just top-by-savedCount as already ordered.
      // (Previously fell through with no output transform; now explicit.)

      // When a seed is provided, do a windowed shuffle: keep the top half ranked,
      // shuffle the rest, then take a randomized slice across both halves. This
      // surfaces fresh picks on Refresh without throwing away signal entirely.
      if (seed !== undefined && places.length > limit) {
        const top = places.slice(0, Math.min(places.length, limit * 3))
        const rng = seededRandom(String(seed))
        for (let i = top.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1))
          ;[top[i], top[j]] = [top[j], top[i]]
        }
        places = top
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

  /**
   * Clear ALL in-memory caches and any user-keyed localStorage/sessionStorage
   * entries. Called on logout so the next user (or this same user logging
   * back in) doesn't see stale data — both for correctness AND because
   * shared-device sign-outs would otherwise leak the previous user's
   * recommendations, recents, suggested-refresh seen-set, etc.
   */
  clearAllUserScopedState(): void {
    this.userPreferencesCache.clear()
    this.userCache.clear()
    this.userActivityCache.clear()
    this.searchCache.clear()
    this.externalRecoCache.clear()
    this.ensureHubInFlight.clear()
    this.getCurrentUserInFlight.clear()
    if (typeof sessionStorage !== 'undefined') {
      try {
        // Drop user-scoped keys; leave anything we don't recognise alone so
        // we don't blow away unrelated app state that a future feature might
        // legitimately store in sessionStorage.
        const known = ['home_for_you_seen', 'suggested_refresh_counter']
        for (const k of known) sessionStorage.removeItem(k)
      } catch (e) {
        console.warn('[clearAllUserScopedState] sessionStorage cleanup failed', e)
      }
    }
    if (typeof localStorage !== 'undefined') {
      try {
        // recentSearches is shown on Home/Explore/Search and is per-user.
        localStorage.removeItem('recentSearches')
        // External-rec cache entries are keyed by lat,lng — they're not
        // strictly user-scoped, but the seed/jitter mixes in user context
        // so it's safer to drop them on logout.
        const remove: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (!key) continue
          if (key.startsWith('reco:') || key.startsWith('places:v1:near|') || key.startsWith('map:')) {
            remove.push(key)
          }
        }
        for (const k of remove) localStorage.removeItem(k)
      } catch (e) {
        console.warn('[clearAllUserScopedState] localStorage cleanup failed', e)
      }
    }
  }

  // Record a suppression for a suggestion by stable key for ~14 days
  async suppressSuggestion(params: { userId?: string | null; stableKey: string; reason?: string }): Promise<void> {
    try {
      const { userId, stableKey, reason } = params
      if (!userId || !stableKey) return
      const ref = doc(db, 'users', userId, 'suggestSuppress', stableKey)
      const ttlMs = 14 * 24 * 60 * 60 * 1000
      await setDoc(ref, {
        reason: reason || 'not_interested',
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(new Date(Date.now() + ttlMs))
      }, { merge: true })
    } catch (e) {
      console.warn('suppressSuggestion failed', e)
    }
  }

  // Fetch active suppressed stable keys for a user (not expired)
  async getSuppressedSuggestionKeys(userId: string): Promise<string[]> {
    try {
      const qy = query(
        collection(db, 'users', userId, 'suggestSuppress'),
        where('expiresAt', '>', Timestamp.now())
      )
      const snap = await getDocs(qy)
      return snap.docs.map(d => (d.id || (d.data() as any)?.stableKey)).filter(Boolean) as string[]
    } catch (e) {
      console.warn('getSuppressedSuggestionKeys failed', e)
      return []
    }
  }

  async getExternalSuggestedPlaces(
    lat: number,
    lng: number,
    tags: string[] = [],
    limit = 12,
    options: {
      interests?: string[];
      radiusKm?: number;
      openNow?: boolean;
      cacheBypass?: boolean;
    } = {}
  ): Promise<any[]> {
    try {
      // Use Places (New) API directly - cost optimized with field masks
      // (searchNearby + getDetails are imported statically at module top.)

      // Use shared type mapping utilities
      const interestInputs = [ ...(options.interests || []), ...tags ];
      const primaryTypes = mapInterestsToTypes(interestInputs, false);
      const complementaryTypes = getComplementaryTypes(primaryTypes);

      const requestedRadiusKm = typeof options.radiusKm === 'number' && options.radiusKm > 0 ? options.radiusKm : 40;
      const queryRadiusKm = Math.max(requestedRadiusKm, 5);
      // Allow up to 150 km for progressive expansion (was 80km)
      const radiusMeters = Math.min(queryRadiusKm * 1000, 150000);
      // Tune jitter based on urban/suburban scale and whether we're bypassing cache
      let jitterMeters: number;
      if (options.cacheBypass) {
        // Forced refresh: add more variety
        jitterMeters = queryRadiusKm <= 20
          ? Math.min(radiusMeters * 0.04, 800)    // urban cap ~800m
          : Math.min(radiusMeters * 0.05, 4000);  // suburban/rural cap ~4km
      } else {
        // Cached path: keep jitter tighter
        jitterMeters = queryRadiusKm <= 20
          ? Math.min(radiusMeters * 0.02, 400)    // urban cap ~400m
          : Math.min(radiusMeters * 0.025, 1000); // suburban/rural cap ~1km
      }
      
      // Dynamic fetch budget: smaller for normal load, larger on repeated refreshes
      let refreshCount = 0;
      if (options.cacheBypass) {
        try {
          const key = 'suggested_refresh_counter';
          const raw = sessionStorage.getItem(key);
          refreshCount = raw ? (Number(raw) || 0) : 0;
          sessionStorage.setItem(key, String(refreshCount + 1));
        } catch {}
      }
      const baseMax = Math.max(limit, 12);
      // Grow modestly with refresh count but stay under safe quotas
      const primaryMax = options.cacheBypass
        ? Math.min(baseMax + Math.min(refreshCount * 4, 16), 36)
        : Math.min(baseMax * 2, 24);
      const secondaryMax = options.cacheBypass
        ? Math.min(Math.floor(baseMax * 0.9), 18)
        : Math.min(Math.floor(baseMax * 0.5), 12);

      // Simple client-side pacing to avoid 429s on rapid refreshes
      if (!('__lastPlacesCallTs' in (this as any))) (this as any).__lastPlacesCallTs = 0;
      const now = Date.now();
      const since = now - (this as any).__lastPlacesCallTs;
      const minGap = options.cacheBypass ? 900 : 400; // ms
      if (since < minGap) {
        await new Promise(res => setTimeout(res, minGap - since));
      }
      (this as any).__lastPlacesCallTs = Date.now();

      const doSearch = async (
        types: string[] | undefined,
        max: number,
        bypass: boolean,
        latOffset: number = 0,
        lngOffset: number = 0
      ) => {
        try {
          return await searchNearby(lat + latOffset, lng + lngOffset, {
            includedTypes: (types && types.length > 0) ? types : undefined,
            max,
            cacheBypass: !!bypass,
            cacheTtlMs: 6 * 60 * 60 * 1000,
            jitterMeters,
            radiusMeters
          });
        } catch (err: any) {
          const msg = String(err?.message || err || '');
          const is429 = msg.includes('429') || /Too\s*Many/i.test(msg);
          if (is429) {
            console.warn('[firebaseDataService] Rate limit hit, using cached results');
            return [] as any[];
          }
          return [] as any[];
        }
      };

      // Multi-call strategy to reach 60 candidates (Google API limit is 20 per call)
      // Make 3 calls with different type mixes and geographic offsets for diversity
      const calls: Promise<any[]>[] = [];

      if (limit >= 40) {
        // Multi-call strategy. Each refresh rotates through different cardinal
        // wedges *and* different type slices so successive Refresh taps land
        // on a fresh chunk of the surrounding map. Without this rotation the
        // same 3 lat/lng offsets keep returning the same ~60 places.
        const compass: Array<[number, number]> = [
          [0,    0],     // center
          [0.3,  0],     // N
          [-0.3, 0],     // S
          [0,    0.3],   // E
          [0,   -0.3],   // W
          [0.3,  0.3],   // NE
          [-0.3, 0.3],   // SE
          [-0.3,-0.3],   // SW
          [0.3, -0.3],   // NW
        ];
        const rot = options.cacheBypass ? refreshCount : 0;
        const pick = (i: number) => compass[(rot * 3 + i) % compass.length];
        const [a1, a2, a3] = [pick(0), pick(1), pick(2)];

        // Type rotation: each refresh slides the primary/complementary slices.
        const rotArr = <T,>(arr: T[], n: number) => arr.length === 0 ? arr : arr.slice(n % arr.length).concat(arr.slice(0, n % arr.length));
        const rotatedPrimary = rotArr(primaryTypes, rot);
        const rotatedComplementary = rotArr(complementaryTypes, rot);
        const mixedTypes = [...rotatedPrimary.slice(0, 2), ...rotatedComplementary.slice(0, 2)];

        console.log('[firebaseDataService] multi-call (rotated)', {
          rot, refreshCount,
          offsets: [a1, a2, a3],
          rotatedPrimary,
          rotatedComplementary,
          mixedTypes,
          radiusMeters,
          jitterMeters,
        });

        calls.push(doSearch(rotatedPrimary,        20, !!options.cacheBypass, a1[0], a1[1]));
        calls.push(doSearch(rotatedComplementary,  20, !!options.cacheBypass, a2[0], a2[1]));
        calls.push(doSearch(mixedTypes,            20, !!options.cacheBypass, a3[0], a3[1]));
      } else {
        // Small request (<40): Single call with mixed types
        const allTypes = [...primaryTypes, ...complementaryTypes.slice(0, 2)];
        const searchMax = Math.min(primaryMax + Math.floor(secondaryMax / 2), 20);

        console.log('[firebaseDataService] single-call strategy', {
          allTypes,
          searchMax,
          radiusMeters,
          queryRadiusKm,
          jitterMeters,
          cacheBypass: !!options.cacheBypass,
          refreshCount
        });

        calls.push(doSearch(allTypes, searchMax, !!options.cacheBypass, 0, 0));
      }

      const allResults = await Promise.all(calls);
      const results = allResults.flat();

      console.log('[firebaseDataService] API returned', {
        totalCalls: allResults.length,
        countsPerCall: allResults.map(r => r.length),
        totalResults: results?.length,
        requestedLimit: limit,
        sample: results?.[0] ? {
          name: results[0].name,
          hasCoords: !!(results[0].lat && results[0].lng)
        } : null
      });

      // Strict chain and fast-food filter
      const ban = [
        // Fast food and coffee
        'mcdonald','burger king','taco bell','kfc','pizza hut','domino','papa john','subway','wendy','five guys','chick-fil-a','chickfila','dunkin','starbucks','chipotle','popeyes','seven-eleven','7-eleven',
        // Big box retail
        'walmart','target','costco','best buy','home depot','lowe',
        // Grocery chains
        'shoprite','acme','stop & shop','stop n shop','wegmans','kroger','safeway','publix','aldi','trader joe','whole foods',
        // Pharmacies
        'cvs','walgreens','rite aid','duane reade'
      ];
      const filterOut = (arr: any[]) => arr.filter((place: any) => {
        const name = String(place.name || '').toLowerCase();
        const isBanned = ban.some(b => name.includes(b));
        const isFast = Array.isArray(place.types) && place.types.some((t: string) => t.toLowerCase().includes('fast_food'));
        return !isBanned && !isFast;
      });
      let merged = filterOut(results);

      console.log('[firebaseDataService] After chain/fast-food filter', {
        before: results.length,
        after: merged.length,
        removed: results.length - merged.length
      });

      // Dedupe by id and name|address
      const seenId = new Set<string>(); const seenKey = new Set<string>();
      const filtered = [] as any[];
      for (const p of merged) {
        const id = p.id || '';
        const key = `${String(p.name||'').toLowerCase()}|${String(p.address||'').toLowerCase()}`;
        if (id && seenId.has(id)) continue;
        if (key && seenKey.has(key)) continue;
        seenId.add(id); seenKey.add(key);
        filtered.push(p);
      }
      console.log('[firebaseDataService] After deduplication', {
        beforeDedupe: merged.length,
        afterDedupe: filtered.length,
        duplicatesRemoved: merged.length - filtered.length
      });
      
      const mapped = filtered.map((place: any) => ({
        id: place.id,
        name: place.name,
        address: place.address || '',
        coordinates: place.lat && place.lng ? { lat: place.lat, lng: place.lng } : undefined,
        primaryType: place.primaryType,
        types: place.types || [],
        category: place.primaryType,
        photos: place.photos || [],
        photosV1: place.photos || [], // Legacy compatibility
        source: 'google'
      }));

      // Fill in missing coordinates - drastically reduce detail/geocode calls
      // Only enrich the first few results that are missing coords
      const MAX_DETAIL_CALLS = 2; // Reduced from 4
      const MAX_GEOCODE_CALLS = 2; // Reduced from 6
      let detailCalls = 0;
      let geocodeCalls = 0;
      
      const enriched = await Promise.all(mapped.map(async (place: any, idx: number) => {
        const hasCoords = place.coordinates?.lat != null && place.coordinates?.lng != null;
        if (hasCoords) return place;

        // Only enrich first few results to minimize API calls
        if (idx >= 8) {
          // For later results, skip if no coords - filter out later
          return null;
        }

        if (detailCalls < MAX_DETAIL_CALLS && idx < 4) {
          detailCalls += 1;
          try {
            const detail = await getDetails(place.id);
            if (detail?.lat != null && detail?.lng != null) {
              return {
                ...place,
                coordinates: { lat: detail.lat, lng: detail.lng },
                primaryType: place.primaryType || detail.primaryType,
                types: place.types?.length ? place.types : detail.types,
                photos: detail.photos?.length ? detail.photos : place.photos,
                photosV1: detail.photos?.length ? detail.photos : place.photos
              };
            }
          } catch (detailError) {
            console.warn('[firebaseDataService] getDetails fallback failed', detailError);
          }
        }

        if (place.address && geocodeCalls < MAX_GEOCODE_CALLS && idx < 6) {
          geocodeCalls += 1;
          try {
            const geo = await this.geocodeLocation(place.address);
            if (geo) {
              return {
                ...place,
                coordinates: { lat: geo.lat, lng: geo.lng },
                address: geo.address || place.address
              };
            }
          } catch (geoError) {
            console.warn('[firebaseDataService] geocode fallback failed', geoError);
          }
        }

        // If we couldn't get coords, filter out
        return null;
      }));

      // Filter out null entries (places we couldn't enrich with coordinates)
      const validPlaces = enriched.filter((p: any) => p != null && p.coordinates?.lat != null && p.coordinates?.lng != null);
      
      // Distance sort so nearest relevant options surface first
      const toRad = (v: number) => v * Math.PI / 180;
      const withDist = validPlaces.map((p: any) => {
        const plat = p?.coordinates?.lat; const plng = p?.coordinates?.lng;
        if (typeof plat === 'number' && typeof plng === 'number') {
          const dLat = toRad(plat - lat); const dLon = toRad(plng - lng);
          const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat))*Math.cos(toRad(plat))*Math.sin(dLon/2)**2;
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const km = 6371 * c; return { p, d: km };
        }
        return { p, d: Number.MAX_VALUE };
      });
      withDist.sort((a,b) => a.d - b.d);
      const finalPlaces = withDist.map(x => x.p).slice(0, limit);

      // Attach stable key before returning
      return finalPlaces.map((p: any) => {
        const placeId = p.placeId ?? (p as any).place_id ?? p.id ?? null
        const normalized = { ...p, placeId }
        const key = stablePlaceKey(normalized)
        return { ...normalized, __key: key }
      })
    } catch (e) {
      console.warn('[firebaseDataService] getExternalSuggestedPlaces failed', e)
      return []
    }
  }

  // In-memory cache for geocoding results to prevent redundant API calls
  private geocodeCache = new Map<string, { lat: number; lng: number; address: string } | null>()

  async geocodeLocation(query: string): Promise<{ lat: number; lng: number; address: string } | null> {
    const cacheKey = query.trim().toLowerCase()
    
    // Check in-memory cache first
    if (this.geocodeCache.has(cacheKey)) {
      console.log('[geocodeLocation] CACHE HIT (memory) ->', query)
      return this.geocodeCache.get(cacheKey)!
    }

    // Check localStorage cache (persists across sessions, 30 day TTL)
    try {
      const storageKey = `geocode:${cacheKey}`
      const cached = localStorage.getItem(storageKey)
      if (cached) {
        const { result, timestamp } = JSON.parse(cached)
        const age = Date.now() - timestamp
        // Cache for 30 days
        if (age < 30 * 24 * 60 * 60 * 1000) {
          console.log('[geocodeLocation] CACHE HIT (localStorage) ->', query)
          this.geocodeCache.set(cacheKey, result)
          return result
        }
        // Expired, remove it
        localStorage.removeItem(storageKey)
      }
    } catch {
      // localStorage might be disabled
    }

    try {
      // API call - this costs money!
      const clientKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY
      let resp: any = await fetch(`/geocodeLocation?q=${encodeURIComponent(query)}&clientKey=${encodeURIComponent(clientKey || '')}` as any)
      if (!resp || !resp.ok) {
        // Fallback to deployed Cloud Function URL
        const cfUrl = 'https://us-central1-this-is-76332.cloudfunctions.net/geocodeLocation'
        resp = await fetch(`${cfUrl}?q=${encodeURIComponent(query)}&clientKey=${encodeURIComponent(clientKey || '')}` as any)
      }
      if (!resp || !resp.ok) {
        this.geocodeCache.set(cacheKey, null)
        return null
      }
      const data = await (resp as any).json()
      const result = data.location || null
      console.log('[geocodeLocation] API call ->', query, 'result ->', result)
      
      // Store in both caches
      this.geocodeCache.set(cacheKey, result)
      try {
        const storageKey = `geocode:${cacheKey}`
        localStorage.setItem(storageKey, JSON.stringify({ result, timestamp: Date.now() }))
      } catch {
        // localStorage might be full or disabled
      }
      
      return result
    } catch {
      this.geocodeCache.set(cacheKey, null)
      return null
    }
  }

  // ====================
  // EFFECTIVE LOCATION (current > profile > null)
  // ====================
  async getEffectiveLocation(userId?: string): Promise<{ lat: number; lng: number; address?: string; source: 'current' | 'profile' } | null> {
    // Skip the browser prompt if the user has already denied — otherwise we
    // pay a 4-second timeout on every page load AND get nothing back.
    let permissionState: PermissionState | null = null
    try {
      if ('permissions' in navigator && (navigator.permissions as Permissions)?.query) {
        const res = await (navigator.permissions as Permissions).query({ name: 'geolocation' as PermissionName })
        permissionState = res.state
      }
    } catch {
      // Permissions API not available; just try geolocation and let it fail.
    }

    if (permissionState !== 'denied') {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          if (!('geolocation' in navigator)) return reject(new Error('no geolocation'))
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 4000 })
        })
        return { lat: pos.coords.latitude, lng: pos.coords.longitude, source: 'current' }
      } catch {
        // fall through to profile fallback
      }
    }

    try {
      if (userId) {
        const u = await this.getCurrentUser(userId)
        const locStr = (u as any)?.location || (u as any)?.location?.address
        if (locStr && typeof locStr === 'string' && locStr.trim().length > 0) {
          const geo = await this.geocodeLocation(locStr)
          if (geo) return { lat: geo.lat, lng: geo.lng, address: geo.address, source: 'profile' }
        }
      }
    } catch (e) {
      console.warn('[getEffectiveLocation] profile fallback failed', e)
    }
    return null
  }

  // Distance helper (km)
  distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
    const toRad = (v: number) => (v * Math.PI) / 180
    const R = 6371
    const dLat = toRad(b.lat - a.lat)
    const dLng = toRad(b.lng - a.lng)
    const la1 = toRad(a.lat)
    const la2 = toRad(b.lat)
    const h = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2
    return 2*R*Math.asin(Math.sqrt(h))
  }

  // ====================
  // BATCHED RECOMMENDATIONS (24h client cache)
  // ====================
  private externalRecoCache = new Map<string, { t: number; v: any[] }>()
  async getBatchedExternalRecommendations(
    lat: number,
    lng: number,
    opts: { tags?: string[]; limit?: number; forceFresh?: boolean; seed?: number | string } = {}
  ) {
    // 3-decimal precision (~110m) so users a block apart don't share cache.
    const key = `reco:${lat.toFixed(3)},${lng.toFixed(3)}|${(opts.tags || []).map(t=>t.toLowerCase()).sort().join('+')}|${opts.limit || 20}`
    const now = Date.now()
    const useCache = !opts.forceFresh
    if (useCache) {
      const mem = this.externalRecoCache.get(key)
      if (mem && now - mem.t < 24*60*60*1000) return shuffleIfSeed(mem.v, opts.seed)
      try {
        const raw = localStorage.getItem(key)
        if (raw) {
          const { t, v } = JSON.parse(raw)
          if (now - t < 24*60*60*1000) { this.externalRecoCache.set(key, { t, v }); return shuffleIfSeed(v, opts.seed) }
        }
      } catch {}
    }
    // Pass cacheBypass down so the underlying searchNearby skips its own
    // localStorage cache too — without this, Refresh would re-fetch from
    // Google but Google's results came from a cached query the layer below
    // already had, so the user saw the same suggestions.
    const v = await this.getExternalSuggestedPlaces(
      lat,
      lng,
      opts.tags || [],
      opts.limit || 20,
      opts.forceFresh ? { cacheBypass: true } : undefined,
    )
    this.externalRecoCache.set(key, { t: now, v })
    try { localStorage.setItem(key, JSON.stringify({ t: now, v })) } catch {
      // localStorage full or denied; not fatal
    }
    return shuffleIfSeed(v, opts.seed)
  }

  

  async createHub(hubData: {
    name: string
    address: string
    description: string
    coordinates?: { lat: number, lng: number }
    photos?: { name: string }[]
    primaryType?: string
    types?: string[]
  }): Promise<{ id: string; created: boolean }> {
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
            return { id: d.id, created: false }
          }
        }
      }
    } catch {}

    const hubRef = await addDoc(collection(db, 'places'), {
      name: hubData.name,
      description: hubData.description,
      address: hubData.address,
      location: {
        address: hubData.address,
        lat: hubData.coordinates?.lat || 0,
        lng: hubData.coordinates?.lng || 0
      },
      coordinates: {
        lat: hubData.coordinates?.lat || 0,
        lng: hubData.coordinates?.lng || 0
      },
      tags: [],
      savedCount: 0,
      name_lowercase: hubData.name.toLowerCase(),
      createdAt: Timestamp.now(),
      // Carry through Google metadata so getPlace() can render real images
      // and category-aware posters without needing a follow-up details fetch.
      photos: Array.isArray(hubData.photos) ? hubData.photos : [],
      primaryType: hubData.primaryType || null,
      types: Array.isArray(hubData.types) ? hubData.types : [],
      // mainImage is set by the first-saver via CoverPhotoPicker. Until then,
      // HubImage falls back to the duotone <PlacePoster>.
    });
    return { id: hubRef.id, created: true };
  }

  /**
   * Idempotent "user X has saved place Y" marker. Increments savedCount on the
   * place exactly once per user-place pair. Subsequent calls from the same
   * user for the same place are no-ops. Use this from the SaveModal flow
   * after savePlaceToList / saveToAutoList have run.
   */
  async recordUserSave(placeId: string, userId: string): Promise<boolean> {
    try {
      if (!placeId || !userId) return false
      const markerRef = doc(db, 'places', placeId, 'saves', userId)
      const existing = await getDoc(markerRef)
      if (existing.exists()) return false
      await setDoc(markerRef, { userId, savedAt: Timestamp.now() })
      const placeRef = doc(db, 'places', placeId)
      await updateDoc(placeRef, { savedCount: increment(1) })
      return true
    } catch (e) {
      console.warn('[recordUserSave] failed', e)
      return false
    }
  }

  /**
   * Inverse of recordUserSave. Idempotent — only decrements savedCount if
   * a marker doc actually exists for this user, so removing a place that
   * was never personally saved (e.g. removing it from a friend's view) is
   * a no-op rather than dragging the global counter negative.
   */
  async recordUserUnsave(placeId: string, userId: string): Promise<boolean> {
    try {
      if (!placeId || !userId) return false
      const markerRef = doc(db, 'places', placeId, 'saves', userId)
      const existing = await getDoc(markerRef)
      if (!existing.exists()) return false
      await deleteDoc(markerRef)
      const placeRef = doc(db, 'places', placeId)
      await updateDoc(placeRef, { savedCount: increment(-1) })
      return true
    } catch (e) {
      console.warn('[recordUserUnsave] failed', e)
      return false
    }
  }

  /**
   * Returns the set of place ids the current user has saved. Used to render
   * "saved" state on cards without N+1 reads.
   */
  async getUserSavedPlaceIds(userId: string): Promise<Set<string>> {
    // Lightweight: rely on the auto-list (loved/tried/want) memberships.
    try {
      const out = new Set<string>()
      const lists = await this.getUserLists(userId)
      for (const l of lists) {
        const hubs = (l as { hubs?: string[] }).hubs || []
        for (const id of hubs) out.add(id)
      }
      return out
    } catch {
      return new Set()
    }
  }

  /**
   * Silent Google→Hub conversion. Used wherever a save/post/comment fires on a
   * place card whose origin is a Google Places candidate. If the place already
   * exists as a hub (by id, or by name+address), returns the existing hub id.
   * Otherwise creates a new hub doc and returns its id. Callers should pass
   * the resulting id into savePlaceToList / saveToAutoList instead of the raw
   * Google placeId.
   */
  // In-flight dedup: when SaveModal + NavigationContext + a card click all
  // request ensureHubFromPlace for the same candidate at once, only one
  // network roundtrip runs and all callers await the same promise. Without
  // this, concurrent calls each pass the duplicate-check before either
  // writes — producing two near-identical hub docs.
  private ensureHubInFlight = new Map<string, Promise<{ id: string | null; created: boolean; mainImage?: string | null }>>()

  async ensureHubFromPlace(p: {
    id?: string
    placeId?: string
    name?: string
    address?: string
    description?: string
    coordinates?: { lat?: number; lng?: number }
    location?: { address?: string; lat?: number; lng?: number }
    photos?: { name: string }[]
    primaryType?: string
    types?: string[]
  }): Promise<{ id: string | null; created: boolean; mainImage?: string | null }> {
    const candidateId = p.id || p.placeId || ''
    const dedupKey = candidateId || `${(p.name || '').toLowerCase().trim()}|${(p.address || p.location?.address || '').toLowerCase().trim()}`
    const existing = this.ensureHubInFlight.get(dedupKey)
    if (existing) return existing

    const work = (async () => {
      try {
        if (candidateId) {
          const found = await this.getPlace(candidateId) as (Place & { mainImage?: string | null }) | null
          if (found && found.id) {
            return { id: found.id, created: false, mainImage: found.mainImage || null }
          }
        }
        const name = (p.name || '').trim()
        if (!name) return { id: candidateId || null, created: false }
        const address = (p.address || p.location?.address || '').trim()
        const lat = p.coordinates?.lat ?? p.location?.lat ?? 0
        const lng = p.coordinates?.lng ?? p.location?.lng ?? 0
        const result = await this.createHub({
          name,
          address,
          description: p.description || '',
          coordinates: { lat, lng },
          photos: p.photos,
          primaryType: p.primaryType,
          types: p.types,
        })
        return { id: result.id, created: result.created, mainImage: null }
      } catch (e) {
        console.warn('[ensureHubFromPlace] failed', e)
        return { id: p.id || null, created: false }
      } finally {
        // Release the slot so a future save (e.g. in a different session)
        // can re-check for an existing hub.
        this.ensureHubInFlight.delete(dedupKey)
      }
    })()

    this.ensureHubInFlight.set(dedupKey, work)
    return work
  }

  /**
   * Updates a hub's mainImage. Use after a user picks a cover photo for a
   * just-materialized hub.
   */
  async setHubMainImage(placeId: string, imageUrl: string): Promise<void> {
    try {
      if (!placeId || !imageUrl) return
      const placeRef = doc(db, 'places', placeId)
      await updateDoc(placeRef, { mainImage: imageUrl })
      try {
        window.dispatchEvent(new CustomEvent('this-is:hubUpdated', { detail: { hubId: placeId, mainImage: imageUrl } }))
      } catch (err) {
        console.warn('[setHubMainImage] dispatch failed', err)
      }
    } catch (e) {
      console.warn('[setHubMainImage] failed', e)
    }
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

}

// Export singleton instance
export const firebaseDataService = new FirebaseDataService()
export default firebaseDataService


