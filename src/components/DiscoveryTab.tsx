import type { Place, List, Hub } from '../types/index.js'
import { MapPinIcon, BookmarkIcon, StarIcon, TrendingUpIcon, FireIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import SearchAndFilter from './SearchAndFilter'
import HubModal from './HubModal'
import ListModal from './ListModal'
import ListMenuDropdown from './ListMenuDropdown'
import { useNavigation } from '../contexts/NavigationContext.tsx'

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
  const [savedLists, setSavedLists] = useState<Set<string>>(new Set())
  
  // Mock data - trending hubs (places that are gaining popularity)
  const trendingHubs: Place[] = [
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
      name: 'Golden Gate Park',
      address: 'San Francisco, CA',
      tags: ['outdoors', 'scenic', 'free'],
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

  const popularLists: List[] = [
    {
      id: '1',
      name: 'Hidden Gems in Oakland',
      description: 'Local favorites that tourists don\'t know about',
      userId: '1',
      isPublic: true,
      isShared: false,
      privacy: 'public',
      tags: ['oakland', 'local', 'hidden-gems'],
      hubs: [],
      coverImage: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=300&h=200&fit=crop',
      createdAt: '2024-01-10',
      updatedAt: '2024-01-15',
      likes: 34,
      isLiked: false
    },
    {
      id: '2',
      name: 'Cozy Coffee Shops',
      description: 'Perfect spots for working remotely',
      userId: '2',
      isPublic: true,
      isShared: false,
      privacy: 'public',
      tags: ['coffee', 'work-friendly', 'cozy'],
      hubs: [],
      coverImage: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300&h=200&fit=crop',
      createdAt: '2024-01-12',
      updatedAt: '2024-01-14',
      likes: 28,
      isLiked: false
    },
    {
      id: '3',
      name: 'Best Tacos in SF',
      description: 'Authentic Mexican food spots',
      userId: '3',
      isPublic: true,
      isShared: false,
      privacy: 'public',
      tags: ['tacos', 'authentic', 'mexican'],
      hubs: [],
      coverImage: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=300&h=200&fit=crop',
      createdAt: '2024-01-11',
      updatedAt: '2024-01-13',
      likes: 42,
      isLiked: false
    }
  ]

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
    // In a real app, this would open SaveModal
    console.log('Save hub:', hub.name)
    closeHubModal()
  }

  const handleHubModalAddPost = (hub: Hub) => {
    // In a real app, this would open CreatePost modal
    console.log('Add post to hub:', hub.name)
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

      {/* Trending Hubs */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <FireIcon className="w-6 h-6 text-gold-500" />
          <h2 className="text-xl font-serif font-semibold text-charcoal-800">Trending Hubs</h2>
        </div>
        <div className="space-y-3">
          {trendingHubs.map((place) => (
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
          ))}
        </div>
      </div>

      {/* Popular Lists */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <StarIcon className="w-6 h-6 text-gold-500" />
          <h2 className="text-xl font-serif font-semibold text-charcoal-800">Popular Lists</h2>
        </div>
        <div className="space-y-4">
          {popularLists.map((list) => (
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
          ))}
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
          onSave={(list) => console.log('Save list:', list.name)}
          onAddPost={(list) => console.log('Add post to list:', list.name)}
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