import type { Place, Post, Tag } from '../types/index.js'
import { MapPinIcon, HeartIcon, BookmarkIcon, PlusIcon, ShareIcon, CameraIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline'

const PlaceHub = () => {
  // Mock place data
  const place: Place = {
    id: '1',
    name: 'Blue Bottle Coffee',
    address: '300 Webster St, Oakland, CA',
    coordinates: { lat: 37.7749, lng: -122.4194 },
    category: 'Coffee Shop',
    tags: ['coffee', 'cozy', 'work-friendly', 'artisan', 'oakland'],
    hubImage: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop',
    posts: [],
    savedCount: 45,
    createdAt: '2024-01-15'
  }

  const posts: Post[] = [
    {
      id: '1',
      placeId: '1',
      userId: '1',
      user: {
        id: '1',
        name: 'Sara Chen',
        username: 'sara.chen',
        avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face'
      },
      image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300&h=200&fit=crop',
      note: 'Perfect spot for morning meetings! The oat milk latte is incredible and the atmosphere is so cozy.',
      tags: ['cozy', 'work-friendly', 'great-coffee'],
      likes: 12,
      createdAt: '2024-01-15T10:30:00Z'
    },
    {
      id: '2',
      placeId: '1',
      userId: '2',
      user: {
        id: '2',
        name: 'Alex Rivera',
        username: 'alex.rivera',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'
      },
      note: 'Love the pour-over coffee here. Great place to work remotely.',
      tags: ['pour-over', 'remote-work', 'quiet'],
      likes: 8,
      createdAt: '2024-01-14T15:20:00Z'
    }
  ]

  const topTags: Tag[] = [
    { name: 'cozy', count: 23, isTop: true },
    { name: 'work-friendly', count: 18, isTop: true },
    { name: 'great-coffee', count: 15, isTop: true },
    { name: 'artisan', count: 12, isTop: false },
    { name: 'quiet', count: 10, isTop: false },
    { name: 'oakland', count: 8, isTop: false }
  ]

  return (
    <div className="min-h-full bg-gradient-to-br from-cream-50 to-coral-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-cream-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-sage-800">Place</h1>
          <div className="flex items-center space-x-2">
            <button className="w-10 h-10 bg-gradient-to-br from-coral-100 to-coral-200 rounded-full flex items-center justify-center shadow-soft">
              <ShareIcon className="w-5 h-5 text-coral-600" />
            </button>
            <button className="w-10 h-10 bg-gradient-to-br from-coral-100 to-coral-200 rounded-full flex items-center justify-center shadow-soft">
              <BookmarkIcon className="w-5 h-5 text-coral-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Place Header */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl overflow-hidden shadow-soft border border-cream-200">
          {place.hubImage && (
            <div className="h-48 bg-gradient-to-br from-cream-200 to-coral-200 relative">
              <img
                src={place.hubImage}
                alt={place.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/20"></div>
            </div>
          )}
          <div className="p-6">
            <h2 className="text-2xl font-bold text-sage-800 mb-2">{place.name}</h2>
            <div className="flex items-center text-sage-600 text-sm mb-3">
              <MapPinIcon className="w-4 h-4 mr-1" />
              {place.address}
            </div>
            {place.category && (
              <p className="text-sage-600 text-sm mb-4">{place.category}</p>
            )}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4 text-sm text-sage-600">
                <span className="flex items-center">
                  <HeartIcon className="w-4 h-4 mr-1" />
                  {place.savedCount} saved
                </span>
                <span>•</span>
                <span>{posts.length} posts</span>
              </div>
              <button className="bg-gradient-to-r from-coral-500 to-coral-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:from-coral-600 hover:to-coral-700 transition-all duration-300 shadow-soft">
                Save to List
              </button>
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-cream-200">
          <h3 className="text-lg font-semibold text-sage-800 mb-3">What people are saying</h3>
          <div className="flex flex-wrap gap-2">
            {topTags.map((tag) => (
              <span
                key={tag.name}
                className={`px-3 py-1 text-sm rounded-full transition-all duration-300 ${
                  tag.isTop
                    ? 'bg-coral-500 text-white font-medium shadow-soft'
                    : 'bg-cream-100 text-sage-700 opacity-70'
                }`}
              >
                {tag.name} ({tag.count})
              </span>
            ))}
          </div>
        </div>

        {/* Posts */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-sage-800">Posts</h3>
            <button className="bg-gradient-to-r from-coral-500 to-coral-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:from-coral-600 hover:to-coral-700 transition-all duration-300 shadow-soft">
              <PlusIcon className="w-4 h-4 mr-1 inline" />
              Add Post
            </button>
          </div>
          <div className="space-y-4">
            {posts.map((post) => (
              <div
                key={post.id}
                className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-cream-200 hover:shadow-liquid transition-all duration-300"
              >
                <div className="flex items-start space-x-3 mb-3">
                  {post.user.avatar ? (
                    <img
                      src={post.user.avatar}
                      alt={post.user.name}
                      className="w-10 h-10 rounded-full object-cover border-2 border-cream-200"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-gradient-to-br from-sage-100 to-sage-200 rounded-full flex items-center justify-center">
                      <span className="text-sage-600 font-medium">{post.user.name.charAt(0)}</span>
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-sage-800">{post.user.name}</span>
                      <span className="text-sage-500 text-sm">@{post.user.username}</span>
                    </div>
                    <p className="text-xs text-sage-500">
                      {new Date(post.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {post.image && (
                  <div className="mb-3">
                    <img
                      src={post.image}
                      alt="Post"
                      className="w-full h-48 object-cover rounded-xl"
                    />
                  </div>
                )}

                {post.note && (
                  <p className="text-sage-700 mb-3">{post.note}</p>
                )}

                <div className="flex flex-wrap gap-1 mb-3">
                  {post.tags.map((tag) => (
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
                    <button className="flex items-center hover:text-coral-600 transition-colors">
                      <HeartIcon className="w-4 h-4 mr-1" />
                      {post.likes}
                    </button>
                    <button className="flex items-center hover:text-coral-600 transition-colors">
                      <ChatBubbleLeftIcon className="w-4 h-4 mr-1" />
                      Reply
                    </button>
                  </div>
                  <button className="text-coral-600 hover:text-coral-700 text-sm font-medium transition-colors">
                    Save
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Empty State for Posts */}
        {posts.length === 0 && (
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 text-center shadow-soft border border-cream-200">
            <CameraIcon className="w-16 h-16 text-sage-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-sage-800 mb-2">No posts yet</h3>
            <p className="text-sage-600 mb-4">Be the first to share your experience at this place</p>
            <button className="bg-gradient-to-r from-coral-500 to-coral-600 text-white px-6 py-3 rounded-xl font-medium hover:from-coral-600 hover:to-coral-700 transition-all duration-300 shadow-soft">
              Add Your First Post
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default PlaceHub 