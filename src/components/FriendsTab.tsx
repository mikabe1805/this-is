import type { Activity } from '../types/index.js'
import { HeartIcon, BookmarkIcon, PlusIcon, UserIcon } from '@heroicons/react/24/outline'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext.tsx'
import { firebaseDataService } from '../services/firebaseDataService.js'

const FriendsTab = () => {
  const { currentUser: authUser } = useAuth()
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Load real friends activity data
  useEffect(() => {
    const loadFriendsActivity = async () => {
      if (!authUser) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError('')
        
        // Get user's friends
        const friends = await firebaseDataService.getUserFriends(authUser.uid)
        
        // Get activity from friends
        const allActivities: Activity[] = []
        for (const friend of friends) {
          const friendActivity = await firebaseDataService.getUserActivity(friend.id, 10)
          allActivities.push(...friendActivity)
        }
        
        // Sort by most recent
        allActivities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        
        setActivities(allActivities.slice(0, 20)) // Show latest 20 activities
      } catch (error) {
        console.error('Error loading friends activity:', error)
        setError('Failed to load friends activity')
        // Fallback to empty array for now
        setActivities([])
      } finally {
        setLoading(false)
      }
    }

    loadFriendsActivity()
  }, [authUser])



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

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="text-center py-8">
          <div className="animate-spin h-8 w-8 border-2 border-sage-300 border-t-sage-600 rounded-full mx-auto mb-4"></div>
          <p className="text-sage-600">Loading friends activity...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 space-y-4">
        <div className="text-center py-8">
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="p-4 space-y-4">
        <div className="text-center py-8">
          <UserIcon className="w-12 h-12 text-sage-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-sage-700 mb-2">No Friends Activity Yet</h3>
          <p className="text-sage-500 mb-4">Follow some friends to see their activity here!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-cream-200 hover:shadow-liquid transition-all duration-300"
        >
          <div className="flex items-start space-x-3">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {activity.user.avatar ? (
                <div className="w-12 h-12 rounded-full border-2 border-cream-200 bg-cream-50/80 backdrop-blur-sm relative overflow-hidden">
                  <img
                    src={activity.user.avatar}
                    alt={activity.user.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 border border-white/30 rounded-full"></div>
                </div>
              ) : (
                <div className="w-12 h-12 bg-gradient-to-br from-sage-100 to-sage-200 rounded-full flex items-center justify-center border-2 border-cream-200">
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