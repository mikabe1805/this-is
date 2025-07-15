import { useState, useEffect } from 'react'
import { XMarkIcon, MagnifyingGlassIcon, MapPinIcon, BookmarkIcon, FireIcon, ClockIcon } from '@heroicons/react/24/outline'
import SearchBar from './SearchBar'
import type { Hub, Place } from '../types/index.js'

interface HubSearchModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectHub: (hub: Hub) => void
}

const HubSearchModal: React.FC<HubSearchModalProps> = ({ isOpen, onClose, onSelectHub }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [showSearchHistory, setShowSearchHistory] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [sortBy, setSortBy] = useState('popular')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

  // Mock data - same as Search page
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
    ]
  }

  const searchHistory = [
    'coffee shops',
    'tacos',
    'oakland restaurants',
    'cozy cafes'
  ]

  const popularHashtags = [
    { tag: '#coffee', count: 234 },
    { tag: '#oakland', count: 189 },
    { tag: '#cozy', count: 156 },
    { tag: '#authentic', count: 123 },
    { tag: '#work-friendly', count: 98 },
    { tag: '#scenic', count: 87 }
  ]

  const sortOptions = [
    { key: 'popular', label: 'Most Popular' },
    { key: 'recent', label: 'Recently Added' },
    { key: 'nearby', label: 'Closest to Location' },
  ]

  const filterOptions = [
    { key: 'coffee', label: 'Coffee' },
    { key: 'food', label: 'Food' },
    { key: 'outdoors', label: 'Outdoors' },
  ]

  const availableTags = ['cozy', 'trendy', 'quiet', 'local', 'charming', 'authentic', 'chill']

  const getFilteredResults = () => {
    if (!searchQuery.trim()) {
      return {
        places: allData.places,
        lists: [],
        users: []
      }
    }

    const query = searchQuery.toLowerCase()
    return {
      places: allData.places.filter(place => 
        place.name.toLowerCase().includes(query) ||
        place.address.toLowerCase().includes(query) ||
        place.tags.some(tag => tag.toLowerCase().includes(query))
      ),
      lists: [],
      users: []
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
    // Simulate search delay
    setTimeout(() => {
      setIsSearching(false)
    }, 500)
  }

  const handleHashtagClick = (hashtag: string) => {
    setSearchQuery(hashtag)
    setShowSearchHistory(false)
    setIsSearching(true)
    // Simulate search delay
    setTimeout(() => {
      setIsSearching(false)
    }, 500)
  }

  const handleSearchInputFocus = () => {
    if (searchQuery === '') {
      setShowSearchHistory(true)
    }
  }

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    
    if (value === '') {
      setShowSearchHistory(true)
      setIsSearching(false)
    } else {
      setShowSearchHistory(false)
    }
  }

  // Debounced search effect
  useEffect(() => {
    if (searchQuery.trim()) {
      setIsSearching(true)
      const timeoutId = setTimeout(() => {
        setIsSearching(false)
      }, 300)
      
      return () => clearTimeout(timeoutId)
    }
  }, [searchQuery])

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
        lat: 37.7749, // Mock coordinates
        lng: -122.4194,
      },
      googleMapsUrl: `https://www.google.com/maps/search/${encodeURIComponent(place.name + ' ' + place.address)}`,
      mainImage: place.hubImage,
      posts: place.posts,
      lists: [],
    }
    onSelectHub(hub)
  }

  const resetForm = () => {
    setSearchQuery('')
    setIsSearching(false)
    setShowSearchHistory(false)
    setSelectedTags([])
    setSortBy('popular')
    setActiveFilters([])
    setShowDropdown(false)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-botanical border border-linen-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-linen-200 flex-shrink-0">
          <h2 className="text-xl font-serif font-semibold text-charcoal-700">Search Places</h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-linen-100 transition-colors"
          >
            <XMarkIcon className="w-6 h-6 text-charcoal-500" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-6 border-b border-linen-200 flex-shrink-0">
          <div className="relative">
            <SearchBar 
              placeholder="Search places, lists, or friends..." 
              value={searchQuery}
              onChange={handleSearchInputChange}
              onFocus={handleSearchInputFocus}
              onFilterClick={() => setShowDropdown(true)}
            />
          </div>
        </div>

        {/* Filter Dropdown */}
        {showDropdown && (
          <div className="fixed inset-0 z-60 flex items-start justify-end px-4 pt-24 bg-black/10" onClick={() => setShowDropdown(false)}>
            <div className="w-80 rounded-2xl shadow-cozy border border-linen-200 bg-white/95 p-6" onClick={e => e.stopPropagation()}>
              <div className="mb-6">
                <div className="font-serif font-semibold mb-4 text-lg text-charcoal-700">Sort by</div>
                <div className="space-y-2">
                  {sortOptions.map(opt => (
                    <label key={opt.key} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer border border-transparent hover:border-sage-200 hover:bg-sage-50">
                      <input
                        type="radio"
                        name="sortBy"
                        value={opt.key}
                        checked={sortBy === opt.key}
                        onChange={() => setSortBy(opt.key)}
                        className="w-5 h-5 text-sage-500 focus:ring-sage-400"
                      />
                      <span className="font-medium text-charcoal-600">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div className="font-serif font-semibold mb-4 text-lg text-charcoal-700">Filter by</div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {filterOptions.map(opt => (
                    <label key={opt.key} className="flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium bg-sage-50 border border-sage-100 text-sage-700 hover:bg-sage-100 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeFilters.includes(opt.key)}
                        onChange={() => setActiveFilters(f => f.includes(opt.key) ? f.filter(x => x !== opt.key) : [...f, opt.key])}
                        className="w-4 h-4 text-sage-500 focus:ring-sage-400"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map(tag => (
                    <label key={tag} className="flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium bg-linen-100 border border-linen-200 text-charcoal-500 hover:bg-linen-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeFilters.includes(tag)}
                        onChange={() => setActiveFilters(f => f.includes(tag) ? f.filter(x => x !== tag) : [...f, tag])}
                        className="w-4 h-4 text-sage-500 focus:ring-sage-400"
                      />
                      {tag}
                    </label>
                  ))}
                </div>
              </div>
              <button
                className="mt-6 w-full py-3 rounded-full font-semibold bg-sage-400 text-white shadow-soft hover:bg-sage-500 transition"
                onClick={() => setShowDropdown(false)}
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!searchQuery && !isSearching && (
            <div className="space-y-6">
              {/* Search History */}
              {searchHistory.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-charcoal-700 mb-3">Recent Searches</h3>
                  <div className="space-y-2">
                    {searchHistory.map((query, index) => (
                      <button
                        key={index}
                        onClick={() => handleSearchHistoryClick(query)}
                        className="flex items-center gap-3 w-full p-3 text-left hover:bg-linen-50 rounded-xl transition-colors"
                      >
                        <ClockIcon className="w-5 h-5 text-charcoal-400" />
                        <span className="text-charcoal-700">{query}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Popular Hashtags */}
              <div>
                <h3 className="text-lg font-semibold text-charcoal-700 mb-3">Popular Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {popularHashtags.map(({ tag, count }) => (
                    <button
                      key={tag}
                      onClick={() => handleHashtagClick(tag)}
                      className="flex items-center gap-2 px-3 py-2 bg-linen-100 text-charcoal-700 rounded-full hover:bg-sage-100 transition-colors"
                    >
                      <span className="font-medium">{tag}</span>
                      <span className="text-xs text-charcoal-500">{count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Search Results */}
          {searchQuery && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-charcoal-700">
                  {isSearching ? 'Searching...' : `Results for "${searchQuery}"`}
                </h3>
                {searchResults.places.length > 0 && (
                  <span className="text-sm text-charcoal-500">{searchResults.places.length} places found</span>
                )}
              </div>

              {isSearching ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-500 mx-auto"></div>
                  <p className="text-charcoal-500 mt-2">Searching...</p>
                </div>
              ) : searchResults.places.length > 0 ? (
                <div className="space-y-3">
                  {searchResults.places.map((place) => (
                    <button
                      key={place.id}
                      onClick={() => handleHubClick(place)}
                      className="w-full flex items-center gap-4 p-4 bg-linen-50 hover:bg-sage-50 rounded-xl transition-colors border border-linen-200 hover:border-sage-200"
                    >
                      <div className="w-16 h-16 bg-sage-200 rounded-xl flex-shrink-0 flex items-center justify-center">
                        <MapPinIcon className="w-8 h-8 text-sage-600" />
                      </div>
                      <div className="flex-1 text-left">
                        <h4 className="font-semibold text-charcoal-700 mb-1">{place.name}</h4>
                        <p className="text-sm text-charcoal-500 mb-2">{place.address}</p>
                        <div className="flex flex-wrap gap-1">
                          {place.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="px-2 py-1 text-xs rounded-full bg-sage-100 text-sage-700">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-charcoal-500">
                        <BookmarkIcon className="w-4 h-4" />
                        <span>{place.savedCount}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MagnifyingGlassIcon className="w-12 h-12 text-charcoal-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-charcoal-700 mb-2">No results found</h3>
                  <p className="text-charcoal-500">Try adjusting your search terms</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default HubSearchModal 