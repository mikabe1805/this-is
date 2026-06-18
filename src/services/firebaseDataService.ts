import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, orderBy, limit as fsLimit, startAfter, endBefore, onSnapshot, Timestamp, QueryConstraint, addDoc, deleteDoc, increment, writeBatch, arrayUnion, arrayRemove, getCountFromServer, deleteField } from 'firebase/firestore'
import { db } from '../firebase/config'
import { serverTimestamp } from 'firebase/firestore'
import type { User, Place, List, Post, PostComment, Activity, Hub } from '../types'
import { auth } from '../firebase/config'
import { firebaseStorageService } from './firebaseStorageService'
import { firebaseListService } from './firebaseListService'
import { stablePlaceKey } from '../utils/stablePlaceKey'
import { mapInterestsToTypes, getComplementaryTypes, detectInterests, placeInterestKeys, detectVibes, interestQuery, interestLabel, vibeLabel } from '../utils/placeTypes'
import { readCoords } from '../utils/coords'
import { searchNearby, searchText, getDetails } from '../lib/placesNew'



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

/** A user's derived taste — what we've "learned" about them. Built from the
 *  ACCUMULATED interaction vector (saves, opens, likes, searches — see
 *  StoredTaste) blended with their saved-place categories, signup vibes, and
 *  bio. Drives recommendation queries + ranking + the "why" reason, and the
 *  "getting to know you" UI. The more the user interacts, the higher
 *  signalCount climbs and the sharper the interests become. */
export interface TasteProfile {
  /** Canonical interests, highest-weight first. */
  interests: Array<{ key: string; label: string; weight: number }>
  /** Mood adjectives (cozy/trendy/…) detected from vibes + bio. */
  vibes: string[]
  /** True once we have any signal at all (saves/tags/bio/interactions). */
  hasSignal: boolean
  savedCount: number
  /** Total weighted interactions recorded — drives the confidence/"getting to
   *  know you" indicator. Grows the more the user uses the app. */
  signalCount: number
  /** 'new' | 'learning' | 'known' — coarse confidence band for UI copy. */
  confidence: 'new' | 'learning' | 'known'
  /** Place ids the user marked "not interested" — excluded from recs. */
  suppressed: Set<string>
}

/** The durable, accumulating interaction vector persisted at userTaste/{uid}.
 *  Updated via atomic increments on every signal, so it survives sessions and
 *  compounds — this is what makes "the more you use it, the more it knows you"
 *  literally true rather than cosmetic. */
export interface StoredTaste {
  interests: Record<string, number>
  vibes: Record<string, number>
  signalCount: number
  suppressed: Record<string, boolean>
  /** ms timestamp of the last decay pass — drives recency decay so the profile
   *  tracks EVOLVING taste instead of accumulating forever. */
  lastDecayedAt?: number
}

class FirebaseDataService {
  private userPreferencesCache = new Map<string, UserPreferences>()
  private tasteProfileCache = new Map<string, { t: number; v: TasteProfile }>()
  private storedTasteCache = new Map<string, { t: number; v: StoredTaste }>()
  private friendSavedCache = new Map<string, { t: number; v: Map<string, string[]> }>()
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

  /**
   * Follower COUNT without hydrating every follower. getFollowers does an N+1
   * getCurrentUser fan-out (one read per follower) purely so callers can read
   * `.length`; this is a single server-side aggregation (billed as 1 read).
   */
  async getFollowerCount(userId: string): Promise<number> {
    try {
      const snap = await getCountFromServer(collection(db, 'users', userId, 'followers'))
      return snap.data().count
    } catch (error) {
      console.error('Error fetching follower count:', error)
      return 0
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
      const filteredFollowing = following.filter(user => user !== null) as User[]
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

      // Log the follow so it shows up in the friends activity rail
      // ("Mika followed Aya"). Without this, follow events were invisible
      // beyond the followers count delta.
      try {
        const activityRef = doc(collection(db, 'users', currentUserId, 'activity'))
        await setDoc(activityRef, {
          id: activityRef.id,
          type: 'follow',
          userId: currentUserId,
          targetUserId,
          createdAt: new Date().toISOString(),
        })
        try { this.userActivityCache.delete(currentUserId) } catch {}
      } catch (e) {
        console.warn('[followUser] activity log failed', e)
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

  async getSavedPlaces(userId: string, max = 200): Promise<Place[]> {
    try {
      const savedPlacesQuery = query(
        collection(db, 'users', userId, 'savedPlaces'),
        orderBy('savedAt', 'desc'),
        fsLimit(Math.max(max, 1))
      );
      const savedPlacesSnapshot = await getDocs(savedPlacesQuery);
      const placePromises = savedPlacesSnapshot.docs.map(doc => this.getPlace(doc.data().placeId));
      // Await the fetches FIRST, then drop the nulls. The previous code called
      // .filter(p => p !== null) on the array of *pending Promises* (never null),
      // so missing/deleted places resolved to null and leaked into the result —
      // breaking the saved-places list, Favorites, and the Home saved count.
      const places = await Promise.all(placePromises);
      return places.filter((p): p is Place => p !== null);
    } catch (error) {
      console.error('Error fetching saved places:', error);
      return [];
    }
  }

  /**
   * Just the set of place ids a user has saved — ONE query against the
   * savedPlaces subcollection, no per-place getDoc fan-out. Use this (not
   * getSavedPlaces) whenever you only need "is this saved?" — e.g. excluding
   * already-saved places from recommendations.
   */
  async getSavedPlaceIds(userId: string, max = 500): Promise<Set<string>> {
    const ids = new Set<string>()
    if (!userId) return ids
    try {
      const snap = await getDocs(query(collection(db, 'users', userId, 'savedPlaces'), fsLimit(Math.max(max, 1))))
      snap.forEach(d => { const pid = (d.data() as { placeId?: string }).placeId; if (pid) ids.add(pid) })
    } catch (error) {
      console.warn('[getSavedPlaceIds] failed', error)
    }
    return ids
  }

  /**
   * Self-heal saved places that were persisted without coordinates (the old
   * save path dropped Google's top-level lat/lng). For each such place that
   * still carries a googlePlaceId, fetch its location once via Place Details,
   * WRITE IT BACK to the place doc (so it's a one-time cost), and return a
   * map of id → coords for the caller to patch its in-memory state. Bounded by
   * `cap` per call to keep the Places bill controlled; heals a few per view.
   */
  async backfillMissingCoords(
    places: Array<Place & { googlePlaceId?: string | null; address?: string; location?: { lat?: number; lng?: number; address?: string } }>,
    cap = 8
  ): Promise<Map<string, { lat: number; lng: number }>> {
    const out = new Map<string, { lat: number; lng: number }>()
    // Heal any place that has no coords but enough to look one up: either a
    // googlePlaceId (precise, via Details) OR a name + address (via Text
    // Search). The name+address path is what fixes legacy saves that predate
    // the googlePlaceId field — so existing lists pin without a data wipe.
    const needs = (places || [])
      .filter(p => p && p.id && !readCoords(p) && (!!p.googlePlaceId || (!!p.name && !!(p.address || p.location?.address))))
      .slice(0, cap)
    if (needs.length === 0) return out
    await Promise.all(needs.map(async (p) => {
      try {
        let lat: number | undefined
        let lng: number | undefined
        if (p.googlePlaceId) {
          const det = await getDetails(p.googlePlaceId)
          if (det) { lat = det.lat; lng = det.lng }
        }
        if ((typeof lat !== 'number' || typeof lng !== 'number') && p.name) {
          const addr = p.address || p.location?.address || ''
          const res = await searchText(`${p.name} ${addr}`.trim(), { max: 1 })
          if (res[0]) { lat = res[0].lat; lng = res[0].lng }
        }
        if (typeof lat === 'number' && typeof lng === 'number' && !(lat === 0 && lng === 0)) {
          const coords = { lat, lng }
          out.set(p.id, coords)
          try {
            await updateDoc(doc(db, 'places', p.id), {
              coordinates: coords,
              location: { ...(p.location || {}), lat, lng },
            })
          } catch (e) {
            console.warn('[backfillMissingCoords] write-back failed', e)
          }
        }
      } catch (e) {
        console.warn('[backfillMissingCoords] lookup failed', e)
      }
    }))
    return out
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

      await setDoc(doc(db, 'users', userId), userProfile)
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

    return places
  }

  private async searchLists(searchQuery: string, filters: any, limitCount: number): Promise<List[]> {
    const constraints: QueryConstraint[] = [
      where('isPublic', '==', true)
    ]
 
 
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
    // When there's a query, fetch a wider UNORDERED pool and rank client-side —
    // mirroring searchPlaces/searchLists. Ordering by influences and capping at
    // limitCount BEFORE name-matching made anyone outside the top-N most
    // influential accounts unfindable by name. Influence stays a tiebreaker via
    // the rank() comparator below. With no query, keep the influence-ranked top.
    const hasQuery = !!(searchQuery && searchQuery.trim())
    const usersQuery = hasQuery
      ? query(collection(db, 'users'), fsLimit(limitCount * 5))
      : query(collection(db, 'users'), orderBy('influences', 'desc'), fsLimit(limitCount))
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
      const searchLower = searchQuery.toLowerCase().replace(/^@/, '').trim()
      const matched = users.filter(user =>
        user.name.toLowerCase().includes(searchLower) ||
        user.username.toLowerCase().includes(searchLower) ||
        (user.bio && user.bio.toLowerCase().includes(searchLower)) ||
        (user.tags && user.tags.some(tag => tag.toLowerCase().includes(searchLower)))
      )
      // Rank by how directly the query names the person — exact handle/name
      // first, then prefix, then substring, then bio/tag-only matches. The DB
      // order (by influences) is only a tiebreaker. Previously results stayed
      // influences-ordered, so the person you typed could sit below strangers.
      const rank = (user: User): number => {
        const name = (user.name || '').toLowerCase()
        const handle = (user.username || '').toLowerCase()
        if (handle === searchLower || name === searchLower) return 0
        if (handle.startsWith(searchLower) || name.startsWith(searchLower)) return 1
        if (handle.includes(searchLower) || name.includes(searchLower)) return 2
        return 3 // bio/tag-only match
      }
      return matched
        .sort((a, b) => {
          const r = rank(a) - rank(b)
          if (r !== 0) return r
          // Tiebreak by influence so the more notable match leads within a band.
          return ((b as any).influences || 0) - ((a as any).influences || 0)
        })
        .slice(0, limitCount)
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
      
      const commentsQuery = query(
        collection(db, 'posts', postId, 'comments'),
        orderBy('createdAt', 'desc')
      );
      const commentsSnapshot = await getDocs(commentsQuery);
      
      
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
      
      return comments;
    } catch (error) {
      console.error('firebaseDataService: Error fetching comments for post:', error);
      return [];
    }
  }

  async postComment(postId: string, userId: string, text: string): Promise<PostComment | null> {
    try {
      
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

      await setDoc(newCommentRef, newComment);
      
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
      const alreadyLiked = (data.likedBy || []).includes(userId)
      // Atomic toggle — was previously a read-modify-write that lost concurrent
      // likes from different users (last writer wins). arrayUnion/arrayRemove
      // and increment() are merged server-side, so two simultaneous likers
      // both end up in likedBy with the count incremented twice.
      if (alreadyLiked) {
        await updateDoc(commentRef, { likedBy: arrayRemove(userId), likes: increment(-1) })
      } else {
        await updateDoc(commentRef, { likedBy: arrayUnion(userId), likes: increment(1) })
      }
    } catch (error) {
      console.error('firebaseDataService: Error liking comment:', error)
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

    } catch (error) {
      console.error('Error saving post to list:', error);
    }
  }

  async savePlaceToList(placeId: string, listId: string, userId: string, note?: string, savedFromListId?: string, status?: 'loved' | 'tried' | 'want', triedRating?: 'liked' | 'neutral' | 'disliked', skipActivity = false): Promise<void> {
    const listRef = doc(db, 'lists', listId);

    try {
      const listDoc = await getDoc(listRef);
      if (!listDoc.exists()) {
        throw new Error(`List with id ${listId} does not exist.`);
      }

      const listData = listDoc.data() as List;
      
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

      // Log activity for user feed (skipped for auto status-collection saves so
      // they don't double-log alongside the user's custom-list save).
      if (!skipActivity) {
        try {
          await this.logActivity(userId, { type: 'save', userId, placeId, listId })
        } catch (e) {
          console.warn('Failed to log save place activity:', e)
        }
      }

      // savedCount is now incremented idempotently via recordUserSave() at the
      // end of the SaveModal flow — not here. Otherwise picking N lists would
      // bump the count by N, plus the auto-list path would add another +1.
    } catch (error) {
      // Rethrow so callers know the save failed. Swallowing here meant the
      // SaveModal flow ran recordUserSave (bumping savedCount + flipping the
      // bookmark to "Saved" everywhere) and showed a success toast even when
      // the place never actually landed in the list. The live caller
      // (App.onSave) already wraps this in try/catch with an error toast.
      console.error('Error saving place to list:', error);
      throw error;
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

  /**
   * Nest one list inside another (folder-style). The parent list's
   * `subLists: string[]` array gains an entry pointing at the child list.
   * This is what powers "Save list" on a list — instead of liking, you
   * collect the list as a sub-folder under one of your own.
   *
   * Cycles are prevented at the immediate level (you can't save a list
   * into itself); deeper cycles are unlikely with the current UI but can
   * be guarded later if needed.
   */
  async saveListToList(childListId: string, parentListId: string, userId: string): Promise<boolean> {
    if (!childListId || !parentListId || childListId === parentListId) return false
    try {
      const parentRef = doc(db, 'lists', parentListId)
      const parentSnap = await getDoc(parentRef)
      if (!parentSnap.exists()) return false
      const parentData = parentSnap.data() as { subLists?: string[]; userId?: string }
      const existing = Array.isArray(parentData.subLists) ? parentData.subLists : []
      if (existing.includes(childListId)) return false
      await updateDoc(parentRef, {
        subLists: arrayUnion(childListId),
        updatedAt: Timestamp.now(),
      })
      try {
        await this.logActivity(userId, { type: 'save', userId, listId: parentListId, savedListId: childListId } as any)
      } catch (e) {
        console.warn('[saveListToList] activity log failed', e)
      }
      return true
    } catch (e) {
      console.error('[saveListToList] failed', e)
      return false
    }
  }

  /**
   * Hydrate the sub-lists collected inside a parent list. Reads the
   * parent's `subLists` array and fans out a getList per id.
   */
  async getSubLists(listId: string): Promise<List[]> {
    try {
      const ref = doc(db, 'lists', listId)
      const snap = await getDoc(ref)
      if (!snap.exists()) return []
      const ids = (snap.data() as { subLists?: string[] }).subLists || []
      if (ids.length === 0) return []
      const lists = await Promise.all(ids.map(id => this.getList(id).catch(() => null)))
      return lists.filter((l): l is List => !!l)
    } catch (e) {
      console.warn('[getSubLists] failed', e)
      return []
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

  // Per-user auto "status collection" list ids, cached so we don't re-query.
  private statusListCache = new Map<string, string>()

  /**
   * Resolve the user's auto-maintained collection list for a save status
   * ("All Loved" / "All Tried" / "All Want"), creating it lazily. These let a
   * user track a sentiment without making (and bloating) custom lists. Created
   * directly (no create_list activity) so they don't spam the friends feed.
   */
  async getOrCreateStatusList(userId: string, status: 'loved' | 'tried' | 'want'): Promise<string | null> {
    if (!userId) return null
    const key = `${userId}:${status}`
    const cached = this.statusListCache.get(key)
    if (cached) return cached
    const NAME = { loved: 'All Loved', tried: 'All Tried', want: 'All Want' } as const
    const DESC = { loved: 'Everywhere you loved', tried: "Everywhere you've been", want: 'Places you want to try' } as const
    const wantedLc = NAME[status].toLowerCase()
    try {
      const lists = await this.getUserLists(userId)
      const existing = lists.find(l => (l.name || '').toLowerCase() === wantedLc)
      if (existing) { this.statusListCache.set(key, existing.id); return existing.id }
      const ref = doc(collection(db, 'lists'))
      await setDoc(ref, this.cleanUndefined({
        id: ref.id,
        name: NAME[status],
        description: DESC[status],
        privacy: 'private',
        isPublic: false,
        tags: ['#auto-generated'],
        autoStatus: status,
        userId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        hubs: [],
        likes: 0,
        isLiked: false,
      }))
      this.statusListCache.set(key, ref.id)
      return ref.id
    } catch (e) {
      console.warn('[getOrCreateStatusList] failed', e)
      return null
    }
  }

  /**
   * Add a place to the user's auto status collection — call alongside the
   * normal custom-list save so every save is tracked by sentiment without the
   * user having to pick/create a list.
   */
  async recordStatusSave(
    userId: string,
    placeId: string,
    status: 'loved' | 'tried' | 'want',
    rating?: 'liked' | 'neutral' | 'disliked',
    note?: string,
  ): Promise<void> {
    if (!userId || !placeId) return
    try {
      const listId = await this.getOrCreateStatusList(userId, status)
      if (!listId) return
      await this.savePlaceToList(placeId, listId, userId, note, undefined, status, rating, true)
    } catch (e) {
      console.warn('[recordStatusSave] failed', e)
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

  /**
   * All posts attached to a place/hub, newest first, privacy-gated for the
   * viewer. Queries `posts where hubId == id` (no orderBy, so no composite
   * index is needed) and sorts in memory — mirrors getPostsForList. This was
   * referenced by updateHubBannerImage but never defined, which threw
   * "getPostsForHub is not a function" on every hub-banner refresh.
   */
  async getPostsForHub(hubId: string, viewerId?: string): Promise<Post[]> {
    if (!hubId) return [];
    try {
      const snap = await getDocs(query(collection(db, 'posts'), where('hubId', '==', hubId)));
      const allPosts = (snap.docs.map(d => ({ id: d.id, ...d.data() })) as Post[])
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Privacy gate — same logic as getPostsForList.
      let friendsOfViewer = new Set<string>();
      if (viewerId) {
        try {
          const fr = await this.getUserFriends(viewerId);
          friendsOfViewer = new Set(fr.map(u => u.id));
        } catch (e) {
          console.warn('[getPostsForHub] friend lookup failed', e);
        }
      }
      const posts = allPosts.filter(p => {
        const privacy = (p as { privacy?: string }).privacy;
        if (!privacy || privacy === 'public') return true;
        if (privacy === 'friends') return !!viewerId && (p.userId === viewerId || friendsOfViewer.has(p.userId));
        return p.userId === viewerId;
      });

      return posts;
    } catch (error) {
      console.error('Error fetching posts for hub:', error);
      return [];
    }
  }

  async getProfileComments(userId: string): Promise<PostComment[]> {
    try {
      const commentsQuery = query(
        collection(db, 'users', userId, 'comments'),
        orderBy('createdAt', 'desc')
      );
      const commentsSnapshot = await getDocs(commentsQuery);
      
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
      
      return comments;
    } catch (error) {
      console.error('firebaseDataService: Error fetching profile comments:', error);
      return [];
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
      const targetUserIds = new Set<string>()
      for (const a of activities) {
        if (a.listId && !a.list) listIds.add(a.listId)
        if (a.placeId && !a.place) placeIds.add(a.placeId)
        if (a.type === 'follow' && a.targetUserId && !a.targetUser) targetUserIds.add(a.targetUserId)
      }
      const [lists, places, targetUsers] = await Promise.all([
        Promise.all(Array.from(listIds).map(id => this.getList(id).catch(() => null))),
        Promise.all(Array.from(placeIds).map(id => this.getPlace(id).catch(() => null))),
        Promise.all(Array.from(targetUserIds).map(id => this.getCurrentUser(id).catch(() => null))),
      ])
      const listById = new Map(Array.from(listIds).map((id, i) => [id, lists[i]]))
      const placeById = new Map(Array.from(placeIds).map((id, i) => [id, places[i]]))
      const targetUserById = new Map(Array.from(targetUserIds).map((id, i) => [id, targetUsers[i]]))
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
        if (a.type === 'follow' && a.targetUserId && !a.targetUser) {
          const u = targetUserById.get(a.targetUserId)
          if (u) activity.targetUser = u
        }
        return activity as Activity
      })

      // Filter out activity entries that target the auto-generated bucket
      // lists (All Loved / All Tried / All Want). They're an implementation
      // detail of the save flow — surfacing "Created All Loved" etc. in the
      // user's recent activity is noise. We also drop create_list rows whose
      // referenced list no longer exists (orphaned activity).
      const isAutoListName = (name?: string) => {
        const n = (name || '').toLowerCase()
        return n === 'all loved' || n === 'all tried' || n === 'all want'
      }
      // Both tag spellings exist in the wild: AuthContext used to write the
      // unadorned 'auto-generated' tag, while the deleted ensureAutoList
      // wrote '#auto-generated'. Accept both so legacy entries are filtered
      // regardless of which path created them.
      const hasAutoTag = (tags?: unknown) => Array.isArray(tags) &&
        ((tags as string[]).includes('auto-generated') || (tags as string[]).includes('#auto-generated'))
      activities = activities.filter(a => {
        const list = (a as { list?: { name?: string; tags?: string[] } }).list
        if (a.type === 'create_list') {
          if (!list) return false // orphaned — list got deleted
          if (isAutoListName(list.name)) return false
          if (hasAutoTag(list.tags)) return false
        }
        if (a.type === 'save' && a.listId && !a.placeId && list && isAutoListName(list.name)) {
          // saveListToList logging into an auto bucket is also noise
          return false
        }
        if (a.type === 'follow' && !a.targetUser) {
          // Followed user couldn't be hydrated (deleted account, etc.) —
          // a "Followed someone" row with no name is just noise.
          return false
        }
        return true
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
    } catch (error) {
      console.error('Error adding tag:', error)
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
  // TASTE-DRIVEN RECOMMENDATIONS
  // ====================

  /**
   * Read the durable, accumulating interaction vector (userTaste/{uid}). This
   * is the memory that grows with every save/open/like/search — the thing that
   * makes the app know you better the more you use it. Cached 2 min.
   */
  async getStoredTaste(userId: string): Promise<StoredTaste> {
    const empty: StoredTaste = { interests: {}, vibes: {}, signalCount: 0, suppressed: {} }
    if (!userId) return empty
    const c = this.storedTasteCache.get(userId)
    if (c && Date.now() - c.t < 2 * 60 * 1000) return c.v
    try {
      const snap = await getDoc(doc(db, 'userTaste', userId))
      const data = (snap.exists() ? snap.data() : {}) as Partial<StoredTaste>
      const v: StoredTaste = {
        interests: data.interests || {},
        vibes: data.vibes || {},
        signalCount: typeof data.signalCount === 'number' ? data.signalCount : 0,
        suppressed: data.suppressed || {},
        lastDecayedAt: typeof data.lastDecayedAt === 'number' ? data.lastDecayedAt : undefined,
      }
      this.storedTasteCache.set(userId, { t: Date.now(), v })
      return v
    } catch (e) {
      console.warn('[getStoredTaste] failed', e)
      return empty
    }
  }

  /**
   * Record a taste signal into the persistent vector via ATOMIC increments
   * (no read-modify-write race, creates the doc if missing). Positive weight =
   * "more of this"; negative = "less". Fire-and-forget from the UI. This is the
   * write half of the learning loop — call it on save/open/like/search/dismiss.
   */
  async recordTasteSignal(
    userId: string,
    opts: { interests: string[]; vibes?: string[]; weight: number; suppressPlaceId?: string }
  ): Promise<void> {
    if (!userId || (!opts.interests?.length && !opts.suppressPlaceId)) return
    // Use updateDoc with DOTTED FIELD PATHS (e.g. 'interests.coffee') — this is
    // the canonical, unambiguous way to atomically deep-merge nested map keys.
    // (setDoc(merge:true) on a nested map OBJECT is easy to get wrong — it can
    // replace the whole map and wipe sibling keys, e.g. losing every previously
    // suppressed place. Dotted paths only ever touch the one key.) Interest
    // keys and place ids contain no dots, so they're path-safe.
    const updates: Record<string, unknown> = { signalCount: increment(1), updatedAt: Timestamp.now() }
    for (const k of new Set(opts.interests || [])) updates[`interests.${k}`] = increment(opts.weight)
    if (opts.vibes?.length) {
      for (const v of new Set(opts.vibes)) updates[`vibes.${v}`] = increment(Math.max(0.5, opts.weight))
    }
    // Store a timestamp (not `true`) so the suppressed map can be aged-out /
    // pruned during the decay pass — otherwise it grows forever toward the 1MB
    // doc limit for heavy dismissers.
    if (opts.suppressPlaceId) updates[`suppressed.${opts.suppressPlaceId}`] = Date.now()
    const ref = doc(db, 'userTaste', userId)
    try {
      try {
        await updateDoc(ref, updates)
      } catch (e) {
        // updateDoc throws not-found if the doc doesn't exist yet — create an
        // empty shell (plain set, only when truly absent so we never clobber),
        // then apply the same dotted-path increments.
        if ((e as { code?: string })?.code === 'not-found') {
          await setDoc(ref, { interests: {}, vibes: {}, suppressed: {}, signalCount: 0, createdAt: Timestamp.now() })
          await updateDoc(ref, updates)
        } else {
          throw e
        }
      }
      // Bust caches so the next profile build reflects the new signal.
      this.storedTasteCache.delete(userId)
      this.invalidateTasteProfile(userId)
    } catch (e) {
      console.warn('[recordTasteSignal] failed', e)
    }
  }

  /** Convenience: learn from a place the user engaged with. weight encodes
   *  intent (loved 3 / tried 2 / want 1.5 / opened 0.6 / liked 1). */
  recordTasteFromPlace(userId: string, place: Parameters<typeof placeInterestKeys>[0] & { id?: string; tags?: string[]; name?: string }, weight: number): void {
    const interests = Array.from(placeInterestKeys(place))
    // Derive the aesthetic vibe from the place's category AND its tags/name, so
    // the "Your vibe" word-cluster grows richer with every place you engage
    // with (a candlelit wine bar adds "candlelit · moody"; a matcha cafe adds
    // "matcha hour · slow mornings").
    const vibes = detectVibes([
      place.primaryType || undefined,
      ...(place.types || []),
      ...(place.tags || []),
      place.name,
    ])
    if (!interests.length && !vibes.length) return
    void this.recordTasteSignal(userId, { interests, vibes, weight })
  }

  /** Convenience: learn intent from a search query. */
  recordTasteFromQuery(userId: string, query: string, weight = 0.5): void {
    const interests = Array.from(detectInterests([query]).keys())
    if (!interests.length) return
    void this.recordTasteSignal(userId, { interests, weight })
  }

  /** "Not interested" — down-weight the place's interests and suppress it. */
  markNotInterested(userId: string, place: Parameters<typeof placeInterestKeys>[0] & { id: string }): void {
    const interests = Array.from(placeInterestKeys(place))
    void this.recordTasteSignal(userId, { interests, weight: -2, suppressPlaceId: place.id })
  }

  /**
   * Map of placeId → names of people the user FOLLOWS who saved it. Powers
   * "Maya saved this" social proof + a recommendation boost — your social graph
   * shaping your feed. Bounded to `cap` follows and cached 10 min (one query
   * per followed user), so it doesn't run on every feed load.
   */
  async getFriendSavedPlaceMap(userId: string, cap = 12): Promise<Map<string, string[]>> {
    if (!userId) return new Map()
    const c = this.friendSavedCache.get(userId)
    if (c && Date.now() - c.t < 10 * 60 * 1000) return c.v
    const map = new Map<string, string[]>()
    try {
      const following = (await this.getUserFollowing(userId).catch(() => [] as User[])).slice(0, cap)
      await Promise.all(following.map(async (f) => {
        const ids = await this.getSavedPlaceIds(f.id, 100).catch(() => new Set<string>())
        const name = (f.name || f.username || 'A friend').split(' ')[0]
        for (const pid of ids) {
          const arr = map.get(pid)
          if (arr) { if (!arr.includes(name)) arr.push(name) }
          else map.set(pid, [name])
        }
      }))
    } catch (e) {
      console.warn('[getFriendSavedPlaceMap] failed', e)
    }
    this.friendSavedCache.set(userId, { t: Date.now(), v: map })
    return map
  }

  /**
   * Build (and cache, 5 min) the user's taste profile by BLENDING the
   * accumulated interaction vector (primary — grows with use) with their
   * saved-place categories, signup vibes, and bio. Pure internal data, no
   * Places API cost. signalCount/confidence drive the "getting to know you" UI.
   */
  async buildTasteProfile(userId: string): Promise<TasteProfile> {
    const cached = this.tasteProfileCache.get(userId)
    if (cached && Date.now() - cached.t < 5 * 60 * 1000) return cached.v

    const [user, saved, stored] = await Promise.all([
      this.getCurrentUser(userId).catch(() => null),
      this.getSavedPlaces(userId, 60).catch(() => [] as Place[]),
      this.getStoredTaste(userId).catch(() => ({ interests: {}, vibes: {}, signalCount: 0, suppressed: {} } as StoredTaste)),
    ])

    // RECENCY DECAY — fade the accumulated vector over time so the profile
    // tracks EVOLVING taste rather than accumulating forever. Every ~2 weeks
    // since the last pass, multiply scores by 0.85 and drop near-zero entries;
    // interests you still engage with get re-incremented and stay high, while
    // abandoned ones quietly fade. Runs at most once per interval (cheap).
    const now = Date.now()
    const hasStoredData = stored.signalCount > 0 || Object.keys(stored.interests).length > 0
    if (hasStoredData) {
      const DECAY_INTERVAL = 14 * 24 * 60 * 60 * 1000
      const DECAY_FACTOR = 0.85
      if (stored.lastDecayedAt === undefined) {
        // First time we've seen this (pre-decay) doc — set the baseline.
        stored.lastDecayedAt = now
        this.storedTasteCache.set(userId, { t: now, v: stored })
        updateDoc(doc(db, 'userTaste', userId), { lastDecayedAt: now }).catch(() => {})
      } else if (now - stored.lastDecayedAt > DECAY_INTERVAL) {
        const periods = Math.floor((now - stored.lastDecayedAt) / DECAY_INTERVAL)
        const factor = Math.pow(DECAY_FACTOR, periods)
        // Apply decay as ATOMIC per-key decrements (increment(-amount)) rather
        // than replacing the whole map. A full-map updateDoc would clobber any
        // taste signal that landed concurrently; atomic decrements compose with
        // those increments, so no signal is ever lost.
        const updates: Record<string, unknown> = { lastDecayedAt: now }
        const applyDecay = (m: Record<string, number>, field: 'interests' | 'vibes'): Record<string, number> => {
          const next: Record<string, number> = {}
          for (const [k, val] of Object.entries(m)) {
            const target = val * factor >= 0.2 ? Math.round(val * factor * 100) / 100 : 0 // drop dust
            const dec = val - target
            if (dec > 0) updates[`${field}.${k}`] = increment(-dec)
            if (target > 0) next[k] = target
          }
          return next
        }
        stored.interests = applyDecay(stored.interests, 'interests')
        stored.vibes = applyDecay(stored.vibes, 'vibes')
        // Prune the suppressed map in the same pass so it can't grow unbounded.
        // Entries now hold a timestamp: drop ones past the TTL (the place may
        // resurface — arguably better UX), and migrate legacy boolean entries to
        // a timestamp so they start aging instead of living forever.
        const SUPPRESS_TTL = 90 * 24 * 60 * 60 * 1000
        for (const [id, ts] of Object.entries(stored.suppressed || {})) {
          if (typeof ts !== 'number') { updates[`suppressed.${id}`] = now; continue }
          if (now - ts > SUPPRESS_TTL) updates[`suppressed.${id}`] = deleteField()
        }
        stored.lastDecayedAt = now
        // Force a fresh read next time so we never re-decay stale data.
        this.storedTasteCache.delete(userId)
        updateDoc(doc(db, 'userTaste', userId), updates).catch(() => {})
      }
    }

    const weights = new Map<string, number>()
    const bump = (key: string, w: number) => weights.set(key, (weights.get(key) || 0) + w)

    // (0) Accumulated interaction vector — PRIMARY signal. Captures every
    //     save/open/like/search/dismiss over the user's whole history, so this
    //     is what makes recommendations sharpen the more they use the app.
    for (const [k, v] of Object.entries(stored.interests)) bump(k, v)
    // (1) Saved places — folded in at a MODEST weight. This serves two roles:
    //     it bootstraps users whose saves predate the interaction log (their
    //     stored vector is empty), and it gently reinforces saved categories
    //     for everyone. There IS deliberate overlap with stored.interests for
    //     post-log saves, but it's bounded (a loved save = stored 3 + 1.5) and
    //     desirable — an explicit save should outweigh light open/search
    //     signals. We don't gate on signalCount, because that created a cliff
    //     where a legacy user's first new save would drop all their older
    //     saves from the profile. Weight ×1.5 per save.
    for (const p of saved) {
      for (const k of placeInterestKeys(p as Place)) bump(k, 1.5)
    }
    // (2) Signup vibes / categories (user.tags). Weight ×2 per hit.
    for (const [k, n] of detectInterests((user?.tags as string[]) || [])) bump(k, 2 * n)
    // (3) Bio keywords. Weight ×1.5 per hit.
    let bioPrefs: string[] = []
    if (user?.bio) {
      try {
        const bio = await this.analyzeUserBio(user.bio)
        for (const [k, n] of detectInterests([...bio.interests, ...bio.suggestedCategories, ...bio.suggestedTags])) bump(k, 1.5 * n)
        bioPrefs = bio.preferences || []
      } catch { /* bio analysis is best-effort */ }
    }

    // Keep only net-positive interests (a dismissed-heavy category can go ≤0).
    const interests = Array.from(weights.entries())
      .filter(([, w]) => w > 0)
      .map(([key, weight]) => ({ key, weight, label: interestLabel(key) }))
      .sort((a, b) => b.weight - a.weight)

    // Accumulated vibes lead (highest-scoring first), then fill from signup
    // vibes + bio. All normalized to vibe KEYS. Keep up to 8 so "Your vibe"
    // reads like a growing mood-board, not a single word.
    const storedTopVibes = Object.entries(stored.vibes).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k)
    const seedVibes = detectVibes([...((user?.tags as string[]) || []), ...bioPrefs])
    const vibes = Array.from(new Set([...storedTopVibes, ...seedVibes])).slice(0, 8)

    const signalCount = stored.signalCount
    const confidence: TasteProfile['confidence'] = signalCount >= 25 ? 'known' : signalCount >= 6 ? 'learning' : 'new'

    const profile: TasteProfile = {
      interests,
      vibes,
      hasSignal: interests.length > 0,
      savedCount: saved.length,
      signalCount,
      confidence,
      suppressed: new Set(Object.keys(stored.suppressed || {})),
    }
    this.tasteProfileCache.set(userId, { t: Date.now(), v: profile })
    return profile
  }

  invalidateTasteProfile(userId: string) {
    this.tasteProfileCache.delete(userId)
  }

  /**
   * Taste-matched place recommendations: queries Google `searchText` with
   * vibe-rich phrases derived from the user's top interests ("cozy specialty
   * coffee shop", "scenic beach") near their location, blends in taste-ranked
   * internal places, drops anything already saved, and ranks by taste fit +
   * proximity + popularity. Each result carries a human "reason".
   *
   * Cost: external queries are capped (top ~4 interests) and cached per
   * (interest, vibe, ~1km cell) for 24h; forceFresh (Refresh) bypasses cache.
   */
  async getTasteRecommendations(
    userId: string,
    location: { lat: number; lng: number } | null,
    opts: { limit?: number; seed?: number | string; forceFresh?: boolean } = {}
  ): Promise<Array<Place & { reason?: string }>> {
    const limit = opts.limit || 12
    const profile = await this.buildTasteProfile(userId)

    // Interests to fetch for. With no signal yet (brand-new user), fall back to
    // broadly-loved categories so the feed is never empty.
    const topKeys = profile.interests.slice(0, 4).map(i => i.key)
    const queryKeys = topKeys.length ? topKeys : ['coffee', 'restaurant', 'nature']
    const profileWeight = new Map(profile.interests.map(i => [i.key, i.weight]))
    const vibe = profile.vibes[0]
    // Outdoor interests read awkwardly with a vibe prefix ("cozy beach").
    const noVibePrefix = new Set(['beach', 'hiking', 'nature', 'viewpoint'])

    type Cand = Place & { lat?: number; lng?: number; __interestKey?: string; userRatingCount?: number }
    const pool: Cand[] = []

    // (A) External taste queries near the user.
    if (location) {
      const perInterest = Math.max(6, Math.ceil((limit * 2) / queryKeys.length))
      const cell = `${location.lat.toFixed(2)},${location.lng.toFixed(2)}`
      const batches = await Promise.all(queryKeys.map(async (key) => {
        const base = interestQuery(key) || key
        // vibe is a slug KEY ('slow_mornings') — use its human label in the
        // actual search text ("slow mornings specialty coffee shop").
        const q = vibe && !noVibePrefix.has(key) ? `${vibeLabel(vibe)} ${base}` : base
        const cacheKey = `taste:v1:${key}|${vibe || ''}|${cell}`
        if (!opts.forceFresh) {
          try {
            const raw = localStorage.getItem(cacheKey)
            if (raw) {
              const { t, v } = JSON.parse(raw)
              if (Date.now() - t < 24 * 60 * 60 * 1000) return (v as Cand[]).map(p => ({ ...p, __interestKey: key }))
            }
          } catch { /* ignore */ }
        }
        let found: Cand[] = []
        try {
          found = (await searchText(q, { lat: location.lat, lng: location.lng, max: perInterest })) as Cand[]
        } catch (e) { console.warn('[taste] searchText failed', key, e) }
        try { localStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), v: found })) } catch { /* quota */ }
        return found.map(p => ({ ...p, __interestKey: key }))
      }))
      for (const b of batches) pool.push(...b)
    }

    // (B) Internal taste-ranked places (user-curated hubs with real photos +
    //     saved counts). Cheap — pure Firestore.
    try {
      const internal = await this.getSuggestedPlaces({
        tags: queryKeys,
        location: location || undefined,
        limit: Math.max(limit, 12),
      })
      for (const p of internal) pool.push(p as Cand)
    } catch { /* internal pool is a bonus */ }

    // (C) Places people you FOLLOW have saved — your social graph shaping your
    //     feed. Strong signal: trusted-taste social proof. Pull in any that
    //     aren't already in the pool (the friend map is cached 10 min).
    const friendMap = await this.getFriendSavedPlaceMap(userId).catch(() => new Map<string, string[]>())
    if (friendMap.size > 0) {
      const poolIds = new Set(pool.map(p => p.id))
      const friendOnly = Array.from(friendMap.keys()).filter(id => !poolIds.has(id)).slice(0, 8)
      const docs = await Promise.all(friendOnly.map(id => this.getPlace(id).catch(() => null)))
      for (const d of docs) if (d) pool.push(d as Cand)
    }

    // Dedupe by id and by normalized name|address.
    const byId = new Set<string>()
    const byFp = new Set<string>()
    const fp = (p: Cand) => {
      const n = String(p.name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
      const a = String(p.address || (p as { location?: { address?: string } }).location?.address || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
      return n && a ? `${n}|${a.slice(0, 24)}` : ''
    }
    const unique = pool.filter(p => {
      if (!p?.id || !p?.name) return false
      if (byId.has(p.id)) return false
      const f = fp(p)
      if (f && byFp.has(f)) return false
      byId.add(p.id); if (f) byFp.add(f)
      return true
    })

    // Exclude places the user already saved — recommendations are for NEW
    // spots. Use the id-only fetch (one query) rather than the N+1 getSavedPlaces.
    const savedIds = await this.getSavedPlaceIds(userId).catch(() => new Set<string>())
    const suppressed = profile.suppressed

    // Score by taste fit.
    const scored = unique
      .filter(p => !savedIds.has(p.id) && !suppressed.has(p.id))
      .map(p => {
        const keys = placeInterestKeys(p)
        let score = 0
        let bestKey = ''
        let bestW = -1
        for (const k of keys) {
          const w = profileWeight.get(k) || 0
          // Sublinear (sqrt) so the favourite interest still leads but doesn't
          // run away and fill the whole grid — a 40-coffee-save user has a
          // coffee weight ~180 vs ~5 for a newer interest; linearly that's a
          // 36× ranking gap that buries everything else. sqrt keeps coffee on
          // top while letting #2–#4 interests' places surface.
          score += Math.sqrt(Math.max(0, w)) * 4
          if (w > bestW) { bestW = w; bestKey = k }
        }
        // Credit the interest it was fetched under (so a "beach" query result
        // still scores even if its Google types don't map cleanly).
        if (p.__interestKey) {
          const w = profileWeight.get(p.__interestKey) || 0.5
          score += w * 2
          if (bestW < 0) bestKey = p.__interestKey
        }
        // Proximity (0–12 pts, decaying over ~12km).
        const c = readCoords(p)
        if (c && location) score += Math.max(0, 12 - Math.min(12, this.distanceKm(c, location)))
        // Popularity prior, scored on the right scale per pool. Our lean Places
        // field mask doesn't fetch userRatingCount, so external Google results
        // carry no rating volume — they'd all sum to 0 and rank identically on
        // popularity. Drive it from internal savedCount (a first-party trust
        // signal, higher ceiling) and only fall back to Google rating volume
        // when it's actually present.
        const savedCount = (p as Place).savedCount || 0
        const ratingCount = p.userRatingCount || 0
        score += savedCount > 0
          ? Math.min(5, savedCount * 0.6)
          : Math.min(3, Math.log10(ratingCount + 1) * 1.3)
        // Friend-saved boost — trusted-taste social proof is a strong signal.
        const friendNames = friendMap.get(p.id)
        if (friendNames && friendNames.length) score += 11
        return { p, score, reasonKey: bestKey, friendNames }
      })
      .sort((a, b) => b.score - a.score)

    // Refresh variety: shuffle within the top window so repeated taps rotate.
    // Guard on >1 (not >limit) so Refresh still reshuffles in low-density areas
    // where the candidate count is at or below `limit` — otherwise every tap
    // returned the identical order.
    let ranked = scored
    if (opts.seed !== undefined && scored.length > 1) {
      const window = scored.slice(0, Math.min(scored.length, limit * 3))
      const rng = seededRandom(String(opts.seed))
      for (let i = window.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
        ;[window[i], window[j]] = [window[j], window[i]]
      }
      ranked = window
    }

    return ranked.slice(0, limit).map(s => {
      // Friend social proof wins the reason slot — it's the most compelling.
      const fn = s.friendNames
      let reason: string | undefined
      if (fn && fn.length) {
        reason = fn.length === 1 ? `${fn[0]} saved this` : `${fn[0]} + ${fn.length - 1} you follow saved this`
      } else if (profile.hasSignal && s.reasonKey && profileWeight.get(s.reasonKey)) {
        reason = `Because you love ${interestLabel(s.reasonKey)}`
      }
      return { ...(s.p as Place), reason }
    })
  }

  /**
   * Themed recommendation LANES built from the user's taste — e.g.
   * "More coffee you'll love", "Beaches for your next trip". Each lane is one
   * interest. Crucially these are sourced from interests BEYOND the top few the
   * For-You grid already queries, so a lane is a *different facet* of your taste
   * ("here's a non-coffee corner of you") instead of the coffee places that
   * didn't fit the coffee-heavy grid. Those deeper interests usually aren't
   * cache-warmed by the grid, so this can add up to `maxLanes` cached searchText
   * calls per load (still bounded by the 24h per-interest cache). Returns [] for
   * users with no taste signal or fewer than `GRID_INTEREST_COUNT` interests.
   */
  async getTasteLanes(
    userId: string,
    location: { lat: number; lng: number } | null,
    opts: { perLane?: number; maxLanes?: number } = {}
  ): Promise<Array<{ key: string; title: string; items: Place[] }>> {
    if (!location) return []
    const perLane = opts.perLane || 8
    const maxLanes = opts.maxLanes || 2
    const profile = await this.buildTasteProfile(userId)
    if (!profile.hasSignal) return []

    // The grid queries the top GRID_INTEREST_COUNT interests; lanes pick up
    // where it leaves off so they add breadth rather than echo the grid.
    const GRID_INTEREST_COUNT = 4
    const keys = profile.interests.slice(GRID_INTEREST_COUNT, GRID_INTEREST_COUNT + maxLanes).map(i => i.key)
    if (!keys.length) return []
    const savedIds = await this.getSavedPlaceIds(userId).catch(() => new Set<string>())
    const suppressed = profile.suppressed
    const vibe = profile.vibes[0]
    const noVibePrefix = new Set(['beach', 'hiking', 'nature', 'viewpoint'])
    const cell = `${location.lat.toFixed(2)},${location.lng.toFixed(2)}`

    const titleFor = (key: string): string => {
      const label = interestLabel(key)
      if (key === 'beach') return 'Beaches for your next trip'
      if (key === 'hiking') return 'Trails for your next adventure'
      if (key === 'viewpoint' || key === 'nature') return `${label[0].toUpperCase()}${label.slice(1)} to explore`
      return `More ${label} you'll love`
    }

    const lanes: Array<{ key: string; title: string; items: Place[] }> = []
    for (const key of keys) {
      const cacheKey = `taste:v1:${key}|${vibe || ''}|${cell}`
      let found: Array<Place & { id?: string; name?: string }> = []
      try {
        const raw = localStorage.getItem(cacheKey)
        if (raw) { const { t, v } = JSON.parse(raw); if (Date.now() - t < 24 * 60 * 60 * 1000) found = v }
      } catch { /* ignore */ }
      if (!found.length) {
        const base = interestQuery(key) || key
        const q = vibe && !noVibePrefix.has(key) ? `${vibeLabel(vibe)} ${base}` : base
        try {
          found = (await searchText(q, { lat: location.lat, lng: location.lng, max: perLane + 4 })) as typeof found
          try { localStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), v: found })) } catch { /* quota */ }
        } catch (e) { console.warn('[taste-lanes] searchText failed', key, e) }
      }
      const items = (found || [])
        .filter(p => p?.id && p?.name && !savedIds.has(p.id) && !suppressed.has(p.id))
        .slice(0, perLane) as Place[]
      if (items.length >= 3) lanes.push({ key, title: titleFor(key), items })
    }
    return lanes
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
    this.tasteProfileCache.clear()
    this.storedTasteCache.clear()
    this.friendSavedCache.clear()
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
          if (key.startsWith('reco:') || key.startsWith('places:v1:near|') || key.startsWith('map:') || key.startsWith('taste:v1:')) {
            remove.push(key)
          }
        }
        for (const k of remove) localStorage.removeItem(k)
      } catch (e) {
        console.warn('[clearAllUserScopedState] localStorage cleanup failed', e)
      }
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
        // Fallback to deployed Cloud Function URL — uses the configured
        // project id so a fork / staging env doesn't accidentally hit prod.
        const projectId = (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || 'this-is-76332'
        const cfUrl = `https://us-central1-${projectId}.cloudfunctions.net/geocodeLocation`
        resp = await fetch(`${cfUrl}?q=${encodeURIComponent(query)}&clientKey=${encodeURIComponent(clientKey || '')}` as any)
      }
      if (!resp || !resp.ok) {
        this.geocodeCache.set(cacheKey, null)
        return null
      }
      const data = await (resp as any).json()
      const result = data.location || null
      
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
    /** Original Google place id (ChIJ...). Stored so the CoverPhotoPicker
     *  can fetch photos even after the Firestore doc has its own random id.
     *  Without this we lose the link to Google after the first ensure. */
    googlePlaceId?: string
  }): Promise<{ id: string; created: boolean; googlePlaceId?: string }> {
    // Prevent duplicates: look for matching name and similar address first.
    // Also opportunistically backfill googlePlaceId on existing docs that
    // are missing it (likely from old saves that predated this field).
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
            // Backfill missing fields if we have richer data from Google now.
            const patch: Record<string, unknown> = {}
            if (!data.googlePlaceId && hubData.googlePlaceId) patch.googlePlaceId = hubData.googlePlaceId
            if ((!Array.isArray(data.photos) || data.photos.length === 0) && Array.isArray(hubData.photos) && hubData.photos.length > 0) patch.photos = hubData.photos
            if (!data.primaryType && hubData.primaryType) patch.primaryType = hubData.primaryType
            if ((!Array.isArray(data.types) || data.types.length === 0) && Array.isArray(hubData.types) && hubData.types.length > 0) patch.types = hubData.types
            // Only backfill coordinates when the existing doc has none AND we
            // have real ones now. readCoords rejects (0, 0) so we don't end
            // up writing the Null Island sentinel back over an empty field.
            const existingCoords = readCoords(data)
            const incomingCoords = readCoords(hubData)
            if (!existingCoords && incomingCoords) patch.coordinates = incomingCoords
            if (Object.keys(patch).length > 0) {
              try { await updateDoc(d.ref, patch) } catch (e) { console.warn('[createHub] backfill failed', e) }
            }
            return { id: d.id, created: false, googlePlaceId: data.googlePlaceId || hubData.googlePlaceId }
          }
        }
      }
    } catch (e) { console.warn('[createHub] dedup lookup failed', e) }

    // Only persist coordinates when we actually have them. Previously we wrote
    // (0, 0) as a placeholder, which Firestore happily indexed; later distance
    // calculations then computed great-circle from Null Island and every saved
    // place showed ~5409 mi from a US viewer. Better to omit the field and let
    // readCoords return undefined downstream (callers already guard).
    const hasCoords = typeof hubData.coordinates?.lat === 'number'
      && typeof hubData.coordinates?.lng === 'number'
      && !(hubData.coordinates.lat === 0 && hubData.coordinates.lng === 0)
    const hubRef = await addDoc(collection(db, 'places'), {
      name: hubData.name,
      description: hubData.description,
      address: hubData.address,
      location: hasCoords
        ? { address: hubData.address, lat: hubData.coordinates!.lat, lng: hubData.coordinates!.lng }
        : { address: hubData.address },
      ...(hasCoords ? { coordinates: { lat: hubData.coordinates!.lat, lng: hubData.coordinates!.lng } } : {}),
      tags: [],
      savedCount: 0,
      name_lowercase: hubData.name.toLowerCase(),
      createdAt: Timestamp.now(),
      // Carry through Google metadata so getPlace() can render real images
      // and category-aware posters without needing a follow-up details fetch.
      photos: Array.isArray(hubData.photos) ? hubData.photos : [],
      primaryType: hubData.primaryType || null,
      types: Array.isArray(hubData.types) ? hubData.types : [],
      googlePlaceId: hubData.googlePlaceId || null,
      // mainImage is set by the first-saver via CoverPhotoPicker. Until then,
      // HubImage falls back to the duotone <PlacePoster>.
    });
    return { id: hubRef.id, created: true, googlePlaceId: hubData.googlePlaceId };
  }

  /**
   * Idempotent "user X has saved place Y" marker. Increments savedCount on the
   * place exactly once per user-place pair. Subsequent calls from the same
   * user for the same place are no-ops. Use this from the SaveModal flow
   * after savePlaceToList has run.
   *
   * We mirror the marker into TWO places:
   *   - places/{placeId}/saves/{userId} — used to compute the global
   *     savedCount and to detect "did this specific user save this place".
   *   - users/{userId}/savedPlaces/{placeId} — used by getSavedPlaces() to
   *     render the user's "places I've saved" view (and the PLACES counter
   *     on the profile). Without this write the counter is permanently 0
   *     because nothing else populated that collection.
   */
  async recordUserSave(placeId: string, userId: string): Promise<boolean> {
    try {
      if (!placeId || !userId) return false
      const markerRef = doc(db, 'places', placeId, 'saves', userId)
      const userSavedRef = doc(db, 'users', userId, 'savedPlaces', placeId)
      const existing = await getDoc(markerRef)
      const ts = Timestamp.now()
      // Always backfill the user-side marker even if the global one already
      // exists — that's the path that recovers PLACES counts for accounts
      // who saved before this mirror was added.
      await setDoc(userSavedRef, { placeId, savedAt: ts }, { merge: true })
      // A new save changes the user's taste — drop the cached profile so the
      // next recommendation load reflects it (cheap; just clears the 5-min cache).
      this.invalidateTasteProfile(userId)
      if (existing.exists()) return false
      await setDoc(markerRef, { userId, savedAt: ts })
      const placeRef = doc(db, 'places', placeId)
      await updateDoc(placeRef, { savedCount: increment(1) })
      return true
    } catch (e) {
      console.warn('[recordUserSave] failed', e)
      return false
    }
  }

  /**
   * One-shot reconciliation for accounts whose saves predate the user-side
   * mirror introduced alongside `recordUserSave` v2. Walks the user's lists,
   * gathers unique place ids, and writes any missing
   * users/{uid}/savedPlaces/{placeId} markers.
   *
   * Idempotent and gated by a session flag so a profile mount doesn't pay
   * the cost more than once per tab. Returns the number of new mirrors
   * written so callers can decide whether to refresh derived state.
   */
  async backfillSavedPlacesFromLists(userId: string): Promise<number> {
    if (!userId) return 0
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(`bfsp:${userId}`) === '1') return 0
    } catch { /* sessionStorage unavailable — backfill anyway */ }
    try {
      const lists = await this.getUserLists(userId)
      const placeIds = new Set<string>()
      for (const list of lists) {
        const hubs = (list as { hubs?: unknown[] }).hubs
        if (!Array.isArray(hubs)) continue
        for (const raw of hubs) {
          const id = typeof raw === 'string'
            ? raw
            : (raw && typeof raw === 'object' && 'id' in (raw as object))
              ? String((raw as { id: string }).id)
              : ''
          if (id) placeIds.add(id)
        }
      }
      if (placeIds.size === 0) {
        try { sessionStorage.setItem(`bfsp:${userId}`, '1') } catch {}
        return 0
      }
      let written = 0
      const ts = Timestamp.now()
      // Cap the per-call write count so we don't fan out hundreds of writes
      // on a heavy account in one go. The remainder gets caught next tab.
      const ids = Array.from(placeIds).slice(0, 50)
      const writes = ids.map(async (placeId) => {
        const ref = doc(db, 'users', userId, 'savedPlaces', placeId)
        const snap = await getDoc(ref)
        if (snap.exists()) return
        await setDoc(ref, { placeId, savedAt: ts, backfilled: true }, { merge: true })
        written += 1
      })
      await Promise.all(writes)
      try { sessionStorage.setItem(`bfsp:${userId}`, '1') } catch {}
      return written
    } catch (e) {
      console.warn('[backfillSavedPlacesFromLists] failed', e)
      return 0
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
  private ensureHubInFlight = new Map<string, Promise<{ id: string | null; created: boolean; mainImage?: string | null; googlePlaceId?: string | null }>>()

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
  }): Promise<{ id: string | null; created: boolean; mainImage?: string | null; googlePlaceId?: string | null }> {
    const candidateId = p.id || p.placeId || ''
    const dedupKey = candidateId || `${(p.name || '').toLowerCase().trim()}|${(p.address || p.location?.address || '').toLowerCase().trim()}`
    const existing = this.ensureHubInFlight.get(dedupKey)
    if (existing) return existing

    // Heuristic: a Google Place id starts with "ChIJ" (~27 chars, all-base64
    // characters). Firestore-generated ids are random alnum, never start with
    // ChIJ. We use this to know whether the candidate is a Google id worth
    // preserving on the place doc.
    const looksLikeGoogleId = /^ChIJ[A-Za-z0-9_-]{20,}$/.test(candidateId)

    const work = (async () => {
      try {
        if (candidateId) {
          const found = await this.getPlace(candidateId) as (Place & { mainImage?: string | null; googlePlaceId?: string | null }) | null
          if (found && found.id) {
            // If the existing doc lacks googlePlaceId but we just got one
            // from the caller (looksLikeGoogleId), backfill it so future
            // CoverPhotoPicker openings work without another save round-trip.
            if (!found.googlePlaceId && looksLikeGoogleId) {
              try { await updateDoc(doc(db, 'places', found.id), { googlePlaceId: candidateId }) } catch (e) { console.warn('[ensureHubFromPlace] gpid backfill failed', e) }
              return { id: found.id, created: false, mainImage: found.mainImage || null, googlePlaceId: candidateId }
            }
            return { id: found.id, created: false, mainImage: found.mainImage || null, googlePlaceId: found.googlePlaceId || (looksLikeGoogleId ? candidateId : null) }
          }
        }
        const name = (p.name || '').trim()
        if (!name) return { id: candidateId || null, created: false }
        const address = (p.address || p.location?.address || '').trim()
        // Use readCoords to handle the four shapes Google + legacy callers
        // can pass (lat/lng vs latitude/longitude on either coordinates or
        // location). Previously we fell back to (0, 0) when no coords were
        // present, which persisted Null Island into Firestore — every saved
        // place then showed ~5409 mi from a US viewer (great-circle from
        // (0, 0) to NJ ≈ 8700 km / 5409 mi) and the list map filtered them
        // out as "no locations".
        const coords = readCoords(p)
        const result = await this.createHub({
          name,
          address,
          description: p.description || '',
          coordinates: coords,
          photos: p.photos,
          primaryType: p.primaryType,
          types: p.types,
          googlePlaceId: looksLikeGoogleId ? candidateId : undefined,
        })
        return { id: result.id, created: result.created, mainImage: null, googlePlaceId: result.googlePlaceId || (looksLikeGoogleId ? candidateId : null) }
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
        return;
      }

      // Update the hub's main image
      await updateDoc(doc(db, 'places', hubId), {
        mainImage: bannerImage
      });

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


