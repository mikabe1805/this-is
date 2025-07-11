import { useState } from 'react'
import { MagnifyingGlassIcon, MapPinIcon, HeartIcon, UserIcon, FunnelIcon, ClockIcon, FireIcon } from '@heroicons/react/24/outline'

const Search = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'places' | 'lists' | 'users'>('all')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showSearchHistory, setShowSearchHistory] = useState(false)
  const [isSearching, setIsSearching] = useState(false)

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
        avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
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
    <div className="min-h-full bg-gradient-to-br from-cream-50 to-coral-50">
      {/* Header with Search Bar */}
      <div className="bg-white/80 backdrop-blur-md border-b border-cream-200 px-6 py-4">
        <h1 className="text-xl font-semibold text-sage-800 mb-4">Search</h1>
        
        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-sage-400" />
          <input
            type="text"
            placeholder="Search places, lists, or people..."
            value={searchQuery}
            onChange={handleSearchInputChange}
            onFocus={handleSearchInputFocus}
            className="w-full pl-10 pr-12 py-3 bg-white/80 backdrop-blur-sm rounded-2xl border border-cream-200 focus:outline-none focus:ring-2 focus:ring-coral-200 focus:border-coral-300 transition-all duration-300"
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

      {/* Search History */}
      {showSearchHistory && searchHistory.length > 0 && (
        <div className="bg-white/90 backdrop-blur-sm border-b border-cream-200 px-6 py-4">
          <div className="flex items-center space-x-2 mb-3">
            <ClockIcon className="w-4 h-4 text-sage-600" />
            <span className="text-sm font-medium text-sage-800">Recent Searches</span>
          </div>
          <div className="space-y-2">
            {searchHistory.map((query, index) => (
              <button
                key={index}
                onClick={() => handleSearchHistoryClick(query)}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-cream-50 transition-colors text-sage-700 hover:text-sage-800"
              >
                {query}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Trendy Hashtags */}
      {showSearchHistory && (
        <div className="bg-white/90 backdrop-blur-sm border-b border-cream-200 px-6 py-4">
          <div className="flex items-center space-x-2 mb-3">
            <FireIcon className="w-4 h-4 text-coral-600" />
            <span className="text-sm font-medium text-sage-800">Trending</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {trendyHashtags.map((item, index) => (
              <button
                key={index}
                onClick={() => handleHashtagClick(item.tag)}
                className="px-3 py-2 bg-gradient-to-r from-coral-100 to-coral-200 text-coral-700 rounded-xl text-sm font-medium hover:from-coral-200 hover:to-coral-300 transition-all duration-300 shadow-soft"
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
        <div className="p-4 space-y-4">
          {/* Search Status */}
          {isSearching && (
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-cream-200">
              <div className="flex items-center justify-between">
                <span className="text-sage-700">
                  {searchQuery ? `Searching for "${searchQuery}"` : 'Showing all results'}
                </span>
                <button
                  onClick={clearSearch}
                  className="text-coral-600 hover:text-coral-700 text-sm font-medium transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Filter Tabs */}
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-1 shadow-soft border border-cream-200">
            <div className="flex">
              {(['all', 'places', 'lists', 'users'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`flex-1 py-2 px-3 text-sm font-medium rounded-xl transition-all duration-300 ${
                    activeFilter === filter
                      ? 'bg-gradient-to-r from-coral-500 to-coral-600 text-white shadow-soft'
                      : 'text-sage-600 hover:text-coral-600 hover:bg-cream-50'
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Tag Filters */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-cream-200">
            <div className="flex items-center space-x-2 mb-3">
              <FunnelIcon className="w-4 h-4 text-sage-600" />
              <span className="text-sm font-medium text-sage-800">Filter by tags</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 ${
                    selectedTags.includes(tag)
                      ? 'bg-coral-500 text-white shadow-soft'
                      : 'bg-cream-100 text-sage-700 hover:bg-coral-100 hover:text-coral-700'
                  }`}
                >
                  {tag}
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
                <p className="text-sage-600">No results found for "{searchQuery}"</p>
                <p className="text-sage-500 text-sm mt-2">Try different keywords or check your spelling</p>
              </div>
            )}

            {/* Places */}
            {(activeFilter === 'all' || activeFilter === 'places') && searchResults.places.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-sage-800 mb-3">
                  Places ({searchResults.places.length})
                </h3>
                <div className="space-y-3">
                  {searchResults.places.map((place) => (
                    <div
                      key={place.id}
                      className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-cream-200 hover:shadow-liquid transition-all duration-300"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-sage-800 mb-1">{place.name}</h4>
                          <div className="flex items-center text-sage-600 text-sm mb-2">
                            <MapPinIcon className="w-4 h-4 mr-1" />
                            {place.address}
                          </div>
                          <div className="flex flex-wrap gap-1 mb-3">
                            {place.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-1 bg-coral-100 text-coral-700 text-xs rounded-full"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4 text-sm text-sage-600">
                              <span className="flex items-center">
                                <HeartIcon className="w-4 h-4 mr-1" />
                                {place.savedCount} saved
                              </span>
                            </div>
                            <button className="bg-gradient-to-r from-coral-500 to-coral-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:from-coral-600 hover:to-coral-700 transition-all duration-300 shadow-soft">
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
                <h3 className="text-lg font-semibold text-sage-800 mb-3">
                  Lists ({searchResults.lists.length})
                </h3>
                <div className="space-y-3">
                  {searchResults.lists.map((list) => (
                    <div
                      key={list.id}
                      className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-cream-200 hover:shadow-liquid transition-all duration-300"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-sage-800 mb-1">{list.name}</h4>
                          <p className="text-sm text-sage-600 mb-2">{list.description}</p>
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
                            <span className="text-xs text-sage-500">Updated {new Date(list.updatedAt).toLocaleDateString()}</span>
                            <button className="text-coral-600 hover:text-coral-700 text-sm font-medium transition-colors">
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
                <h3 className="text-lg font-semibold text-sage-800 mb-3">
                  People ({searchResults.users.length})
                </h3>
                <div className="space-y-3">
                  {searchResults.users.map((user) => (
                    <div
                      key={user.id}
                      className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-cream-200 hover:shadow-liquid transition-all duration-300"
                    >
                      <div className="flex items-center space-x-3">
                        {user.avatar ? (
                          <div className="w-12 h-12 rounded-full border-2 border-cream-200 bg-cream-50/80 backdrop-blur-sm relative overflow-hidden">
                            <img
                              src={user.avatar}
                              alt={user.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 border border-white/30 rounded-full"></div>
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-gradient-to-br from-sage-100 to-sage-200 rounded-full flex items-center justify-center border-2 border-cream-200">
                            <UserIcon className="w-6 h-6 text-sage-600" />
                          </div>
                        )}
                        <div className="flex-1">
                          <h4 className="font-semibold text-sage-800">{user.name}</h4>
                          <p className="text-sm text-sage-600">@{user.username}</p>
                          {user.bio && (
                            <p className="text-sm text-sage-600 mt-1">{user.bio}</p>
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