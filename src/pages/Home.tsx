import { useState, useEffect, useRef } from 'react'
import { HeartIcon, BookmarkIcon, EyeIcon, PlusIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid'
import SearchAndFilter from '../components/SearchAndFilter'
import AdvancedFiltersDrawer from '../components/AdvancedFiltersDrawer'
import { useFilters } from '../contexts/FiltersContext'
import SaveModal from '../components/SaveModal'
import LocationSelectModal from '../components/LocationSelectModal'
import CreatePost from '../components/CreatePost'
import CommentsModal from '../components/CommentsModal'
import ReplyModal from '../components/ReplyModal'
import ShareModal from '../components/ShareModal'
import type { Place, Post, List, Activity, Hub, User } from '../types/index.js'
import { useNavigation } from '../contexts/NavigationContext.tsx'
import { firebaseListService } from '../services/firebaseListService.js';
import { db } from '../firebase/config'
import { doc, onSnapshot } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext.tsx'
import { firebaseDataService } from '../services/firebaseDataService.js'
import CreateHubModal from '../components/CreateHubModal'
import Section from '../components/Section'
import Button from '../components/ui/Button'
import SegmentedTabs from '../components/ui/SegmentedTabs'
import { CardShell } from '../components/primitives/CardShell'
import { SuggestedHubsRail } from '../components/home/SuggestedHubsRail'
import SuggestedHubModal from '../components/home/SuggestedHubModal'; // Import the new modal
import SafeImage from '../components/ui/SafeImage'
import HubImage from '../components/HubImage'
import '../styles/glass.css'
import '../styles/page-bg.css'
import { stablePlaceKey } from '../utils/stablePlaceKey'
import { kmBetween } from '../utils/distance'
import { isHardBannedChain, isSoftPenalizedChain } from '../utils/chainDetection'
import { mapInterestsToTypes } from '../utils/placeTypes'
import {
  SuggestionsEngine,
  calculateBaseRadius
} from '../services/suggestionsEngine'

// Version marker to verify code reload
console.log('[CODE VERSION] Home.tsx loaded at 2025-10-26T03:15:00Z')

interface FriendActivity extends Omit<Activity, 'list'> {
    user: User
    place?: Place
    placeImage?: string
    list?: string
    places?: number
    note?: string
}

interface DiscoveryItem {
    id: string
    type: 'list' | 'hub'
    title: string
    description: string
    owner?: string
    likes?: number
    places?: number
    image: string
    activity?: string
    item: List | Place
    isGoogleSuggested?: boolean
    googlePlaceDetails?: any
}

const sortOptions = [
    { key: 'relevance', label: 'Relevance' },
    { key: 'popular', label: 'Most Popular' },
    { key: 'friends', label: 'Most Liked by Friends' },
    { key: 'nearby', label: 'Closest to Location' },
]
const filterOptions = [
    { key: 'loved', label: 'Loved' },
    { key: 'tried', label: 'Tried' },
    { key: 'want', label: 'Want to' },
]
// Tags are fetched from Firebase; no static fallback needed here

const Home = () => {
    const {
        openProfileModal,
        openListModal,
        openHubModal,
    } = useNavigation()

    const [friendsActivity, setFriendsActivity] = useState<FriendActivity[]>([])
    const [discoveryItems, setDiscoveryItems] = useState<DiscoveryItem[]>([])
    const [isLoadingActivity, setIsLoadingActivity] = useState(true)
    //
    const [activeTab, setActiveTab] = useState<'friends' | 'discovery'>('discovery')
    const [sortBy, setSortBy] = useState('relevance')
    const [searchQuery, setSearchQuery] = useState('')
    const [activeFilters, setActiveFilters] = useState<string[]>([])
    const [selectedTags, setSelectedTags] = useState<string[]>([])
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; name?: string } | null>(null)
    const [itemDistances, setItemDistances] = useState<Record<string, number>>({})
    const placeCacheRef = useRef<Record<string, Place>>({})
    const [showSaveModal, setShowSaveModal] = useState(false)
    const [showLocationModal, setShowLocationModal] = useState(false)
    const [showCreatePost, setShowCreatePost] = useState(false)
    const [selectedPlace, setSelectedPlace] = useState<Place | null>(null)
    const [createPostListId, setCreatePostListId] = useState<string | null>(null)
    const [createPostHub, setCreatePostHub] = useState<any>(null)
    const [showCommentsModal, setShowCommentsModal] = useState(false)
    const [showReplyModal, setShowReplyModal] = useState(false)
    const [showShareModal, setShowShareModal] = useState(false)
    const [selectedPost, setSelectedPost] = useState<Post | null>(null)
    const { currentUser } = useAuth()
    const { filters } = useFilters()
    const [availableTags, setAvailableTags] = useState<string[]>([])
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [userOwnedLists, setUserOwnedLists] = useState<List[]>([])
    // SuggestedHubModal path removed in favor of direct Create Hub flow
    const [suggestedGoogle, setSuggestedGoogle] = useState<any[]>([])
    const discoveryCacheRef = useRef<{ items: DiscoveryItem[]; suggested: any[]; timestamp: number }>({ items: [], suggested: [], timestamp: 0 })
    const [hasLoadedDiscovery, setHasLoadedDiscovery] = useState(false)
    const forYouCacheRef = useRef<{ items: DiscoveryItem[]; timestamp: number }>({ items: [], timestamp: 0 })
    const suggestedCacheRef = useRef<{ items: any[]; timestamp: number }>({ items: [], timestamp: 0 })
    const [isLoadingForYou, setIsLoadingForYou] = useState(true)
    const [isLoadingSuggested, setIsLoadingSuggested] = useState(true)
    const [showCreateHubModal, setShowCreateHubModal] = useState(false)
    const [createHubSeed, setCreateHubSeed] = useState<any>(null)
    const [recentCreatedHub, setRecentCreatedHub] = useState<Hub | null>(null)

    // State for the new details modal
    const [showSuggestedHubModal, setShowSuggestedHubModal] = useState(false);
    const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
    
    // Track if initial load has happened to prevent React StrictMode double-invoke
    const initialLoadRef = useRef({ forYou: false, suggested: false, activity: false });
    // Track in-flight requests to prevent duplicate calls
    const loadingRef = useRef({ forYou: false, suggested: false, activity: false });

    const handleViewDetails = (placeId: string) => {
      setSelectedPlaceId(placeId);
      setShowSuggestedHubModal(true);
    };

    // Track radius expansion history for progressive search
    const radiusHistoryRef = useRef<number[]>([])

    useEffect(() => {
        if (!currentUser) return;
        
        // Prevent duplicate calls from React StrictMode
        if (initialLoadRef.current.forYou && initialLoadRef.current.suggested && initialLoadRef.current.activity) {
            console.log('[Home] Skipping duplicate mount effect');
            return;
        }

        // AbortController to cancel on unmount/re-render
        const abortController = new AbortController();
        let mounted = true;

        const loadInitialData = async () => {
            try {
                // Load in sequence to avoid overwhelming the API
                if (!initialLoadRef.current.activity && mounted) {
                    initialLoadRef.current.activity = true;
                    await loadFriendsActivity();
                }
                
                if (!initialLoadRef.current.forYou && mounted) {
                    initialLoadRef.current.forYou = true;
                    await loadForYou(false);
                }
                
                if (!initialLoadRef.current.suggested && mounted) {
                    initialLoadRef.current.suggested = true;
                    await loadSuggested(false);
                }

                // Load user lists and tags in parallel (non-API calls)
                if (mounted) {
                    firebaseDataService.getUserLists(currentUser.id)
                        .then(l => setUserOwnedLists(Array.isArray(l) ? l.filter(x => x.userId === currentUser.id) : []))
                        .catch(() => setUserOwnedLists([]));
                    
                    firebaseDataService.getPopularTags(200)
                        .then(tags => setAvailableTags(tags))
                        .catch(() => setAvailableTags(['cozy','trendy','quiet','local','authentic']));
                }
            } catch (error) {
                if (!abortController.signal.aborted) {
                    console.error('[Home] Error loading initial data:', error);
                }
            }
        };

        loadInitialData();

        return () => {
            mounted = false;
            abortController.abort();
        };
    }, [currentUser])

    // Reload discovery when switching to discovery tab (use cache, don't force refresh)
    useEffect(() => {
        if (activeTab === 'discovery' && currentUser) {
            // Use cache - these will return immediately if cache is fresh
            void loadForYou(false);
            void loadSuggested(false);
        }
    }, [activeTab])

    // Optional, motion-safe parallax for the global sunlight layer
    useEffect(() => {
        try {
            const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
            if (reduce) return
            const el = document.querySelector('.sunlight-layer') as HTMLElement | null
            if (!el) return
            const onScroll = () => {
                const y = Math.min(24, window.scrollY * 0.06)
                el.style.transform = `translateY(${y}px)`
            }
            window.addEventListener('scroll', onScroll, { passive: true })
            return () => window.removeEventListener('scroll', onScroll)
        } catch {}
    }, [])

    // Live-sync user profile updates (e.g., location changes)
    useEffect(() => {
        if (!currentUser) return
        try {
            const unsub = onSnapshot(doc(db, 'users', currentUser.id), async (snap) => {
                if (!snap.exists()) return
                const u = { id: snap.id, ...(snap.data() as any) } as User
                const declared = typeof u.location === 'string' ? u.location.trim() : ''
                if (declared) {
                    try {
                        const geo = await firebaseDataService.geocodeLocation(declared)
                        if (geo) {
                            setSelectedLocation({ lat: geo.lat, lng: geo.lng, name: geo.address || declared })
                            if (activeTab === 'discovery') loadDiscoveryItems()
                        }
                    } catch {}
                }
            })
            return () => unsub()
        } catch {}
    }, [currentUser, activeTab])

    const loadFriendsActivity = async () => {
        if (!currentUser) return;
        
        // Prevent duplicate in-flight requests
        if (loadingRef.current.activity) {
            console.log('[loadFriendsActivity] already loading, skipping duplicate call');
            return;
        }
        loadingRef.current.activity = true;
        
        try {
            setIsLoadingActivity(true)
            const friends = await firebaseDataService.getUserFriends(currentUser.id)
            if (friends.length === 0) {
                setFriendsActivity([])
                return
            }
            const allActivities: FriendActivity[] = []
            for (const friend of friends.slice(0, 10)) {
                try {
                    const friendActivity = await firebaseDataService.getUserActivity(friend.id, 5)
                    const transformedActivities: FriendActivity[] = friendActivity.map(activity => ({
                        ...activity,
                        user: friend,
                        place: activity.place,
                        placeImage: activity.place?.hubImage || 'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=400&h=300&fit=crop',
                        list: activity.list?.name,
                        places: activity.list?.hubs?.length || 0,
                    }))
                    allActivities.push(...transformedActivities)
                } catch (error) {
                    console.error(`Error loading activity for friend ${friend.id}:`, error)
                }
            }
            allActivities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            setFriendsActivity(allActivities.slice(0, 12))
        } catch (error) {
            console.error('Error loading friends activity:', error)
            setFriendsActivity([])
        } finally {
            setIsLoadingActivity(false)
            loadingRef.current.activity = false;
        }
    }

    // Load ONLY the external Google suggestions rail
    const loadSuggested = async (bypassCache: boolean = false) => {
        // Prevent duplicate in-flight requests
        if (loadingRef.current.suggested) {
            console.log('[loadSuggested] already loading, skipping duplicate call');
            return;
        }
        loadingRef.current.suggested = true;

        try {
            setIsLoadingSuggested(true)

            // 1. Get context
            const { tags, loc, userPrefs } = await getDiscoveryContext()
            if (!loc) {
                setSuggestedGoogle([]);
                setIsLoadingSuggested(false);
                loadingRef.current.suggested = false;
                return;
            }

            const interests = (userPrefs as any)?.favoriteCategories || []

            // 2. Calculate radius with progressive expansion
            const baseRadius = calculateBaseRadius(userPrefs, filters)
            const isRefresh = bypassCache

            let currentRadius = baseRadius
            if (isRefresh && radiusHistoryRef.current.length > 0) {
                // Progressive expansion on refresh
                const expansionFactors = [1.0, 1.3, 1.6, 2.0, 2.5]
                const round = radiusHistoryRef.current.length
                const factor = expansionFactors[Math.min(round, expansionFactors.length - 1)]
                currentRadius = Math.min(baseRadius * factor, 150) // Cap at 150km
            }

            radiusHistoryRef.current.push(currentRadius)

            // 3. Build cache key (location only, stable)
            const cacheKey = `suggested_${loc.lat.toFixed(2)}_${loc.lng.toFixed(2)}_v3`

            // Check cache (skip if refreshing)
            if (!bypassCache) {
                try {
                    const raw = sessionStorage.getItem(cacheKey)
                    if (raw) {
                        const parsed = JSON.parse(raw)
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            console.log('[loadSuggested] using cache', {
                                count: parsed.length,
                                sample: parsed[0] ? {
                                    name: parsed[0].name,
                                    hasDistance: 'distanceKm' in parsed[0],
                                    distanceKm: parsed[0].distanceKm
                                } : null
                            })
                            setSuggestedGoogle(parsed)
                            setIsLoadingSuggested(false)
                            loadingRef.current.suggested = false
                            return
                        }
                    }
                } catch {}
            }

            // 4. Request candidates (LARGER pool: 60 instead of 20)
            const requestLimit = 60

            console.log('[loadSuggested] fetching', {
                bypassCache,
                radius: currentRadius,
                round: radiusHistoryRef.current.length,
                radiusHistory: radiusHistoryRef.current
            })

            const candidates = await firebaseDataService.getExternalSuggestedPlaces(
                loc.lat,
                loc.lng,
                tags,
                requestLimit,
                {
                    interests: interests.slice(0, 6),
                    radiusKm: currentRadius,
                    openNow: !!filters.openNow,
                    cacheBypass: bypassCache
                }
            )

            console.log('[loadSuggested] received candidates', {
                count: candidates?.length || 0,
                sample: candidates?.[0] ? {
                    name: candidates[0].name,
                    hasCoords: !!(candidates[0].coordinates?.lat && candidates[0].coordinates?.lng),
                    coords: candidates[0].coordinates
                } : null
            })

            if (bypassCache && (!candidates || candidates.length === 0)) {
                console.warn('[loadSuggested] refresh returned empty (preserving existing)')
                setIsLoadingSuggested(false)
                loadingRef.current.suggested = false
                return
            }

            // 5. Build known/suppressed sets
            const existingLite = await firebaseDataService.getPlaceKeysLite(800)
            const knownKeys = new Set<string>([
                ...forYouCacheRef.current.items
                    .filter(it => it.type === 'hub')
                    .map(it => stablePlaceKey((it.item as any))),
                ...((existingLite || []).map((x: any) => stablePlaceKey({
                    placeId: (x as any).placeId,
                    name: x.name,
                    address: x.address,
                    coordinates: { lat: x.lat, lng: x.lng }
                })))
            ].filter(Boolean) as string[])

            const suppressedKeys = new Set<string>(
                currentUser ? (await firebaseDataService.getSuppressedSuggestionKeys(currentUser.id)) : []
            )

            // 6. Create suggestions engine
            const engine = new SuggestionsEngine({
                userLoc: loc,
                userInterests: [...tags, ...interests].map(s => s.toLowerCase()),
                knownKeys,
                suppressedKeys,
                recentRailKeys: new Set(suggestedGoogle.map(g => g.__key || stablePlaceKey(g)).filter(Boolean)),
                storage: sessionStorage,
                radiusHistory: radiusHistoryRef.current,
                count: 12,
                ttlHours: 6,
                maxMemory: 300
            })

            // 7. Let engine pick
            const { picked, nextRadius, shouldExpand, memorySize, debug } = engine.pick(candidates)

            console.log('[suggestions:engine]', {
                round: radiusHistoryRef.current.length,
                radius: currentRadius,
                nextRadius,
                shouldExpand,
                candidatesReceived: candidates.length,
                candidatesTotal: debug.candidatesTotal,
                candidatesNovel: debug.candidatesNovel,
                picked: picked.length,
                memorySize
            })

            console.log('[suggestions:picked]', picked.map(p => ({
                name: p.name,
                key: p.__key?.substring(0, 20),
                km: p.__km?.toFixed(1)
            })))

            // 8. Format for UI
            const formatted = picked.map(p => ({
                id: p.__key,
                name: p.name,
                address: p.address || '',
                photoUrl: p.mainImage,
                reason: p.types?.[0],
                exists: false,
                placeId: p.placeId,
                photos: p.photos || [],
                primaryType: p.types?.[0],
                types: p.types || [],
                distanceKm: p.__km,
                __key: p.__key
            }))

            console.log('[loadSuggested] Formatted output', {
                count: formatted.length,
                sample: formatted.slice(0, 2).map(f => ({
                    name: f.name,
                    distanceKm: f.distanceKm?.toFixed(1),
                    hasDistance: typeof f.distanceKm === 'number',
                    key: f.__key?.substring(0, 15)
                }))
            })

            // 9. Cache if not refreshing
            if (!bypassCache) {
                try {
                    sessionStorage.setItem(cacheKey, JSON.stringify(formatted))
                } catch {}
            }

            setSuggestedGoogle(formatted)
        } catch (e) {
            console.error('[loadSuggested] failed', e)
            setSuggestedGoogle([])
        } finally {
            setIsLoadingSuggested(false)
            loadingRef.current.suggested = false;
        }
    }


    // Shared context for loaders
    const getDiscoveryContext = async (): Promise<{ tags: string[]; loc: { lat: number; lng: number; name?: string } | null; userPrefs: any }> => {
        const userProfile = currentUser ? await firebaseDataService.getCurrentUser(currentUser.id) : null
        const userPrefs = currentUser ? await firebaseDataService.getUserPreferences(currentUser.id) : null
        const tags = (userProfile?.tags || []).slice(0, 8)
        let loc: { lat: number; lng: number; name?: string } | null = null

        // Honor Advanced Filters origin/location first
        try {
            if (filters.origin === 'custom' && filters.location && typeof filters.location.lat === 'number' && typeof filters.location.lng === 'number') {
                loc = { lat: filters.location.lat, lng: filters.location.lng, name: filters.location.name || 'Chosen location' }
            } else if (filters.origin === 'current') {
                if ('geolocation' in navigator) {
                    await new Promise<void>((resolve) => {
                        navigator.geolocation.getCurrentPosition(
                            (pos) => { loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, name: 'Current Location' }; resolve() },
                            () => resolve(),
                            { enableHighAccuracy: true, timeout: 6000 }
                        )
                    })
                }
                // fall through to profile if geolocation failed
                if (!loc && typeof (userProfile as any)?.location === 'string' && ((userProfile as any)?.location as string).trim().length > 0) {
                    try {
                        const geo = await firebaseDataService.geocodeLocation((userProfile as any).location)
                        if (geo) loc = { lat: geo.lat, lng: geo.lng, name: geo.address || (userProfile as any).location }
                    } catch {}
                }
            } else { // 'profile' or default
                if (typeof (userProfile as any)?.location === 'string' && ((userProfile as any)?.location as string).trim().length > 0) {
                    try {
                        const geo = await firebaseDataService.geocodeLocation((userProfile as any).location)
                        if (geo) loc = { lat: geo.lat, lng: geo.lng, name: geo.address || (userProfile as any).location }
                    } catch {}
                }
                // fallback to current if profile missing
                if (!loc && 'geolocation' in navigator) {
                    try {
                        await new Promise<void>((resolve) => {
                            navigator.geolocation.getCurrentPosition(
                                (pos) => { loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, name: 'Current Location' }; resolve() },
                                () => resolve(),
                                { enableHighAccuracy: true, timeout: 6000 }
                            )
                        })
                    } catch {}
                }
            }
        } catch {}

        // As a final fallback, use any previously selected location
        if (!loc && selectedLocation) loc = selectedLocation

        if (loc) setSelectedLocation(loc)
        return { tags, loc: loc || null, userPrefs }
    }

    // Load ONLY the For You section (internal places + lists)
    const loadForYou = async (force: boolean = false) => {
        // Prevent duplicate in-flight requests
        if (loadingRef.current.forYou) {
            console.log('[loadForYou] already loading, skipping duplicate call');
            return;
        }
        loadingRef.current.forYou = true;
        
        try {
            setIsLoadingForYou(true)
            if (!force && forYouCacheRef.current.items.length > 0 && Date.now() - forYouCacheRef.current.timestamp < 2 * 60 * 1000) {
                setDiscoveryItems(forYouCacheRef.current.items)
                setIsLoadingForYou(false)
                loadingRef.current.forYou = false;
                return
            }
            const { tags, loc } = await getDiscoveryContext()
            if (!loc) { 
                setDiscoveryItems([]); 
                setIsLoadingForYou(false); 
                loadingRef.current.forYou = false;
                return;
            }
            const internal = await firebaseDataService.getSuggestedPlaces({ tags, location: { lat: loc.lat, lng: loc.lng }, limit: 12 })
            let places = internal || []

            // Convert places to DiscoveryItems
            const placeItems: DiscoveryItem[] = places.slice(0, 12).map(place => {
                const addr = (place as any).address || (place as any).location?.address || ''
                return ({
                    id: place.id,
                    type: 'hub' as const,
                    title: place.name,
                    description: addr,
                    image: (place as any).mainImage || 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop',
                    item: place,
                    isGoogleSuggested: (place as any).source === 'google',
                    googlePlaceDetails: (place as any).googlePlaceDetails
                })
            })

            // Complement with lists matching user tags
            const searchLists = await firebaseDataService.performSearch('', { tags }, 20)
            const listItems: DiscoveryItem[] = searchLists.lists.slice(0, 6).map(list => ({
                id: list.id,
                type: 'list' as const,
                title: list.name,
                description: list.description || 'Curated collection for your interests',
                owner: searchLists.users.find(u => u.id === list.userId)?.name || 'User',
                likes: list.likes || 0,
                places: list.hubs?.length || 0,
                image: list.coverImage || 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop',
                item: list
            }))

            const finalItems = [...placeItems, ...listItems]
            setDiscoveryItems(finalItems)
            forYouCacheRef.current = { items: finalItems, timestamp: Date.now() }
        } catch (error) {
            console.error('Error loading For You items:', error)
            setDiscoveryItems([])
        } finally {
            setIsLoadingForYou(false)
            loadingRef.current.forYou = false;
        }
    }

    const loadDiscoveryItems = async (force: boolean = false) => {
        try {
            // Return cached results if not forcing and cache is fresh (2 minutes)
            const cache = discoveryCacheRef.current
            if (!force && cache.items.length > 0 && Date.now() - cache.timestamp < 2 * 60 * 1000) {
                setDiscoveryItems(cache.items)
                setSuggestedGoogle(cache.suggested)
                setHasLoadedDiscovery(true)
                return
            }
            // Fallback legacy loader: delegate to split loaders
            await loadForYou(true)
            await loadSuggested(true)
            // Load user profile for tags and preferences
            const userProfile = currentUser ? await firebaseDataService.getCurrentUser(currentUser.id) : null
            const userPrefs = currentUser ? await firebaseDataService.getUserPreferences(currentUser.id) : null
            const tags = (userProfile?.tags || []).slice(0, 8)
            // Prefer profile-declared location (geocode); else try geolocation briefly
            let loc = selectedLocation
            if (!loc && typeof (userProfile as any)?.location === 'string' && ((userProfile as any)?.location as string).trim().length > 0) {
                try {
                    const geo = await firebaseDataService.geocodeLocation((userProfile as any).location)
                    if (geo) loc = { lat: geo.lat, lng: geo.lng, name: geo.address || (userProfile as any).location }
                } catch {}
            }
            if (!loc && 'geolocation' in navigator) {
                try {
                    await new Promise<void>((resolve) => {
                        navigator.geolocation.getCurrentPosition(
                            (pos) => { loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, name: 'Current Location' }; resolve() },
                            () => resolve(),
                            { enableHighAccuracy: true, timeout: 6000 }
                        )
                    })
                } catch {}
            }
            console.log('[Home Discovery] load start', { loc, tags })
            // Suggested places personalized by tags/location (internal) and external (parallel)
            const internalPromise = firebaseDataService.getSuggestedPlaces({
                tags,
                location: loc ? { lat: loc.lat, lng: loc.lng } : undefined,
                limit: 12
            })
            let places: any[] = []
            let ext: any[] = []
            if (loc) {
                const interests = (userPrefs as any)?.favoriteCategories || []
                const milesPreferred = (userPrefs as any)?.locationPreferences?.nearbyRadius
                const radiusKm = typeof milesPreferred === 'number' && milesPreferred > 0 ? milesPreferred * 1.60934 : 80
                const extPromise = firebaseDataService.getExternalSuggestedPlaces(
                    loc.lat, loc.lng, tags, 8, { interests: interests.slice(0,6), radiusKm, openNow: false }
                )
                const [internal, external, existingLite] = await Promise.all([
                  internalPromise,
                  extPromise,
                  firebaseDataService.getPlaceKeysLite(800)
                ])
                places = internal || []
                ext = external || []
                console.log('[Home Discovery] external results', { count: ext?.length })
                // external suggestions handled by loadSuggested
                // Avoid duplicates with existing DB places by id, name+address, or coordinates
                const seen = new Set(places.map(p => p.id))
                const keyFor = (p: any) => `${(p.name||'').toLowerCase()}|${(p.address||'').toLowerCase()}`
                const coordKey = (p:any) => (p.coordinates && typeof p.coordinates.lat==='number' && typeof p.coordinates.lng==='number') ? `${p.coordinates.lat.toFixed(5)},${p.coordinates.lng.toFixed(5)}` : ''
                const seenComposite = new Set([
                  ...places.map(p => keyFor(p)),
                  ...(existingLite||[]).map((x:any)=>`${(x.name||'').toLowerCase()}|${(x.address||'').toLowerCase()}`),
                  ...(existingLite||[]).map((x:any)=> (typeof x.lat==='number' && typeof x.lng==='number') ? `${x.lat.toFixed(5)},${x.lng.toFixed(5)}` : '')
                ])
                for (const p of (ext || [])) {
                  const k = keyFor(p)
                  const ck = coordKey(p)
                  if (!seen.has(p.id) && !seenComposite.has(k) && (!ck || !seenComposite.has(ck))) { places.push(p); seen.add(p.id); if (k) seenComposite.add(k); if (ck) seenComposite.add(ck) }
                }
            } else {
                const internalRes = await internalPromise
                places = internalRes || []
            }
            // Respect default willingness to travel from signup preferences; fallback ~50 miles
            const milesPreferred = (userPrefs as any)?.locationPreferences?.nearbyRadius
            const preferredKm = typeof milesPreferred === 'number' && milesPreferred > 0 ? milesPreferred * 1.60934 : 80
            const maxKmDefault = (typeof filters.distanceKm === 'number' ? filters.distanceKm : preferredKm)
            const filteredPlaces = loc
              ? places.filter(p => {
                  const plat = p.coordinates?.lat
                  const plng = p.coordinates?.lng
                  if (typeof plat !== 'number' || typeof plng !== 'number') return false
                  const toRad = (v: number) => (v * Math.PI) / 180
                  const R = 6371
                  const dLat = toRad(plat - loc!.lat)
                  const dLon = toRad(plng - loc!.lng)
                  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(loc!.lat)) * Math.cos(toRad(plat)) * Math.sin(dLon/2)**2
                  const c = 2 * Math.atan2(Math.sqrt(a),Math.sqrt(1-a))
                  const km = R * c
                  return km <= maxKmDefault
                })
              : places
            // If too few within radius, fill with nearest others but still hard-cap distance
            let within = filteredPlaces
            if (loc && within.length < 6) {
              const withDist = places
                .map(p => ({ p, d: (p.coordinates && typeof p.coordinates.lat==='number' && typeof p.coordinates.lng==='number')
                  ? (function(){ const R=6371; const toRad=(v:number)=>v*Math.PI/180; const dLat=toRad(p.coordinates!.lat - loc!.lat); const dLon=toRad(p.coordinates!.lng - loc!.lng); const a=Math.sin(dLat/2)**2+Math.cos(toRad(loc!.lat))*Math.cos(toRad(p.coordinates!.lat))*Math.sin(dLon/2)**2; const c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)); return R*c; })() : Number.MAX_VALUE }))
                .filter(x => x.d <= Math.max(preferredKm, 60)) // never include items beyond cap
                .sort((a,b)=>a.d-b.d)
                .map(x=>x.p)
              within = withDist.slice(0, 12)
            }
            // Ensure uniqueness within For You feed as well (by stable key)
            const feedSeen = new Set<string>()
            const uniqueWithin: any[] = []
            for (const p of within) {
              const k = stablePlaceKey({
                placeId: (p as any).placeId,
                name: p.name,
                address: (p as any).address || (p as any).location?.address,
                coordinates: {
                  lat: (p as any).coordinates?.lat ?? (p as any).location?.lat,
                  lng: (p as any).coordinates?.lng ?? (p as any).location?.lng,
                },
              })
              if (k && !feedSeen.has(k)) { feedSeen.add(k); uniqueWithin.push(p) }
            }
            const placeItems: DiscoveryItem[] = uniqueWithin.slice(0, 12).map(place => {
                const addr = (place as any).address || (place as any).location?.address || ''
                return ({
                id: place.id,
                type: 'hub' as const,
                title: place.name,
                    description: addr,
                    image: (place as any).mainImage || 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop',
                    item: place,
                    isGoogleSuggested: (place as any).source === 'google',
                    googlePlaceDetails: (place as any).googlePlaceDetails
                })
            })
            // Complement with lists matching user tags (basic relevance)
            const searchLists = await firebaseDataService.performSearch('', { tags }, 20)
            const listItems: DiscoveryItem[] = searchLists.lists.slice(0, 6).map(list => ({
                id: list.id,
                type: 'list' as const,
                title: list.name,
                description: list.description || 'Curated collection for your interests',
                owner: searchLists.users.find(u => u.id === list.userId)?.name || 'User',
                likes: list.likes || 0,
                places: list.hubs?.length || 0,
                image: list.coverImage || 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop',
                item: list
            }))
            const finalItems = [...placeItems, ...listItems]
            setDiscoveryItems(finalItems)
            // Do not set suggested here; handled by loadSuggested
            discoveryCacheRef.current = { items: finalItems, suggested: suggestedGoogle, timestamp: Date.now() }
            setHasLoadedDiscovery(true)
            console.log('[Home Discovery] final items', { places: placeItems.length, lists: listItems.length })
        } catch (error) {
            console.error('Error loading discovery items:', error)
            setDiscoveryItems([])
        } finally {
            setIsLoadingForYou(false)
        }
    }

    // Recompute distances when items or selected location change
    useEffect(() => {
        const computeDistances = async () => {
            if (!selectedLocation || discoveryItems.length === 0) {
                setItemDistances({})
                return
            }
            const distances: Record<string, number> = {}
            for (const item of discoveryItems) {
                if (item.type === 'hub') {
                    const place = item.item as Place
                    const lat = place.coordinates?.lat
                    const lng = place.coordinates?.lng
                    if (typeof lat === 'number' && typeof lng === 'number') {
                        distances[item.id] = kmBetween(lat, lng, selectedLocation.lat, selectedLocation.lng)
                    }
                } else {
                    // list: compute nearest hub distance
                    const list = item.item as any
                    const hubs: any[] = Array.isArray(list.hubs) ? list.hubs : []
                    let min = Infinity
                    if (list.location && typeof list.location.lat === 'number' && typeof list.location.lng === 'number') {
                      min = Math.min(min, kmBetween(list.location.lat, list.location.lng, selectedLocation.lat, selectedLocation.lng))
                    }
                    for (const hubRef of hubs) {
                        if (typeof hubRef === 'string') {
                            let place = placeCacheRef.current[hubRef]
                            if (!place) {
                                const fetched = await firebaseDataService.getPlace(hubRef)
                                if (fetched) {
                                    placeCacheRef.current[hubRef] = fetched
                                    place = fetched
                                }
                            }
                            const lat = place && place.coordinates ? place.coordinates.lat : undefined
                            const lng = place && place.coordinates ? place.coordinates.lng : undefined
                            if (typeof lat === 'number' && typeof lng === 'number') {
                                const d = kmBetween(lat, lng, selectedLocation.lat, selectedLocation.lng)
                                if (d < min) min = d
                            }
                        } else {
                            const lat = (hubRef.location && hubRef.location.lat) || hubRef.coordinates?.lat
                            const lng = (hubRef.location && hubRef.location.lng) || hubRef.coordinates?.lng
                            if (typeof lat === 'number' && typeof lng === 'number') {
                                const d = kmBetween(lat, lng, selectedLocation.lat, selectedLocation.lng)
                                if (d < min) min = d
                            }
                        }
                    }
                    if (min !== Infinity) distances[item.id] = min
                }
            }
            setItemDistances(distances)
        }
        computeDistances()
    }, [selectedLocation, discoveryItems])

    const formatTimestamp = (timestamp: any): string => {
        if (!timestamp) return 'Recently'
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
            const now = new Date()
            const diffMs = now.getTime() - date.getTime()
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
            const diffDays = Math.floor(diffHours / 24)
            if (diffHours < 1) return 'Just now'
            if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
            if (diffDays === 1) return '1 day ago'
            if (diffDays < 7) return `${diffDays} days ago`
            return date.toLocaleDateString()
        } catch (error) {
            return 'Recently'
        }
    }

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'loved':
                return <HeartIconSolid className="w-5 h-5 text-sage-500" />
            case 'tried':
                return <BookmarkIcon className="w-5 h-5 text-gold-500" />
            case 'want':
                return <EyeIcon className="w-5 h-5 text-sage-400" />
            case 'create_list':
                return <PlusIcon className="w-5 h-5 text-gold-500" />
            default:
                return null
        }
    }

    const getActionText = (action: string) => {
        switch (action) {
            case 'loved':
                return 'loved'
            case 'tried':
                return 'tried'
            case 'want':
                return 'wants to try'
            case 'create_list':
                return 'created a list'
            default:
                return action
        }
    }

    const handleActivityClick = async (activity: FriendActivity) => {
        if (activity.type === 'create_list' && activity.listId) {
            const list = await firebaseDataService.getList(activity.listId)
            if (list) openListModal(list, 'home-activity-feed');
        } else if (activity.type === 'post' && activity.placeId) {
            const place = await firebaseDataService.getPlace(activity.placeId)
            if (place) {
                const hub: Hub = { ...place, id: place.id, name: place.name, description: ``, tags: place.tags, images: [], location: { address: place.address, lat: 0, lng: 0 }, googleMapsUrl: '', mainImage: '', posts: [], lists: [] };
                openHubModal(hub, 'home-activity-feed');
            }
        }
    }

    const handleDiscoveryClick = (item: DiscoveryItem) => {
        if (item.type === 'list') {
            openListModal(item.item as List, 'home-discovery-feed');
        } else {
            const place = item.item as Place
            const lat = place.coordinates?.lat || (place as any)?.location?.lat || 0
            const lng = place.coordinates?.lng || (place as any)?.location?.lng || 0
            const mapsUrl = (place as any).googleMapsUrl || (lat && lng
              ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
              : (place.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.address)}` : ''))
            const hub: Hub = { ...place, id: place.id, name: place.name, description: ``, tags: place.tags, images: [], location: { address: place.address, lat, lng }, googleMapsUrl: mapsUrl, mainImage: (place as any).mainImage || '', posts: [], lists: [] };
            openHubModal(hub, 'home-discovery-feed');
        }
    }

    const handleLikeItem = async (itemId: string, itemType: 'list' | 'hub') => {
    if (!currentUser) return;

    if (itemType === 'list') {
      setDiscoveryItems(prevItems =>
        prevItems.map(item => {
          if (item.id === itemId) {
            const likedByArr = (item.item as List).likedBy || [];
            const isLiked = likedByArr.includes(currentUser.id);
            const newLikedBy = isLiked
              ? likedByArr.filter(id => id !== currentUser.id)
              : [...likedByArr, currentUser.id];
            
            return {
              ...item,
              item: {
                ...item.item,
                likedBy: newLikedBy,
                likes: newLikedBy.length,
              },
              likes: newLikedBy.length,
            };
          }
          return item;
        })
      );

      try {
        // Only toggle like to avoid double-updating likes via save
        await firebaseListService.likeList(itemId, currentUser.id);
      } catch (error) {
        console.error("Failed to like list:", error);
        // Revert UI on failure
        loadDiscoveryItems();
      }
    }
  };

    const handleSaveToPlace = (place: Place) => {
        setSelectedPlace(place)
        setShowSaveModal(true)
    }

    const handleSave = async (status: 'loved' | 'tried' | 'want', rating?: 'liked' | 'neutral' | 'disliked', listIds?: string[], note?: string) => {
        if (!selectedPlace || !currentUser) return
        try {
            const ids = Array.isArray(listIds) ? listIds : []
            // Warn duplicates
            const already: string[] = []
            for (const lid of ids) {
              if (await firebaseDataService.isPlaceInList(lid, selectedPlace.id)) already.push(lid)
            }
            if (already.length > 0) {
              const names = userOwnedLists.filter(l=>already.includes(l.id)).map(l=>l.name).join(', ')
              const overwrite = window.confirm(`You've already saved this hub to the following lists: ${names}.\nWould you like to overwrite your previous save?`)
              if (!overwrite) return
            }
            // Save to selected
            await Promise.all(ids.map(id => firebaseDataService.savePlaceToList(selectedPlace.id, id, currentUser.id, note, undefined, status, rating)))
            // Auto list
            await firebaseDataService.saveToAutoList(selectedPlace.id, currentUser.id, status, note, rating)
        } catch (e) {
            console.error('Failed to save place', e)
        }
    }

    const handleCreateList = (listData: { name: string; description: string; privacy: 'public' | 'private' | 'friends'; tags?: string[]; coverImage?: string }) => {
        console.log('Creating new list:', listData, 'and saving place:', selectedPlace)
    }

    const handleLocationSelect = (location: { id: string; name: string; address: string; coordinates: { lat: number; lng: number } }) => {
        setSelectedLocation({ lat: location.coordinates.lat, lng: location.coordinates.lng, name: location.name })
        setSortBy('nearby')
        setShowLocationModal(false)
    }

    const handleSortByChange = (newSortBy: string) => {
        if (newSortBy === 'nearby') {
            setShowLocationModal(true)
        } else {
            setSortBy(newSortBy)
        }
    }

    const handleCreatePost = (listId?: string, hub?: any) => {
        setCreatePostListId(listId || null)
        setCreatePostHub(hub || null)
        setShowCreatePost(true)
    }

    const handleAddComment = (text: string) => {
        if (!selectedPost) return
        console.log('Adding comment to post:', selectedPost.id, 'Text:', text)
    }

    const handleLikeComment = (commentId: string) => {
        console.log('Liking comment:', commentId)
    }

    const handleReplyToComment = (commentId: string, text: string) => {
        console.log('Replying to comment:', commentId, 'Text:', text)
    }

    const handlePostReply = async (text: string, images?: string[]) => {
        if (!selectedPost) return
        console.log('Creating reply to post:', selectedPost.id, 'Text:', text, 'Images:', images)
    }

    const handleUserClick = (userId: string) => {
        openProfileModal(userId, 'home-activity-feed')
    }

    // handleCreateHubFromGoogle removed; flow uses CreateHubModal

    const isHomeReady = !isLoadingActivity && !isLoadingForYou && !isLoadingSuggested
    const locationName = selectedLocation?.name
        ? (selectedLocation.name.split(',')[0]?.trim() || selectedLocation.name)
        : 'your area'
    const curatedCount = discoveryItems.length
    const googleCount = suggestedGoogle.length
    const curatedLabel = curatedCount === 1 ? 'pick' : 'picks'
    const googleLabel = googleCount === 1 ? 'new find' : 'new finds'

    return (
        <div className="min-h-screen sunlight-soft">
            <main className="pb-28" data-page="home" data-page-ready={isHomeReady ? 'true' : undefined}>
                <div className="relative z-10 p-5 pb-2 max-w-2xl mx-auto flex flex-col gap-2 overflow-visible">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-[28px] font-serif font-extrabold tracking-tight" style={{color: 'rgba(61,54,48,0.95)'}}>
                                    This Is
                                </h1>
                            </div>
                            <p className="text-[14px] mt-1 leading-tight" style={{color: 'rgba(74,66,60,0.82)', fontWeight: 500}}>
                                Your personal memory journal
                            </p>
                        </div>
                    </div>
                    <div className="relative mb-4">
                        <form onSubmit={(e) => { e.preventDefault(); }}>
                        <SearchAndFilter
                            placeholder="Search places, lists, or friends..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            sortOptions={sortOptions}
                            filterOptions={filterOptions}
                            availableTags={availableTags}
                            sortBy={sortBy}
                            setSortBy={handleSortByChange}
                            activeFilters={activeFilters}
                            setActiveFilters={setActiveFilters}
                            selectedTags={selectedTags}
                            setSelectedTags={setSelectedTags}
                                onLocationSelect={() => setShowLocationModal(true)}
                            dropdownPosition="top-right"
                                onSubmitQuery={() => { /* in-place filtering */ }}
                                onApplyFilters={async ()=>{ await Promise.all([loadForYou(true), loadSuggested(true)]) }}
                                distanceKm={undefined}
                                setDistanceKm={undefined}
                                onOpenAdvanced={() => setShowAdvanced(true)}
                        />
                        </form>
                        
                    </div>
                    <SegmentedTabs
                      value={activeTab}
                      onChange={(v)=> setActiveTab(v as 'friends' | 'discovery')}
                      items={[
                        { key: 'friends', label: 'Friends' },
                        { key: 'discovery', label: 'Discovery' },
                      ]}
                      className="mb-3"
                    />
                    {activeTab === 'discovery' && (
                      <CardShell
                        variant="glass"
                        className="mt-1 p-4 sm:p-5 space-y-4 rounded-3xl animate-slide-up shadow-[0_16px_40px_rgba(61,54,48,0.08)]"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="space-y-1">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-sage-500">
                              Today near {locationName}
                            </p>
                            <h2 className="text-[18px] font-semibold text-bark-900">
                              {curatedCount > 0
                                ? `Fresh ${curatedLabel} picked for you`
                                : 'We are curating new picks'}
                            </h2>
                            <p className="text-[13px] text-bark-600">
                              {googleCount > 0
                                ? `Plus ${googleCount} ${googleLabel} from Google to explore.`
                                : 'Refresh discovery to surface more ideas nearby.'}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 rounded-2xl bg-white/60 px-4 py-3 shadow-[0_8px_24px_rgba(61,54,48,0.08)]">
                            <div className="text-center">
                              <div className="text-[20px] font-semibold text-bark-900 leading-none">{curatedCount}</div>
                              <div className="text-[11px] text-bark-500">Curated</div>
                            </div>
                            <div className="h-8 w-px bg-white/70" aria-hidden="true"></div>
                            <div className="text-center">
                              <div className="text-[20px] font-semibold text-bark-900 leading-none">{googleCount}</div>
                              <div className="text-[11px] text-bark-500">New finds</div>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="px-4"
                            onClick={() => { void Promise.all([loadForYou(true), loadSuggested(true)]); }}
                          >
                            Refresh picks
                          </Button>
                          <button
                            type="button"
                            className="text-[12px] text-sage-700 underline-offset-4 hover:underline"
                            onClick={() => setShowAdvanced(true)}
                          >
                            Refine filters
                          </button>
                          <div className="flex items-center gap-2 text-[12px] text-bark-500">
                            <span className="inline-flex h-2 w-2 rounded-full bg-sage-500" aria-hidden="true"></span>
                            <span>{curatedCount > 0 ? 'Updated moments ago' : 'Collecting new picks'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[12px] text-bark-500">
                            <span className="inline-flex h-2 w-2 rounded-full bg-sand-500" aria-hidden="true"></span>
                            <span>{selectedLocation?.name || 'Set a location to personalize distance'}</span>
                          </div>
                        </div>
                      </CardShell>
                    )}
                </div>
                <div className="relative z-10 px-5 pb-8 max-w-2xl mx-auto overflow-x-hidden">
                    {activeTab === 'friends' ? (
                        <div className="space-y-4">
                            <Section title="Recent Activity">
                            {isLoadingActivity ? (
                                <p className="text-center py-8">Loading activity...</p>
                            ) : (() => {
                                const q = searchQuery.trim().toLowerCase()
                                const filtered = q
                                  ? friendsActivity.filter(a => (
                                      (a.place?.name || '').toLowerCase().includes(q) ||
                                      (a.list || '').toLowerCase().includes(q) ||
                                      (a.note || '').toLowerCase().includes(q) ||
                                      (a.user?.name || '').toLowerCase().includes(q)
                                    ))
                                  : friendsActivity
                                if (filtered.length === 0) {
                                    return <p className="text-center py-8 text-cozy-sub">No recent activity yet.</p>
                                }
                                return (
                                    filtered.map((activity) => (
                                    <button
                                        key={activity.id}
                                        onClick={() => handleActivityClick(activity)}
                                        className="w-full text-left flex flex-col gap-2 overflow-hidden"
                                    >
                                        <CardShell variant="solid" className="p-4">
                                        <div className="flex items-start gap-4">
                                            <SafeImage
                                                src={activity.user.avatar}
                                                alt={activity.user.name}
                                                className="w-10 h-10 rounded-xl2 object-cover shadow-soft"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleUserClick(activity.user.id)
                                                        }}
                                                        className="text-cozy-title hover:text-sage-600 transition-colors cursor-pointer"
                                                    >
                                                        {activity.user.name}
                                                    </span>
                                                    <span className="text-sage-400">•</span>
                                                    <span className="text-cozy-meta">{formatTimestamp(activity.createdAt)}</span>
                                                </div>
                                                <div className="flex items-start gap-2">
                                                    {getActionIcon(activity.type)}
                                                    <div className="flex-1">
                                                        <p className="text-cozy-sub">
                                                            {activity.type === 'create_list' ? (
                                                                <>
                                                                    <span className="font-medium">{getActionText(activity.type)}</span>
                                                                    <span className="font-semibold text-charcoal-800"> "{activity.list}"</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span className="font-medium">{getActionText(activity.type)}</span>
                                                                    <span className="font-semibold text-charcoal-800"> {activity.place?.name}</span>
                                                                </>
                                                            )}
                                                        </p>
                                                        {activity.type === 'create_list' && (
                                                            <p className="text-cozy-meta mt-1">{activity.note}</p>
                                                        )}
                                                        {activity.note && (
                                                            <p className="text-cozy-meta mt-2 italic">
                                                                "{activity.note}"
                                                            </p>
                                                        )}
                                                        {activity.placeImage && (
                                    <SafeImage
                                        src={activity.placeImage}
                                        alt={activity.place?.name || 'Place'}
                                        className="w-full h-32 object-cover rounded-lg mt-3"
                                    />
                                                        )}
                                                        {activity.list && activity.type !== 'create_list' && (
                                                            <div className="mt-2">
                                                                <span className="text-xs bg-linen-100 text-sage-700 px-2 py-1 rounded-full">
                                                                    Saved to {activity.list}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {activity.type === 'create_list' && (
                                                            <div className="mt-2">
                                                                <span className="text-xs bg-sage-100 text-sage-600 px-2 py-1 rounded-full">
                                                                    {activity.places} places
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </CardShell>
                                    </button>
                                ))
                                )
                            })()}
                            </Section>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="radial-warm animate-slide-up">
                              <div className="flex items-start justify-between mb-4">
                                <div>
                                  <h2 className="text-[20px] font-semibold" style={{color: 'rgba(61,54,48,0.95)', letterSpacing: '-0.01em'}}>
                                    For You
                                  </h2>
                                  <p className="text-[13px] mt-1" style={{color: 'rgba(74,66,60,0.75)'}}>
                                    Personalized places and lists based on your interests
                                  </p>
                                </div>
                                {hasLoadedDiscovery && (
                                  <button className="badge h-9 inline-flex items-center gap-1.5 hover:brightness-105 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200" onClick={async()=>{ await loadForYou(true) }} aria-label="Refresh recommendations">
                                    <svg className={`w-4 h-4 transition-transform duration-600 ease-out ${isLoadingForYou ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    <span className="text-[13px]">Refresh</span>
                                  </button>
                                )}
                              </div>
                            <Section
                              className=""
                            >
                            {isLoadingForYou ? (
                                <div className="space-y-4">
                                  {/* skeleton loaders to keep user engaged */}
                                  {Array.from({ length: 3 }).map((_, i) => (
                                            <CardShell key={i} variant="glass" className="p-4 animate-pulse">
                                      <div className="flex items-start gap-4">
                                        <div className="w-16 h-16 rounded-xl bg-bark-200" />
                                        <div className="flex-1 space-y-2">
                                          <div className="h-4 bg-bark-200 rounded w-1/2" />
                                          <div className="h-3 bg-bark-200 rounded w-3/4" />
                                          <div className="h-3 bg-bark-200 rounded w-2/3" />
                                        </div>
                                      </div>
                                    </CardShell>
                                  ))}
                                </div>
                            ) : (() => {
                                const q = searchQuery.trim().toLowerCase()
                                let filtered = q
                                  ? discoveryItems.filter(item => {
                                      const list: any = item.item
                                      return (
                                        (item.title || '').toLowerCase().includes(q) ||
                                        (item.description || '').toLowerCase().includes(q) ||
                                        (Array.isArray(list?.tags) && list.tags.some((t: string) => t.toLowerCase().includes(q)))
                                      )
                                    })
                                  : discoveryItems
                                // Remove any hubs that collide with the rail set (by stable key)
                                const railKeys = new Set<string>(suggestedGoogle.map((g: any) => g.__key || stablePlaceKey(g)))
                                filtered = filtered.filter(it => {
                                  if (it.type !== 'hub') return true
                                  const k = stablePlaceKey((it.item as any))
                                  return !railKeys.has(k)
                                })
                                const showSuggestedSection = true
                                const hasCurated = filtered.length > 0
                                if (sortBy === 'relevance') {
                                    const q = searchQuery.trim().toLowerCase()
                                    const score = (it: DiscoveryItem) => {
                                      let s = 0
                                      const name = (it.title||'').toLowerCase()
                                      const desc = (it.description||'').toLowerCase()
                                      const tags = Array.isArray((it.item as any)?.tags) ? ((it.item as any).tags as string[]).map(t=>t.toLowerCase()) : []
                                      if (q) { if (name.includes(q)) s+=4; if (desc.includes(q)) s+=2; if (tags.some(t=>t.includes(q))) s+=3 }
                                      // popularity tiebreaker
                                      const pop = (it.likes||0) + ((it.item as any)?.savedCount || 0)
                                      return { s, pop }
                                    }
                                    filtered = [...filtered].sort((a,b)=>{
                                      const sa = score(a), sb = score(b)
                                      if (sb.s !== sa.s) return sb.s - sa.s
                                      return sb.pop - sa.pop
                                    })
                                } else if (sortBy === 'nearby' && selectedLocation) {
                                    filtered = [...filtered].sort((a, b) => {
                                        const da = itemDistances[a.id] ?? Number.MAX_VALUE
                                        const db = itemDistances[b.id] ?? Number.MAX_VALUE
                                        return da - db
                                    })
                                }
                                if (!hasCurated && !showSuggestedSection) {
                                    return <p className="text-center py-8">No trending items yet.</p>
                                }
                                return (
                                    <>
                                    {!hasCurated && (
                                      <CardShell variant="glass" className="p-5 text-center text-sm text-bark-600 mb-3">
                                        <p className="font-medium text-bark-800">We&apos;re still curating picks for you.</p>
                                        <p className="mt-2 text-bark-600">
                                          Try refreshing or adjust filters to bring in more personalized places.
                                        </p>
                                      </CardShell>
                                    )}
                                    {recentCreatedHub && (
                                      <CardShell
                                        key={`recent-${recentCreatedHub.id}`}
                                        variant="solid"
                                        onClick={() => openHubModal(recentCreatedHub, 'home-discovery-feed')}
                                        className="w-full p-5 hover:shadow-cozy hover:-translate-y-1 transition-all duration-300 text-left flex flex-col gap-2 overflow-hidden cursor-pointer"
                                      >
                                        <div className="flex items-start gap-4">
                                          <HubImage photos={(recentCreatedHub as any).photos} primaryType={(recentCreatedHub as any).primaryType} types={(recentCreatedHub as any).types} alt={recentCreatedHub.name} load={false} className="w-16 h-16 rounded-xl2 object-cover shadow-soft" />
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between mb-2">
                                              <h3 className="text-cozy-title line-clamp-2">{recentCreatedHub.name}</h3>
                                            </div>
                                            <p className="text-cozy-sub mb-3">{recentCreatedHub.location?.address}</p>
                                          </div>
                                        </div>
                                      </CardShell>
                                    )}
                                    {filtered.map((item, idx) => {
                                        // Extract single address line
                                        const address = item.type === 'hub' && (item.item as any)?.address
                                            ? (item.item as any).address.split(',').slice(0, 2).join(',').trim()
                                            : item.description;
                                        
                                        return (
                                    <div
                                        key={item.id}
                                        onClick={() => handleDiscoveryClick(item)}
                                            className="w-full text-left cursor-pointer"
                                    >
                                            <CardShell variant="glass" className={`p-4 ${idx===0 ? 'sun-edge' : ''} animate-rise hover-lift hover-lift-on`} style={{ animationDelay: `${idx*40}ms` }}>
                                                <div className="grid grid-cols-[64px_1fr] items-start gap-3">
                                                    {/* Thumbnail */}
                                    {item.type === 'hub' ? (
                                      <div className="row-span-2">
                                        <HubImage
                                        // @ts-ignore
                                        photos={(item.item as any)?.photos}
                                        // @ts-ignore
                                        primaryType={(item.item as any)?.primaryType}
                                        // @ts-ignore
                                        types={(item.item as any)?.types}
                                        alt={item.title}
                                        load={false}
                                        className="w-16 h-16 rounded-xl2 object-cover shadow-soft flex-shrink-0"
                                      />
                                      </div>
                                    ) : (
                                      <div className="row-span-2">
                                        <SafeImage
                                          src={item.image}
                                          alt={item.title}
                                          className="w-16 h-16 rounded-xl2 object-cover shadow-soft flex-shrink-0"
                                        />
                                      </div>
                                    )}
                                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                                <h3 className="text-[15px] font-semibold truncate mb-1" style={{color: 'rgba(61,54,48,0.92)'}}>
                                                    {item.title}
                                                </h3>
                                                <p className="text-[13px] truncate" style={{color: 'rgba(74,66,60,0.85)'}}>
                                                    {address}
                                                </p>
                                                {item.type === 'list' && item.places && (
                                                    <span className="inline-block mt-1 text-[12px]" style={{color: 'rgba(74,66,60,0.82)'}}>
                                                        {item.places} places
                                                    </span>
                                                )}
                                            </div>
                                            {/* Actions (compact, below content on small screens) */}
                                            <div className="col-start-2 mt-1 flex items-center gap-1">
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="w-9 h-9 p-0"
                                                aria-label={`${(item.item as List).likedBy?.includes(currentUser!.id) ? 'Unlike' : 'Like'} ${item.title}`}
                                                onClick={e => { e.stopPropagation(); handleLikeItem(item.id, item.type); }}
                                              >
                                                {(item.item as List).likedBy?.includes(currentUser!.id)
                                                  ? <HeartIconSolid className="w-4 h-4 text-red-500" />
                                                  : <HeartIcon className="w-4 h-4 text-bark-700" />}
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="w-9 h-9 p-0"
                                                aria-label={`Save ${item.title} to list`}
                                                onClick={e => { e.stopPropagation(); handleSaveToPlace(item.item as Place); }}
                                              >
                                                <BookmarkIcon className="w-4 h-4 text-bark-700" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="w-9 h-9 p-0"
                                                aria-label={`Add post for ${item.title}`}
                                                onClick={e => { e.stopPropagation(); handleCreatePost(item.type === 'list' ? item.id : undefined, item.type === 'hub' ? item.item : undefined); }}
                                              >
                                                <PlusIcon className="w-4 h-4 text-bark-700" />
                                              </Button>
                                            </div>
                                        </div>
                                    </CardShell>
                                    </div>
                                        );
                                    })}
                                    
                                    {/* Suggested Hubs Rail */}
                                    {suggestedGoogle.length > 0 || isLoadingSuggested ? (
                                      <SuggestedHubsRail
                                        suggestions={suggestedGoogle.slice(0, 12).map((item) => {
                                          const lat = item?.coordinates?.lat
                                          const lng = item?.coordinates?.lng
                                          // Use pre-calculated distance from engine, ensure it's a valid number (not NaN)
                                          let distanceKm: number | undefined = undefined
                                          if (typeof item.distanceKm === 'number' && !isNaN(item.distanceKm)) {
                                            distanceKm = item.distanceKm
                                          } else if (typeof item.distanceKm === 'string') {
                                            const parsed = parseFloat(item.distanceKm)
                                            distanceKm = isNaN(parsed) ? undefined : parsed
                                          }
                                          // Fallback to recalculation if still undefined or invalid
                                          if ((distanceKm === undefined || isNaN(distanceKm)) && selectedLocation && typeof lat === 'number' && typeof lng === 'number') {
                                            distanceKm = kmBetween(lat, lng, selectedLocation.lat, selectedLocation.lng)
                                          }
                                          return ({
                                            // Use stable key as UI id so variants collapse together
                                            id: item.__key,
                                            rawId: item.id,
                                          name: item.name,
                                          address: item.address || '',
                                          photoUrl: item.mainImage,
                                          reason: item.tags?.[0],
                                          exists: false,
                                            placeId: item.placeId || item.id,
                                          photos: item.photos || [],
                                          primaryType: item.primaryType || item.category,
                                            types: item.types || [],
                                            distanceKm,
                                          })
                                        })}
                                        onRefresh={async () => await loadSuggested(true)}
                                        onViewDetails={handleViewDetails} // Pass the handler
                                        onOpen={(hub) => {
                                          // TODO: Navigate to existing hub
                                          console.log('Open hub:', hub);
                                        }}
                                        onCreate={(hub) => {
                                          const item = suggestedGoogle.find(g => (g as any).__key === hub.id || stablePlaceKey(g) === hub.id);
                                          if (item) {
                                            setCreateHubSeed({
                                                             name: item.name,
                                                             address: item.address,
                                                             coordinates: item.coordinates,
                                                             images: item.images,
                                                             mainImage: item.mainImage,
                                                             description: item.description
                                            });
                                            setShowCreateHubModal(true);
                                          }
                                        }}
                                        onNotInterested={async (hubId) => {
                                          setSuggestedGoogle(prev => prev.filter(g => ((g as any).__key || stablePlaceKey(g)) !== hubId));
                                          try {
                                            if (currentUser) {
                                              await firebaseDataService.suppressSuggestion({
                                                userId: currentUser.id,
                                                stableKey: hubId,
                                                reason: 'not_interested',
                                              })
                                            }
                                          } catch {}
                                        }}
                                        isLoading={isLoadingSuggested}
                                      />
                                    ) : null}

                                    </>
                                )
                            })()}
                            </Section>
                            </div>
                        </div>
                    )}
                </div>
                {selectedPlace && (
                    <SaveModal
                        isOpen={showSaveModal}
                        onClose={() => {
                            setShowSaveModal(false)
                            setSelectedPlace(null)
                        }}
                        place={selectedPlace}
                        userLists={userOwnedLists}
                        onSave={handleSave}
                        onCreateList={handleCreateList}
                    />
                )}
                <LocationSelectModal
                    isOpen={showLocationModal}
                    onClose={() => setShowLocationModal(false)}
                    onLocationSelect={handleLocationSelect}
                />
                <AdvancedFiltersDrawer isOpen={showAdvanced} onClose={()=>setShowAdvanced(false)} onApply={async ()=>{ await Promise.all([loadForYou(true), loadSuggested(true)]) }} />
                
                <SuggestedHubModal
                  isOpen={showSuggestedHubModal}
                  onClose={() => setShowSuggestedHubModal(false)}
                  placeId={selectedPlaceId}
                  userLocation={selectedLocation || undefined}
                  onCreateHub={(placeData) => {
                    // TODO: Implement hub creation flow from modal
                    console.log('Create hub from modal:', placeData);
                    setShowSuggestedHubModal(false);
                  }}
                />

                <CreatePost
                    isOpen={showCreatePost}
                    onClose={() => {
                        setShowCreatePost(false)
                        setCreatePostListId(null)
                        setCreatePostHub(null)
                    }}
                    preSelectedListIds={createPostListId ? [createPostListId] : undefined}
                    preSelectedHub={createPostHub || undefined}
                />
                {selectedPost && (
                    <CommentsModal
                        isOpen={showCommentsModal}
                        onClose={() => {
                            setShowCommentsModal(false)
                            setSelectedPost(null)
                        }}
                        comments={selectedPost.comments || []}
                        onAddComment={handleAddComment}
                        onLikeComment={handleLikeComment}
                        onReplyToComment={handleReplyToComment}
                    />
                )}
                {selectedPost && (
                    <ReplyModal
                        isOpen={showReplyModal}
                        onClose={() => {
                            setShowReplyModal(false)
                            setSelectedPost(null)
                        }}
                        postId={selectedPost.id}
                        postAuthor={selectedPost.username}
                        postContent={selectedPost.description}
                        postImage={selectedPost.images?.[0]}
                        onReply={handlePostReply}
                    />
                )}
                <ShareModal
                    isOpen={showShareModal}
                    onClose={() => setShowShareModal(false)}
                    title="this.is"
                    description="Discover amazing places with friends"
                    url={window.location.href}
                    type="post"
                />
                {/* SuggestedHubModal path removed */}
                {showCreateHubModal && (
                  <CreateHubModal
                    isOpen={showCreateHubModal}
                    onClose={() => setShowCreateHubModal(false)}
                    place={createHubSeed || undefined}
                    onCreate={async (data) => {
                      if (!currentUser) return
                      const hubId = await firebaseDataService.createHub({
                        name: data.name,
                        description: data.description || '',
                        address: data.address,
                        coordinates: data.coordinates,
                      } as any)
                      if (hubId) {
                        // set chosen primary image if provided
                        if (data.mainImage) {
                          try { await firebaseDataService.setHubMainImage(hubId, data.mainImage) } catch {}
                        }
                        // Close modal and remove the suggested item by stable key
                        setShowCreateHubModal(false)
                        const createdKey = stablePlaceKey({
                          placeId: (data as any).placeId,
                          name: data.name,
                          address: data.address,
                          coordinates: data.coordinates,
                        })
                        setSuggestedGoogle(prev => prev.filter(p => stablePlaceKey(p) !== createdKey))
                        // Refresh discovery cache but avoid layout reset
                        await Promise.all([loadForYou(true), loadSuggested(true)])
                        // Open the created hub
                        const newHub: Hub = {
                          id: hubId,
                          name: data.name,
                          description: data.description || '',
                          tags: [],
                          images: [],
                          location: { address: data.address, lat: data.coordinates?.lat || 0, lng: data.coordinates?.lng || 0 },
                          googleMapsUrl: data.coordinates ? `https://www.google.com/maps/search/?api=1&query=${data.coordinates.lat},${data.coordinates.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.address)}`,
                          mainImage: data.mainImage,
                          posts: [],
                          lists: []
                        }
                        setRecentCreatedHub(newHub)
                        openHubModal(newHub, 'home-suggested-create')
                      }
                    }}
                  />
                )}
                </main>
            </div>
    )
}

export default Home
