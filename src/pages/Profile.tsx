import type { User, List, Activity } from '../types/index.js'
import { UserIcon, BookmarkIcon, HeartIcon, PlusIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'

const Profile = () => {
  // Mock user data
  const currentUser: User = {
    id: '1',
    name: 'Mika Chen',
    username: 'mika.chen',
    avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
    bio: 'Finding cozy spots and sharing them with friends ✨',
    location: 'San Francisco, CA'
  }

  const userLists: List[] = [
    {
      id: '1',
      name: 'Cozy Coffee Spots',
      description: 'Perfect places to work and relax',
      userId: '1',
      isPublic: true,
      isShared: false,
      tags: ['coffee', 'work-friendly', 'cozy'],
      places: [],
      coverImage: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300&h=200&fit=crop',
      createdAt: '2024-01-10',
      updatedAt: '2024-01-15'
    },
    {
      id: '2',
      name: 'Hidden Gems',
      description: 'Local favorites that tourists don\'t know about',
      userId: '1',
      isPublic: true,
      isShared: false,
      tags: ['local', 'hidden-gems', 'authentic'],
      places: [],
      coverImage: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=300&h=200&fit=crop',
      createdAt: '2024-01-12',
      updatedAt: '2024-01-14'
    }
  ]

  const recentActivity: Activity[] = [
    {
      id: '1',
      type: 'save',
      userId: '1',
      user: currentUser,
      placeId: '1',
      place: {
        id: '1',
        name: 'Blue Bottle Coffee',
        address: '300 Webster St, Oakland, CA',
        tags: ['coffee', 'cozy'],
        posts: [],
        savedCount: 45,
        createdAt: '2024-01-15'
      },
      listId: '1',
      list: userLists[0],
      createdAt: '2024-01-15T10:30:00Z'
    }
  ]

  return (
    <div className="min-h-full bg-gradient-to-br from-cream-50 to-coral-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-cream-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-sage-800">Profile</h1>
          <button className="w-10 h-10 bg-gradient-to-br from-sage-100 to-sage-200 rounded-full flex items-center justify-center shadow-soft">
            <Cog6ToothIcon className="w-5 h-5 text-sage-600" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* User Info */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-soft border border-cream-200">
          <div className="flex items-center space-x-4 mb-4">
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-20 h-20 rounded-full object-cover border-4 border-cream-200"
              />
            ) : (
              <div className="w-20 h-20 bg-gradient-to-br from-sage-100 to-sage-200 rounded-full flex items-center justify-center border-4 border-cream-200">
                <UserIcon className="w-10 h-10 text-sage-600" />
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-xl font-bold text-sage-800">{currentUser.name}</h2>
              <p className="text-sage-600">@{currentUser.username}</p>
              {currentUser.location && (
                <p className="text-sm text-sage-500">{currentUser.location}</p>
              )}
            </div>
          </div>
          {currentUser.bio && (
            <p className="text-sage-700 mb-4">{currentUser.bio}</p>
          )}
          <div className="flex space-x-4 text-sm">
            <div className="text-center">
              <div className="font-semibold text-sage-800">12</div>
              <div className="text-sage-600">Lists</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-sage-800">89</div>
              <div className="text-sage-600">Places</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-sage-800">156</div>
              <div className="text-sage-600">Followers</div>
            </div>
          </div>
        </div>

        {/* Most Popular Lists */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-sage-800">Most Popular Lists</h3>
            <button className="text-coral-600 hover:text-coral-700 text-sm font-medium transition-colors">
              View All
            </button>
          </div>
          <div className="space-y-3">
            {userLists.map((list) => (
              <div
                key={list.id}
                className="bg-white/70 backdrop-blur-sm rounded-2xl overflow-hidden shadow-soft border border-cream-200 hover:shadow-liquid transition-all duration-300"
              >
                {list.coverImage && (
                  <div className="h-24 bg-gradient-to-br from-cream-200 to-coral-200 relative">
                    <img
                      src={list.coverImage}
                      alt={list.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/10"></div>
                  </div>
                )}
                <div className="p-4">
                  <h4 className="font-semibold text-sage-800 mb-1">{list.name}</h4>
                  <p className="text-sm text-sage-600 mb-2">{list.description}</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {list.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-coral-100 text-coral-700 text-xs rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-sage-500">Updated {new Date(list.updatedAt).toLocaleDateString()}</span>
                    <button className="text-coral-600 hover:text-coral-700 text-sm font-medium transition-colors">
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h3 className="text-lg font-semibold text-sage-800 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-cream-200"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-coral-100 to-coral-200 rounded-full flex items-center justify-center">
                    <BookmarkIcon className="w-5 h-5 text-coral-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-sage-700">
                      Saved <span className="font-medium">{activity.place?.name}</span> to{' '}
                      <span className="font-medium">{activity.list?.name}</span>
                    </p>
                    <p className="text-xs text-sage-500">
                      {new Date(activity.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-gradient-to-br from-sage-50 to-sage-100 rounded-2xl p-4">
          <h3 className="font-semibold text-sage-800 mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <button className="bg-white/80 backdrop-blur-sm rounded-xl p-3 text-center hover:bg-white transition-all duration-300 shadow-soft">
              <PlusIcon className="w-6 h-6 text-coral-600 mx-auto mb-2" />
              <span className="text-sm font-medium text-sage-800">New List</span>
            </button>
            <button className="bg-white/80 backdrop-blur-sm rounded-xl p-3 text-center hover:bg-white transition-all duration-300 shadow-soft">
              <HeartIcon className="w-6 h-6 text-sage-600 mx-auto mb-2" />
              <span className="text-sm font-medium text-sage-800">Saved Places</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile 