import type { Activity } from '../types/index.js'
import { HeartIcon, BookmarkIcon, PlusIcon, UserIcon } from '@heroicons/react/24/outline'

const FriendsTab = () => {
  // Mock data - in real app this would come from API
  const mockActivities: Activity[] = [
    {
      id: '1',
      type: 'save',
      userId: '1',
      user: {
        id: '1',
        name: 'Sara Chen',
        username: 'sara.chen',
        avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face'
      },
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
      listId: '1',
      list: {
        id: '1',
        name: 'Oakland Coffee Spots',
        userId: '1',
        isPublic: true,
        isShared: false,
        tags: ['coffee', 'oakland'],
        places: [],
        createdAt: '2024-01-10',
        updatedAt: '2024-01-15'
      },
      createdAt: '2024-01-15T10:30:00Z'
    },
    {
      id: '2',
      type: 'post',
      userId: '2',
      user: {
        id: '2',
        name: 'Alex Rivera',
        username: 'alex.rivera',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'
      },
      placeId: '2',
      place: {
        id: '2',
        name: 'Tacos El Gordo',
        address: '123 Mission St, San Francisco, CA',
        tags: ['tacos', 'authentic', 'quick'],
        posts: [],
        savedCount: 23,
        createdAt: '2024-01-14'
      },
      createdAt: '2024-01-15T09:15:00Z'
    }
  ]

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'save':
        return <BookmarkIcon className="w-5 h-5 text-coral-600" />
      case 'like':
        return <HeartIcon className="w-5 h-5 text-coral-600" />
      case 'post':
        return <PlusIcon className="w-5 h-5 text-sage-600" />
      case 'create_list':
        return <BookmarkIcon className="w-5 h-5 text-sage-600" />
      default:
        return <UserIcon className="w-5 h-5 text-sage-600" />
    }
  }

  const getActivityText = (activity: Activity) => {
    switch (activity.type) {
      case 'save':
        return `saved ${activity.place?.name} to ${activity.list?.name}`
      case 'like':
        return `liked ${activity.place?.name}`
      case 'post':
        return `posted about ${activity.place?.name}`
      case 'create_list':
        return `created ${activity.list?.name}`
      default:
        return 'did something'
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return `${Math.floor(diffInMinutes / 1440)}d ago`
  }

  return (
    <div className="p-4 space-y-4">
      {mockActivities.map((activity) => (
        <div
          key={activity.id}
          className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-cream-200 hover:shadow-liquid transition-all duration-300"
        >
          <div className="flex items-start space-x-3">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {activity.user.avatar ? (
                <img
                  src={activity.user.avatar}
                  alt={activity.user.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-cream-200"
                />
              ) : (
                <div className="w-12 h-12 bg-gradient-to-br from-sage-100 to-sage-200 rounded-full flex items-center justify-center">
                  <UserIcon className="w-6 h-6 text-sage-600" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <span className="font-semibold text-sage-800">{activity.user.name}</span>
                <span className="text-sage-500 text-sm">{getActivityText(activity)}</span>
              </div>
              
              {activity.place && (
                <div className="bg-cream-50 rounded-xl p-3 mb-2">
                  <h4 className="font-medium text-sage-800 mb-1">{activity.place.name}</h4>
                  <p className="text-sm text-sage-600 mb-2">{activity.place.address}</p>
                  <div className="flex flex-wrap gap-1">
                    {activity.place.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-coral-100 text-coral-700 text-xs rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {getActivityIcon(activity.type)}
                  <span className="text-xs text-sage-500">{formatTimeAgo(activity.createdAt)}</span>
                </div>
                
                <button className="text-coral-600 hover:text-coral-700 text-sm font-medium transition-colors">
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default FriendsTab 