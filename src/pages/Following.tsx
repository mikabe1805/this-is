import { useState, useEffect } from 'react'
import { ArrowLeftIcon, MagnifyingGlassIcon, UserIcon, MapPinIcon, HeartIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.js'
import { firebaseDataService } from '../services/firebaseDataService.js'
import type { User } from '../types/index.js'

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

  const { currentUser: authUser } = useAuth()
  const [followingUsers, setFollowingUsers] = useState<User[]>([])
  const [followersUsers, setFollowersUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      if (authUser) {
        setLoading(true)
        const [following, followers] = await Promise.all([
          firebaseDataService.getUserFollowing(authUser.id),
          firebaseDataService.getFollowers(authUser.id)
        ]);
        setFollowingUsers(following);
        setFollowersUsers(followers);
        setLoading(false)
      }
    }
    fetchData()
  }, [authUser])

  const handleUnfollow = async (userId: string) => {
    if (!authUser) return;
    try {
      await firebaseDataService.unfollowUser(authUser.id, userId);
      // Refetch data to confirm the change
      const following = await firebaseDataService.getUserFollowing(authUser.id);
      setFollowingUsers(following);
      console.log(`Unfollowed user ${userId}`);
    } catch (error) {
      console.error('Error unfollowing user:', error);
    }
  }

  const handleFollow = async (userId: string) => {
    if (!authUser) return;
    try {
      await firebaseDataService.followUser(authUser.id, userId);
      // Refetch data to confirm the change
      const following = await firebaseDataService.getUserFollowing(authUser.id);
      setFollowingUsers(following);
      console.log(`Followed user ${userId}`);
    } catch (error) {
      console.error('Error following user:', error);
    }
  }

  if (loading) {
    return <div>Loading...</div>; // Or a proper loading spinner
  }
  
  // Determine mutual followers (friends)
  const followerIdSet = new Set(followersUsers.map(user => user.id))
  const friendsUsers = followingUsers.filter(user => followerIdSet.has(user.id))
  const followingOnlyUsers = followingUsers.filter(user => !followerIdSet.has(user.id))

  const isFollowing = (userId: string) => {
    return followingUsers.some(u => u.id === userId);
  }

  const currentUsers =
    activeTab === 'following'
      ? followingOnlyUsers
      : activeTab === 'friends'
      ? friendsUsers
      : followersUsers
  
  const filteredUsers = currentUsers.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.bio && user.bio.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (user.tags && user.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))
  )


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
                      onClick={() => isFollowing(user.id) ? handleUnfollow(user.id) : handleFollow(user.id)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                        isFollowing(user.id)
                          ? 'bg-linen-100 text-charcoal-600 hover:bg-linen-200'
                          : 'bg-sage-500 text-white hover:bg-sage-600 shadow-soft'
                      }`}
                    >
                      {isFollowing(user.id) ? 'Following' : 'Follow'}
                    </button>
                  </div>

                  <p className="text-sm text-charcoal-600 mb-2 line-clamp-2">{user.bio}</p>

                  {/* Location and Activity */}


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