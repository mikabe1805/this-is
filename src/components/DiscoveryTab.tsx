import type { Place, List, Hub, User } from '../types/index.js'
import { MapPinIcon, BookmarkIcon, StarIcon, FireIcon, EllipsisHorizontalIcon, SparklesIcon, UserIcon } from '@heroicons/react/24/outline'
import { useState, useEffect } from 'react'
import SearchAndFilter from './SearchAndFilter'
import HubModal from './HubModal'
import ListModal from './ListModal'
import ListMenuDropdown from './ListMenuDropdown'
import { useNavigation } from '../contexts/NavigationContext.tsx'
import { useModal } from '../contexts/ModalContext.tsx'
import { 
  getPersonalizedRecommendations,
  type SearchContext,
  type DiscoveryRecommendation 
} from '../utils/intelligentSearchService.js'
import { firebaseDataService } from '../services/firebaseDataService.js'

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
  const [savedLists, setSavedLists] = useState<Set<string>>(new Set())
  const [personalizedRecommendations, setPersonalizedRecommendations] = useState<DiscoveryRecommendation[]>([])
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(true)
  
  // Firebase data state
  const [trendingHubs, setTrendingHubs] = useState<Place[]>([])
  const [popularLists, setPopularLists] = useState<List[]>([])
  const [isLoadingTrending, setIsLoadingTrending] = useState(true)

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
        
        // No fallback - require real data
        setSearchContext(null)
      } finally {
        setContextLoading(false)
      }
    }

    buildFirebaseContext()
  }, [currentUser.id])
  
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
    { key: 'popular', label: 'Most Popular' },
    { key: 'trending', label: 'Trending Now' },
    { key: 'nearby', label: 'Closest to Location' },
  ]
  const filterOptions = [
    { key: 'coffee', label: 'Coffee' },
    { key: 'food', label: 'Food' },
    { key: 'outdoors', label: 'Outdoors' },
  ]
  const availableTags = ['cozy', 'trendy', 'quiet', 'local', 'charming', 'authentic', 'chill']

  const [sortBy, setSortBy] = useState('popular')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
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
        <SearchAndFilter
          placeholder="Search places, lists, or friends..."
          sortOptions={sortOptions}
          filterOptions={filterOptions}
          availableTags={availableTags}
          sortBy={sortBy}
          setSortBy={setSortBy}
          activeFilters={activeFilters}
          setActiveFilters={setActiveFilters}
          dropdownPosition="top-right"
        />
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
                        {rec.algorithm.replace('_', ' ')}
                      </span>
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full font-medium">
                        {Math.round(rec.confidence * 100)}% match
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
                      <div>{rec.reasons.join(' • ')}</div>
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
                            mainImage: 'hubImage' in rec.item ? rec.item.hubImage : undefined,
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
          <h2 className="text-xl font-serif font-semibold text-charcoal-800">Trending Hubs</h2>
        </div>
        <div className="space-y-3">
          {isLoadingTrending ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600"></div>
              <p className="mt-2 text-sm text-charcoal-600">Loading trending places...</p>
            </div>
          ) : trendingHubs.length === 0 ? (
            <p className="text-center py-8 text-charcoal-600">No trending places yet.</p>
          ) : (
            trendingHubs.map((place) => (
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
                    <div className="flex items-center gap-2 text-sm text-charcoal-600">
                      <BookmarkIcon className="w-4 h-4" />
                      <span>{place.savedCount} saved</span>
                    </div>
                  </div>
                  <div className="p-2 rounded-full bg-sage-50 text-sage-600">
                    <BookmarkIcon className="w-4 h-4" />
                  </div>
                </div>
              </button>
            ))
          )}
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
          ) : popularLists.length === 0 ? (
            <p className="text-center py-8 text-charcoal-600">No popular lists yet.</p>
          ) : (
            popularLists.map((list) => (
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
                          <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium bg-sage-50 border border-sage-100 text-sage-700">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-charcoal-500">
                        <span>{list.likes} likes</span>
                        <span>•</span>
                        <span>Updated {new Date(list.updatedAt).toLocaleDateString()}</span>
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
          )}
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
        onTogglePrivacy={() => {
          console.log('Toggle privacy for list:', selectedListId)
          // TODO: Implement privacy toggle
        }}
        onDelete={() => {
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