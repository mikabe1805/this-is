import React, { useState, useEffect } from 'react'
import { MapPinIcon, HeartIcon, UserIcon, ClockIcon, FireIcon, BookmarkIcon, PlusIcon, FunnelIcon, MagnifyingGlassIcon, SparklesIcon } from '@heroicons/react/24/outline'
import type { User, Place, List, Post } from '../types/index.js'
import { 
  searchIntelligently, 
  getPersonalizedRecommendations,
  type SearchContext,
  type IntelligentSearchResult,
  type DiscoveryRecommendation 
} from '../utils/intelligentSearchService.js'

// Mock data for demonstration
const mockCurrentUser: User = {
  id: '1',
  name: 'You',
  username: 'current_user',
  avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
  bio: 'Love discovering cozy coffee spots and authentic food',
  location: 'San Francisco, CA',
  tags: ['coffee', 'cozy', 'authentic', 'local', 'foodie']
}

const mockFriends: User[] = [
  {
    id: '2',
    name: 'Sara Chen',
    username: 'sara_chen',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
    bio: 'Coffee enthusiast and local guide',
    tags: ['coffee', 'cozy', 'work-friendly']
  },
  {
    id: '3', 
    name: 'Mike Rodriguez',
    username: 'mike_r',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    bio: 'Taco connoisseur and adventure seeker',
    tags: ['tacos', 'authentic', 'adventure']
  }
]

const mockPlaces: Place[] = [
  {
    id: '1',
    name: 'Blue Bottle Coffee',
    address: '300 Webster St, Oakland, CA',
    coordinates: { lat: 37.8044, lng: -122.2711 },
    category: 'coffee',
    tags: ['coffee', 'cozy', 'work-friendly', 'artisan'],
    posts: [],
    savedCount: 45,
    createdAt: '2024-01-15'
  },
  {
    id: '2',
    name: 'Tartine Bakery',
    address: '600 Guerrero St, San Francisco, CA',
    coordinates: { lat: 37.7594, lng: -122.4241 },
    category: 'bakery',
    tags: ['bakery', 'pastries', 'cozy', 'artisan'],
    posts: [],
    savedCount: 67,
    createdAt: '2024-01-10'
  },
  {
    id: '3',
    name: 'La Taqueria',
    address: '2889 Mission St, San Francisco, CA',
    coordinates: { lat: 37.7516, lng: -122.4180 },
    category: 'mexican',
    tags: ['tacos', 'authentic', 'quick', 'local'],
    posts: [],
    savedCount: 89,
    createdAt: '2024-01-12'
  }
]

const mockLists: List[] = [
  {
    id: '1',
    name: 'Sara\'s Favorite Coffee Spots',
    description: 'The best coffee shops for working and relaxing',
    userId: '2',
    isPublic: true,
    isShared: false,
    privacy: 'public',
    tags: ['coffee', 'work-friendly', 'cozy'],
    hubs: [],
    coverImage: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300&h=200&fit=crop',
    createdAt: '2024-01-10',
    updatedAt: '2024-01-15',
    likes: 24,
    isLiked: false
  },
  {
    id: '2', 
    name: 'Hidden Gems in Mission',
    description: 'Local favorites that tourists don\'t know about',
    userId: '3',
    isPublic: true,
    isShared: false,
    privacy: 'public',
    tags: ['hidden-gems', 'local', 'authentic'],
    hubs: [],
    coverImage: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=300&h=200&fit=crop',
    createdAt: '2024-01-08',
    updatedAt: '2024-01-14',
    likes: 18,
    isLiked: false
  }
]

const EnhancedSearchDemo = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<IntelligentSearchResult | null>(null)
  const [discoveries, setDiscoveries] = useState<DiscoveryRecommendation[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showExamples, setShowExamples] = useState(true)

  // Example queries to demonstrate the intelligence
  const exampleQueries = [
    "sara's favorite coffee spots",
    "cozy places for working", 
    "best tacos near mission",
    "authentic local hidden gems",
    "mike's recommendations"
  ]

  // Mock search context
  const searchContext: SearchContext = {
    currentUser: mockCurrentUser,
    friends: mockFriends,
    following: [],
    userHistory: {
      searches: ['coffee', 'tacos', 'cozy spots', 'work friendly'],
      savedPlaces: ['1', '2'],
      likedLists: ['1'],
      visitedPlaces: ['1', '3']
    },
    location: {
      lat: 37.7749,
      lng: -122.4194
    }
  }

  // Load discovery recommendations on mount
  useEffect(() => {
    loadDiscoveries()
  }, [])

  const loadDiscoveries = async () => {
    try {
      const recs = await getPersonalizedRecommendations(searchContext, 10)
      setDiscoveries(recs)
    } catch (error) {
      console.error('Failed to load discoveries:', error)
    }
  }

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults(null)
      setShowExamples(true)
      return
    }

    setIsSearching(true)
    setShowExamples(false)

    try {
      // Create mock data sources for demonstration
      const mockDataSources = {
        places: mockPlaces,
        lists: mockLists,
        users: mockFriends,
        posts: []
      }

      const results = await searchIntelligently(
        query,
        searchContext,
        {}, // No filters for demo
        {
          maxResults: 20,
          includeDiscovery: query.length < 3, // Show discoveries for short/empty queries
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

      // Mock some results since we don't have a real backend
      const mockResults: IntelligentSearchResult = {
        ...results,
        places: mockPlaces.filter(place => 
          place.name.toLowerCase().includes(query.toLowerCase()) ||
          place.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase())) ||
          place.address.toLowerCase().includes(query.toLowerCase())
        ).map(place => ({
          item: place,
          score: 85 + Math.random() * 15,
          reasons: generateMockReasons(place, query),
          category: 'semantic_match' as const
        })),
        lists: mockLists.filter(list =>
          list.name.toLowerCase().includes(query.toLowerCase()) ||
          list.description.toLowerCase().includes(query.toLowerCase()) ||
          list.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase())) ||
          (query.toLowerCase().includes('sara') && list.userId === '2') ||
          (query.toLowerCase().includes('mike') && list.userId === '3')
        ).map(list => ({
          item: list,
          score: 80 + Math.random() * 20,
          reasons: generateMockListReasons(list, query),
          category: 'user_connection' as const
        })),
        users: mockFriends.filter(user =>
          user.name.toLowerCase().includes(query.toLowerCase()) ||
          user.username.toLowerCase().includes(query.toLowerCase())
        ).map(user => ({
          item: user,
          score: 90 + Math.random() * 10,
          reasons: ['Exact name match', 'In your friends list'],
          category: 'exact_match' as const
        })),
        posts: []
      }

      setSearchResults(mockResults)
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const generateMockReasons = (place: Place, query: string): string[] => {
    const reasons: string[] = []
    
    if (place.name.toLowerCase().includes(query.toLowerCase())) {
      reasons.push('Exact name match')
    }
    
    if (place.tags.some(tag => query.toLowerCase().includes(tag))) {
      const matchingTags = place.tags.filter(tag => query.toLowerCase().includes(tag))
      reasons.push(`Matches your interests: ${matchingTags.join(', ')}`)
    }
    
    if (place.savedCount > 50) {
      reasons.push('Popular place')
    }
    
    if (mockCurrentUser.tags?.some(tag => place.tags.includes(tag))) {
      reasons.push('Matches your profile interests')
    }
    
    return reasons
  }

  const generateMockListReasons = (list: List, query: string): string[] => {
    const reasons: string[] = []
    
    if (query.toLowerCase().includes('sara') && list.userId === '2') {
      reasons.push('Sara\'s curated list')
    }
    
    if (query.toLowerCase().includes('mike') && list.userId === '3') {
      reasons.push('Mike\'s recommendations')
    }
    
    if (list.tags.some(tag => query.toLowerCase().includes(tag))) {
      reasons.push('Matches search intent')
    }
    
    if (list.likes > 20) {
      reasons.push('Highly rated by community')
    }
    
    return reasons
  }

  const handleExampleClick = (example: string) => {
    setSearchQuery(example)
    handleSearch(example)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FEF6E9] via-[#FBF0D9] to-[#F7E8CC] p-4">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <SparklesIcon className="w-8 h-8 text-[#B08968]" />
            <h1 className="text-3xl font-serif font-bold text-[#5D4A2E]">
              Intelligent Search Demo
            </h1>
            <SparklesIcon className="w-8 h-8 text-[#B08968]" />
          </div>
          <p className="text-[#7A5D3F] text-lg max-w-2xl mx-auto">
            Experience the power of natural language search and personalized discovery. 
            Try queries like "sara's favorite coffee" or "cozy work spots".
          </p>
        </div>

        {/* Search Bar */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-[#E8D4C0]/40 mb-6">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#B08968]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
              placeholder="Try: 'sara's favorite coffee spots' or 'cozy places for working'"
              className="w-full pl-12 pr-4 py-4 rounded-xl border border-[#E8D4C0]/50 bg-[#FEF6E9]/50 text-[#5D4A2E] placeholder-[#B08968]/70 focus:outline-none focus:ring-2 focus:ring-[#B08968]/30 focus:border-[#B08968] text-lg"
            />
            {isSearching && (
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-[#B08968]/30 border-t-[#B08968] rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          
          <button
            onClick={() => handleSearch(searchQuery)}
            className="mt-4 w-full bg-gradient-to-r from-[#B08968] to-[#9A7B5A] text-white py-3 rounded-xl font-semibold shadow-lg hover:from-[#9A7B5A] hover:to-[#8B6F47] transition-all duration-300"
          >
            Search Intelligently
          </button>
        </div>

        {/* Example Queries */}
        {showExamples && (
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-[#E8D4C0]/40 mb-6">
            <h3 className="text-lg font-serif font-semibold text-[#5D4A2E] mb-4 flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-[#B08968]" />
              Try These Smart Queries
            </h3>
            <div className="flex flex-wrap gap-2">
              {exampleQueries.map((example, index) => (
                <button
                  key={index}
                  onClick={() => handleExampleClick(example)}
                  className="px-4 py-2 bg-gradient-to-r from-[#D4A574] to-[#C17F59] text-white rounded-xl text-sm font-medium hover:from-[#C17F59] hover:to-[#B08968] transition-all duration-300 shadow-md"
                >
                  "{example}"
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search Results */}
        {searchResults && (
          <div className="space-y-6">
            
            {/* Query Analysis */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-[#E8D4C0]/40">
              <h3 className="text-lg font-serif font-semibold text-[#5D4A2E] mb-4">
                🧠 Query Analysis
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-[#7A5D3F]">Intent:</span>
                  <p className="text-[#5D4A2E]">{searchResults.query.intent}</p>
                </div>
                <div>
                  <span className="font-medium text-[#7A5D3F]">Confidence:</span>
                  <p className="text-[#5D4A2E]">{Math.round(searchResults.query.confidence * 100)}%</p>
                </div>
                <div>
                  <span className="font-medium text-[#7A5D3F]">Algorithms:</span>
                  <p className="text-[#5D4A2E]">{searchResults.analytics.algorithmsUsed.join(', ')}</p>
                </div>
              </div>
            </div>

            {/* Places Results */}
            {searchResults.places.length > 0 && (
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-[#E8D4C0]/40">
                <h3 className="text-lg font-serif font-semibold text-[#5D4A2E] mb-4">
                  📍 Places ({searchResults.places.length})
                </h3>
                <div className="space-y-3">
                  {searchResults.places.map((result, index) => (
                    <div key={result.item.id} className="bg-[#FEF6E9]/80 rounded-xl p-4 border border-[#E8D4C0]/30">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-[#5D4A2E] mb-1">{result.item.name}</h4>
                          <p className="text-sm text-[#7A5D3F] mb-2 flex items-center gap-1">
                            <MapPinIcon className="w-4 h-4" />
                            {result.item.address}
                          </p>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {result.item.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="px-2 py-1 bg-[#B08968]/20 text-[#B08968] text-xs rounded-full">
                                #{tag}
                              </span>
                            ))}
                          </div>
                          <div className="text-xs text-[#9A7B5A] space-y-1">
                            <div>Score: {Math.round(result.score)}/100</div>
                            <div>Reasons: {result.reasons.join(', ')}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <span className="px-2 py-1 bg-[#D4A574]/30 text-[#B08968] text-xs rounded-full font-medium">
                            {result.category}
                          </span>
                          <button className="p-2 rounded-full bg-[#B08968]/20 text-[#B08968] hover:bg-[#B08968]/30 transition">
                            <BookmarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lists Results */}
            {searchResults.lists.length > 0 && (
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-[#E8D4C0]/40">
                <h3 className="text-lg font-serif font-semibold text-[#5D4A2E] mb-4">
                  📝 Lists ({searchResults.lists.length})
                </h3>
                <div className="space-y-3">
                  {searchResults.lists.map((result, index) => (
                    <div key={result.item.id} className="bg-[#FEF6E9]/80 rounded-xl p-4 border border-[#E8D4C0]/30">
                      <div className="flex items-start gap-4">
                        {result.item.coverImage && (
                          <img 
                            src={result.item.coverImage} 
                            alt={result.item.name}
                            className="w-16 h-16 rounded-lg object-cover"
                          />
                        )}
                        <div className="flex-1">
                          <h4 className="font-semibold text-[#5D4A2E] mb-1">{result.item.name}</h4>
                          <p className="text-sm text-[#7A5D3F] mb-2">{result.item.description}</p>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {result.item.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="px-2 py-1 bg-[#C17F59]/20 text-[#C17F59] text-xs rounded-full">
                                #{tag}
                              </span>
                            ))}
                          </div>
                          <div className="text-xs text-[#9A7B5A] space-y-1">
                            <div>Score: {Math.round(result.score)}/100</div>
                            <div>Reasons: {result.reasons.join(', ')}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-[#D4A574]/30 text-[#B08968] text-xs rounded-full font-medium">
                            {result.category}
                          </span>
                          <button className="p-2 rounded-full bg-[#C17F59]/20 text-[#C17F59] hover:bg-[#C17F59]/30 transition">
                            <HeartIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Users Results */}
            {searchResults.users.length > 0 && (
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-[#E8D4C0]/40">
                <h3 className="text-lg font-serif font-semibold text-[#5D4A2E] mb-4">
                  👥 People ({searchResults.users.length})
                </h3>
                <div className="space-y-3">
                  {searchResults.users.map((result, index) => (
                    <div key={result.item.id} className="bg-[#FEF6E9]/80 rounded-xl p-4 border border-[#E8D4C0]/30">
                      <div className="flex items-center gap-4">
                        <img 
                          src={result.item.avatar} 
                          alt={result.item.name}
                          className="w-12 h-12 rounded-full object-cover border-2 border-[#E8D4C0]"
                        />
                        <div className="flex-1">
                          <h4 className="font-semibold text-[#5D4A2E]">{result.item.name}</h4>
                          <p className="text-sm text-[#7A5D3F]">@{result.item.username}</p>
                          {result.item.bio && (
                            <p className="text-sm text-[#9A7B5A] mt-1">{result.item.bio}</p>
                          )}
                          <div className="text-xs text-[#9A7B5A] mt-2">
                            Reasons: {result.reasons.join(', ')}
                          </div>
                        </div>
                        <button className="px-4 py-2 bg-gradient-to-r from-[#B08968] to-[#9A7B5A] text-white rounded-xl text-sm font-medium hover:from-[#9A7B5A] hover:to-[#8B6F47] transition">
                          View Profile
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Discovery Recommendations */}
        {discoveries.length > 0 && showExamples && (
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-[#E8D4C0]/40">
            <h3 className="text-lg font-serif font-semibold text-[#5D4A2E] mb-4 flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-[#D4A574]" />
              Personalized Discoveries
            </h3>
            <p className="text-sm text-[#7A5D3F] mb-4">
              Based on your preferences and activity patterns
            </p>
            <div className="space-y-3">
              {discoveries.slice(0, 3).map((rec, index) => (
                <div key={`${rec.type}-${rec.item.id}`} className="bg-[#FEF6E9]/80 rounded-xl p-4 border border-[#E8D4C0]/30">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-[#5D4A2E] mb-1">{rec.item.name}</h4>
                      <p className="text-sm text-[#7A5D3F] mb-2">
                        {'address' in rec.item ? rec.item.address : rec.item.description}
                      </p>
                      <div className="text-xs text-[#9A7B5A] space-y-1">
                        <div>Algorithm: {rec.algorithm}</div>
                        <div>Confidence: {Math.round(rec.confidence * 100)}%</div>
                        <div>Reasons: {rec.reasons.join(', ')}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <span className="px-2 py-1 bg-[#D4A574]/30 text-[#D4A574] text-xs rounded-full font-medium">
                        {rec.algorithm}
                      </span>
                      <button className="p-2 rounded-full bg-[#D4A574]/20 text-[#D4A574] hover:bg-[#D4A574]/30 transition">
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
  )
}

export default EnhancedSearchDemo 