import type { Place, List, Hub, User } from '../types/index.js'
import TagPill from './TagPill'
import { formatTimestamp } from '../utils/dateUtils'
import { MapPinIcon, BookmarkIcon, StarIcon, FireIcon, EllipsisHorizontalIcon, SparklesIcon, UserIcon } from '@heroicons/react/24/outline'
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import SearchAndFilter from './SearchAndFilter'
import HubModal from './HubModal'
import ListModal from './ListModal'
import ListMenuDropdown from './ListMenuDropdown'
import { useNavigation } from '../contexts/NavigationContext.tsx'
import { useModal } from '../contexts/ModalContext.tsx'
import { useAuth } from '../contexts/AuthContext.tsx'
import { 
  getPersonalizedRecommendations,
  type SearchContext,
  type DiscoveryRecommendation 
} from '../utils/intelligentSearchService.js'
import { firebaseDataService } from '../services/firebaseDataService.js'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'

const DiscoveryTab = () => {
  const { 
    showHubModal, 
    showListModal, 
    selectedHub, 
    selectedList, 
    openHubModal, 
    openListModal, 
    closeHubModal, 
    closeListModal,
    hubModalFromList,
    goBackFromHubModal,
    goBackFromListModal,
    openFullScreenHub,
    openFullScreenList
  } = useNavigation()
  const { openSaveModal, openCreatePostModal } = useModal()
  const navigate = useNavigate()
  const { currentUser: authUser } = useAuth()
  const [savedLists, setSavedLists] = useState<Set<string>>(new Set())
  const [personalizedRecommendations, setPersonalizedRecommendations] = useState<DiscoveryRecommendation[]>([])
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(true)
  
  // Firebase data state
  const [trendingHubs, setTrendingHubs] = useState<Place[]>([])
  const [popularLists, setPopularLists] = useState<List[]>([])
  const [isLoadingTrending, setIsLoadingTrending] = useState(true)
  const [suggestedPlaces, setSuggestedPlaces] = useState<Place[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(() => 80)
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  // State for Firebase search context
  const [searchContext, setSearchContext] = useState<SearchContext | null>(null)
  const [contextLoading, setContextLoading] = useState(true)

  // Nearby sorting state
  const [sortBy, setSortBy] = useState('relevance')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; name?: string } | null>(null)
  const [hubDistances, setHubDistances] = useState<Record<string, number>>({})
  const [listDistances, setListDistances] = useState<Record<string, number>>({})
  const placeCacheRef = useRef<Record<string, Place>>({})

  const toRad = (v: number) => (v * Math.PI) / 180
  const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371
    const dLat = toRad(lat2 - lat1)
    const dLon = toRad(lon2 - lon1)
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // Load real user data and build search context
  useEffect(() => {
    const loadUserAndBuildContext = async () => {
      if (!authUser) {
        setContextLoading(false)
        return
      }

      try {
        setContextLoading(true)
        
        // Get real user data from Firebase
        const userProfile = await firebaseDataService.getCurrentUser(authUser.id)
        if (userProfile) {
          setCurrentUser(userProfile)
        } else {
          // Fallback if profile doesn't exist yet
          setCurrentUser({
            id: authUser.uid,
            name: authUser.displayName || 'User',
            username: authUser.email?.split('@')[0] || 'user',
            avatar: authUser.photoURL || '',
            bio: 'Welcome to This Is!',
            location: '',
            influences: 0,
            tags: []
          })
        }
        
        // Build search context with real user data
        const firebaseContext = await firebaseDataService.buildSearchContext(authUser.id)
        setSearchContext(firebaseContext)

        // Initialize default distance from user prefs
        const miles = (firebaseContext as any)?.userPreferences?.locationPreferences?.nearbyRadius
        if (typeof miles === 'number' && miles > 0) setMaxDistanceKm(miles * 1.60934)

        // If user has a declared textual location, geocode and set as origin
        const declared = (firebaseContext as any)?.currentUser?.location
        if (!selectedLocation && declared && typeof declared === 'string' && declared.trim().length > 0) {
          try {
            const geo = await firebaseDataService.geocodeLocation(declared)
            if (geo && typeof geo.lat === 'number' && typeof geo.lng === 'number') {
              setSelectedLocation({ lat: geo.lat, lng: geo.lng, name: geo.address || declared })
            }
          } catch {}
        }
      } catch (error) {
        console.error('Error loading user data and building search context:', error)
        setSearchContext(null)
      } finally {
        setContextLoading(false)
      }
    }

    loadUserAndBuildContext()
  }, [authUser])
  
  // Load trending data from Firebase
  const loadTrendingData = async () => {
    try {
      setIsLoadingTrending(true)
      
      // Get trending places (sorted by savedCount)
      const searchData = await firebaseDataService.performSearch('', { sortBy: 'popular' }, 20)
      
      // Filter and sort places by savedCount for trending
      const trending = searchData.places
        .filter(place => place.savedCount > 0)
        .sort((a, b) => b.savedCount - a.savedCount)
        .slice(0, 6)
      
      // Filter and sort lists by likes for popular
      const popular = searchData.lists
        .filter(list => list.likes > 0)
        .sort((a, b) => b.likes - a.likes)
        .slice(0, 6)
      
      setTrendingHubs(trending)
      setPopularLists(popular)
    } catch (error) {
      console.error('Error loading trending data:', error)
      setTrendingHubs([])
      setPopularLists([])
    } finally {
      setIsLoadingTrending(false)
    }
  }

  // Load trending data on mount and when search context is ready
  useEffect(() => {
    loadTrendingData()
  }, [])

  // Live-sync profile changes (e.g., user updates location in Edit Profile)
  useEffect(() => {
    if (!authUser) return
    try {
      const unsub = onSnapshot(doc(db, 'users', authUser.id), async (snap) => {
        if (!snap.exists()) return
        const u = { id: snap.id, ...(snap.data() as any) } as User
        setCurrentUser(u)
        const declared = typeof u.location === 'string' ? u.location.trim() : ''
        if (declared && (!selectedLocation || selectedLocation.name !== declared)) {
          try {
            const geo = await firebaseDataService.geocodeLocation(declared)
            if (geo) {
              setSelectedLocation({ lat: geo.lat, lng: geo.lng, name: geo.address || declared })
            }
          } catch {}
        }
      })
      return () => unsub()
    } catch {}
  }, [authUser])

  // Load Suggested for you (cold-start friendly)
  useEffect(() => {
    const loadSuggestions = async () => {
      try {
        setIsLoadingSuggestions(true)
        let loc = selectedLocation
        // Prefer user-declared location from profile/context
        const declaredCtx = (searchContext as any)?.currentUser?.location
        const declaredUser = currentUser?.location
        // In our user schema, location is a string; geocode if provided
        if (!loc && typeof declaredCtx === 'string' && declaredCtx.trim().length > 0) {
          try {
            const geo = await firebaseDataService.geocodeLocation(declaredCtx)
            if (geo) loc = { lat: geo.lat, lng: geo.lng, name: geo.address || declaredCtx }
          } catch {}
        }
        if (!loc && typeof declaredUser === 'string' && declaredUser.trim().length > 0) {
          try {
            const geo = await firebaseDataService.geocodeLocation(declaredUser)
            if (geo) loc = { lat: geo.lat, lng: geo.lng, name: geo.address || declaredUser }
          } catch {}
        }
        if (!loc && 'geolocation' in navigator) {
          try {
            await new Promise<void>((resolve) => {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, name: 'Current Location' }
                  resolve()
                },
                () => resolve(),
                { enableHighAccuracy: true, timeout: 6000 }
              )
            })
          } catch {}
        }
        const tags = (currentUser?.tags || []).slice(0, 8)
        console.log('[Discovery] loadSuggestions start', { loc, tags, maxDistanceKm })
        // First try internal suggestions
        const internal = await firebaseDataService.getSuggestedPlaces({
          tags,
          location: loc ? { lat: loc.lat, lng: loc.lng } : undefined,
          limit: 24
        })
        if (!internal || internal.length === 0) {
          console.warn('[Discovery] No internal places returned')
        }
        // Filter internal by distance if we have a location
        const internalFiltered = (internal || []).filter(p => {
          if (!loc) return true
          const lat = p.coordinates?.lat
          const lng = p.coordinates?.lng
          if (typeof lat !== 'number' || typeof lng !== 'number') return false
          const R=6371; const toRad=(v:number)=>v*Math.PI/180
          const dLat=toRad(lat-loc.lat); const dLon=toRad(lng-loc.lng)
          const a=Math.sin(dLat/2)**2+Math.cos(toRad(loc.lat))*Math.cos(toRad(lat))*Math.sin(dLon/2)**2
          const c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
          return (R*c) <= (maxDistanceKm ?? 80)
        })
        let places = internalFiltered.slice(0, 12)
        console.log('[Discovery] internalFiltered', { count: internalFiltered.length })
        // If still sparse, call external Google Places proxy with user prefs
        if ((!places || places.length < 6) && loc) {
          const interests = ((searchContext as any)?.userPreferences?.favoriteCategories || []).slice(0, 6)
          const radiusPrefMiles = (searchContext as any)?.userPreferences?.locationPreferences?.nearbyRadius
          const radiusKm = typeof radiusPrefMiles === 'number' && radiusPrefMiles > 0 ? radiusPrefMiles * 1.60934 : maxDistanceKm || 20
          const ext = await firebaseDataService.getExternalSuggestedPlaces(
            loc.lat,
            loc.lng,
            tags,
            20,
            { interests, radiusKm, openNow: false }
          )
          console.log('[Discovery] external results', { count: ext?.length, interests, radiusKm })
          // Filter external by distance and de-dupe by id
          const extFiltered = (ext || []).filter(p => {
            const lat = p.coordinates?.lat
            const lng = p.coordinates?.lng
            if (typeof lat !== 'number' || typeof lng !== 'number') return false
            const R=6371; const toRad=(v:number)=>v*Math.PI/180
            const dLat=toRad(lat-loc!.lat); const dLon=toRad(lng-loc!.lng)
            const a=Math.sin(dLat/2)**2+Math.cos(toRad(loc!.lat))*Math.cos(toRad(lat))*Math.sin(dLon/2)**2
            const c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
            return (R*c) <= (maxDistanceKm ?? radiusKm)
          })
          const seen = new Set(places.map(p=>p.id))
          for (const p of extFiltered) { if (!seen.has(p.id)) { places.push(p); seen.add(p.id) } }
          places = places.slice(0, 12)
        }
        console.log('[Discovery] final suggestions', { count: places.length })
        setSuggestedPlaces(places)
      } catch (e) {
        console.warn('Failed to load suggestions', e)
        setSuggestedPlaces([])
      } finally {
        setIsLoadingSuggestions(false)
      }
    }
    loadSuggestions()
  }, [currentUser, selectedLocation, searchContext])

  // Load personalized recommendations when search context is ready
  useEffect(() => {
    if (searchContext && !contextLoading) {
      loadPersonalizedRecommendations()
    }
  }, [searchContext, contextLoading])

  const loadPersonalizedRecommendations = async () => {
    if (!searchContext) return
    
    setIsLoadingRecommendations(true)
    try {
      const recommendations = await getPersonalizedRecommendations(searchContext, 15)
      setPersonalizedRecommendations(recommendations)
    } catch (error) {
      console.error('Failed to load personalized recommendations:', error)
    } finally {
      setIsLoadingRecommendations(false)
    }
  }

  // Auto-acquire location if nearby sorting is selected
  useEffect(() => {
    if (sortBy === 'nearby' && !selectedLocation && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setSelectedLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, name: 'Current Location' })
        },
        () => {
          // Ignore errors; nearby sorting will just not re-order
        },
        { enableHighAccuracy: true, timeout: 8000 }
      )
    }
  }, [sortBy, selectedLocation])

  // Compute distances for hubs and lists when data or location changes
  useEffect(() => {
    const compute = async () => {
      if (!selectedLocation) {
        setHubDistances({})
        setListDistances({})
        return
      }
      const hd: Record<string, number> = {}
      trendingHubs.forEach(place => {
        const lat = place.coordinates?.lat
        const lng = place.coordinates?.lng
        if (typeof lat === 'number' && typeof lng === 'number') {
          hd[place.id] = haversineKm(lat, lng, selectedLocation.lat, selectedLocation.lng)
        }
      })
      setHubDistances(hd)

      const ld: Record<string, number> = {}
      for (const list of popularLists) {
        const anyList: any = list
        const hubs: any[] = Array.isArray(anyList.hubs) ? anyList.hubs : []
        let min = Infinity
        if (anyList.location && typeof anyList.location.lat === 'number' && typeof anyList.location.lng === 'number') {
          min = Math.min(min, haversineKm(anyList.location.lat, anyList.location.lng, selectedLocation.lat, selectedLocation.lng))
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
        if (min !== Infinity) ld[list.id] = min
      }
      setListDistances(ld)
    }
    compute()
  }, [selectedLocation, trendingHubs, popularLists])

  const handleSaveList = (listId: string) => {
    setSavedLists(prev => {
      const newSet = new Set(prev)
      if (newSet.has(listId)) {
        newSet.delete(listId)
      } else {
        newSet.add(listId)
      }
      return newSet
    })
  }

  const handleHubClick = (place: Place) => {
    // Convert Place to Hub format
    const hub: Hub = {
      id: place.id,
      name: place.name,
      description: `A great place to visit in ${place.address}`,
      tags: place.tags,
      images: place.hubImage ? [place.hubImage] : [],
      location: {
        address: place.address,
        lat: place.coordinates?.lat || 37.7749,
        lng: place.coordinates?.lng || -122.4194,
      },
      googleMapsUrl: `https://www.google.com/maps/search/${encodeURIComponent(place.name + ' ' + place.address)}`,
      mainImage: place.hubImage,
      posts: place.posts,
      lists: [],
    }
    openHubModal(hub, 'discovery')
  }

  const sortOptions = [
    { key: 'relevance', label: 'Relevance' },
    { key: 'popular', label: 'Most Popular' },
    { key: 'trending', label: 'Trending Now' },
    { key: 'nearby', label: 'Closest to Location' },
  ]
  const filterOptions = [
    { key: 'coffee', label: 'Coffee' },
    { key: 'food', label: 'Food' },
    { key: 'outdoors', label: 'Outdoors' },
  ]
  const [availableTags, setAvailableTags] = useState<string[]>([])
  useEffect(() => {
    const loadTags = async () => {
      try {
        const tags = await firebaseDataService.getPopularTags(200)
        setAvailableTags(tags)
      } catch {
        setAvailableTags(['cozy','trendy','quiet','local','charming','authentic','chill'])
      }
    }
    loadTags()
  }, [])

  const [showListMenu, setShowListMenu] = useState(false)
  const [selectedListId, setSelectedListId] = useState<string | null>(null)

  // Add handlers for HubModal buttons
  const handleHubModalSave = (hub: Hub) => {
    openSaveModal(hub)
    closeHubModal()
  }

  const handleHubModalAddPost = (hub: Hub) => {
    openCreatePostModal(hub)
    closeHubModal()
  }

  const handleHubModalShare = (hub: Hub) => {
    // In a real app, this would open ShareModal
    console.log('Share hub:', hub.name)
  }

  const handleHubModalOpenList = (list: List) => {
    openListModal(list, 'hub-modal')
  }

  const handleHubModalFullScreen = (hub: Hub) => {
    openFullScreenHub(hub)
  }

  const handleListModalFullScreen = (list: List) => {
    openFullScreenList(list)
  }

  // Show loading state while context is loading
  if (contextLoading || !searchContext) {
    return (
      <div className="p-6 animate-pulse">
        <div className="h-12 bg-gray-200 rounded mb-6"></div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-8">
      <div className="mb-6">
        <form onSubmit={(e) => { e.preventDefault() }}>
          <SearchAndFilter
            placeholder="Search places, lists, or friends..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sortOptions={sortOptions}
            filterOptions={filterOptions}
            availableTags={availableTags}
            sortBy={sortBy}
            setSortBy={(key) => {
              setSortBy(key)
              if (key !== 'nearby') return
              if (!selectedLocation && 'geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                  (pos) => setSelectedLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, name: 'Current Location' }),
                  () => {},
                  { enableHighAccuracy: true, timeout: 8000 }
                )
              }
            }}
            activeFilters={activeFilters}
            setActiveFilters={setActiveFilters}
            dropdownPosition="top-right"
            onSubmitQuery={() => { /* in-place filtering */ }}
            distanceKm={maxDistanceKm}
            setDistanceKm={setMaxDistanceKm}
          />
        </form>
      </div>

      {/* Suggested for you */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <SparklesIcon className="w-6 h-6 text-sage-600" />
          <h2 className="text-xl font-serif font-semibold text-charcoal-800">Suggested for you</h2>
        </div>
        {isLoadingSuggestions ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600"></div>
            <p className="mt-2 text-sm text-charcoal-600">Finding great places near you…</p>
          </div>
        ) : suggestedPlaces.length === 0 ? (
          <p className="text-center py-8 text-charcoal-600">No suggestions yet. Start exploring to personalize recommendations.</p>
        ) : (
          <div className="space-y-3">
            {(() => {
              const loc = selectedLocation
              const maxKmDefault = maxDistanceKm ?? (() => {
                const miles = (searchContext as any)?.userPreferences?.locationPreferences?.nearbyRadius
                return typeof miles === 'number' && miles > 0 ? miles * 1.60934 : 80
              })()
              const toRad = (v: number) => (v * Math.PI) / 180
              const withinDefault = (p: Place) => {
                if (!loc) return true
                const lat = p.coordinates?.lat
                const lng = p.coordinates?.lng
                if (typeof lat !== 'number' || typeof lng !== 'number') return false
                const R = 6371
                const dLat = toRad(lat - loc.lat)
                const dLon = toRad(lng - loc.lng)
                const a = Math.sin(dLat/2)**2 + Math.cos(toRad(loc.lat)) * Math.cos(toRad(lat)) * Math.sin(dLon/2)**2
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
                return (R * c) <= maxKmDefault
              }
              const places = suggestedPlaces.filter(withinDefault).slice(0, 6)
              return places.map((place) => (
                <button
                  key={place.id}
                  onClick={() => handleHubClick(place)}
                  className="w-full bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-linen-200 hover:shadow-cozy transition-all duration-300 text-left"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-charcoal-800 mb-1">{place.name}</h3>
                      {place.address && (
                        <div className="flex items-center text-charcoal-600 text-sm mb-2">
                          <MapPinIcon className="w-4 h-4 mr-1" />
                          {place.address}
                        </div>
                      )}
                      {!!(place.tags && place.tags.length) && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {place.tags.slice(0, 3).map((tag) => (
                            <TagPill key={tag} label={tag} size="sm" />
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="p-2 rounded-full bg-sage-50 text-sage-600">
                      <BookmarkIcon className="w-4 h-4" />
                    </div>
                  </div>
                </button>
              ))
            })()}
          </div>
        )}
      </div>

      {/* AI-Powered Personalized Recommendations */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <SparklesIcon className="w-6 h-6 text-purple-500" />
          <h2 className="text-xl font-serif font-semibold text-charcoal-800">AI Recommendations</h2>
          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
            Just for You
          </span>
        </div>
        
        {isLoadingRecommendations ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
            <span className="ml-3 text-charcoal-600">Analyzing your preferences...</span>
          </div>
        ) : personalizedRecommendations.length > 0 ? (
          <div className="space-y-3">
            {personalizedRecommendations.slice(0, 6).map((rec, index) => (
              <div
                key={`${rec.type}-${rec.item.id}-${index}`}
                className="bg-gradient-to-r from-purple-50 to-purple-100 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-purple-200 hover:shadow-cozy transition-all duration-300"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-charcoal-800">{rec.item.name}</h3>
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                        rec.algorithm === 'collaborative' ? 'bg-blue-100 text-blue-700' :
                        rec.algorithm === 'content_based' ? 'bg-green-100 text-green-700' :
                        rec.algorithm === 'social' ? 'bg-orange-100 text-orange-700' :
                        rec.algorithm === 'trending' ? 'bg-red-100 text-red-700' :
                        rec.algorithm === 'location' ? 'bg-teal-100 text-teal-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {rec.algorithm ? rec.algorithm.replace('_', ' ') : 'Unknown'}
                      </span>
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full font-medium">
                        {Math.round((rec.confidence || 0) * 100)}% match
                      </span>
                    </div>
                    
                    <p className="text-charcoal-600 text-sm mb-2">
                      {'address' in rec.item ? rec.item.address : rec.item.description}
                    </p>

                    {rec.type === 'place' && 'tags' in rec.item && rec.item.tags && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {rec.item.tags.slice(0, 3).map((tag: string) => (
                          <span
                            key={tag}
                            className="px-2 py-1 bg-purple-200 text-purple-700 text-xs rounded-full"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="text-xs text-purple-600 space-y-1">
                      <div className="font-medium">Why we think you'll love this:</div>
                      <div>{rec.reasons ? rec.reasons.join(' • ') : 'No reasons available'}</div>
                      <div className="text-purple-500">
                        Expected rating: {rec.metadata.expectedPreference ? `${rec.metadata.expectedPreference.toFixed(1)}/5 ⭐` : 'High'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center gap-2 ml-4">
                    <button 
                      onClick={() => {
                        if (rec.type === 'place') {
                          // Convert to hub and open
                          const hub: Hub = {
                            id: rec.item.id,
                            name: rec.item.name,
                            description: `A place you might love`,
                            tags: 'tags' in rec.item ? rec.item.tags : [],
                            images: [],
                            location: {
                              address: 'address' in rec.item ? rec.item.address : '',
                              lat: 37.7749,
                              lng: -122.4194,
                            },
                            googleMapsUrl: `https://www.google.com/maps/search/${encodeURIComponent(rec.item.name)}`,
                            mainImage: 'mainImage' in rec.item ? (rec.item as any).mainImage : undefined,
                            posts: 'posts' in rec.item ? rec.item.posts : [],
                            lists: [],
                          }
                          openHubModal(hub, 'discovery')
                        } else {
                          // It's a list
                          openListModal(rec.item as List, 'discovery')
                        }
                      }}
                      className="p-2 rounded-full bg-purple-200/50 text-purple-600 hover:bg-purple-200 transition"
                      title="View details"
                    >
                      <BookmarkIcon className="w-4 h-4" />
                    </button>
                    <div className="text-xs text-purple-600 text-center">
                      {rec.type}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <SparklesIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-charcoal-600">No personalized recommendations yet</p>
            <p className="text-charcoal-500 text-sm mt-1">Start exploring places to get better recommendations!</p>
          </div>
        )}
      </div>

      {/* Trending Hubs */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <FireIcon className="w-6 h-6 text-gold-500" />
          <h2 className="text-xl font-serif font-semibold text-charcoal-800">For You</h2>
        </div>
        <div className="space-y-3">
          {isLoadingTrending ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600"></div>
              <p className="mt-2 text-sm text-charcoal-600">Loading places…</p>
            </div>
          ) : (() => {
            const q = searchQuery.trim().toLowerCase()
            let filtered = q
              ? trendingHubs.filter(p => (
                  (p.name || '').toLowerCase().includes(q) ||
                  (p.address || '').toLowerCase().includes(q) ||
                  (p.tags || []).some(t => t.toLowerCase().includes(q))
                ))
              : trendingHubs
            if (sortBy === 'relevance') {
              const q = searchQuery.trim().toLowerCase()
              const score = (p: Place) => {
                let s = 0
                const name = (p.name||'').toLowerCase()
                const addr = (p.address||'').toLowerCase()
                const tags = (p.tags||[]).map(t=>t.toLowerCase())
                if (q) { if (name.includes(q)) s+=4; if (addr.includes(q)) s+=2; if (tags.some(t=>t.includes(q))) s+=3 }
                return s + (p.savedCount||0)
              }
              if (selectedLocation) {
                filtered = filtered.filter(p => {
                  const lat = p.coordinates?.lat
                  const lng = p.coordinates?.lng
                  if (typeof lat !== 'number' || typeof lng !== 'number') return false
                  const R=6371; const toRad=(v:number)=>v*Math.PI/180
                  const dLat=toRad(lat-selectedLocation.lat); const dLon=toRad(lng-selectedLocation.lng)
                  const a=Math.sin(dLat/2)**2+Math.cos(toRad(selectedLocation.lat))*Math.cos(toRad(lat))*Math.sin(dLon/2)**2
                  const c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
                  return (R*c) <= (maxDistanceKm??80)
                })
              }
              filtered = [...filtered].sort((a,b)=>score(b)-score(a))
            } else if (sortBy === 'nearby' && selectedLocation) {
              filtered = [...filtered].sort((a, b) => {
                const da = hubDistances[a.id] ?? Number.MAX_VALUE
                const db = hubDistances[b.id] ?? Number.MAX_VALUE
                return da - db
              })
            }
            if (filtered.length === 0) {
              return (
                <p className="text-center py-8 text-charcoal-600">No places to show yet.</p>
              )
            }
            return (
              filtered.map((place) => (
                <button
                  key={place.id}
                  onClick={() => handleHubClick(place)}
                  className="w-full bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-linen-200 hover:shadow-cozy transition-all duration-300 text-left"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-charcoal-800 mb-1">{place.name}</h3>
                      <div className="flex items-center text-charcoal-600 text-sm mb-2">
                        <MapPinIcon className="w-4 h-4 mr-1" />
                        {place.address}
                      </div>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {place.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-1 bg-sage-100 text-sage-700 text-xs rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      {/* popularity indicator hidden per UX feedback */}
                    </div>
                    <div className="p-2 rounded-full bg-sage-50 text-sage-600">
                      <BookmarkIcon className="w-4 h-4" />
                    </div>
                  </div>
                </button>
              ))
            )
          })()}
        </div>
      </div>

      {/* Popular Lists */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <StarIcon className="w-6 h-6 text-gold-500" />
          <h2 className="text-xl font-serif font-semibold text-charcoal-800">Popular Lists</h2>
        </div>
        <div className="space-y-4">
          {isLoadingTrending ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600"></div>
              <p className="mt-2 text-sm text-charcoal-600">Loading popular lists...</p>
            </div>
          ) : (() => {
            const q = searchQuery.trim().toLowerCase()
            let filtered = q
              ? popularLists.filter(l => (
                  (l.name || '').toLowerCase().includes(q) ||
                  (l.description || '').toLowerCase().includes(q) ||
                  (l.tags || []).some(t => t.toLowerCase().includes(q))
                ))
              : popularLists
            if (sortBy === 'relevance') {
              const q = searchQuery.trim().toLowerCase()
              const score = (l: List) => {
                let s = 0
                const name = (l.name||'').toLowerCase()
                const desc = (l.description||'').toLowerCase()
                const tags = (l.tags||[]).map(t=>t.toLowerCase())
                if (q) { if (name.includes(q)) s+=4; if (desc.includes(q)) s+=2; if (tags.some(t=>t.includes(q))) s+=3 }
                return s + (l.likes||0)
              }
              filtered = [...filtered].sort((a,b)=>score(b)-score(a))
            } else if (sortBy === 'nearby' && selectedLocation) {
              filtered = [...filtered].sort((a, b) => {
                const da = listDistances[a.id] ?? Number.MAX_VALUE
                const db = listDistances[b.id] ?? Number.MAX_VALUE
                return da - db
              })
            }
            if (filtered.length === 0) {
              return <p className="text-center py-8 text-charcoal-600">No popular lists yet.</p>
            }
            return (
              filtered.map((list) => (
                <div
                  key={list.id}
                  className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-soft border border-linen-200 overflow-hidden hover:shadow-cozy transition-all duration-300"
                >
                  <div className="flex">
                    {list.coverImage && (
                      <div className="w-24 h-24 bg-linen-100 flex-shrink-0">
                        <img src={list.coverImage} alt={list.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 p-4 flex flex-col justify-between">
                      <div>
                        <h3 className="font-serif font-semibold text-lg text-charcoal-700 mb-1">{list.name}</h3>
                        <p className="text-sm text-charcoal-500 mb-2 leading-relaxed">{list.description}</p>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {list.tags.map(tag => (
                            <TagPill key={tag} label={tag} size="sm" />
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-charcoal-500">
                          <span>{list.likes} likes</span>
                          <span>•</span>
                          <span>Updated {formatTimestamp(list.updatedAt)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleSaveList(list.id)}
                            className={`p-2 rounded-full transition ${
                              savedLists.has(list.id) 
                                ? 'bg-sage-100 text-sage-700' 
                                : 'bg-sage-50 text-sage-600 hover:bg-sage-100'
                            }`}
                          >
                            <BookmarkIcon className={`w-4 h-4 ${savedLists.has(list.id) ? 'fill-current' : ''}`} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedListId(list.id)
                              setShowListMenu(true)
                            }}
                            className="p-2 rounded-full bg-linen-100 text-charcoal-600 hover:bg-linen-200 transition"
                          >
                            <EllipsisHorizontalIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )
          })()}
        </div>
      </div>

      {/* Hub Modal */}
      {showHubModal && selectedHub && (
        <HubModal
          hub={selectedHub}
          isOpen={showHubModal}
          onClose={closeHubModal}
          onSave={handleHubModalSave}
          onAddPost={handleHubModalAddPost}
          onShare={handleHubModalShare}
          onOpenFullScreen={handleHubModalFullScreen}
          onOpenList={handleHubModalOpenList}
          showBackButton={hubModalFromList}
          onBack={goBackFromHubModal}
        />
      )}

      {/* List Modal */}
      {showListModal && selectedList && (
        <ListModal
          list={selectedList}
          isOpen={showListModal}
          onClose={closeListModal}
          onSave={(list) => {
            openSaveModal(undefined, list)
            closeListModal()
          }}
          onAddPost={(list) => {
            openCreatePostModal(undefined, list)
            closeListModal()
          }}
          onShare={(list) => console.log('Share list:', list.name)}
          onOpenFullScreen={handleListModalFullScreen}
          onOpenHub={(place) => {
            const hub: Hub = {
              id: place.id,
              name: place.name,
              description: `A great place to visit`,
              tags: place.tags,
              images: [],
              location: {
                address: place.address,
                lat: 37.7749,
                lng: -122.4194,
              },
              googleMapsUrl: `https://www.google.com/maps/search/${encodeURIComponent(place.name)}`,
              mainImage: place.hubImage,
              posts: place.posts,
              lists: [],
            }
            openHubModal(hub, 'list-modal')
          }}
          showBackButton={false}
        />
      )}

      {/* List Menu Dropdown */}
      <ListMenuDropdown
        isOpen={showListMenu}
        onClose={() => {
          setShowListMenu(false)
          setSelectedListId(null)
        }}
        onEditList={() => {
          console.log('Edit list:', selectedListId)
          // TODO: Implement edit list functionality
        }}
        onChangePrivacy={() => {
          console.log('Toggle privacy for list:', selectedListId)
          // TODO: Implement privacy toggle
        }}
        onDeleteList={() => {
          console.log('Delete list:', selectedListId)
          // TODO: Implement delete functionality
        }}
        isPublic={true}
        isOwner={false}
      />
    </div>
  )
}

export default DiscoveryTab 