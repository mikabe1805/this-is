import { useState, useEffect } from 'react'
import { MapPinIcon, HeartIcon, UserIcon, ClockIcon, FireIcon, BookmarkIcon, PlusIcon, FunnelIcon } from '@heroicons/react/24/outline'
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

  // Handle URL parameters for tag filtering
  useEffect(() => {
    const tag = searchParams.get('tag')
    if (tag && !selectedTags.includes(tag)) {
      setSelectedTags([tag])
      setSearchQuery(`#${tag}`)
      setIsSearching(true)
    }
  }, [searchParams, selectedTags])


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
    } else {
      setShowSearchHistory(false)
      setIsSearching(true)
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
    }
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
                <span className="text-charcoal-700">
                  {searchQuery ? `Searching for "${searchQuery}"` : 'Showing all results'}
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
             searchResults.places.length === 0 && 
             searchResults.lists.length === 0 && 
             searchResults.users.length === 0 && (
              <div className="text-center py-8">
                <p className="text-charcoal-600">No results found for "{searchQuery}"</p>
                <p className="text-charcoal-500 text-sm mt-2">Try different keywords or check your spelling</p>
              </div>
            )}

            {/* Places */}
            {(activeFilter === 'all' || activeFilter === 'places') && (searchResults.places || []).length > 0 && (
              <div>
                <h3 className="text-lg font-serif font-semibold text-charcoal-800 mb-3">
                  Hubs ({searchResults.places.length})
                </h3>
                <div className="space-y-3">
                  {(searchResults.places || []).map((place) => (
                    <div
                      key={place.id}
                      onClick={() => handlePlaceClick(place)}
                      className="w-full bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-linen-200 hover:shadow-cozy transition-all duration-300 text-left"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-charcoal-800 mb-1">{place.name}</h4>
                          <p className="text-sm text-charcoal-600 mb-2">{place.address}</p>
                          <div className="flex flex-wrap gap-1">
                            {place.tags.slice(0, 3).map((tag) => (
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
                        </div>
                        <div className="flex items-center gap-1 ml-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setLikedPlaces(prev => {
                                const newSet = new Set(prev)
                                if (newSet.has(place.id)) {
                                  newSet.delete(place.id)
                                } else {
                                  newSet.add(place.id)
                                }
                                return newSet
                              })
                            }}
                            className={`p-1.5 rounded-full transition ${
                              likedPlaces.has(place.id)
                                ? 'bg-gold-100 text-gold-700 border border-gold-200'
                                : 'bg-gold-50 text-gold-600 hover:bg-gold-100'
                            }`}
                          >
                            <HeartIcon className={`w-4 h-4 ${likedPlaces.has(place.id) ? 'fill-current' : ''}`} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSaveToPlace(place)
                            }}
                            className={`p-1.5 rounded-full transition ${
                              savedPlaces.has(place.id)
                                ? 'bg-sage-100 text-sage-700'
                                : 'bg-sage-50 text-sage-600 hover:bg-sage-100'
                            }`}
                            title="Save to list"
                          >
                            <BookmarkIcon className={`w-4 h-4 ${savedPlaces.has(place.id) ? 'fill-current' : ''}`} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lists */}
            {(activeFilter === 'all' || activeFilter === 'lists') && (searchResults.lists || []).length > 0 && (
              <div>
                <h3 className="text-lg font-serif font-semibold text-charcoal-800 mb-3">
                  Lists ({searchResults.lists.length})
                </h3>
                <div className="space-y-3">
                  {(searchResults.lists || []).map((list) => (
                    <div
                      key={list.id}
                      onClick={() => handleListClick(list)}
                      className="w-full bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-linen-200 hover:shadow-cozy transition-all duration-300 text-left"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-charcoal-800 mb-1">{list.name}</h4>
                          <p className="text-sm text-charcoal-600 mb-2">{list.description}</p>
                          <div className="flex flex-wrap gap-1">
                            {list.tags.slice(0, 3).map((tag) => (
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
                        </div>
                        <div className="flex items-center gap-1 ml-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setLikedLists(prev => {
                                const newSet = new Set(prev)
                                if (newSet.has(list.id)) {
                                  newSet.delete(list.id)
                                } else {
                                  newSet.add(list.id)
                                }
                                return newSet
                              })
                            }}
                            className={`p-1.5 rounded-full transition ${
                              likedLists.has(list.id)
                                ? 'bg-gold-100 text-gold-700 border border-gold-200'
                                : 'bg-gold-50 text-gold-600 hover:bg-gold-100'
                            }`}
                          >
                            <HeartIcon className={`w-4 h-4 ${likedLists.has(list.id) ? 'fill-current' : ''}`} />
                            {(list.likes ?? 0) + (likedLists.has(list.id) ? 1 : 0)}
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              // Open SaveModal for lists as well
                              const mockPlace = {
                                id: list.id,
                                name: list.name,
                                address: 'Various locations',
                                tags: list.tags,
                                posts: [],
                                savedCount: list.savedCount || 0,
                                createdAt: list.createdAt
                              }
                              handleSaveToPlace(mockPlace)
                            }}
                            className={`p-1.5 rounded-full transition ${
                              savedLists.has(list.id)
                                ? 'bg-sage-100 text-sage-700'
                                : 'bg-sage-50 text-sage-600 hover:bg-sage-100'
                            }`}
                            title="Save to list"
                          >
                            <BookmarkIcon className={`w-4 h-4 ${savedLists.has(list.id) ? 'fill-current' : ''}`} />
                          </button>
                          {list.userId === '1' && (
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation()
                                handleCreatePost(list.id)
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
            {(activeFilter === 'all' || activeFilter === 'users') && (searchResults.users || []).length > 0 && (
              <div>
                <h3 className="text-lg font-serif font-semibold text-charcoal-800 mb-3">
                  People ({searchResults.users.length})
                </h3>
                <div className="space-y-3">
                  {(searchResults.users || []).map((user) => (
                    <div
                      key={user.id}
                      className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-linen-200 hover:shadow-cozy transition-all duration-300"
                    >
                      <div className="flex items-center space-x-3">
                        {user.avatar ? (
                          <div className="w-12 h-12 rounded-full border-2 border-linen-200 bg-linen-50/80 backdrop-blur-sm relative overflow-hidden">
                            <img
                              src={user.avatar}
                              alt={user.name}
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
                            onClick={() => handleUserClick(user)}
                            className="text-left hover:opacity-80 transition-opacity"
                          >
                            <h4 className="font-semibold text-charcoal-800">{user.name}</h4>
                            <p className="text-sm text-charcoal-600">@{user.username}</p>
                          </button>
                          {user.tags && user.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2 mb-2">
                              {user.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-2 py-1 bg-gold-100 text-gold-700 text-xs rounded-full"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                          {user.bio && (
                            <p className="text-sm text-charcoal-600 mt-1">{user.bio}</p>
                          )}
                        </div>
                        <button 
                          onClick={() => handleFollowUser(user.id)}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 shadow-soft ${
                            followingUsers.has(user.id)
                              ? 'bg-linen-100 text-charcoal-600 hover:bg-linen-200'
                              : 'bg-gradient-to-r from-sage-500 to-sage-600 text-white hover:from-sage-600 hover:to-sage-700'
                          }`}
                        >
                          {followingUsers.has(user.id) ? 'Following' : 'Follow'}
                        </button>
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