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
import ImageCarousel from '../components/ImageCarousel'
import CreateHubModal from '../components/CreateHubModal'

const BotanicalAccent = () => (
    <svg width="80" height="80" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute -top-8 -left-8 opacity-30 select-none pointer-events-none">
        <path d="M10 50 Q30 10 50 50" stroke="#A3B3A3" strokeWidth="3" fill="none" />
        <ellipse cx="18" cy="38" rx="4" ry="8" fill="#C7D0C7" />
        <ellipse cx="30" cy="28" rx="4" ry="8" fill="#A3B3A3" />
        <ellipse cx="42" cy="38" rx="4" ry="8" fill="#7A927A" />
    </svg>
)

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
    const [activeTab, setActiveTab] = useState<'friends' | 'discovery'>('friends')
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
    // Track recently-surfaced suggestions to rotate variety across refreshes
    const suggestedSeenRef = useRef<Set<string>>(new Set<string>())
    try {
        const rawSeen = sessionStorage.getItem('suggested_seen_ids')
        if (rawSeen) suggestedSeenRef.current = new Set<string>(JSON.parse(rawSeen))
    } catch {}
    const [showCreateHubModal, setShowCreateHubModal] = useState(false)
    const [createHubSeed, setCreateHubSeed] = useState<any>(null)
    const [recentCreatedHub, setRecentCreatedHub] = useState<Hub | null>(null)

    const toRad = (v: number) => (v * Math.PI) / 180
    const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371
        const dLat = toRad(lat2 - lat1)
        const dLon = toRad(lon2 - lon1)
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        return R * c
    }

    useEffect(() => {
        if (currentUser) {
            loadFriendsActivity()
            loadForYou(true)
            loadSuggested(true)
            firebaseDataService.getUserLists(currentUser.id).then(l => setUserOwnedLists(Array.isArray(l) ? l.filter(x => x.userId === currentUser.id) : [])).catch(() => setUserOwnedLists([]))
            // Fetch tag options from Firebase for unified menu
            firebaseDataService.getPopularTags(200).then(tags => setAvailableTags(tags)).catch(()=> setAvailableTags(['cozy','trendy','quiet','local','authentic']))
        }
    }, [currentUser])

    // Reload discovery when switching to discovery tab
    useEffect(() => {
        if (activeTab === 'discovery' && currentUser) {
            loadForYou()
            loadSuggested()
        }
    }, [activeTab])

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
        try {
            setIsLoadingForYou(true)
            if (!force && forYouCacheRef.current.items.length > 0 && Date.now() - forYouCacheRef.current.timestamp < 2 * 60 * 1000) {
                setDiscoveryItems(forYouCacheRef.current.items)
                return
            }
            const { tags, loc, userPrefs } = await getDiscoveryContext()
            if (!loc) { setDiscoveryItems([]); return }
            const internal = await firebaseDataService.getSuggestedPlaces({ tags, location: { lat: loc.lat, lng: loc.lng }, limit: 12 })
            let places = internal || []
            const milesPreferred = (userPrefs as any)?.locationPreferences?.nearbyRadius
            const preferredKm = typeof milesPreferred === 'number' && milesPreferred > 0 ? milesPreferred * 1.60934 : 80
            const maxKmDefault = (typeof filters.distanceKm === 'number' ? filters.distanceKm : preferredKm)
            const filtered = places.filter(p => {
                const plat = p.coordinates?.lat, plng = p.coordinates?.lng
                if (typeof plat !== 'number' || typeof plng !== 'number') return false
                const R = 6371, toRad = (v:number)=>v*Math.PI/180
                const dLat = toRad(plat - loc.lat), dLon = toRad(plng - loc.lng)
                const a = Math.sin(dLat/2)**2 + Math.cos(toRad(loc.lat)) * Math.cos(toRad(plat)) * Math.sin(dLon/2)**2
                const km = 2 * Math.atan2(Math.sqrt(a),Math.sqrt(1-a)) * R
                return km <= maxKmDefault
            })
            // Ensure uniqueness
            const seen = new Set<string>()
            const unique: any[] = []
            for (const p of filtered) {
                const k = `${(p.name||'').toLowerCase()}|${((p as any).address || (p as any).location?.address || '').toLowerCase()}`
                if (!seen.has(k)) { seen.add(k); unique.push(p) }
            }
            const placeItems: DiscoveryItem[] = unique.slice(0, 12).map(place => ({
                id: place.id,
                type: 'hub' as const,
                title: place.name,
                description: (place as any).address || (place as any).location?.address || '',
                image: (place as any).mainImage || 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop',
                item: place,
                isGoogleSuggested: (place as any).source === 'google',
                googlePlaceDetails: (place as any).googlePlaceDetails
            }))
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
            setHasLoadedDiscovery(true)
        } finally {
            setIsLoadingForYou(false)
        }
    }

    // Load ONLY the Suggested Hubs section (Google external)
    const loadSuggested = async (force: boolean = false) => {
        try {
            setIsLoadingSuggested(true)
            if (!force && suggestedCacheRef.current.items.length > 0 && Date.now() - suggestedCacheRef.current.timestamp < 2 * 60 * 1000) {
                setSuggestedGoogle(suggestedCacheRef.current.items)
                return
            }
            const { tags, loc, userPrefs } = await getDiscoveryContext()
            if (!loc) { setSuggestedGoogle([]); return }
            const interests = (userPrefs as any)?.favoriteCategories || []
            const milesPreferred = (userPrefs as any)?.locationPreferences?.nearbyRadius
            const preferredKm = typeof milesPreferred === 'number' && milesPreferred > 0 ? milesPreferred * 1.60934 : 80
            const radiusKm = (typeof filters.distanceKm === 'number' ? filters.distanceKm : preferredKm)
            // session cache key by location+radius+openNow (show cached immediately, still refresh)
            try {
              const cacheKey = `suggested_${filters.origin}_${loc.lat.toFixed(3)}_${loc.lng.toFixed(3)}_${radiusKm}_${filters.openNow?1:0}`
              if (!force) {
                const raw = sessionStorage.getItem(cacheKey)
                if (raw) {
                  const parsed = JSON.parse(raw)
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    setSuggestedGoogle(parsed)
                  }
                }
              }
            } catch {}
            // fetch more than we need, we will filter + de-dupe and then slice
            const external = await firebaseDataService.getExternalSuggestedPlaces(loc.lat, loc.lng, tags, 12, { interests: interests.slice(0,6), radiusKm, openNow: !!filters.openNow })
            const existingLite = await firebaseDataService.getPlaceKeysLite(800)
            const keyFor = (p: any) => `${(p.name||'').toLowerCase()}|${(p.address||'').toLowerCase()}`
            const coordKey = (p:any) => (p.coordinates && typeof p.coordinates.lat==='number' && typeof p.coordinates.lng==='number') ? `${p.coordinates.lat.toFixed(5)},${p.coordinates.lng.toFixed(5)}` : ''
            const seenComposite = new Set([
                ...forYouCacheRef.current.items.map(it => keyFor((it.item as any))),
                ...(existingLite||[]).map((x:any)=>`${(x.name||'').toLowerCase()}|${(x.address||'').toLowerCase()}`),
                ...(existingLite||[]).map((x:any)=> (typeof x.lat==='number' && typeof x.lng==='number') ? `${x.lat.toFixed(5)},${x.lng.toFixed(5)}` : '')
            ])
            // Remove duplicates and enforce distance bound; drop items with no coordinates unless geocoded later
            let filtered = (external||[])
              .filter(p => !seenComposite.has(keyFor(p)) && (!coordKey(p) || !seenComposite.has(coordKey(p))))
              .filter(p => {
                const plat = p?.coordinates?.lat
                const plng = p?.coordinates?.lng
                if (typeof plat !== 'number' || typeof plng !== 'number') return false // require coords pre-enrichment to respect hard cap
                const R=6371; const toRad=(v:number)=>v*Math.PI/180
                const dLat=toRad(plat - loc.lat); const dLon=toRad(plng - loc.lng)
                const a=Math.sin(dLat/2)**2+Math.cos(toRad(loc.lat))*Math.cos(toRad(plat))*Math.sin(dLon/2)**2
                const c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
                const km = R*c
                return km <= radiusKm
              })
            // Shuffle to introduce variety
            for (let i = filtered.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1))
                const tmp = filtered[i]; filtered[i] = filtered[j]; filtered[j] = tmp
            }
            // Exclude recently surfaced items when possible
            const seenIds = suggestedSeenRef.current as unknown as Set<string>
            const unseen = filtered.filter(p => !seenIds.has(p.id))
            let pick = (unseen.length >= 8 ? unseen : filtered).slice(0, 12)
            // Enrich addresses to ensure full, formatted address (state/country/zip) where missing; also attempt geocoding only if coords exist
            try {
                pick = await Promise.all(pick.map(async (p: any) => {
                    let addr = p.address || p.formattedAddress || ''
                    const looksIncomplete = !addr || (!/\b[A-Z]{2}\b/.test(addr) && !/\b[0-9]{5}(?:-[0-9]{4})?\b/.test(addr))
                    if (looksIncomplete && p.coordinates && typeof p.coordinates.lat==='number' && typeof p.coordinates.lng==='number') {
                        try {
                            const geo = await firebaseDataService.geocodeLocation(`${p.coordinates.lat},${p.coordinates.lng}`)
                            if (geo?.address) addr = geo.address
                        } catch {}
                    }
                    return { ...p, address: addr }
                }))
            } catch {}
            // After enrichment, drop any items that still visibly exceed the radius if coords known
            pick = pick.filter((p: any) => {
                const plat = p?.coordinates?.lat
                const plng = p?.coordinates?.lng
                if (typeof plat !== 'number' || typeof plng !== 'number') return false
                const R=6371; const toRad=(v:number)=>v*Math.PI/180
                const dLat=toRad(plat - loc.lat); const dLon=toRad(plng - loc.lng)
                const a=Math.sin(dLat/2)**2+Math.cos(toRad(loc.lat))*Math.cos(toRad(plat))*Math.sin(dLon/2)**2
                const c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
                const km = R*c
                return km <= radiusKm
            })
            // Keep UI limited
            pick = pick.slice(0, 8)
            // Persist recently surfaced ids (cap to 100)
            pick.forEach(p => seenIds.add(p.id))
            try {
                const arr = Array.from(seenIds).slice(-100)
                suggestedSeenRef.current = new Set(arr) as unknown as Set<string>
                sessionStorage.setItem('suggested_seen_ids', JSON.stringify(arr))
            } catch {}
            setSuggestedGoogle(pick)
            suggestedCacheRef.current = { items: pick, timestamp: Date.now() }
            try {
              const cacheKey = `suggested_${filters.origin}_${loc.lat.toFixed(3)}_${loc.lng.toFixed(3)}_${radiusKm}_${filters.openNow?1:0}`
              sessionStorage.setItem(cacheKey, JSON.stringify(pick))
            } catch {}
        } finally {
            setIsLoadingSuggested(false)
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
            // Ensure uniqueness within For You feed as well
            const feedSeen = new Set<string>()
            const uniqueWithin: any[] = []
            for (const p of within) {
              const k = `${(p.name||'').toLowerCase()}|${((p as any).address || (p as any).location?.address || '').toLowerCase()}`
              if (!feedSeen.has(k)) { feedSeen.add(k); uniqueWithin.push(p) }
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
            // no-op; using split loaders now
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
                        distances[item.id] = haversineKm(lat, lng, selectedLocation.lat, selectedLocation.lng)
                    }
                } else {
                    // list: compute nearest hub distance
                    const list = item.item as any
                    const hubs: any[] = Array.isArray(list.hubs) ? list.hubs : []
                    let min = Infinity
                    if (list.location && typeof list.location.lat === 'number' && typeof list.location.lng === 'number') {
                      min = Math.min(min, haversineKm(list.location.lat, list.location.lng, selectedLocation.lat, selectedLocation.lng))
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
                                const d = haversineKm(lat, lng, selectedLocation.lat, selectedLocation.lng)
                                if (d < min) min = d
                            }
                        } else {
                            const lat = (hubRef.location && hubRef.location.lat) || hubRef.coordinates?.lat
                            const lng = (hubRef.location && hubRef.location.lng) || hubRef.coordinates?.lng
                            if (typeof lat === 'number' && typeof lng === 'number') {
                                const d = haversineKm(lat, lng, selectedLocation.lat, selectedLocation.lng)
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

    return (
        <div className="min-h-full relative bg-linen-50 overflow-x-hidden">
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 bg-linen-texture opacity-80 mix-blend-multiply"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-gold-50/60 via-linen-100/80 to-sage-100/70 opacity-80"></div>
                <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-charcoal-900/10"></div>
            </div>
            <div className="relative z-10 p-8 pb-4 max-w-2xl mx-auto flex flex-col gap-2 overflow-visible">
                <BotanicalAccent />
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-3xl font-serif font-extrabold text-charcoal-800 tracking-tight">
                                This Is
                            </h1>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="ml-1 -mt-1">
                                <path d="M4 20 Q12 4 20 20" stroke="#A3B3A3" strokeWidth="2" fill="none" />
                                <ellipse cx="8" cy="15" rx="2" ry="4" fill="#C7D0C7" />
                                <ellipse cx="16" cy="15" rx="2" ry="4" fill="#A3B3A3" />
                            </svg>
                        </div>
                        <p className="text-sage-700 text-base mt-1">
                            Your personal memory journal
                        </p>
                    </div>
                </div>
                <div className="relative mb-6">
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
                <div className="flex bg-white/80 rounded-xl p-1 mb-6 shadow-soft">
                    <button
                        onClick={() => setActiveTab('friends')}
                        className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-200 ${activeTab === 'friends'
                            ? 'bg-gradient-to-r from-sage-400 to-gold-300 text-white shadow-botanical'
                            : 'text-sage-700 hover:text-sage-900'
                            }`}
                    >
                        Friends
                    </button>
                    <button
                        onClick={() => setActiveTab('discovery')}
                        className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-200 ${activeTab === 'discovery'
                            ? 'bg-gradient-to-r from-sage-400 to-gold-300 text-white shadow-botanical'
                            : 'text-sage-700 hover:text-sage-900'
                            }`}
                    >
                        Discovery
                    </button>
                </div>
            </div>
            <div className="relative z-10 px-8 pb-8 max-w-2xl mx-auto overflow-x-hidden">
                {activeTab === 'friends' ? (
                    <div className="space-y-6">
                        <h2 className="text-xl font-serif font-semibold text-charcoal-700 mb-4">
                            Recent Activity
                        </h2>
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
                                return <p className="text-center py-8">No recent activity yet.</p>
                            }
                            return (
                                filtered.map((activity) => (
                                <button
                                    key={activity.id}
                                    onClick={() => handleActivityClick(activity)}
                                    className="w-full bg-white/98 rounded-2xl shadow-botanical border border-linen-200 p-5 hover:shadow-cozy hover:-translate-y-1 transition-all duration-300 text-left flex flex-col gap-2 overflow-hidden"
                                >
                                    <div className="flex items-start gap-4">
                                        <img
                                            src={activity.user.avatar}
                                            alt={activity.user.name}
                                            className="w-12 h-12 rounded-xl object-cover border-2 border-white shadow-soft"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleUserClick(activity.user.id)
                                                    }}
                                                    className="font-semibold text-charcoal-800 hover:text-sage-600 transition-colors cursor-pointer"
                                                >
                                                    {activity.user.name}
                                                </span>
                                                <span className="text-sage-400">•</span>
                                                <span className="text-sage-500 text-sm">{formatTimestamp(activity.createdAt)}</span>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                {getActionIcon(activity.type)}
                                                <div className="flex-1">
                                                    <p className="text-sage-900">
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
                                                        <p className="text-sage-700 text-sm mt-1">{activity.note}</p>
                                                    )}
                                                    {activity.note && (
                                                        <p className="text-sage-700 text-sm mt-2 italic">
                                                            "{activity.note}"
                                                        </p>
                                                    )}
                                                    {activity.placeImage && (
                                                        <img
                                                            src={activity.placeImage}
                                                            alt={activity.place?.name}
                                                            className="w-full h-32 object-cover rounded-lg mt-3 shadow-soft"
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
                                </button>
                            ))
                            )
                        })()}
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-serif font-semibold text-charcoal-700">For You</h2>
                            {hasLoadedDiscovery && (
                              <button
                                onClick={async () => { await loadForYou(true) }}
                                className="text-sage-700 text-sm px-3 py-1 rounded-lg bg-white/80 border border-linen-200 hover:bg-white transition"
                                aria-label="Refresh recommendations"
                              >
                                Refresh
                              </button>
                            )}
                        </div>
                        {isLoadingForYou ? (
                            <div className="space-y-4">
                              {/* skeleton loaders to keep user engaged */}
                              {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="w-full rounded-2xl border border-linen-200 bg-white/70 p-5 animate-pulse">
                                  <div className="flex items-start gap-4">
                                    <div className="w-16 h-16 rounded-xl bg-linen-200" />
                                    <div className="flex-1 space-y-2">
                                      <div className="h-4 bg-linen-200 rounded w-1/2" />
                                      <div className="h-3 bg-linen-200 rounded w-3/4" />
                                      <div className="h-3 bg-linen-200 rounded w-2/3" />
                                    </div>
                                  </div>
                                </div>
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
                            // Remove google-suggested hubs from the default list so they render only in the distinct section
                            filtered = filtered.filter(it => (it.type !== 'hub') || (((it.item as any)?.source) !== 'google'))
                            const showSuggestedSection = true
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
                            if (filtered.length === 0 && !showSuggestedSection) {
                                return <p className="text-center py-8">No trending items yet.</p>
                            }
                            return (
                                <>
                                {recentCreatedHub && (
                                  <div
                                    key={`recent-${recentCreatedHub.id}`}
                                    onClick={() => openHubModal(recentCreatedHub, 'home-discovery-feed')}
                                    className="w-full bg-white/98 rounded-2xl shadow-botanical border border-linen-200 p-5 hover:shadow-cozy hover:-translate-y-1 transition-all duration-300 text-left flex flex-col gap-2 overflow-hidden cursor-pointer"
                                  >
                                    <div className="flex items-start gap-4">
                                      <img src={recentCreatedHub.mainImage || '/assets/leaf.png'} alt={recentCreatedHub.name} className="w-16 h-16 rounded-xl object-cover border-2 border-white shadow-soft" />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between mb-2">
                                          <h3 className="font-semibold text-charcoal-800 line-clamp-2">{recentCreatedHub.name}</h3>
                                        </div>
                                        <p className="text-sage-700 text-sm mb-3">{recentCreatedHub.location?.address}</p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {filtered.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => handleDiscoveryClick(item)}
                                    className="w-full bg-white/98 rounded-2xl shadow-botanical border border-linen-200 p-5 hover:shadow-cozy hover:-translate-y-1 transition-all duration-300 text-left flex flex-col gap-2 overflow-hidden cursor-pointer"
                                >
                                    <div className="flex items-start gap-4">
                                        <img
                                            src={item.image}
                                            alt={item.title}
                                            className="w-16 h-16 rounded-xl object-cover border-2 border-white shadow-soft"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between mb-2">
                                                <h3 className="font-semibold text-charcoal-800 line-clamp-2">{item.title}</h3>
                                                <div className="flex items-center gap-1 ml-2">
                                                    <button
                                                        onClick={e => {
                                                            e.stopPropagation();
                                                            handleLikeItem(item.id, item.type);
                                                        }}
                                                        className="p-1.5 rounded-full bg-sage-50 text-sage-600 hover:bg-sage-100 transition"
                                                        title="Like"
                                                    >
                                                        {(item.item as List).likedBy?.includes(currentUser!.id) ? <HeartIconSolid className="w-4 h-4 text-red-500" /> : <HeartIcon className="w-4 h-4" />}
                                                    </button>
                                                    {item.type === 'list' && (
                                                        <>
                                                            <button
                                                                onClick={e => {
                                                                    e.stopPropagation();
                                                                    handleSaveToPlace(item.item as Place);
                                                                }}
                                                                className="p-1.5 rounded-full bg-gold-50 text-gold-600 hover:bg-gold-100 transition"
                                                                title="Save to list"
                                                            >
                                                                <BookmarkIcon className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={e => {
                                                                    e.stopPropagation();
                                                                    handleCreatePost(item.id);
                                                                }}
                                                                className="p-1.5 rounded-full bg-sage-50 text-sage-600 hover:bg-gold-100 transition"
                                                                title="Create post"
                                                            >
                                                                <PlusIcon className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                    {item.type === 'hub' && (
                                                        <>
                                                            <button
                                                                onClick={e => {
                                                                    e.stopPropagation();
                                                                    handleSaveToPlace(item.item as Place);
                                                                }}
                                                                className="p-1.5 rounded-full bg-gold-50 text-gold-600 hover:bg-gold-100 transition"
                                                                title="Save to list"
                                                            >
                                                                <BookmarkIcon className="w-4 h-4" />
                                                            </button>
                                                            {(item.item as any).source === 'google' && (
                                                                <button
                                                                    onClick={async e => {
                                                                        e.stopPropagation();
                                                                        const place = item.item as Place
                                                                        const coords = place.coordinates || { lat: 0, lng: 0 }
                                                                        try {
                                                                            const hubId = await firebaseDataService.createHub({ name: place.name, address: place.address || '', description: '', coordinates: coords })
                                                                            const mapsUrl = coords.lat && coords.lng ? `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}` : (place.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.address)}` : '')
                                                                            const newHub: Hub = { ...(place as any), id: hubId, name: place.name, description: '', tags: place.tags, images: [], location: { address: place.address, lat: coords.lat, lng: coords.lng }, googleMapsUrl: mapsUrl, mainImage: (place as any).mainImage || '', posts: [], lists: [] }
                                                                            openHubModal(newHub, 'home-discovery-feed')
                                                                        } catch (err) {
                                                                            console.error('Failed to create hub from suggestion', err)
                                                                        }
                                                                    }}
                                                                    className="p-1.5 rounded-full bg-sage-100 text-sage-700 hover:bg-sage-200 transition"
                                                                    title="Create hub"
                                                                >
                                                                    <PlusIcon className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={e => {
                                                                    e.stopPropagation();
                                                                    handleCreatePost(undefined, item.item);
                                                                }}
                                                                className="p-1.5 rounded-full bg-sage-50 text-sage-600 hover:bg-gold-100 transition"
                                                                title="Create post"
                                                            >
                                                                <PlusIcon className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-sage-700 text-sm mb-3">
                                                {item.type === 'hub' && (item.item as any)?.address
                                                  ? ((item.item as any).address as string).split(',').slice(-2).join(', ').trim() || (item.item as any).address
                                                  : item.description}
                                            </p>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {item.owner && (
                                                    <span className="text-xs text-sage-500">by {item.owner}</span>
                                                )}
                                                {item.type === 'list' && (
                                                    <span className="text-xs bg-sage-100 text-sage-600 px-2 py-0.5 rounded-full">
                                                        {item.places} places
                                                    </span>
                                                )}
                                                {/* Hide saved-count badge per UX feedback */}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                ))}
                                <div className="mt-8">
                                    <div className="flex items-center justify-between mb-4">
                                      <h2 className="text-xl font-serif font-semibold text-center flex-1" style={{ color: '#2563eb' }}>Suggested Hubs</h2>
                                      <button
                                        onClick={async () => { await loadSuggested(true) }}
                                        className="ml-2 text-blue-700 text-sm px-3 py-1 rounded-lg bg-white/70 border border-white/40 hover:bg-white/90 transition"
                                        disabled={isLoadingSuggested}
                                      >
                                        {isLoadingSuggested ? 'Loading…' : 'Refresh'}
                                      </button>
                                    </div>
                                    {isLoadingSuggested ? (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                        {Array.from({ length: 6 }).map((_, i) => (
                                          <div key={i} className="rounded-3xl border border-white/30 ring-1 ring-white/50 bg-white/50 h-60 animate-pulse" />
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                        {suggestedGoogle.slice(0, 8).map((item) => {
                                              const price = typeof item.priceLevel === 'number' ? '$'.repeat(Math.max(1, Math.min(4, item.priceLevel))) : ''
                                              const ratingAndCount = typeof item.rating === 'number'
                                                ? `${item.rating.toFixed(1)} ★${typeof item.userRatingsTotal === 'number' ? ` (${item.userRatingsTotal})` : ''}`
                                                : ''
                                              const meta = [
                                                ratingAndCount,
                                                price,
                                                item.openNow ? 'Open now' : ''
                                              ].filter(Boolean).join(' · ')
                                              const images = Array.isArray(item.images) && item.images.length > 0 ? item.images : (item.mainImage ? [item.mainImage] : [])
                                              return (
                                                <div
                                                  key={item.id}
                                                  className="relative w-full rounded-3xl shadow-xl border border-white/30 ring-1 ring-white/50 overflow-hidden"
                                                  style={{ background: 'linear-gradient(145deg, rgba(248,252,255,0.9), rgba(221,236,255,0.65))', backdropFilter: 'blur(28px) saturate(1.32)' }}
                                                >
                                                  {/* liquid glass highlights */}
                                                  <div className="pointer-events-none absolute -top-20 left-6 w-56 h-56 rounded-full bg-white/70 blur-3xl opacity-70" />
                                                  <div className="pointer-events-none absolute -bottom-24 right-8 w-52 h-52 rounded-full bg-blue-200/70 blur-3xl opacity-70" />
                                                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-blue-200/20" />
                                                  {/* sweeping glare */}
                                                  <div className="pointer-events-none absolute -top-10 -left-20 w-[160%] h-14 bg-gradient-to-r from-white/10 via-white/70 to-white/10 opacity-60 blur-xl transform -rotate-6" />
                                                  {/* bottom refraction */}
                                                  <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 w-2/3 h-10 rounded-full bg-white/15 blur-md" />
 
                                                   {/* top media */}
                                                   <div className="w-full h-40 bg-gradient-to-br from-blue-200/30 to-blue-100/20 relative">
                                                     {images.length > 1 ? (
                                                       <ImageCarousel images={images} className="h-40 w-full" />
                                                     ) : (
                                                       <img src={(images[0] || item.mainImage || '/assets/leaf.png')} alt={item.name} className="absolute inset-0 w-full h-full object-cover" />
                                                     )}
                                                     <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/25 to-transparent" />
                                            </div>
 
                                                   {/* content */}
                                                   <div className="p-4 relative">
                                                     {/* subtle inner panel to amplify glass */}
                                                     <div className="absolute inset-2 rounded-2xl bg-white/18 border border-white/30 shadow-inner pointer-events-none" />
                                                     <div className="relative">
                                                       <h3 className="font-semibold text-blue-900 text-base text-center line-clamp-2">{item.name}</h3>
                                                       {/* full address toggle for mobile */}
                                                       <button onClick={(e)=>{ e.stopPropagation(); const el = (e.currentTarget.nextSibling as HTMLElement); if (el) { el.classList.toggle('line-clamp-1'); el.classList.toggle('line-clamp-none'); } }} className="block w-full text-blue-700 text-xs text-center mt-1">
                                                         {(() => { const parts = String(item.address||'').split(',').map((s:string)=>s.trim()).filter(Boolean); const street = parts[0] || ''; const city = parts[1] || ''; const short = [street, city].filter(Boolean).join(', '); return short || item.description })()}
                                                       </button>
                                                       <p className="text-blue-700 text-[11px] text-center mt-1 line-clamp-1">{item.address || ''}</p>
                                                       {meta && <p className="text-blue-900/80 text-[11px] text-center mt-2">{meta}</p>}
                                                       {item.description && <p className="text-blue-900/80 text-[11px] leading-snug text-center line-clamp-3 mt-2">{item.description}</p>}
                                                   {/* type chips */}
                                                   {Array.isArray(item.tags) && item.tags.length > 0 && (
                                                     <div className="mt-2 flex flex-wrap justify-center gap-1">
                                                       {item.tags.filter((t: string) => !['establishment','point_of_interest'].includes(t)).slice(0,6).map((t: string, idx: number) => (
                                                         <span key={idx} className="px-2 py-0.5 rounded-full bg-white/55 border border-white/40 text-[10px] text-blue-900/80">{t.replace(/_/g,' ')}</span>
                                                       ))}
                                        </div>
                                                   )}
 
                                                     <button
                                                       onClick={(e) => { e.stopPropagation(); setCreateHubSeed({
                                                         name: item.name,
                                                         address: item.address,
                                                         coordinates: item.coordinates,
                                                         images: item.images,
                                                         mainImage: item.mainImage,
                                                         description: item.description
                                                       }); setShowCreateHubModal(true) }}
                                                       className="mt-3 w-full py-2 rounded-xl font-semibold text-white shadow-lg transition-all duration-200 active:scale-95"
                                                       style={{ background: 'linear-gradient(135deg, #1ea4ff, #1d4ed8)' }}
                                                     >
                                                       Create Hub
                                                     </button>
                                    </div>
                                </div>
                                                 </div>
                                              )
                                            })}
                                          </div>
                        )}
                                </div>
                                </>
                            )
                        })()}
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
                    // Close modal and remove the suggested item
                    setShowCreateHubModal(false)
                    setSuggestedGoogle(prev => prev.filter(p => p.name !== data.name || p.address !== data.address))
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
        </div>
    )
}

export default Home
