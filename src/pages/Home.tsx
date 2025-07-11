import { useState } from 'react'
import { HeartIcon, BookmarkIcon, EyeIcon, PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid'

// Mock data for the home feed
const mockFriendsActivity = [
  {
    id: '1',
    user: {
      name: 'Emma',
      avatar: 'https://randomuser.me/api/portraits/women/44.jpg'
    },
    action: 'loved',
    place: 'Blue Bottle Coffee',
    placeImage: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&h=300&fit=crop',
    note: 'The cold brew here is absolutely divine!',
    timestamp: '2 hours ago',
    list: 'All Loved'
  },
  {
    id: '2',
    user: {
      name: 'Rami',
      avatar: 'https://randomuser.me/api/portraits/men/32.jpg'
    },
    action: 'created',
    list: 'SF Coffee Tour',
    description: 'Exploring the best coffee spots in San Francisco',
    places: 8,
    timestamp: '4 hours ago'
  },
  {
    id: '3',
    user: {
      name: 'Sophie',
      avatar: 'https://randomuser.me/api/portraits/women/68.jpg'
    },
    action: 'tried',
    place: 'Tartine Bakery',
    placeImage: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=300&fit=crop',
    note: 'Their morning bun is life-changing!',
    timestamp: '1 day ago',
    list: 'All Tried'
  }
]

const mockDiscovery = [
  {
    id: '1',
    type: 'list',
    title: 'Cozy Winter Cafes',
    description: 'Perfect spots for reading and people watching',
    owner: 'Emma',
    likes: 24,
    places: 12,
    image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop'
  },
  {
    id: '2',
    type: 'hub',
    title: 'Mission Chinese Food',
    description: 'New hub created by Rami',
    activity: '3 friends have been here',
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop'
  },
  {
    id: '3',
    type: 'list',
    title: 'Hidden Bookstores',
    description: 'Quiet places to discover new reads',
    owner: 'Sophie',
    likes: 18,
    places: 8,
    image: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=300&fit=crop'
  }
]

const Home = () => {
  const [activeTab, setActiveTab] = useState<'friends' | 'discovery'>('friends')

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'loved':
        return <HeartIconSolid className="w-5 h-5 text-warm-500" />
      case 'tried':
        return <BookmarkIcon className="w-5 h-5 text-sage-500" />
      case 'want':
        return <EyeIcon className="w-5 h-5 text-earth-500" />
      case 'created':
        return <PlusIcon className="w-5 h-5 text-warm-500" />
      default:
        return null
    }
  }

  const getActionText = (action: string) => {
    switch (action) {
      case 'loved':
        return 'loved'
      case 'tried':
        return 'tried'
      case 'want':
        return 'wants to try'
      case 'created':
        return 'created a list'
      default:
        return action
    }
  }

  const handleActivityClick = (activity: typeof mockFriendsActivity[0]) => {
    if (activity.action === 'created') {
      alert(`Opening ${activity.user.name}'s list: "${activity.list}"`)
    } else {
      alert(`Opening place hub for ${activity.place}`)
    }
  }

  const handleDiscoveryClick = (item: typeof mockDiscovery[0]) => {
    if (item.type === 'list') {
      alert(`Opening list: "${item.title}" by ${item.owner}`)
    } else {
      alert(`Opening place hub for ${item.title}`)
    }
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-cream-50 via-warm-50 to-sage-50">
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-serif font-bold text-earth-800">
              This Is
            </h1>
            <p className="text-earth-600 text-sm">
              Your personal memory journal
            </p>
          </div>
          <button className="w-10 h-10 bg-gradient-to-r from-warm-500 to-earth-500 rounded-full flex items-center justify-center text-white shadow-soft hover:shadow-lg transition-all duration-300">
            <PlusIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-earth-400" />
          <input
            type="text"
            placeholder="Search places, lists, or friends..."
            className="w-full pl-12 pr-4 py-3 bg-white/80 backdrop-blur-glass rounded-xl border border-white/30 focus:outline-none focus:ring-2 focus:ring-warm-300 focus:border-transparent shadow-soft"
          />
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-white/60 backdrop-blur-glass rounded-xl p-1 mb-6">
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-200 ${
              activeTab === 'friends'
                ? 'bg-gradient-to-r from-warm-500 to-warm-400 text-white shadow-warm-200'
                : 'text-earth-600 hover:text-earth-800'
            }`}
          >
            Friends
          </button>
          <button
            onClick={() => setActiveTab('discovery')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-200 ${
              activeTab === 'discovery'
                ? 'bg-gradient-to-r from-warm-500 to-warm-400 text-white shadow-warm-200'
                : 'text-earth-600 hover:text-earth-800'
            }`}
          >
            Discovery
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 pb-6">
        {activeTab === 'friends' ? (
          /* Friends Tab */
          <div className="space-y-4">
            <h2 className="text-lg font-serif font-semibold text-earth-800 mb-4">
              Recent Activity
            </h2>
            
            {mockFriendsActivity.map((activity) => (
              <button
                key={activity.id}
                onClick={() => handleActivityClick(activity)}
                className="w-full bg-white/90 backdrop-blur-glass rounded-2xl shadow-crystal border border-white/30 p-4 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 text-left"
              >
                <div className="flex items-start gap-3">
                  <img 
                    src={activity.user.avatar} 
                    alt={activity.user.name}
                    className="w-10 h-10 rounded-full object-cover border border-white shadow-sm"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-earth-800">{activity.user.name}</span>
                      <span className="text-earth-500">•</span>
                      <span className="text-earth-500 text-sm">{activity.timestamp}</span>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      {getActionIcon(activity.action)}
                      <div className="flex-1">
                        <p className="text-earth-700">
                          {activity.action === 'created' ? (
                            <>
                              <span className="font-medium">{getActionText(activity.action)}</span>
                              <span className="font-semibold text-earth-800"> "{activity.list}"</span>
                            </>
                          ) : (
                            <>
                              <span className="font-medium">{getActionText(activity.action)}</span>
                              <span className="font-semibold text-earth-800"> {activity.place}</span>
                            </>
                          )}
                        </p>
                        
                        {activity.action === 'created' && (
                          <p className="text-earth-600 text-sm mt-1">{activity.description}</p>
                        )}
                        
                        {activity.note && (
                          <p className="text-earth-600 text-sm mt-2 italic">
                            "{activity.note}"
                          </p>
                        )}
                        
                        {activity.placeImage && (
                          <img 
                            src={activity.placeImage} 
                            alt={activity.place}
                            className="w-full h-32 object-cover rounded-lg mt-3 shadow-sm"
                          />
                        )}
                        
                        {activity.list && activity.action !== 'created' && (
                          <div className="mt-2">
                            <span className="text-xs bg-warm-100 text-warm-600 px-2 py-1 rounded-full">
                              Saved to {activity.list}
                            </span>
                          </div>
                        )}
                        
                        {activity.action === 'created' && (
                          <div className="mt-2">
                            <span className="text-xs bg-sage-100 text-sage-600 px-2 py-1 rounded-full">
                              {activity.places} places
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          /* Discovery Tab */
          <div className="space-y-4">
            <h2 className="text-lg font-serif font-semibold text-earth-800 mb-4">
              Discover New Places
            </h2>
            
            {mockDiscovery.map((item) => (
              <button
                key={item.id}
                onClick={() => handleDiscoveryClick(item)}
                className="w-full bg-white/90 backdrop-blur-glass rounded-2xl shadow-crystal border border-white/30 overflow-hidden hover:shadow-xl hover:scale-[1.02] transition-all duration-300 text-left"
              >
                <div className="flex">
                  <img 
                    src={item.image} 
                    alt={item.title}
                    className="w-24 h-24 object-cover"
                  />
                  
                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-earth-800">{item.title}</h3>
                      {item.type === 'list' && (
                        <div className="flex items-center gap-1 text-warm-600">
                          <HeartIcon className="w-4 h-4" />
                          <span className="text-sm">{item.likes}</span>
                        </div>
                      )}
                    </div>
                    
                    <p className="text-earth-600 text-sm mb-3">{item.description}</p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-earth-500">by {item.owner}</span>
                        {item.type === 'list' && (
                          <span className="text-xs bg-sage-100 text-sage-600 px-2 py-0.5 rounded-full">
                            {item.places} places
                          </span>
                        )}
                        {item.type === 'hub' && (
                          <span className="text-xs bg-earth-100 text-earth-600 px-2 py-0.5 rounded-full">
                            {item.activity}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Home 