import { useState, useEffect } from 'react'
import { MapPinIcon, HeartIcon, UserIcon, ClockIcon, FireIcon, BookmarkIcon, PlusIcon, FunnelIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { useSearchParams } from 'react-router-dom'

import SearchAndFilter from '../components/SearchAndFilter'
import HubModal from '../components/HubModal'
import ListModal from '../components/ListModal'
import SaveModal from '../components/SaveModal'
import LocationSelectModal from '../components/LocationSelectModal'
import CreatePost from '../components/CreatePost'
import ProfileModal from '../components/ProfileModal'
import type { Hub, Place, List, User } from '../types/index.js'
import { useNavigation } from '../contexts/NavigationContext.tsx'
import { 
  searchIntelligently, 
  getPersonalizedRecommendations,
  type SearchContext,
  type IntelligentSearchResult,
  type DiscoveryRecommendation 
} from '../utils/intelligentSearchService.js'
import { firebaseDataService } from '../services/firebaseDataService.js'

const allData = {
  places: [
    {
      id: '1',
      name: 'Blue Bottle Coffee',
      address: '300 Webster St, Oakland, CA',
      tags: ['coffee', 'cozy', 'work-friendly'],
      posts: [],
      savedCount: 45,
      createdAt: '2024-01-15'
    },
    {
      id: '2',
      name: 'Tacos El Gordo',
      address: '123 Mission St, San Francisco, CA',
      tags: ['tacos', 'authentic', 'quick'],
      posts: [],
      savedCount: 23,
      createdAt: '2024-01-14'
    },
    {
      id: '3',
      name: 'Starbucks Reserve',
      address: '456 Market St, San Francisco, CA',
      tags: ['coffee', 'premium', 'cozy'],
      posts: [],
      savedCount: 67,
      createdAt: '2024-01-13'
    },
    {
      id: '4',
      name: 'Philz Coffee',
      address: '789 Castro St, San Francisco, CA',
      tags: ['coffee', 'artisan', 'cozy'],
      posts: [],
      savedCount: 34,
      createdAt: '2024-01-12'
    }
  ],
  lists: [
    {
      id: '1',
      name: 'Cozy Coffee Spots',
      description: 'Perfect places to work and relax',
      userId: '1',
      isPublic: true,
      isShared: false,
      tags: ['coffee', 'work-friendly', 'cozy'],
      places: [],
      createdAt: '2024-01-10',
      updatedAt: '2024-01-15',
      likes: 120,
      savedCount: 50
    },
    {
      id: '2',
      name: 'Best Tacos in SF',
      description: 'Authentic Mexican food spots',
      userId: '2',
      isPublic: true,
      isShared: false,
      tags: ['tacos', 'authentic', 'mexican'],
      places: [],
      createdAt: '2024-01-11',
      updatedAt: '2024-01-14',
      likes: 80,
      savedCount: 30
    }
  ],
  users: [
    {
      id: '1',
      name: 'Sara Chen',
      username: 'sara.chen',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      bio: 'Finding cozy spots and sharing them with friends ✨',
      location: 'San Francisco, CA',
      tags: ['cozy', 'coffee', 'foodie', 'local']
    },
    {
      id: '2',
      name: 'Mike Johnson',
      username: 'mike.j',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
      bio: 'Coffee enthusiast and food lover',
      location: 'Oakland, CA',
      tags: ['coffee', 'artisan', 'tacos', 'authentic']
    }
  ]
}

const Search = () => {
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
    openFullScreenList,
    openFullScreenUser
  } = useNavigation()
  const [searchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'places' | 'lists' | 'users'>('all')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showSearchHistory, setShowSearchHistory] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [sortBy, setSortBy] = useState('popular')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [showMap, setShowMap] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [showCreatePost, setShowCreatePost] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<{ id: string; name: string; address: string; coordinates: { lat: number; lng: number } } | null>(null)
  const [likedLists, setLikedLists] = useState<Set<string>>(new Set())
  const [savedLists, setSavedLists] = useState<Set<string>>(new Set())
  const [likedPlaces, setLikedPlaces] = useState<Set<string>>(new Set())
  const [savedPlaces, setSavedPlaces] = useState<Set<string>>(new Set())
  const [followingUsers, setFollowingUsers] = useState<Set<string>>(new Set())
  const [userLists, setUserLists] = useState(allData.lists)
  const [createPostListId, setCreatePostListId] = useState<string | null>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [intelligentResults, setIntelligentResults] = useState<IntelligentSearchResult | null>(null)
  const [discoveries, setDiscoveries] = useState<DiscoveryRecommendation[]>([])
  const [useIntelligentSearch, setUseIntelligentSearch] = useState(true)

  // Debug log to help identify issues
  console.log('Search component loaded, useIntelligentSearch:', useIntelligentSearch)

  // Mock current user for search context
  const currentUser: User = {
    id: 'current-user',
    name: 'You',
    username: 'current_user',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
    bio: 'Love discovering cozy coffee spots and authentic food',
    location: 'San Francisco, CA',
    tags: ['coffee', 'cozy', 'authentic', 'local', 'foodie']
  }

  // State for Firebase search context
  const [searchContext, setSearchContext] = useState<SearchContext | null>(null)
  const [contextLoading, setContextLoading] = useState(true)

  // Build search context using Firebase
  useEffect(() => {
    const buildFirebaseContext = async () => {
      try {
        setContextLoading(true)
        
        // For demo purposes, use the mock current user ID
        // In a real app, this would come from authentication context
        const userId = currentUser.id
        
        const firebaseContext = await firebaseDataService.buildSearchContext(userId)
        setSearchContext(firebaseContext)
      } catch (error) {
        console.error('Error building search context:', error)
        // No fallback - require real Firebase data
        setSearchContext(null)
      } finally {
        setContextLoading(false)
      }
    }

    buildFirebaseContext()
  }, [currentUser.id])

  // Handle URL parameters for tag filtering (MOVED BEFORE EARLY RETURN)
  useEffect(() => {
    const tag = searchParams.get('tag')
    if (tag && !selectedTags.includes(tag)) {
      setSelectedTags([tag])
      setSearchQuery(`#${tag}`)
      setIsSearching(true)
    }
  }, [searchParams, selectedTags])

  // Load personalized discoveries on mount (MOVED BEFORE EARLY RETURN)
  useEffect(() => {
    if (searchContext && !contextLoading) {
      loadDiscoveries()
    }
  }, [searchContext, contextLoading])

  // Early return if context is still loading (AFTER ALL HOOKS)
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

  const loadDiscoveries = async () => {
    try {
      const recs = await getPersonalizedRecommendations(searchContext, 10)
      setDiscoveries(recs)
    } catch (error) {
      console.error('Failed to load discoveries:', error)
    }
  }


  // Mock data
  const searchHistory = [
    'Blue Bottle Coffee',
    'cozy coffee spots',
    'tacos el gordo',
    'work-friendly cafes',
    'sara chen'
  ]

  const trendyHashtags = [
    { tag: '#coffee', count: '2.3k' },
    { tag: '#cozy', count: '1.8k' },
    { tag: '#oakland', count: '1.5k' },
    { tag: '#workfriendly', count: '1.2k' },
    { tag: '#tacos', count: '980' },
    { tag: '#authentic', count: '850' },
    { tag: '#scenic', count: '720' },
    { tag: '#quick', count: '650' }
  ]

  const sortOptions = [
    { key: 'popular', label: 'Most Popular' },
    { key: 'recent', label: 'Most Recent' },
    { key: 'nearby', label: 'Closest to Location' },
  ]

  const filterOptions = [
    { key: 'coffee', label: 'Coffee' },
    { key: 'food', label: 'Food' },
    { key: 'work-friendly', label: 'Work-Friendly' },
  ]

  const availableTags = ['coffee', 'cozy', 'work-friendly', 'tacos', 'authentic', 'quick', 'outdoors', 'scenic']

  // Filter data based on search query
  const getFilteredResults = () => {
    if (!searchQuery.trim()) {
      return {
        ...allData,
        lists: userLists
      }
    }

    const query = searchQuery.toLowerCase()
    return {
      places: allData.places.filter(place => 
        place.name.toLowerCase().includes(query) ||
        place.address.toLowerCase().includes(query) ||
        place.tags.some(tag => tag.toLowerCase().includes(query))
      ),
      lists: userLists.filter(list => 
        list.name.toLowerCase().includes(query) ||
        list.description.toLowerCase().includes(query) ||
        (list.tags && list.tags.some(tag => tag.toLowerCase().includes(query)))
      ),
      users: allData.users.filter(user => 
        user.name.toLowerCase().includes(query) ||
        user.username.toLowerCase().includes(query) ||
        user.bio.toLowerCase().includes(query) ||
        user.location.toLowerCase().includes(query) ||
        (user.tags && user.tags.some(tag => tag.toLowerCase().includes(query)))
      )
    }
  }

  const searchResults = getFilteredResults()
  
  // Use intelligent results if available, otherwise fall back to basic results
  const displayResults = intelligentResults || {
    places: searchResults.places.map(place => ({
      item: place,
      score: 75,
      reasons: ['Basic search match'],
      category: 'semantic_match' as const
    })),
    lists: searchResults.lists.map(list => ({
      item: list,
      score: 75,
      reasons: ['Basic search match'],
      category: 'semantic_match' as const
    })),
    users: searchResults.users.map(user => ({
      item: user,
      score: 75,
      reasons: ['Basic search match'],
      category: 'semantic_match' as const
    })),
    posts: []
  }

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  const handleSearchHistoryClick = (query: string) => {
    setSearchQuery(query)
    setShowSearchHistory(false)
    setIsSearching(true)
  }

  const handleHashtagClick = (hashtag: string) => {
    // Remove the # symbol and add to selected tags
    const tag = hashtag.replace('#', '')
    if (!selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag])
    }
    // Set search query to the hashtag
    setSearchQuery(hashtag)
  }

  const handleTagClick = (tag: string) => {
    // Toggle tag in selected tags
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag))
    } else {
      setSelectedTags([...selectedTags, tag])
    }
  }

  const handleSearchInputFocus = () => {
    if (searchQuery === '') {
      setShowSearchHistory(true)
    }
  }

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    if (e.target.value === '') {
      setShowSearchHistory(true)
      setIsSearching(false)
      setIntelligentResults(null)
    } else {
      setShowSearchHistory(false)
      setIsSearching(true)
      // Trigger intelligent search with debouncing
      if (useIntelligentSearch) {
        performIntelligentSearch(e.target.value)
      }
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      setShowSearchHistory(false)
      setIsSearching(true)
      // Add to search history (in a real app, this would be persisted)
      if (!searchHistory.includes(searchQuery)) {
        searchHistory.unshift(searchQuery)
        if (searchHistory.length > 10) {
          searchHistory.pop()
        }
      }
      
      if (useIntelligentSearch) {
        performIntelligentSearch(searchQuery)
      }
    }
  }

  const performIntelligentSearch = async (query: string) => {
    try {
      // Track search interaction
      await firebaseDataService.trackUserInteraction(
        currentUser.id,
        'search',
        { query }
      )

      const results = await searchIntelligently(
        query,
        searchContext,
        {}, // No filters for now
        {
          maxResults: 20,
          includeDiscovery: query.length < 3,
          algorithms: {
            enableNLP: true,
            enableCollaborative: true,
            enableContentBased: true,
            enableSocial: true,
            enableLocation: true,
            enableTrending: true
          }
        }
      )

      // Map the current data to intelligent results format
      const enhancedResults: IntelligentSearchResult = {
        ...results,
        places: getFilteredResults().places.map(place => ({
          item: place,
          score: 85 + Math.random() * 15,
          reasons: generatePlaceReasons(place, query),
          category: determineResultCategory(place, query)
        })),
        lists: getFilteredResults().lists.map(list => ({
          item: list,
          score: 80 + Math.random() * 20,
          reasons: generateListReasons(list, query),
          category: determineListCategory(list, query)
        })),
        users: getFilteredResults().users.map(user => ({
          item: user,
          score: 90 + Math.random() * 10,
          reasons: generateUserReasons(user, query),
          category: 'exact_match' as const
        })),
        posts: []
      }

      setIntelligentResults(enhancedResults)
    } catch (error) {
      console.error('Intelligent search failed:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const generatePlaceReasons = (place: Place, query: string): string[] => {
    const reasons: string[] = []
    const lowerQuery = query.toLowerCase()
    
    if (place.name.toLowerCase().includes(lowerQuery)) {
      reasons.push('Exact name match')
    }
    
    if (place.tags.some(tag => lowerQuery.includes(tag))) {
      const matchingTags = place.tags.filter(tag => lowerQuery.includes(tag))
      reasons.push(`Matches your search: ${matchingTags.join(', ')}`)
    }
    
    if (place.savedCount > 50) {
      reasons.push('Popular destination')
    }
    
    if (currentUser.tags?.some(tag => place.tags.includes(tag))) {
      reasons.push('Matches your interests')
    }
    
    return reasons.length > 0 ? reasons : ['Semantic match']
  }

  const generateListReasons = (list: List, query: string): string[] => {
    const reasons: string[] = []
    const lowerQuery = query.toLowerCase()
    
    if (lowerQuery.includes('sara') && list.userId === '1') {
      reasons.push('Sara\'s curated list')
    }
    
    if (lowerQuery.includes('mike') && list.userId === '2') {
      reasons.push('Mike\'s recommendations')
    }
    
    if (list.tags.some(tag => lowerQuery.includes(tag))) {
      reasons.push('Matches search intent')
    }
    
    if (list.likes > 20) {
      reasons.push('Highly rated')
    }
    
    return reasons.length > 0 ? reasons : ['Content match']
  }

  const generateUserReasons = (user: User, query: string): string[] => {
    const reasons: string[] = []
    const lowerQuery = query.toLowerCase()
    
    if (user.name.toLowerCase().includes(lowerQuery)) {
      reasons.push('Name match')
    }
    
    if (user.username.toLowerCase().includes(lowerQuery)) {
      reasons.push('Username match')
    }
    
    reasons.push('In your network')
    return reasons
  }

  const determineResultCategory = (place: Place, query: string): 'exact_match' | 'semantic_match' | 'user_connection' | 'trending' | 'personalized' => {
    if (place.name.toLowerCase().includes(query.toLowerCase())) return 'exact_match'
    if (currentUser.tags?.some(tag => place.tags.includes(tag))) return 'personalized'
    if (place.savedCount > 50) return 'trending'
    return 'semantic_match'
  }

  const determineListCategory = (list: List, query: string): 'exact_match' | 'semantic_match' | 'user_connection' | 'trending' | 'personalized' => {
    const lowerQuery = query.toLowerCase()
    if (lowerQuery.includes('sara') || lowerQuery.includes('mike')) return 'user_connection'
    if (list.likes > 20) return 'trending'
    return 'semantic_match'
  }

  const clearSearch = () => {
    setSearchQuery('')
    setShowSearchHistory(true)
    setIsSearching(false)
  }

  const handleSaveToPlace = (place: Place) => {
    setSelectedPlace(place)
    setShowSaveModal(true)
  }

  const handleSave = (status: 'loved' | 'tried' | 'want', rating?: 'liked' | 'neutral' | 'disliked', listIds?: string[], note?: string) => {
    // In a real app, this would save the place with the selected status
    console.log('Saving place:', { 
      place: selectedPlace, 
      status, 
      rating, 
      listIds, 
      note,
      // Auto-save to appropriate "All" list
      autoSaveToList: `All ${status.charAt(0).toUpperCase() + status.slice(1)}`
    })
    // You could also show a success toast here
  }

  const handleCreateList = (listData: { name: string; description: string; privacy: 'public' | 'private' | 'friends'; tags?: string[]; coverImage?: string }) => {
    setUserLists(prev => [...prev, listData])
  }

  const handleLocationSelect = (location: { id: string; name: string; address: string; coordinates: { lat: number; lng: number } }) => {
    setSelectedLocation(location)
    setSortBy('nearby') // Set the sort to nearby
    setShowLocationModal(false)
    // In a real app, you would filter/sort based on this location
    console.log('Selected location for sorting:', location)
  }

  const handleSortByChange = (newSortBy: string) => {
    if (newSortBy === 'nearby') {
      setShowLocationModal(true)
    } else {
      setSortBy(newSortBy)
    }
  }

  const handlePlaceClick = (place: Place) => {
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
    openHubModal(hub, 'search')
  }

  const handleListClick = (list: List) => {
    openListModal(list, 'search')
  }

  const handleCreatePost = (listId?: string) => {
    setCreatePostListId(listId || null)
    setShowCreatePost(true)
  }

  const handleFollowUser = (userId: string) => {
    setFollowingUsers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(userId)) {
        newSet.delete(userId)
      } else {
        newSet.add(userId)
      }
      return newSet
    })
  }

  const handleUserClick = (user: User) => {
    setSelectedUser(user)
    setShowProfileModal(true)
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

  // Add handlers for HubModal and ListModal buttons
  const handleHubModalSave = (hub: Hub) => {
    // Convert hub to place and open save modal
    const place: Place = {
      id: hub.id,
      name: hub.name,
      address: hub.location.address,
      tags: hub.tags,
      posts: hub.posts,
      savedCount: 0,
      createdAt: new Date().toISOString()
    }
    setSelectedPlace(place)
    setShowSaveModal(true)
  }

  const handleHubModalAddPost = (hub: Hub) => {
    // Convert hub to the format expected by CreatePost
    const createPostHub = {
      id: hub.id,
      name: hub.name,
      address: hub.location.address,
      description: hub.description,
      lat: hub.location.lat,
      lng: hub.location.lng,
    }
    handleCreatePost(undefined, createPostHub)
  }

  const handleHubModalShare = (hub: Hub) => {
    // In a real app, this would open a share modal
    console.log('Sharing hub:', hub.name)
  }

  const handleListModalSave = (list: List) => {
    // For lists, we might want to save the list itself or create a copy
    console.log('Saving list:', list.name)
    // You could implement list saving functionality here
  }

  const handleListModalAddPost = (list: List) => {
    handleCreatePost(list.id)
  }

  const handleListModalShare = (list: List) => {
    // In a real app, this would open a share modal
    console.log('Sharing list:', list.name)
  }

  const handleListModalOpenHub = (place: Place) => {
    // Convert place to hub and open hub modal
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
  }

  return (
    <div className="relative min-h-full overflow-x-hidden bg-linen-50">
      {/* Enhanced background: linen texture, sunlight gradient, vignette */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-linen-texture opacity-80 mix-blend-multiply"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-gold-50/60 via-linen-100/80 to-sage-100/70 opacity-80"></div>
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-charcoal-900/10"></div>
      </div>

      {/* Header with Search Bar */}
      <div className="relative z-10 bg-white/90 backdrop-blur-glass border-b border-linen-200 px-6 py-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 flex items-center gap-2">
            <SearchAndFilter
              placeholder="Search places, lists, or people..."
              showBackButton={showSearchHistory}
              onBackClick={() => setShowSearchHistory(false)}
              showFilter={true}
              value={searchQuery}
              onChange={handleSearchInputChange}
              onFocus={handleSearchInputFocus}
              onSubmit={handleSearchSubmit}
              sortOptions={sortOptions}
              filterOptions={filterOptions}
              availableTags={availableTags}
              sortBy={sortBy}
              setSortBy={handleSortByChange}
              activeFilters={activeFilters}
              setActiveFilters={setActiveFilters}
              onLocationSelect={handleLocationSelect}
              dropdownPosition="top-right"
            />
          </div>
          <button
            className="ml-2 px-4 py-2 rounded-full bg-gradient-to-r from-sage-400 to-gold-300 text-white font-semibold shadow-botanical hover:shadow-cozy transition-all duration-300"
            onClick={() => setShowMap(true)}
          >
            Map
          </button>
          <button
            onClick={() => setUseIntelligentSearch(!useIntelligentSearch)}
            className={`ml-2 px-4 py-2 rounded-full font-semibold shadow-botanical transition-all duration-300 flex items-center gap-2 ${
              useIntelligentSearch 
                ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700' 
                : 'bg-white/70 text-charcoal-700 hover:bg-white/90'
            }`}
            title={useIntelligentSearch ? 'Using AI Search' : 'Using Basic Search'}
          >
            <SparklesIcon className="w-4 h-4" />
            {useIntelligentSearch ? 'AI' : 'Basic'}
          </button>
        </div>
      </div>
      {showMap && (
        <div className="fixed inset-0 z-30 bg-black/40 flex flex-col">
          <div className="bg-white/95 p-4 shadow-botanical flex items-center gap-2">
            <form className="flex-1 relative">
              <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-charcoal-600 pointer-events-none z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search hubs on map..."
                value={searchQuery}
                onChange={handleSearchInputChange}
                className="w-full pl-12 pr-4 py-2 rounded-full border border-linen-200 bg-linen-50 text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200 shadow-soft"
              />
            </form>
            <button className="p-2 rounded-full bg-white border border-linen-200 shadow-soft hover:bg-linen-100 transition">
              <FunnelIcon className="w-5 h-5 text-sage-400" />
            </button>
            <button className="ml-2 px-4 py-2 rounded-full bg-sage-400 text-white font-semibold shadow-soft hover:bg-sage-500 transition" onClick={() => setShowMap(false)}>
              Close
            </button>
          </div>
          <div className="flex-1 bg-gray-200 flex items-center justify-center">
            {/* TODO: Map with hubs and user location */}
            <span className="text-sage-700 text-lg">[Map goes here]</span>
          </div>
        </div>
      )}



      {/* Search History */}
      {showSearchHistory && searchHistory.length > 0 && (
        <div className="relative z-10 bg-white/90 backdrop-blur-sm border-b border-linen-200 px-6 py-4">
          <div className="flex items-center space-x-2 mb-3">
            <ClockIcon className="w-4 h-4 text-sage-600" />
            <span className="text-sm font-medium text-charcoal-800">Recent Searches</span>
          </div>
          <div className="space-y-2">
            {searchHistory.map((query, index) => (
              <button
                key={index}
                onClick={() => handleSearchHistoryClick(query)}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-linen-50 transition-colors text-charcoal-700 hover:text-charcoal-800"
              >
                {query}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Trendy Hashtags */}
      {showSearchHistory && (
        <div className="relative z-10 bg-white/90 backdrop-blur-sm border-b border-linen-200 px-6 py-4">
          <div className="flex items-center space-x-2 mb-3">
            <FireIcon className="w-4 h-4 text-gold-600" />
            <span className="text-sm font-medium text-charcoal-800">Trending</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {trendyHashtags.map((item, index) => (
              <button
                key={index}
                onClick={() => handleHashtagClick(item.tag)}
                className="px-3 py-2 bg-gradient-to-r from-gold-100 to-gold-200 text-gold-700 rounded-xl text-sm font-medium hover:from-gold-200 hover:to-gold-300 transition-all duration-300 shadow-soft"
              >
                {item.tag}
                <span className="ml-1 text-xs opacity-70">({item.count})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Results or Filters */}
      {!showSearchHistory && (
        <div className="relative z-10 p-4 space-y-4">
          {/* Search Status */}
          {isSearching && (
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-linen-200">
              <div className="flex items-center justify-between">
                <span className="text-charcoal-700 flex items-center gap-2">
                  {useIntelligentSearch && <SparklesIcon className="w-4 h-4 text-purple-600" />}
                  {searchQuery ? `${useIntelligentSearch ? 'AI ' : ''}Searching for "${searchQuery}"` : 'Showing all results'}
                </span>
                <button
                  onClick={clearSearch}
                  className="text-sage-600 hover:text-sage-700 text-sm font-medium transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* AI Query Analysis */}
          {useIntelligentSearch && intelligentResults && (
            <div className="bg-gradient-to-r from-purple-50 to-purple-100 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-purple-200">
              <h3 className="text-lg font-serif font-semibold text-purple-800 mb-3 flex items-center gap-2">
                <SparklesIcon className="w-5 h-5" />
                AI Analysis
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-purple-700">Intent:</span>
                  <p className="text-purple-600">{intelligentResults.query.intent}</p>
                </div>
                <div>
                  <span className="font-medium text-purple-700">Confidence:</span>
                  <p className="text-purple-600">{Math.round(intelligentResults.query.confidence * 100)}%</p>
                </div>
                <div>
                  <span className="font-medium text-purple-700">Search Time:</span>
                  <p className="text-purple-600">{intelligentResults.analytics.searchLatency}ms</p>
                </div>
              </div>
              {intelligentResults.suggestions.queryCorrections.length > 0 && (
                <div className="mt-3 pt-3 border-t border-purple-200">
                  <span className="font-medium text-purple-700 text-sm">Suggestions: </span>
                  {intelligentResults.suggestions.queryCorrections.map((suggestion, i) => (
                    <button 
                      key={i}
                      onClick={() => setSearchQuery(suggestion)}
                      className="ml-2 text-xs bg-purple-200 text-purple-700 px-2 py-1 rounded-full hover:bg-purple-300 transition"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Filter Tabs */}
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-1 shadow-soft border border-linen-200">
            <div className="flex">
              {(['all', 'places', 'lists', 'users'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`flex-1 py-2 px-3 text-sm font-medium rounded-xl transition-all duration-300 ${
                    activeFilter === filter
                      ? 'bg-gradient-to-r from-sage-500 to-sage-600 text-white shadow-soft'
                      : 'text-charcoal-600 hover:text-sage-600 hover:bg-linen-50'
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>



          {/* Search Results */}
          <div className="space-y-4">
            {/* No Results */}
            {isSearching && searchQuery && 
             displayResults.places.length === 0 && 
             displayResults.lists.length === 0 && 
             displayResults.users.length === 0 && (
              <div className="text-center py-8">
                <p className="text-charcoal-600">No results found for "{searchQuery}"</p>
                <p className="text-charcoal-500 text-sm mt-2">Try different keywords or check your spelling</p>
                {useIntelligentSearch && intelligentResults?.suggestions.queryCorrections.length > 0 && (
                  <div className="mt-4">
                    <p className="text-charcoal-600 text-sm mb-2">Did you mean:</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {intelligentResults.suggestions.queryCorrections.map((suggestion, i) => (
                        <button 
                          key={i}
                          onClick={() => setSearchQuery(suggestion)}
                          className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm hover:bg-purple-200 transition"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Places */}
            {(activeFilter === 'all' || activeFilter === 'places') && displayResults.places.length > 0 && (
              <div>
                <h3 className="text-lg font-serif font-semibold text-charcoal-800 mb-3">
                  Hubs ({displayResults.places.length})
                  {useIntelligentSearch && <span className="ml-2 text-sm text-purple-600">✨ AI Ranked</span>}
                </h3>
                <div className="space-y-3">
                  {displayResults.places.map((result) => (
                    <div
                      key={result.item.id}
                      onClick={() => handlePlaceClick(result.item)}
                      className="w-full bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-linen-200 hover:shadow-cozy transition-all duration-300 text-left"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-charcoal-800">{result.item.name}</h4>
                            {useIntelligentSearch && (
                              <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                                result.category === 'exact_match' ? 'bg-green-100 text-green-700' :
                                result.category === 'user_connection' ? 'bg-blue-100 text-blue-700' :
                                result.category === 'trending' ? 'bg-orange-100 text-orange-700' :
                                result.category === 'personalized' ? 'bg-purple-100 text-purple-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {result.category.replace('_', ' ')}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-charcoal-600 mb-2">{result.item.address}</p>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {result.item.tags.slice(0, 3).map((tag) => (
                              <button
                                key={tag}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleTagClick(tag)
                                }}
                                className={`px-2 py-1 text-xs rounded-full transition-colors ${
                                  selectedTags.includes(tag)
                                    ? 'bg-sage-200 text-sage-800 border border-sage-300'
                                    : 'bg-sage-100 text-sage-700 hover:bg-sage-200'
                                }`}
                              >
                                #{tag}
                              </button>
                            ))}
                          </div>
                          {useIntelligentSearch && (
                            <div className="text-xs text-purple-600 space-y-1">
                              <div>Score: {Math.round(result.score)}/100</div>
                              <div>Why: {result.reasons.join(', ')}</div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setLikedPlaces(prev => {
                                const newSet = new Set(prev)
                                if (newSet.has(result.item.id)) {
                                  newSet.delete(result.item.id)
                                } else {
                                  newSet.add(result.item.id)
                                }
                                return newSet
                              })
                            }}
                            className={`p-1.5 rounded-full transition ${
                              likedPlaces.has(result.item.id)
                                ? 'bg-gold-100 text-gold-700 border border-gold-200'
                                : 'bg-gold-50 text-gold-600 hover:bg-gold-100'
                            }`}
                          >
                            <HeartIcon className={`w-4 h-4 ${likedPlaces.has(result.item.id) ? 'fill-current' : ''}`} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSaveToPlace(result.item)
                            }}
                            className={`p-1.5 rounded-full transition ${
                              savedPlaces.has(result.item.id)
                                ? 'bg-sage-100 text-sage-700'
                                : 'bg-sage-50 text-sage-600 hover:bg-sage-100'
                            }`}
                            title="Save to list"
                          >
                            <BookmarkIcon className={`w-4 h-4 ${savedPlaces.has(result.item.id) ? 'fill-current' : ''}`} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lists */}
            {(activeFilter === 'all' || activeFilter === 'lists') && displayResults.lists.length > 0 && (
              <div>
                <h3 className="text-lg font-serif font-semibold text-charcoal-800 mb-3">
                  Lists ({displayResults.lists.length})
                  {useIntelligentSearch && <span className="ml-2 text-sm text-purple-600">✨ AI Ranked</span>}
                </h3>
                <div className="space-y-3">
                  {displayResults.lists.map((result) => (
                    <div
                      key={result.item.id}
                      onClick={() => handleListClick(result.item)}
                      className="w-full bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-linen-200 hover:shadow-cozy transition-all duration-300 text-left"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-charcoal-800">{result.item.name}</h4>
                            {useIntelligentSearch && (
                              <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                                result.category === 'exact_match' ? 'bg-green-100 text-green-700' :
                                result.category === 'user_connection' ? 'bg-blue-100 text-blue-700' :
                                result.category === 'trending' ? 'bg-orange-100 text-orange-700' :
                                result.category === 'personalized' ? 'bg-purple-100 text-purple-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {result.category.replace('_', ' ')}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-charcoal-600 mb-2">{result.item.description}</p>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {result.item.tags.slice(0, 3).map((tag) => (
                              <button
                                key={tag}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleTagClick(tag)
                                }}
                                className={`px-2 py-1 text-xs rounded-full transition-colors ${
                                  selectedTags.includes(tag)
                                    ? 'bg-gold-200 text-gold-800 border border-gold-300'
                                    : 'bg-gold-100 text-gold-700 hover:bg-gold-200'
                                }`}
                              >
                                #{tag}
                              </button>
                            ))}
                          </div>
                          {useIntelligentSearch && (
                            <div className="text-xs text-purple-600 space-y-1">
                              <div>Score: {Math.round(result.score)}/100</div>
                              <div>Why: {result.reasons.join(', ')}</div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setLikedLists(prev => {
                                const newSet = new Set(prev)
                                if (newSet.has(result.item.id)) {
                                  newSet.delete(result.item.id)
                                } else {
                                  newSet.add(result.item.id)
                                }
                                return newSet
                              })
                            }}
                            className={`p-1.5 rounded-full transition ${
                              likedLists.has(result.item.id)
                                ? 'bg-gold-100 text-gold-700 border border-gold-200'
                                : 'bg-gold-50 text-gold-600 hover:bg-gold-100'
                            }`}
                          >
                            <HeartIcon className={`w-4 h-4 ${likedLists.has(result.item.id) ? 'fill-current' : ''}`} />
                            {(result.item.likes ?? 0) + (likedLists.has(result.item.id) ? 1 : 0)}
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              // Open SaveModal for lists as well
                              const mockPlace = {
                                id: result.item.id,
                                name: result.item.name,
                                address: 'Various locations',
                                tags: result.item.tags,
                                posts: [],
                                savedCount: result.item.savedCount || 0,
                                createdAt: result.item.createdAt
                              }
                              handleSaveToPlace(mockPlace)
                            }}
                            className={`p-1.5 rounded-full transition ${
                              savedLists.has(result.item.id)
                                ? 'bg-sage-100 text-sage-700'
                                : 'bg-sage-50 text-sage-600 hover:bg-sage-100'
                            }`}
                            title="Save to list"
                          >
                            <BookmarkIcon className={`w-4 h-4 ${savedLists.has(result.item.id) ? 'fill-current' : ''}`} />
                          </button>
                          {result.item.userId === '1' && (
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation()
                                handleCreatePost(result.item.id)
                              }}
                              className="p-1.5 rounded-full bg-gold-50 text-gold-600 hover:bg-gold-100 transition"
                              title="Create post"
                            >
                              <PlusIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Users */}
            {(activeFilter === 'all' || activeFilter === 'users') && displayResults.users.length > 0 && (
              <div>
                <h3 className="text-lg font-serif font-semibold text-charcoal-800 mb-3">
                  People ({displayResults.users.length})
                  {useIntelligentSearch && <span className="ml-2 text-sm text-purple-600">✨ AI Ranked</span>}
                </h3>
                <div className="space-y-3">
                  {displayResults.users.map((result) => (
                    <div
                      key={result.item.id}
                      className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-linen-200 hover:shadow-cozy transition-all duration-300"
                    >
                      <div className="flex items-center space-x-3">
                        {result.item.avatar ? (
                          <div className="w-12 h-12 rounded-full border-2 border-linen-200 bg-linen-50/80 backdrop-blur-sm relative overflow-hidden">
                            <img
                              src={result.item.avatar}
                              alt={result.item.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 border border-white/30 rounded-full"></div>
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-gradient-to-br from-sage-100 to-sage-200 rounded-full flex items-center justify-center border-2 border-linen-200">
                            <UserIcon className="w-6 h-6 text-sage-600" />
                          </div>
                        )}
                        <div className="flex-1">
                          <button
                            onClick={() => handleUserClick(result.item)}
                            className="text-left hover:opacity-80 transition-opacity"
                          >
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-charcoal-800">{result.item.name}</h4>
                              {useIntelligentSearch && (
                                <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                                  result.category === 'exact_match' ? 'bg-green-100 text-green-700' :
                                  result.category === 'user_connection' ? 'bg-blue-100 text-blue-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {result.category.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-charcoal-600">@{result.item.username}</p>
                          </button>
                          {result.item.tags && result.item.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2 mb-2">
                              {result.item.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-2 py-1 bg-gold-100 text-gold-700 text-xs rounded-full"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                          {result.item.bio && (
                            <p className="text-sm text-charcoal-600 mt-1">{result.item.bio}</p>
                          )}
                          {useIntelligentSearch && (
                            <div className="text-xs text-purple-600 mt-2">
                              Score: {Math.round(result.score)}/100 • {result.reasons.join(', ')}
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={() => handleFollowUser(result.item.id)}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 shadow-soft ${
                            followingUsers.has(result.item.id)
                              ? 'bg-linen-100 text-charcoal-600 hover:bg-linen-200'
                              : 'bg-gradient-to-r from-sage-500 to-sage-600 text-white hover:from-sage-600 hover:to-sage-700'
                          }`}
                        >
                          {followingUsers.has(result.item.id) ? 'Following' : 'Follow'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Discovery Recommendations */}
            {!searchQuery && discoveries.length > 0 && (
              <div>
                <h3 className="text-lg font-serif font-semibold text-charcoal-800 mb-3 flex items-center gap-2">
                  <SparklesIcon className="w-5 h-5 text-purple-600" />
                  Personalized Discoveries
                </h3>
                <p className="text-sm text-charcoal-600 mb-4">
                  Based on your preferences and activity patterns
                </p>
                <div className="space-y-3">
                  {discoveries.slice(0, 5).map((rec, index) => (
                    <div key={`${rec.type}-${rec.item.id}`} className="bg-gradient-to-r from-purple-50 to-purple-100 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-purple-200">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-charcoal-800">{rec.item.name}</h4>
                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                              rec.algorithm === 'collaborative' ? 'bg-blue-100 text-blue-700' :
                              rec.algorithm === 'content_based' ? 'bg-green-100 text-green-700' :
                              rec.algorithm === 'social' ? 'bg-orange-100 text-orange-700' :
                              rec.algorithm === 'trending' ? 'bg-red-100 text-red-700' :
                              'bg-purple-100 text-purple-700'
                            }`}>
                              {rec.algorithm.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-sm text-charcoal-600 mb-2">
                            {'address' in rec.item ? rec.item.address : rec.item.description}
                          </p>
                          <div className="text-xs text-purple-600 space-y-1">
                            <div>Confidence: {Math.round(rec.confidence * 100)}%</div>
                            <div>Why: {rec.reasons.join(', ')}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button className="p-2 rounded-full bg-purple-200/50 text-purple-600 hover:bg-purple-200 transition">
                            <PlusIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Hub Modal and List Modal are now handled globally in App.tsx */}

      {/* Modals */}
      {selectedPlace && (
        <SaveModal
          isOpen={showSaveModal}
          onClose={() => {
            setShowSaveModal(false)
            setSelectedPlace(null)
          }}
          place={selectedPlace}
          userLists={userLists}
          onSave={handleSave}
          onCreateList={handleCreateList}
        />
      )}

      <LocationSelectModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onLocationSelect={handleLocationSelect}
      />

      <CreatePost
        isOpen={showCreatePost}
        onClose={() => {
          setShowCreatePost(false)
          setCreatePostListId(null)
        }}
        preSelectedListIds={createPostListId ? [createPostListId] : undefined}
      />

      {/* Profile Modal */}
      {selectedUser && (
        <ProfileModal
          user={selectedUser}
          isOpen={showProfileModal}
          onClose={() => {
            setShowProfileModal(false)
            setSelectedUser(null)
          }}
          onFollow={handleFollowUser}
        />
      )}


    </div>
  )
}

export default Search 