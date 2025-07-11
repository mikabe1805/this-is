import { useState } from 'react'
import { HeartIcon, BookmarkIcon, EyeIcon, PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid'

// Botanical SVG accent (eucalyptus branch)
const BotanicalAccent = () => (
  <svg width="80" height="80" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute -top-8 -left-8 opacity-30 select-none pointer-events-none">
    <path d="M10 50 Q30 10 50 50" stroke="#A3B3A3" strokeWidth="3" fill="none"/>
    <ellipse cx="18" cy="38" rx="4" ry="8" fill="#C7D0C7"/>
    <ellipse cx="30" cy="28" rx="4" ry="8" fill="#A3B3A3"/>
    <ellipse cx="42" cy="38" rx="4" ry="8" fill="#7A927A"/>
  </svg>
)

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
        return <HeartIconSolid className="w-5 h-5 text-sage-500" />
      case 'tried':
        return <BookmarkIcon className="w-5 h-5 text-gold-500" />
      case 'want':
        return <EyeIcon className="w-5 h-5 text-sage-400" />
      case 'created':
        return <PlusIcon className="w-5 h-5 text-gold-500" />
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
    <div className="min-h-full relative bg-linen-50">
      {/* Enhanced background: linen texture, sunlight gradient, vignette */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-linen-texture opacity-80 mix-blend-multiply"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-gold-50/60 via-linen-100/80 to-sage-100/70 opacity-80"></div>
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-charcoal-900/10"></div>
      </div>
      {/* Header */}
      <div className="relative z-10 p-8 pb-4 max-w-2xl mx-auto flex flex-col gap-2 overflow-visible">
        {/* Botanical SVG accent */}
        <BotanicalAccent />
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-serif font-extrabold text-charcoal-800 tracking-tight">
                This Is
              </h1>
              {/* Small leaf icon accent */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="ml-1 -mt-1">
                <path d="M4 20 Q12 4 20 20" stroke="#A3B3A3" strokeWidth="2" fill="none"/>
                <ellipse cx="8" cy="15" rx="2" ry="4" fill="#C7D0C7"/>
                <ellipse cx="16" cy="15" rx="2" ry="4" fill="#A3B3A3"/>
              </svg>
            </div>
            <p className="text-sage-700 text-base mt-1">
              Your personal memory journal
            </p>
          </div>
          <button className="w-12 h-12 bg-gradient-to-r from-sage-400 to-gold-300 rounded-full flex items-center justify-center text-white shadow-botanical hover:shadow-cozy transition-all duration-300">
            <PlusIcon className="w-6 h-6" />
          </button>
        </div>
        {/* Search Bar */}
        <div className="relative mb-6">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-sage-400" />
          <input
            type="text"
            placeholder="Search places, lists, or friends..."
            className="w-full pl-12 pr-4 py-3 bg-white/90 rounded-xl border border-linen-200 focus:outline-none focus:ring-2 focus:ring-sage-200 focus:border-transparent shadow-soft text-charcoal-700"
          />
        </div>
        {/* Tab Navigation */}
        <div className="flex bg-white/80 rounded-xl p-1 mb-6 shadow-soft">
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-200 ${
              activeTab === 'friends'
                ? 'bg-gradient-to-r from-sage-400 to-gold-300 text-white shadow-botanical'
                : 'text-sage-700 hover:text-sage-900'
            }`}
          >
            Friends
          </button>
          <button
            onClick={() => setActiveTab('discovery')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-200 ${
              activeTab === 'discovery'
                ? 'bg-gradient-to-r from-sage-400 to-gold-300 text-white shadow-botanical'
                : 'text-sage-700 hover:text-sage-900'
            }`}
          >
            Discovery
          </button>
        </div>
      </div>
      {/* Content */}
      <div className="relative z-10 px-8 pb-8 max-w-2xl mx-auto">
        {activeTab === 'friends' ? (
          /* Friends Tab */
          <div className="space-y-6">
            <h2 className="text-xl font-serif font-semibold text-charcoal-700 mb-4">
              Recent Activity
            </h2>
            {mockFriendsActivity.map((activity) => (
              <button
                key={activity.id}
                onClick={() => handleActivityClick(activity)}
                className="w-full bg-white/98 rounded-2xl shadow-botanical border border-linen-200 p-5 hover:shadow-cozy hover:-translate-y-1 transition-all duration-300 text-left flex flex-col gap-2 overflow-hidden"
              >
                <div className="flex items-start gap-4">
                  <img 
                    src={activity.user.avatar} 
                    alt={activity.user.name}
                    className="w-12 h-12 rounded-xl object-cover border-2 border-white shadow-soft"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-charcoal-800">{activity.user.name}</span>
                      <span className="text-sage-400">•</span>
                      <span className="text-sage-500 text-sm">{activity.timestamp}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      {getActionIcon(activity.action)}
                      <div className="flex-1">
                        <p className="text-sage-900">
                          {activity.action === 'created' ? (
                            <>
                              <span className="font-medium">{getActionText(activity.action)}</span>
                              <span className="font-semibold text-charcoal-800"> "{activity.list}"</span>
                            </>
                          ) : (
                            <>
                              <span className="font-medium">{getActionText(activity.action)}</span>
                              <span className="font-semibold text-charcoal-800"> {activity.place}</span>
                            </>
                          )}
                        </p>
                        {activity.action === 'created' && (
                          <p className="text-sage-700 text-sm mt-1">{activity.description}</p>
                        )}
                        {activity.note && (
                          <p className="text-sage-700 text-sm mt-2 italic">
                            "{activity.note}"
                          </p>
                        )}
                        {activity.placeImage && (
                          <img 
                            src={activity.placeImage} 
                            alt={activity.place}
                            className="w-full h-32 object-cover rounded-lg mt-3 shadow-soft"
                          />
                        )}
                        {activity.list && activity.action !== 'created' && (
                          <div className="mt-2">
                            <span className="text-xs bg-linen-100 text-sage-700 px-2 py-1 rounded-full">
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
          <div className="space-y-6">
            <h2 className="text-xl font-serif font-semibold text-charcoal-700 mb-4">
              Discover New Places
            </h2>
            {mockDiscovery.map((item) => (
              <button
                key={item.id}
                onClick={() => handleDiscoveryClick(item)}
                className="w-full bg-white/98 rounded-2xl shadow-botanical border border-linen-200 overflow-hidden hover:shadow-cozy hover:-translate-y-1 transition-all duration-300 text-left flex flex-col md:flex-row gap-0"
              >
                <img 
                  src={item.image} 
                  alt={item.title}
                  className="w-full md:w-32 h-32 object-cover md:rounded-l-2xl"
                />
                <div className="flex-1 p-5 flex flex-col justify-between">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-serif font-semibold text-lg text-charcoal-800">{item.title}</h3>
                    {item.type === 'list' && (
                      <div className="flex items-center gap-1 text-sage-700">
                        <HeartIcon className="w-4 h-4" />
                        <span className="text-sm">{item.likes}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-sage-700 text-sm mb-3">{item.description}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.owner && (
                      <span className="text-xs text-sage-500">by {item.owner}</span>
                    )}
                    {item.type === 'list' && (
                      <span className="text-xs bg-sage-100 text-sage-600 px-2 py-0.5 rounded-full">
                        {item.places} places
                      </span>
                    )}
                    {item.type === 'hub' && (
                      <span className="text-xs bg-gold-100 text-gold-700 px-2 py-0.5 rounded-full">
                        {item.activity}
                      </span>
                    )}
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