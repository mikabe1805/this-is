import type { List, ListPlace } from '../types/index.js'
import { MapPinIcon, HeartIcon, BookmarkIcon, ShareIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline'

const ListView = () => {
  // Mock list data
  const list: List = {
    id: '1',
    name: 'Cozy Coffee Spots',
    description: 'Perfect places to work and relax with great coffee and atmosphere',
    userId: '1',
    isPublic: true,
    isShared: false,
    tags: ['coffee', 'work-friendly', 'cozy', 'oakland'],
    coverImage: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=200&fit=crop',
    places: [],
    createdAt: '2024-01-10',
    updatedAt: '2024-01-15'
  }

  const listPlaces: ListPlace[] = [
    {
      id: '1',
      placeId: '1',
      place: {
        id: '1',
        name: 'Blue Bottle Coffee',
        address: '300 Webster St, Oakland, CA',
        tags: ['coffee', 'cozy', 'work-friendly'],
        posts: [],
        savedCount: 45,
        createdAt: '2024-01-15'
      },
      note: 'Perfect spot for morning meetings. Great oat milk lattes!',
      addedBy: '1',
      addedAt: '2024-01-15T10:30:00Z'
    },
    {
      id: '2',
      placeId: '2',
      place: {
        id: '2',
        name: 'Souvenir Coffee',
        address: '1500 Webster St, Oakland, CA',
        tags: ['coffee', 'artisan', 'quiet'],
        posts: [],
        savedCount: 32,
        createdAt: '2024-01-14'
      },
      note: 'Hidden gem with amazing pour-over coffee. Very peaceful.',
      addedBy: '1',
      addedAt: '2024-01-14T15:20:00Z'
    }
  ]

  return (
    <div className="min-h-full bg-gradient-to-br from-cream-50 to-coral-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-cream-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-sage-800">List</h1>
          <div className="flex items-center space-x-2">
            <button className="w-10 h-10 bg-gradient-to-br from-coral-100 to-coral-200 rounded-full flex items-center justify-center shadow-soft">
              <ShareIcon className="w-5 h-5 text-coral-600" />
            </button>
            <button className="w-10 h-10 bg-gradient-to-br from-sage-100 to-sage-200 rounded-full flex items-center justify-center shadow-soft">
              <EllipsisHorizontalIcon className="w-5 h-5 text-sage-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* List Header */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl overflow-hidden shadow-soft border border-cream-200">
          {list.coverImage && (
            <div className="h-32 bg-gradient-to-br from-cream-200 to-coral-200 relative overflow-hidden">
              <img
                src={list.coverImage}
                alt={list.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-black/5 to-transparent backdrop-blur-[1px]"></div>
              <div className="absolute inset-0 border border-white/20"></div>
            </div>
          )}
          <div className="p-6">
            <h2 className="text-2xl font-bold text-sage-800 mb-2">{list.name}</h2>
            <p className="text-sage-600 mb-4">{list.description}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {list.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-coral-100 text-coral-700 text-sm rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 text-sm text-sage-600">
                <span>{listPlaces.length} places</span>
                <span>•</span>
                <span>Updated {new Date(list.updatedAt).toLocaleDateString()}</span>
              </div>
              <button className="bg-gradient-to-r from-coral-500 to-coral-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:from-coral-600 hover:to-coral-700 transition-all duration-300 shadow-soft">
                Add Place
              </button>
            </div>
          </div>
        </div>

        {/* Places */}
        <div>
          <h3 className="text-lg font-semibold text-sage-800 mb-4">Places</h3>
          <div className="space-y-3">
            {listPlaces.map((listPlace) => (
              <div
                key={listPlace.id}
                className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-cream-200 hover:shadow-liquid transition-all duration-300"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-sage-800 mb-1">{listPlace.place.name}</h4>
                    <div className="flex items-center text-sage-600 text-sm mb-2">
                      <MapPinIcon className="w-4 h-4 mr-1" />
                      {listPlace.place.address}
                    </div>
                    {listPlace.note && (
                      <p className="text-sm text-sage-700 mb-3 italic">"{listPlace.note}"</p>
                    )}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {listPlace.place.tags.map((tag) => (
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
                          {listPlace.place.savedCount} saved
                        </span>
                        <span>•</span>
                        <span>Added {new Date(listPlace.addedAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button className="text-coral-600 hover:text-coral-700 text-sm font-medium transition-colors">
                          Edit
                        </button>
                        <button className="text-sage-600 hover:text-sage-700 text-sm font-medium transition-colors">
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Empty State */}
        {listPlaces.length === 0 && (
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 text-center shadow-soft border border-cream-200">
            <BookmarkIcon className="w-16 h-16 text-sage-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-sage-800 mb-2">No places yet</h3>
            <p className="text-sage-600 mb-4">Start building your list by adding your favorite places</p>
            <button className="bg-gradient-to-r from-coral-500 to-coral-600 text-white px-6 py-3 rounded-xl font-medium hover:from-coral-600 hover:to-coral-700 transition-all duration-300 shadow-soft">
              Add Your First Place
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ListView 