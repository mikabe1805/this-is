import React from 'react'
import type { TabType } from '../types/index.js'
import { useState } from 'react'
import { EllipsisHorizontalIcon, HeartIcon as HeartOutline, CheckCircleIcon, StarIcon, ClockIcon, BookmarkIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid'
import SearchBar from '../components/SearchBar'

function Collage({ images }: { images: string[] }) {
  if (!images.length) return (
    <div className="w-full h-40 bg-gradient-to-br from-coral-400 via-sage-200 to-coral-200 rounded-t-2xl flex items-center justify-center text-white text-sm font-medium shadow-inner">
      <div className="text-center">
        <div className="w-12 h-12 bg-gradient-to-br from-coral-300 to-sage-400 rounded-full mx-auto mb-2 flex items-center justify-center">
          <BookmarkIcon className="w-6 h-6 text-white" />
        </div>
        <span>No Image</span>
      </div>
    </div>
  )
  if (images.length === 1) return (
    <img src={images[0]} className="w-full h-40 rounded-t-2xl object-cover shadow-lg" alt="List collage" />
  )
  return (
    <div className="w-full h-40 grid grid-cols-2 grid-rows-2 gap-1 rounded-t-2xl overflow-hidden shadow-lg">
      {images.slice(0, 4).map((img, i) => (
        <img key={i} src={img} className="object-cover w-full h-full hover:scale-105 transition-transform duration-300" alt="List collage" />
      ))}
    </div>
  )
}

type StatusType = 'tried' | 'loved' | 'want';
const statusIcon: Record<StatusType, React.ReactElement> = {
  tried: <CheckCircleIcon className="w-5 h-5 text-white" />,
  loved: <StarIcon className="w-5 h-5 text-white" />,
  want: <ClockIcon className="w-5 h-5 text-white" />,
};

const statusColors: Record<StatusType, string> = {
  tried: 'bg-gradient-to-r from-sage-600 to-sage-500',
  loved: 'bg-gradient-to-r from-coral-600 to-coral-500',
  want: 'bg-gradient-to-r from-brown-600 to-brown-500',
};

const activityFeed = [
  {
    id: '1',
    type: 'save_place',
    user: {
      name: 'Emma',
      avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    },
    place: {
      name: 'Camino',
      image: 'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?w=300&h=200&fit=crop',
      tags: ['Vegetarian', 'Creative'],
    },
    toList: {
      name: 'Date Night Ideas',
      image: '',
      collage: [
        'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=300&h=200&fit=crop',
        'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?w=300&h=200&fit=crop',
        'https://images.unsplash.com/photo-1519125323398-675f0ddb6308?w=300&h=200&fit=crop',
        'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=300&h=200&fit=crop',
      ],
      owner: 'Emma',
    },
    fromList: {
      name: "Sophie’s San Francisco Eats",
      owner: 'Sophie',
    },
    status: 'loved',
    time: '4 hours ago',
    canSave: true,
    likes: 12,
    liked: false,
  },
  {
    id: '2',
    type: 'save_list',
    user: {
      name: 'Rami',
      avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    },
    toList: {
      name: 'Portland Gems',
      image: 'https://images.unsplash.com/photo-1519125323398-675f0ddb6308?w=300&h=200&fit=crop',
      collage: [],
      owner: 'Rami',
    },
    status: 'want',
    time: '1 day ago',
    canSave: true,
    likes: 7,
    liked: true,
  },
  {
    id: '3',
    type: 'add_list_to_list',
    user: {
      name: 'Sophie',
      avatar: 'https://randomuser.me/api/portraits/women/68.jpg',
    },
    toList: {
      name: 'Loved Recently',
      image: '',
      collage: [
        'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=300&h=200&fit=crop',
        'https://images.unsplash.com/photo-1519125323398-675f0ddb6308?w=300&h=200&fit=crop',
      ],
      owner: 'Sophie',
    },
    fromList: {
      name: 'NYC Coffee Spots',
      owner: 'Jess',
    },
    status: 'tried',
    time: '2 days ago',
    canSave: true,
    likes: 3,
    liked: false,
  },
  {
    id: '4',
    type: 'save_list',
    user: {
      name: 'Jess',
      avatar: 'https://randomuser.me/api/portraits/women/65.jpg',
    },
    toList: {
      name: 'NYC Coffee Spots',
      image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=300&h=200&fit=crop',
      collage: [],
      owner: 'Jess',
    },
    status: 'loved',
    time: 'yesterday',
    canSave: true,
    likes: 5,
    liked: false,
  },
]

const Home = () => {
  const [currentTab, setCurrentTab] = useState<TabType>('friends')
  const [feed, setFeed] = useState(activityFeed)
  
  // Update the parent's activeTab when currentTab changes
  React.useEffect(() => {
    // setActiveTab('home') // This line is removed as per the edit hint
  }, []) // Removed setActiveTab from dependency array
  
  // Use activeTab to determine if this is the active route

  const toggleLike = (id: string) => {
    setFeed(feed => feed.map(item => item.id === id ? { ...item, liked: !item.liked, likes: item.liked ? item.likes - 1 : item.likes + 1 } : item))
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-coral-50 via-cream-100 to-sage-50 bg-fixed">
      {/* SearchBar */}
      <div className="px-4 pt-4 pb-2 sticky top-0 z-20 bg-gradient-to-br from-coral-50 via-cream-100 to-sage-50 backdrop-blur-sm">
        <SearchBar placeholder="Search people, places, lists..." />
      </div>
      {/* Header */}
      <div className="px-6 pt-2 pb-2 flex items-center justify-between">
        <h1 className="text-3xl font-serif font-bold logo tracking-tight bg-gradient-to-r from-coral-600 via-brown-600 to-sage-600 bg-clip-text text-transparent drop-shadow-md">this.is</h1>
      </div>
      {/* Tab Navigation */}
      <div className="flex px-6 border-b border-coral-200 mb-2 bg-white/40 backdrop-blur-sm">
        {(['friends', 'discovery'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setCurrentTab(tab)}
            className={`flex-1 py-3 text-lg font-serif font-semibold transition-all duration-300 relative ${
              currentTab === tab
                ? 'text-coral-600 drop-shadow-md'
                : 'text-brown-400/80 hover:text-brown-600'
            }`}
          >
            {tab === 'friends' ? 'Friends' : 'Discovery'}
            {currentTab === tab && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-gradient-to-r from-coral-400 via-coral-500 to-sage-400 rounded-pill shadow-coral-200"></div>
            )}
          </button>
        ))}
      </div>
      {/* Friends Tab Content */}
      {currentTab === 'friends' && (
        <div className="px-2 pb-8 max-w-md mx-auto bg-gradient-to-br from-coral-100 via-cream-200 to-sage-100 rounded-2xl shadow-xl mt-2">
          <h2 className="text-lg font-serif font-semibold text-brown-700 mb-4 mt-4 flex items-center gap-2">
            <div className="w-2 h-2 bg-gradient-to-r from-coral-400 to-sage-400 rounded-full"></div>
            Recent Activity
          </h2>
          <div className="space-y-10">
            {feed.map((item) => (
              <div
                key={item.id}
                className="w-full bg-gradient-to-br from-coral-200 via-cream-200 to-sage-200 rounded-2xl shadow-xl border border-coral-300 flex flex-col relative overflow-hidden group hover:shadow-2xl hover:scale-[1.02] transition-all duration-300"
                tabIndex={0}
                style={{
                  boxShadow: '0 10px 25px -5px rgba(233, 160, 122, 0.15), 0 10px 10px -5px rgba(186, 200, 181, 0.10)',
                }}
              >
                {/* List image/collage at top */}
                <div className="relative">
                  {item.toList.image ? (
                    <img src={item.toList.image} alt={item.toList.name} className="w-full h-44 object-cover rounded-t-2xl shadow-lg" />
                  ) : (
                    <Collage images={item.toList.collage} />
                  )}
                  {/* Status icon top left */}
                  <div className={`absolute top-3 left-3 z-20 flex items-center gap-1 rounded-pill px-3 py-1 shadow-lg border-0 ${statusColors[item.status as StatusType]}`}>
                    {statusIcon[item.status as StatusType] ?? null}
                    <span className="text-xs font-bold capitalize text-white">{item.status}</span>
                  </div>
                  {/* Three dots menu */}
                  <button className="absolute top-3 right-3 bg-white/80 rounded-full p-2 shadow-lg hover:bg-coral-200 transition-colors z-10 border-0">
                    <EllipsisHorizontalIcon className="h-6 w-6 text-coral-600" />
                  </button>
                  {/* User avatar overlay */}
                  <img
                    src={item.user.avatar}
                    alt={item.user.name}
                    className="w-14 h-14 rounded-full border-3 border-white absolute left-4 -bottom-7 shadow-xl bg-cream-50 z-10"
                    style={{ boxShadow: '0 4px 12px 0 rgba(0,0,0,0.15)' }}
                  />
                  {/* Place image accent */}
                  {item.place && item.place.image && (
                    <img
                      src={item.place.image}
                      alt={item.place.name}
                      className="w-14 h-14 rounded-2xl object-cover border-3 border-white absolute right-4 -bottom-7 shadow-xl bg-cream-50 z-10"
                      style={{ boxShadow: '0 4px 12px 0 rgba(0,0,0,0.15)' }}
                    />
                  )}
                </div>
                <div className="pt-12 pb-6 px-4">
                  {/* Action text */}
                  <div className="text-brown-800 font-serif text-base mb-3 leading-relaxed">
                    {item.type === 'save_place' && (
                      <>
                        <span className="font-semibold text-coral-600">{item.user.name}</span> saved <span className="font-semibold text-sage-600">{item.place?.name}</span> to <span className="font-semibold text-coral-700">{item.toList.name}</span>
                        {item.fromList && (
                          <span className="text-brown-500/80"> (from <span className="font-semibold text-brown-600">{item.fromList.name}</span>)</span>
                        )}
                      </>
                    )}
                    {item.type === 'save_list' && (
                      <>
                        <span className="font-semibold text-coral-600">{item.user.name}</span> saved the list <span className="font-semibold text-sage-700">{item.toList.name}</span>
                      </>
                    )}
                    {item.type === 'add_list_to_list' && (
                      <>
                        <span className="font-semibold text-coral-600">{item.user.name}</span> added <span className="font-semibold text-coral-700">{item.fromList?.name}</span> to <span className="font-semibold text-sage-700">{item.toList.name}</span>
                      </>
                    )}
                  </div>
                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {item.place?.tags?.map((tag) => (
                      <button key={tag} className="px-3 py-1 rounded-pill bg-gradient-to-r from-coral-600 to-sage-600 text-white text-xs font-semibold shadow-sm hover:scale-105 hover:shadow-lg transition-all duration-200 focus:outline-none">
                        #{tag}
                      </button>
                    ))}
                  </div>
                  {/* Bottom row with time and action buttons */}
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-brown-500/80 font-medium">{item.time}</div>
                    <div className="flex items-center gap-3">
                      {/* Heart button with count */}
                      <button
                        className={`flex items-center gap-2 px-3 py-2 rounded-pill bg-gradient-to-r from-coral-500 to-coral-400 shadow-coral-200 hover:from-coral-600 hover:to-coral-500 transition-all duration-200 text-white font-bold border-0 ${item.liked ? 'scale-105' : ''}`}
                        onClick={() => toggleLike(item.id)}
                        title="Love"
                      >
                        {item.liked ? <HeartSolid className="w-5 h-5" /> : <HeartOutline className="w-5 h-5" />}
                        <span className="font-bold text-sm">{item.likes}</span>
                      </button>
                      {/* Save button */}
                      {item.canSave && (
                        <button className="flex items-center justify-center w-10 h-10 rounded-pill bg-gradient-to-r from-sage-500 to-sage-400 shadow-sage-200 hover:from-sage-600 hover:to-sage-500 transition-all duration-200 text-white border-0" title="Save">
                          <BookmarkIcon className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Discovery Tab Placeholder */}
      {currentTab === 'discovery' && (
        <div className="px-6 py-12 text-center text-brown-500/60 font-serif text-lg">Discovery coming soon…</div>
      )}
    </div>
  )
}

export default Home 