import { useState } from 'react'
import { ArrowLeftIcon, MagnifyingGlassIcon, UserIcon, MapPinIcon, HeartIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'

// SVG botanical accent
const BotanicalAccent = () => (
  <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute -top-6 -left-6 opacity-30 select-none pointer-events-none">
    <path d="M10 50 Q30 10 50 50" stroke="#A3B3A3" strokeWidth="3" fill="none"/>
    <ellipse cx="18" cy="38" rx="4" ry="8" fill="#C7D0C7"/>
    <ellipse cx="30" cy="28" rx="4" ry="8" fill="#A3B3A3"/>
    <ellipse cx="42" cy="38" rx="4" ry="8" fill="#7A927A"/>
  </svg>
)

interface FollowingUser {
  id: string
  name: string
  username: string
  avatar: string
  bio: string
  location: string
  tags: string[]
  isFollowing: boolean
  mutualFriends: number
  lastActive: string
}

const Following = () => {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'following' | 'friends' | 'followers'>('following')

  // Mock following data
  const [followingUsers, setFollowingUsers] = useState<FollowingUser[]>([
    {
      id: '1',
      name: 'Sara Chen',
      username: 'sara.chen',
      avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
      bio: 'Coffee enthusiast and urban explorer ☕️',
      location: 'San Francisco, CA',
      tags: ['coffee', 'urban-explorer', 'foodie'],
      isFollowing: true,
      mutualFriends: 12,
      lastActive: '2h ago'
    },
    {
      id: '2',
      name: 'Alex Rivera',
      username: 'alex.rivera',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
      bio: 'Finding the best tacos in the Bay Area 🌮',
      location: 'Oakland, CA',
      tags: ['tacos', 'bay-area', 'authentic'],
      isFollowing: true,
      mutualFriends: 8,
      lastActive: '1d ago'
    },
    {
      id: '3',
      name: 'Emma Thompson',
      username: 'emma.thompson',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      bio: 'Book lover and cozy cafe hunter 📚',
      location: 'Berkeley, CA',
      tags: ['books', 'cozy', 'cafes'],
      isFollowing: true,
      mutualFriends: 15,
      lastActive: '3h ago'
    },
    {
      id: '4',
      name: 'Marcus Johnson',
      username: 'marcus.johnson',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
      bio: 'Adventure seeker and outdoor enthusiast 🏔️',
      location: 'Marin County, CA',
      tags: ['outdoors', 'adventure', 'hiking'],
      isFollowing: true,
      mutualFriends: 5,
      lastActive: '5h ago'
    },
    {
      id: '5',
      name: 'Lily Zhang',
      username: 'lily.zhang',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
      bio: 'Plant-based foodie and sustainability advocate 🌱',
      location: 'San Francisco, CA',
      tags: ['vegan', 'sustainable', 'healthy'],
      isFollowing: true,
      mutualFriends: 20,
      lastActive: '1h ago'
    }
  ])

  const [followersUsers, setFollowersUsers] = useState<FollowingUser[]>([
    {
      id: '6',
      name: 'David Kim',
      username: 'david.kim',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
      bio: 'Tech enthusiast and coffee lover ☕',
      location: 'San Jose, CA',
      tags: ['tech', 'coffee', 'startups'],
      isFollowing: false,
      mutualFriends: 3,
      lastActive: '30m ago'
    },
    {
      id: '7',
      name: 'Sophia Rodriguez',
      username: 'sophia.rodriguez',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face',
      bio: 'Art lover and museum enthusiast 🎨',
      location: 'San Francisco, CA',
      tags: ['art', 'museums', 'culture'],
      isFollowing: false,
      mutualFriends: 7,
      lastActive: '4h ago'
    }
  ])

  // Determine mutual followers (friends)
  const followerIdSet = new Set(followersUsers.map(user => user.id))
  const friendsUsers = followingUsers.filter(user => followerIdSet.has(user.id))
  const followingOnlyUsers = followingUsers.filter(user => !followerIdSet.has(user.id))

  const currentUsers =
    activeTab === 'following'
      ? followingOnlyUsers
      : activeTab === 'friends'
      ? friendsUsers
      : followersUsers

  const filteredUsers = currentUsers.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.bio.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const handleUnfollow = (userId: string) => {
    // In a real app, this would make an API call
    console.log('Unfollowing user:', userId)
    // Update local state for immediate feedback
    setFollowingUsers(prev => prev.filter(user => user.id !== userId))
  }

  const handleFollow = (userId: string) => {
    // In a real app, this would make an API call
    console.log('Following user:', userId)
    // Update local state for immediate feedback
    setFollowersUsers(prev => prev.map(user => 
      user.id === userId ? { ...user, isFollowing: true } : user
    ))
  }

  return (
    <div className="relative min-h-full overflow-x-hidden bg-linen-50">
      {/* Enhanced background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-linen-texture opacity-80 mix-blend-multiply"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-gold-50/60 via-linen-100/80 to-sage-100/70 opacity-80"></div>
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-charcoal-900/10"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 p-4 border-b border-linen-200 bg-white/95 backdrop-blur-glass">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate('/profile')}
            className="p-2 rounded-xl bg-linen-100 text-charcoal-600 hover:bg-linen-200 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-serif font-semibold text-charcoal-800">Following</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-charcoal-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search following..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-linen-200 bg-linen-50 text-charcoal-700 focus:outline-none focus:ring-2 focus:ring-sage-200 focus:border-sage-300 transition-colors"
          />
        </div>

        {/* Tab Navigation */}
        <div className="flex mt-4 bg-linen-100 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('following')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              activeTab === 'following'
                ? 'bg-white text-sage-700 shadow-soft'
                : 'text-charcoal-600 hover:text-charcoal-800'
            }`}
          >
            Following ({followingOnlyUsers.length})
          </button>
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              activeTab === 'friends'
                ? 'bg-white text-sage-700 shadow-soft'
                : 'text-charcoal-600 hover:text-charcoal-800'
            }`}
          >
            Friends ({friendsUsers.length})
          </button>
          <button
            onClick={() => setActiveTab('followers')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              activeTab === 'followers'
                ? 'bg-white text-sage-700 shadow-soft'
                : 'text-charcoal-600 hover:text-charcoal-800'
            }`}
          >
            Followers ({followersUsers.length})
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 p-4 space-y-4 max-w-2xl mx-auto">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-linen-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserIcon className="w-8 h-8 text-charcoal-400" />
            </div>
            <h3 className="text-lg font-serif font-semibold text-charcoal-700 mb-2">
              {searchQuery ? 'No users found' : `No ${activeTab} yet`}
            </h3>
            <p className="text-charcoal-500">
              {searchQuery 
                ? 'Try adjusting your search terms'
                : activeTab === 'following' 
                  ? 'Start following people to see them here'
                  : activeTab === 'friends'
                    ? 'When you follow each other, you\'ll appear here as friends'
                    : 'When people follow you, they\'ll appear here'
              }
            </p>
          </div>
        ) : (
          filteredUsers.map((user) => (
            <div
              key={user.id}
              className="relative rounded-2xl shadow-botanical border border-linen-200 bg-white/95 p-4 transition hover:shadow-cozy hover:-translate-y-1"
            >
              <BotanicalAccent />
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-16 h-16 rounded-2xl border-2 border-linen-100 shadow-soft object-cover"
                  />
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-serif font-semibold text-charcoal-800 truncate">{user.name}</h3>
                      <p className="text-sm text-charcoal-500">@{user.username}</p>
                    </div>
                    <button
                      onClick={() => user.isFollowing ? handleUnfollow(user.id) : handleFollow(user.id)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                        user.isFollowing
                          ? 'bg-linen-100 text-charcoal-600 hover:bg-linen-200'
                          : 'bg-sage-500 text-white hover:bg-sage-600 shadow-soft'
                      }`}
                    >
                      {user.isFollowing ? 'Following' : 'Follow'}
                    </button>
                  </div>

                  <p className="text-sm text-charcoal-600 mb-2 line-clamp-2">{user.bio}</p>

                  {/* Location and Activity */}
                  <div className="flex items-center gap-4 text-xs text-charcoal-500 mb-3">
                    <div className="flex items-center gap-1">
                      <MapPinIcon className="w-3 h-3" />
                      {user.location}
                    </div>
                    <div className="flex items-center gap-1">
                      <HeartIcon className="w-3 h-3" />
                      {user.mutualFriends} mutual friends
                    </div>
                    <span>•</span>
                    <span>{user.lastActive}</span>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1">
                    {user.tags.slice(0, 3).map(tag => (
                      <span
                        key={tag}
                        className="px-2 py-1 rounded-full text-xs font-medium bg-sage-50 border border-sage-100 text-sage-700"
                      >
                        #{tag}
                      </span>
                    ))}
                    {user.tags.length > 3 && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-linen-100 text-charcoal-500">
                        +{user.tags.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default Following 