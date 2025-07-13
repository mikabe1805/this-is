import { useState } from 'react'
import { MagnifyingGlassIcon, MapPinIcon, HeartIcon, UserIcon, FunnelIcon, ClockIcon, FireIcon } from '@heroicons/react/24/outline'

const Search = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'places' | 'lists' | 'users'>('all')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showSearchHistory, setShowSearchHistory] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [sortBy, setSortBy] = useState('popular')
  const [activeFilters, setActiveFilters] = useState<string[]>([])

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
        updatedAt: '2024-01-15'
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
        updatedAt: '2024-01-14'
      }
    ],
    users: [
      {
        id: '1',
        name: 'Sara Chen',
        username: 'sara.chen',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
        bio: 'Finding cozy spots and sharing them with friends ✨',
        location: 'San Francisco, CA'
      },
      {
        id: '2',
        name: 'Mike Johnson',
        username: 'mike.j',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
        bio: 'Coffee enthusiast and food lover',
        location: 'Oakland, CA'
      }
    ]
  }

  const availableTags = ['coffee', 'cozy', 'work-friendly', 'tacos', 'authentic', 'quick', 'outdoors', 'scenic']

  // Filter data based on search query
  const getFilteredResults = () => {
    if (!searchQuery.trim()) {
      return allData
    }

    const query = searchQuery.toLowerCase()
    
    return {
      places: allData.places.filter(place => 
        place.name.toLowerCase().includes(query) ||
        place.address.toLowerCase().includes(query) ||
        place.tags.some(tag => tag.toLowerCase().includes(query))
      ),
      lists: allData.lists.filter(list => 
        list.name.toLowerCase().includes(query) ||
        list.description.toLowerCase().includes(query) ||
        list.tags.some(tag => tag.toLowerCase().includes(query))
      ),
      users: allData.users.filter(user => 
        user.name.toLowerCase().includes(query) ||
        user.username.toLowerCase().includes(query) ||
        user.bio.toLowerCase().includes(query) ||
        user.location.toLowerCase().includes(query)
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
    setSearchQuery(hashtag)
    setShowSearchHistory(false)
    setIsSearching(true)
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
          <div className="flex-1">
            <h1 className="text-xl font-serif font-semibold text-charcoal-800">Search</h1>
          </div>
          <div className="relative">
            <button
              className="flex items-center gap-2 px-5 py-3 rounded-full bg-white/90 border border-linen-200 shadow-cozy transition-all duration-300 hover:shadow-botanical hover:bg-linen-50"
              onClick={() => setShowDropdown(v => !v)}
            >
              <FunnelIcon className="w-5 h-5 text-sage-400" />
              <span className="font-semibold text-charcoal-600">Sort & Filter</span>
            </button>
          </div>
        </div>
        
        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-sage-400" />
          <input
            type="text"
            placeholder="Search places, lists, or people..."
            value={searchQuery}
            onChange={handleSearchInputChange}
            onFocus={handleSearchInputFocus}
            className="w-full pl-10 pr-12 py-3 bg-white/80 backdrop-blur-sm rounded-2xl border border-linen-200 focus:outline-none focus:ring-2 focus:ring-sage-200 focus:border-sage-300 transition-all duration-300"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sage-400 hover:text-sage-600 transition-colors"
            >
              ✕
            </button>
          )}
        </form>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="fixed inset-0 z-20 flex items-start justify-end px-4 pt-24 bg-black/10" onClick={() => setShowDropdown(false)}>
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
            {(activeFilter === 'all' || activeFilter === 'places') && searchResults.places.length > 0 && (
              <div>
                <h3 className="text-lg font-serif font-semibold text-charcoal-800 mb-3">
                  Places ({searchResults.places.length})
                </h3>
                <div className="space-y-3">
                  {searchResults.places.map((place) => (
                    <div
                      key={place.id}
                      className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-linen-200 hover:shadow-cozy transition-all duration-300"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-charcoal-800 mb-1">{place.name}</h4>
                          <div className="flex items-center text-charcoal-600 text-sm mb-2">
                            <MapPinIcon className="w-4 h-4 mr-1" />
                            {place.address}
                          </div>
                          <div className="flex flex-wrap gap-1 mb-3">
                            {place.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-1 bg-gold-100 text-gold-700 text-xs rounded-full"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4 text-sm text-charcoal-600">
                              <span className="flex items-center">
                                <HeartIcon className="w-4 h-4 mr-1" />
                                {place.savedCount} saved
                              </span>
                            </div>
                            <button className="bg-gradient-to-r from-sage-500 to-sage-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:from-sage-600 hover:to-sage-700 transition-all duration-300 shadow-soft">
                              Save
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lists */}
            {(activeFilter === 'all' || activeFilter === 'lists') && searchResults.lists.length > 0 && (
              <div>
                <h3 className="text-lg font-serif font-semibold text-charcoal-800 mb-3">
                  Lists ({searchResults.lists.length})
                </h3>
                <div className="space-y-3">
                  {searchResults.lists.map((list) => (
                    <div
                      key={list.id}
                      className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-linen-200 hover:shadow-cozy transition-all duration-300"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-charcoal-800 mb-1">{list.name}</h4>
                          <p className="text-sm text-charcoal-600 mb-2">{list.description}</p>
                          <div className="flex flex-wrap gap-1 mb-3">
                            {list.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-1 bg-sage-100 text-sage-700 text-xs rounded-full"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-charcoal-500">Updated {new Date(list.updatedAt).toLocaleDateString()}</span>
                            <button className="text-sage-600 hover:text-sage-700 text-sm font-medium transition-colors">
                              Follow List
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Users */}
            {(activeFilter === 'all' || activeFilter === 'users') && searchResults.users.length > 0 && (
              <div>
                <h3 className="text-lg font-serif font-semibold text-charcoal-800 mb-3">
                  People ({searchResults.users.length})
                </h3>
                <div className="space-y-3">
                  {searchResults.users.map((user) => (
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
                          <h4 className="font-semibold text-charcoal-800">{user.name}</h4>
                          <p className="text-sm text-charcoal-600">@{user.username}</p>
                          {user.bio && (
                            <p className="text-sm text-charcoal-600 mt-1">{user.bio}</p>
                          )}
                        </div>
                        <button className="bg-gradient-to-r from-sage-500 to-sage-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:from-sage-600 hover:to-sage-700 transition-all duration-300 shadow-soft">
                          Follow
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
    </div>
  )
}

export default Search 