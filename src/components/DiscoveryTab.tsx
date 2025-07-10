import type { Place, List } from '../types/index.js'
import { MapPinIcon, HeartIcon, BookmarkIcon, StarIcon } from '@heroicons/react/24/outline'

const DiscoveryTab = () => {
  // Mock data - in real app this would come from API
  const trendingPlaces: Place[] = [
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
    }
  ]

  const suggestedLists: List[] = [
    {
      id: '1',
      name: 'Hidden Gems in Oakland',
      description: 'Local favorites that tourists don\'t know about',
      userId: '1',
      isPublic: true,
      isShared: false,
      tags: ['oakland', 'local', 'hidden-gems'],
      places: [],
      coverImage: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=300&h=200&fit=crop',
      createdAt: '2024-01-10',
      updatedAt: '2024-01-15'
    },
    {
      id: '2',
      name: 'Cozy Coffee Shops',
      description: 'Perfect spots for working remotely',
      userId: '2',
      isPublic: true,
      isShared: false,
      tags: ['coffee', 'work-friendly', 'cozy'],
      places: [],
      coverImage: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300&h=200&fit=crop',
      createdAt: '2024-01-12',
      updatedAt: '2024-01-14'
    }
  ]

  return (
    <div className="p-4 space-y-6">
      {/* Trending Places */}
      <div>
        <h2 className="text-lg font-semibold text-sage-800 mb-4">Trending Near You</h2>
        <div className="space-y-3">
          {trendingPlaces.map((place) => (
            <div
              key={place.id}
              className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-cream-200 hover:shadow-liquid transition-all duration-300"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-sage-800 mb-1">{place.name}</h3>
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

      {/* Suggested Lists */}
      <div>
        <h2 className="text-lg font-semibold text-sage-800 mb-4">Lists You Might Like</h2>
        <div className="space-y-3">
          {suggestedLists.map((list) => (
            <div
              key={list.id}
              className="bg-white/70 backdrop-blur-sm rounded-2xl overflow-hidden shadow-soft border border-cream-200 hover:shadow-liquid transition-all duration-300"
            >
              {list.coverImage && (
                <div className="h-32 bg-gradient-to-br from-cream-200 to-coral-200 relative">
                  <img
                    src={list.coverImage}
                    alt={list.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/10"></div>
                </div>
              )}
              <div className="p-4">
                <h3 className="font-semibold text-sage-800 mb-1">{list.name}</h3>
                <p className="text-sm text-sage-600 mb-3">{list.description}</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {list.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-sage-100 text-sage-700 text-xs rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-sm text-sage-600">
                    <StarIcon className="w-4 h-4" />
                    <span>Curated by community</span>
                  </div>
                  <button className="text-coral-600 hover:text-coral-700 text-sm font-medium transition-colors">
                    Follow List
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-br from-coral-50 to-coral-100 rounded-2xl p-4">
        <h3 className="font-semibold text-coral-800 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <button className="bg-white/80 backdrop-blur-sm rounded-xl p-3 text-center hover:bg-white transition-all duration-300 shadow-soft">
            <BookmarkIcon className="w-6 h-6 text-coral-600 mx-auto mb-2" />
            <span className="text-sm font-medium text-sage-800">Create List</span>
          </button>
          <button className="bg-white/80 backdrop-blur-sm rounded-xl p-3 text-center hover:bg-white transition-all duration-300 shadow-soft">
            <MapPinIcon className="w-6 h-6 text-sage-600 mx-auto mb-2" />
            <span className="text-sm font-medium text-sage-800">Find Nearby</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default DiscoveryTab 